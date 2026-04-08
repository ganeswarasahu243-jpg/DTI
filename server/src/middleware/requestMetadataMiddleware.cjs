const crypto = require('crypto')

function assignRequestMetadata(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID()
  req.requestId = String(requestId)
  res.setHeader('X-Request-Id', req.requestId)
  return next()
}

module.exports = { assignRequestMetadata }
