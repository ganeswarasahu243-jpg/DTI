const nodemailer = require('nodemailer')
const { config } = require('../config/env.cjs')

let transporter = null

function hasSmtpConfig() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass && config.smtp.from)
}

function getTransporter() {
  if (!hasSmtpConfig()) {
    return null
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    })
  }

  return transporter
}

function buildOtpEmail({ code, purpose }) {
  const title = purpose === 'email-verification' ? 'Verify your email address' : 'Your LOOM security code'
  const body = purpose === 'email-verification'
    ? `Use this verification code to confirm your LOOM email address: ${code}`
    : `Use this LOOM security code to continue: ${code}`

  return {
    subject: `${title} - LOOM`,
    text: `${body}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">${title}</h2>
        <p>${body}</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.3em; margin: 20px 0;">${code}</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  }
}

async function sendOtpEmail(email, code, purpose) {
  const preview = { email, code, purpose }
  const mail = buildOtpEmail({ code, purpose })
  const activeTransporter = getTransporter()

  if (!activeTransporter) {
    return {
      channel: 'email',
      delivered: true,
      preview,
      provider: 'preview',
    }
  }

  await activeTransporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  })

  return {
    channel: 'email',
    delivered: true,
    preview,
    provider: 'smtp',
  }
}

function sendOtpSms(phone, code, purpose) {
  return {
    channel: 'sms',
    delivered: true,
    provider: 'preview',
    preview: {
      phone,
      code,
      purpose,
    },
  }
}

function sendReleaseAlert(userId, message) {
  return {
    channel: 'alert-log',
    delivered: true,
    preview: {
      userId,
      message,
    },
  }
}

module.exports = { sendOtpEmail, sendOtpSms, sendReleaseAlert, hasSmtpConfig }
