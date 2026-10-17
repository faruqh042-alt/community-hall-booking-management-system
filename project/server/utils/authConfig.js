const MIN_JWT_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRET_PATTERN = /^(?:this_is_|replace_|your_|example_|placeholder_|paste_)/i;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH || PLACEHOLDER_SECRET_PATTERN.test(secret)) {
    return null;
  }
  return secret;
}

module.exports = { getJwtSecret };
