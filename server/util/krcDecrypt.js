// Ported from folia-major KRC decrypt logic for server-side lyric matching.
const zlib = require('zlib');

const KRC_KEY = Buffer.from([64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105]);

function inflateAsync(buffer) {
  return new Promise((resolve, reject) => {
    zlib.inflate(buffer, (err, out) => {
      if (!err) return resolve(out);
      zlib.inflateRaw(buffer, (rawErr, rawOut) => {
        if (!rawErr) return resolve(rawOut);
        reject(err);
      });
    });
  });
}

async function krcDecrypt(encryptedBytes) {
  const bytes = Buffer.from(encryptedBytes);
  if (bytes.length <= 4) throw new Error('Invalid KRC data: too short');
  const data = bytes.subarray(4);
  const decrypted = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 1) {
    decrypted[i] = data[i] ^ KRC_KEY[i % KRC_KEY.length];
  }
  const inflated = await inflateAsync(decrypted);
  return inflated.toString('utf8');
}

module.exports = { krcDecrypt };
