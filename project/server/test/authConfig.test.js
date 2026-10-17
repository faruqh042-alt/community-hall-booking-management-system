const assert = require('node:assert/strict');
const test = require('node:test');
const { getJwtSecret } = require('../utils/authConfig');

const originalSecret = process.env.JWT_SECRET;
test.after(() => {
  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
});

test('rejects missing and short JWT secrets', () => {
  delete process.env.JWT_SECRET;
  assert.equal(getJwtSecret(), null);

  process.env.JWT_SECRET = 'short-secret';
  assert.equal(getJwtSecret(), null);
});

test('rejects known insecure and example JWT secrets', () => {
  for (const secret of [
    'this_is_a_super_secret_key_change_me',
    'replace_with_a_random_secret_of_at_least_32_characters',
    'your_example_secret_that_is_long_enough_but_not_real'
  ]) {
    process.env.JWT_SECRET = secret;
    assert.equal(getJwtSecret(), null);
  }
});

test('accepts a sufficiently long non-placeholder JWT secret', () => {
  const secret = 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6';
  process.env.JWT_SECRET = secret;
  assert.equal(getJwtSecret(), secret);
});
