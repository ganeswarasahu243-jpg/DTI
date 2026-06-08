const nodemailer = require('nodemailer')
const { config } = require('../config/env.cjs')

let transporter = null
let hasPrintedEmailDebug = false

function looksPlaceholder(value) {
  return /your_|example|replace/i.test(String(value || ''))
}

function hasGmailConfig() {
  return Boolean(config.gmail.user && config.gmail.appPassword)
}

function hasUsableGmailConfig() {
  return hasGmailConfig() && !looksPlaceholder(config.gmail.user) && !looksPlaceholder(config.gmail.appPassword)
}

function hasSmtpConfig() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass && config.smtp.from)
}

function getTransporter() {
  if (!hasUsableGmailConfig() && !hasSmtpConfig()) {
    throw new Error('Email delivery is not configured. Set EMAIL_USER and EMAIL_PASS in environment variables.')
  }

  if (hasGmailConfig() && !hasUsableGmailConfig() && !hasSmtpConfig()) {
    throw new Error('EMAIL_USER or EMAIL_PASS is still a placeholder. Set real Gmail + App Password.')
  }

  if (!transporter) {
    if (config.env === 'development' && !hasPrintedEmailDebug) {
      console.log('[otp-email-debug] EMAIL_USER =', process.env.EMAIL_USER || '(undefined)')
      hasPrintedEmailDebug = true
    }

    transporter = hasUsableGmailConfig()
      ? nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: config.gmail.user,
            pass: config.gmail.appPassword,
          },
        })
      : nodemailer.createTransport({
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
  if (config.env === 'development' && !hasUsableGmailConfig() && !hasSmtpConfig()) {
    console.log('[otp-email-preview]', { email, code, purpose })
    return {
      channel: 'email',
      delivered: true,
      provider: 'preview',
      preview: {
        email,
        code,
        purpose,
      },
    }
  }

  const mail = buildOtpEmail({ code, purpose })
  const activeTransporter = getTransporter()
  const fromAddress = hasUsableGmailConfig() ? (config.gmail.from || config.gmail.user) : config.smtp.from

  try {
    await activeTransporter.sendMail({
      from: fromAddress,
      to: email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
  } catch (error) {
    console.error('[otp-email-error]', {
      message: error?.message,
      code: error?.code,
      responseCode: error?.responseCode,
      command: error?.command,
    })
    throw error
  }

  return {
    channel: 'email',
    delivered: true,
    provider: hasGmailConfig() ? 'gmail' : 'smtp',
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

module.exports = { sendOtpEmail, sendOtpSms, sendReleaseAlert, hasSmtpConfig, hasGmailConfig }
