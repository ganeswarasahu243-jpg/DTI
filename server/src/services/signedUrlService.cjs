const crypto = require('crypto')
const { config } = require('../config/env.cjs')

function signUrl({ storageKey, assetId, userId, expiresAt }) {
  const payload = `${storageKey}:${assetId}:${userId}:${expiresAt}`
  const signature = crypto.createHmac('sha256', config.signedUrlSecret).update(payload).digest('hex')
  return `/api/files/${encodeURIComponent(storageKey)}?assetId=${encodeURIComponent(assetId)}&expires=${encodeURIComponent(expiresAt)}&signature=${signature}`
}

function verifyUrl({ storageKey, assetId, userId, expires, signature }) {
  if (new Date(expires) < new Date()) {
    return false
  }

  const payload = `${storageKey}:${assetId}:${userId}:${expires}`
  const expected = crypto.createHmac('sha256', config.signedUrlSecret).update(payload).digest('hex')
  const supplied = Buffer.from(String(signature || ''))
  const target = Buffer.from(expected)
  if (supplied.length !== target.length) {
    return false
  }

  return crypto.timingSafeEqual(supplied, target)
}

module.exports = { signUrl, verifyUrl }
