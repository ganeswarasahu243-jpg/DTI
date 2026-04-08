const { config } = require('../config/env.cjs')

function enforceHttps(req, res, next) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
  const secure = req.secure || forwardedProto === 'https'

  if (config.enforceHttps && !secure) {
    const host = req.headers.host
    return res.redirect(308, `https://${host}${req.originalUrl}`)
  }

  return next()
}

module.exports = { enforceHttps }
