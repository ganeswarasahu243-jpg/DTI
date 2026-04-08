const { app, startup } = require('./src/app.cjs')
const { config } = require('./src/config/env.cjs')

startup.then(() => {
  app.listen(config.port, () => {
    const protocol = config.enforceHttps ? 'https' : 'http'
    console.log(`Secure API running on ${protocol}://localhost:${config.port}`)
  })
}).catch((error) => {
  console.error('API startup failed.', error)
  process.exit(1)
})
