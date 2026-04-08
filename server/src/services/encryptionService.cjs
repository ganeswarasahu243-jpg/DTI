const crypto = require('crypto')
const { config } = require('../config/env.cjs')

const KEY = config.encryptionKey

function normalize(value) {
  if (value == null) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value)
}

function encryptText(value) {
  const plaintext = Buffer.from(normalize(value), 'utf8')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return JSON.stringify({
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  })
}

function decryptText(payload) {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    KEY,
    Buffer.from(parsed.iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, 'base64')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    buffer: encrypted,
    meta: JSON.stringify({
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    }),
  }
}

function decryptBuffer(buffer, meta) {
  const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    KEY,
    Buffer.from(parsed.iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'))

  return Buffer.concat([decipher.update(buffer), decipher.final()])
}

function hashLookup(value) {
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex')
}

module.exports = {
  encryptText,
  decryptText,
  encryptBuffer,
  decryptBuffer,
  hashLookup,
}
