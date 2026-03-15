const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const TEAM_ID = 'JLKA6S8UWH';
const KEY_ID = '6DLG5ND5U7';
const CLIENT_ID = 'com.tjade.dailyq';
const AUDIENCE = 'https://appleid.apple.com';
const KEY_PATH = path.join(__dirname, 'AuthKey_6DLG5ND5U7.p8');

if (!fs.existsSync(KEY_PATH)) {
  console.error('Error: AuthKey_6DLG5ND5U7.p8 not found. Place it in the same directory as this script.');
  process.exit(1);
}
const privateKey = fs.readFileSync(KEY_PATH, 'utf8');

const now = Math.floor(Date.now() / 1000);
const expiresAt = new Date();
expiresAt.setMonth(expiresAt.getMonth() + 6);
const exp = Math.floor(expiresAt.getTime() / 1000);

const token = jwt.sign(
  {
    iss: TEAM_ID,
    iat: now,
    exp,
    aud: AUDIENCE,
    sub: CLIENT_ID,
  },
  privateKey,
  {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: KEY_ID,
    },
  }
);

console.log(token);
