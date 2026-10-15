// utils/mailer.js
// Sends an email to the site owner (ADMIN_EMAIL in .env) every time a
// customer creates a new booking. Uses nodemailer with a normal SMTP
// account (Gmail by default — see README.md "Setting Up Booking Emails").
//
// IMPORTANT: This is intentionally "fire and forget" from the caller's
// point of view — see bookingController.js, which wraps the call in a
// try/catch so that a broken mail server NEVER blocks or fails a booking.
// The booking is the important part; the email is a nice-to-have.

const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // If email isn't configured at all, don't crash — just skip sending.
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE !== 'false', // true = SSL on port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  return transporter;
}

// Called after a booking is successfully inserted into the database.
async function sendBookingNotification({ userName, userEmail, hallName, date, timeSlot, price }) {
  const t = getTransporter();
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!t || !adminEmail) {
    console.log('ℹ️  Email not configured (EMAIL_USER/EMAIL_PASS/ADMIN_EMAIL missing) — skipping notification email.');
    return;
  }

  const subject = `🏛️ New Hall Booking: ${hallName} on ${date}`;

  const html = `
    <div style="font-family: Arial, sans-serif; background:#F0F7FF; color:#172554; padding:24px; border-radius:12px; border:1px solid #E2E8F0;">
      <h2 style="color:#2563EB; margin-top:0;">New Booking Request</h2>
      <p>A new booking has just been submitted and is waiting for your approval.</p>
      <table style="width:100%; border-collapse:collapse; margin-top:16px;">
        <tr><td style="padding:6px 0; color:#64748B;">Hall</td><td style="padding:6px 0;"><b>${escapeHtml(hallName)}</b></td></tr>
        <tr><td style="padding:6px 0; color:#64748B;">Date</td><td style="padding:6px 0;">${escapeHtml(date)}</td></tr>
        <tr><td style="padding:6px 0; color:#64748B;">Time Slot</td><td style="padding:6px 0;">${escapeHtml(timeSlot)}</td></tr>
        <tr><td style="padding:6px 0; color:#64748B;">Price</td><td style="padding:6px 0;">₹${price}</td></tr>
        <tr><td style="padding:6px 0; color:#64748B;">Booked By</td><td style="padding:6px 0;">${escapeHtml(userName)} (${escapeHtml(userEmail)})</td></tr>
      </table>
      <p style="margin-top:20px;">Log in to the Admin Dashboard to approve or reject this booking.</p>
    </div>
  `;

  try {
    await t.sendMail({
      from: `"Community Hall Booking Management System" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject,
      html
    });
    console.log(`✅ Booking notification email sent to ${adminEmail}`);
  } catch (err) {
    // Never let an email failure break the booking flow — just log it.
    console.error('⚠️  Failed to send booking notification email:', err.message);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { sendBookingNotification };
