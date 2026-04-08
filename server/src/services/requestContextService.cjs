const crypto = require('crypto')

function firstHeaderValue(value) {
  return String(value || '').split(',')[0].trim()
}

function getRequestContext(req) {
  const ipAddress =
    firstHeaderValue(req.headers['x-forwarded-for']) ||
    req.headers['x-real-ip'] ||
    req.ip ||
    'unknown'

  const deviceInfo = String(req.headers['user-agent'] || 'unknown-device')
  const locationHint =
    req.headers['x-vercel-ip-country'] ||
    req.headers['cf-ipcountry'] ||
    req.headers['x-geo-country'] ||
    ipAddress.split('.').slice(0, 2).join('.')

  return {
    requestId: req.requestId,
    ipAddress,
    deviceInfo,
    locationHint: String(locationHint || 'unknown'),
    deviceFingerprint: crypto.createHash('sha256').update(deviceInfo).digest('hex'),
    loginTime: new Date().toISOString(),
  }
}

module.exports = { getRequestContext }
