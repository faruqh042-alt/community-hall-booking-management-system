const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'unit-test-secret-that-is-not-used-outside-tests';

const databasePath = require.resolve('../db');
require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: { pool: { query: async () => [[{ ...currentUser }]] } }
};

let currentUser = {
  id: 12,
  name: 'Test Account',
  email: 'user@example.com',
  role: 'user',
  is_active: 1
};

const { verifyToken, isOwner, isManager } = require('../middleware/auth');

function requestFor(role = currentUser.role) {
  return {
    headers: {
      authorization: `Bearer ${jwt.sign({ id: currentUser.id, role }, process.env.JWT_SECRET)}`
    }
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function authenticate(role) {
  const req = requestFor(role);
  const res = responseRecorder();
  let continued = false;
  await verifyToken(req, res, () => { continued = true; });
  return { req, res, continued };
}

test('owner permission requires the database owner role and exact owner email', async () => {
  currentUser = { id: 12, name: 'Owner', email: 'faruqh042@gmail.com', role: 'owner', is_active: 1 };
  const { req, res, continued } = await authenticate('user');
  assert.equal(continued, true);
  let authorized = false;
  isOwner(req, res, () => { authorized = true; });
  assert.equal(authorized, true);
});

test('a non-owner email cannot use an owner role, even with a valid token', async () => {
  currentUser = { id: 12, name: 'Impostor', email: 'other@example.com', role: 'owner', is_active: 1 };
  const { req, res, continued } = await authenticate('owner');
  assert.equal(continued, true);
  isOwner(req, res, () => assert.fail('owner middleware must reject this account'));
  assert.equal(res.statusCode, 403);
});

test('authorization uses the current database role instead of a stale token role', async () => {
  currentUser = { id: 12, name: 'User', email: 'user@example.com', role: 'user', is_active: 1 };
  const { req, res, continued } = await authenticate('owner');
  assert.equal(continued, true);
  isOwner(req, res, () => assert.fail('regular user must not enter owner routes'));
  assert.equal(res.statusCode, 403);
});

test('manager access is role-scoped and does not imply owner access', async () => {
  currentUser = { id: 12, name: 'Manager', email: 'manager@example.com', role: 'manager', is_active: 1 };
  const { req, res, continued } = await authenticate('user');
  assert.equal(continued, true);
  let managerAuthorized = false;
  isManager(req, res, () => { managerAuthorized = true; });
  assert.equal(managerAuthorized, true);
  isOwner(req, res, () => assert.fail('manager must not enter owner routes'));
  assert.equal(res.statusCode, 403);
});

test('inactive accounts are rejected even when their token is valid', async () => {
  currentUser = { id: 12, name: 'Inactive', email: 'user@example.com', role: 'user', is_active: 0 };
  const { res, continued } = await authenticate('user');
  assert.equal(continued, false);
  assert.equal(res.statusCode, 401);
});

test('missing bearer tokens are rejected', async () => {
  const req = { headers: {} };
  const res = responseRecorder();
  let continued = false;
  await verifyToken(req, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.statusCode, 401);
});
