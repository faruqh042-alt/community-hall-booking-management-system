require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const readline = require('readline');
const { pool } = require('../db');

const OWNER_EMAIL = 'faruqh042@gmail.com';
const CODE_TTL_MS = 10 * 60 * 1000;

function promptSecret(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Owner setup must be run in an interactive terminal.');
  }

  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    const wasRaw = input.isRaw;
    output.write(`${label}: `);
    input.setRawMode(true);
    input.resume();

    let value = '';
    const onData = (chunk) => {
      const key = chunk.toString('utf8');
      if (key === '\u0003') {
        cleanup();
        output.write('\n');
        reject(new Error('Owner setup cancelled.'));
      } else if (key === '\r' || key === '\n') {
        cleanup();
        output.write('\n');
        resolve(value);
      } else if (key === '\u007f' || key === '\b') {
        value = value.slice(0, -1);
      } else if (key.length === 1 && key >= ' ') {
        value += key;
      }
    };

    function cleanup() {
      input.removeListener('data', onData);
      input.setRawMode(wasRaw);
    }
    input.on('data', onData);
  });
}

async function initializeOwner() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Owner setup must be run in an interactive terminal.');
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Configure EMAIL_USER and EMAIL_PASS before initializing the owner account.');
  }

  const code = crypto.randomBytes(5).toString('hex').toUpperCase();
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE !== 'false',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  await transporter.sendMail({
    from: `"Community Hall Booking" <${process.env.EMAIL_USER}>`,
    to: OWNER_EMAIL,
    subject: 'Verify your Community Hall owner account',
    text: `Your one-time owner initialization code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`
  });
  console.log(`A one-time verification code was sent to ${OWNER_EMAIL}.`);

  const expiresAt = Date.now() + CODE_TTL_MS;
  let verified = false;
  for (let attempt = 0; attempt < 5 && Date.now() < expiresAt; attempt++) {
    const entered = await promptSecret('Email verification code');
    const supplied = Buffer.from(entered.trim().toUpperCase());
    const expected = Buffer.from(code);
    if (supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected)) {
      verified = true;
      break;
    }
    console.error('That code is not valid.');
  }
  if (!verified || Date.now() >= expiresAt) throw new Error('Owner email verification failed or expired.');

  const name = (await promptSecret('Owner name')).trim();
  const password = await promptSecret('New owner password (minimum 12 characters)');
  if (!name || name.length > 100 || password.length < 12) {
    throw new Error('Enter a name of 1–100 characters and a password of at least 12 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [owners] = await connection.query(
      'SELECT id FROM users WHERE role = ? FOR UPDATE',
      ['owner']
    );
    if (owners.length > 0) {
      throw new Error('An owner account is already initialized. Contact the existing owner.');
    }

    const [accounts] = await connection.query(
      'SELECT id FROM users WHERE email = ? FOR UPDATE',
      [OWNER_EMAIL]
    );
    if (accounts.length > 0) {
      const ownerId = accounts[0].id;
      await connection.query('DELETE FROM manager_halls WHERE manager_id = ?', [ownerId]);
      await connection.query(
        `UPDATE users SET name = ?, password = ?, role = 'owner',
         is_active = 1, email_verified_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [name, passwordHash, ownerId]
      );
    } else {
      await connection.query(
        `INSERT INTO users (name, email, password, role, is_active, email_verified_at)
         VALUES (?, ?, ?, 'owner', 1, CURRENT_TIMESTAMP)`,
        [name, OWNER_EMAIL, passwordHash]
      );
    }
    await connection.commit();
    console.log('Owner account initialized. Sign in using the verified mailbox and the new password.');
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

initializeOwner()
  .catch((err) => {
    console.error('Owner initialization failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
