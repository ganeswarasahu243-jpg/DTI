const http = require('http')

const payload = JSON.stringify({ email: 'owner@loom-demo.local', password: 'DemoPass123!' })

const req = http.request(
  {
    hostname: 'localhost',
    port: 4000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length,
    },
  },
  (res) => {
    let rawData = ''
    res.on('data', (chunk) => {
      rawData += chunk
    })
    res.on('end', () => {
      console.log('Status code:', res.statusCode)
      console.log('Response body:', rawData)
    })
  }
)

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`)
})

req.write(payload)
req.end()
