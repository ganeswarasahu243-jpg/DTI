function createRateLimit({ windowMs, max, skip }) {
  const hits = new Map()

  return (req, res, next) => {
    if (typeof skip === 'function' && skip(req)) {
      return next()
    }

    const key = `${req.ip}:${req.path}`
    const now = Date.now()
    const bucket = hits.get(key) || []
    const recent = bucket.filter((timestamp) => now - timestamp < windowMs)
    recent.push(now)
    hits.set(key, recent)

    if (recent.length > max) {
      return res.status(429).json({ message: 'Too many requests. Please try again later.' })
    }

    return next()
  }
}

module.exports = { createRateLimit }
