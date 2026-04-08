const crypto = require('crypto')

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer) {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31]
  }

  return output
}

function base32Decode(value) {
  const normalized = String(value).replace(/=+$/g, '').toUpperCase()
  let bits = 0
  let accumulator = 0
  const output = []

  for (const char of normalized) {
    const index = alphabet.indexOf(char)
    if (index === -1) {
      continue
    }

    accumulator = (accumulator << 5) | index
    bits += 5

    if (bits >= 8) {
      output.push((accumulator >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(output)
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20))
}

function hotp(secret, counter) {
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buffer).digest()
  const offset = hmac[hmac.length - 1] & 15
  const code =
    ((hmac[offset] & 127) << 24) |
    ((hmac[offset + 1] & 255) << 16) |
    ((hmac[offset + 2] & 255) << 8) |
    (hmac[offset + 3] & 255)

  return String(code % 1000000).padStart(6, '0')
}

function totp(secret, time = Date.now()) {
  return hotp(secret, Math.floor(time / 30000))
}

function verifyTotp(secret, code, window = 1) {
  const now = Date.now()

  for (let offset = -window; offset <= window; offset += 1) {
    if (totp(secret, now + offset * 30000) === String(code)) {
      return true
    }
  }

  return false
}

function buildOtpAuthUrl({ issuer, accountName, secret }) {
  const label = encodeURIComponent(`${issuer}:${accountName}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

module.exports = { generateSecret, verifyTotp, buildOtpAuthUrl }
