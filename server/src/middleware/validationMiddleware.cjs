function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: 'Invalid request payload.',
        issues: result.error.flatten(),
      })
    }

    req.validatedBody = result.data
    return next()
  }
}

module.exports = { validate }
