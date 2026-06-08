# MERN Supabase OTP Auth App

This project now uses **Supabase Authentication** for OTP and OAuth login.

## What Changed

- Removed Gmail/Nodemailer OTP flow.
- Removed `EMAIL_USER` and `EMAIL_PASS` from backend env.
- Added Supabase auth support for:
  - Email OTP
  - Phone OTP
  - Google sign in
- Added session persistence, auto-login, and logout in frontend.

## Features

1. Email OTP Authentication
- Send OTP: `supabase.auth.signInWithOtp({ email })`
- Verify OTP: `supabase.auth.verifyOtp({ email, token, type: 'email' })`

2. Phone OTP Authentication
- Send OTP: `supabase.auth.signInWithOtp({ phone })`
- Verify OTP: `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`

3. Google Authentication
- Continue with Google button
- Uses: `supabase.auth.signInWithOAuth({ provider: 'google' })`

4. Demo Account Authentication (Optional)
- Continue with Demo Account button
- Uses: `supabase.auth.signInWithPassword({ email, password })`
- Credentials are loaded from frontend env:
  - `REACT_APP_DEMO_EMAIL`
  - `REACT_APP_DEMO_PASSWORD`

5. Session Handling
- Persistent session
- Auto-login if session exists
- Logout support

6. Error Handling
- Friendly messages for invalid OTP, expired OTP, and provider config issues

---

## Project Structure

```text
mern-otp-app
├── backend
│   ├── controllers
│   │   └── authController.js
│   ├── routes
│   │   └── authRoutes.js
│   ├── utils
│   │   └── supabaseClient.js
│   ├── .env
│   ├── .env.example
│   └── app.js
└── frontend
    ├── src
    │   ├── components
    │   │   └── OTPVerification.js
    │   ├── supabaseClient.js
    │   ├── App.js
    │   ├── index.css
    │   └── index.js
    ├── .env
    ├── .env.example
    └── package.json
```

---

## 1) Backend Setup

### Backend `.env`
File: `mern-otp-app/backend/.env`

```env
PORT=5000
SUPABASE_URL=https://ryembrjyjrjhpeqzwyen.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Install and run backend

```bash
cd mern-otp-app/backend
npm install
npm run dev
```

Backend runs at: `http://localhost:5000`

---

## 2) Frontend Setup

### Frontend `.env`
File: `mern-otp-app/frontend/.env`

```env
REACT_APP_SUPABASE_URL=https://ryembrjyjrjhpeqzwyen.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_DEMO_EMAIL=demo@example.com
REACT_APP_DEMO_PASSWORD=demo_password
```

### Install and run frontend

```bash
cd mern-otp-app/frontend
npm install
npm start
```

Frontend runs at: `http://localhost:3000`

---

## 3) Required Supabase Dashboard Settings

In your Supabase project:

1. **Enable Email Provider**
- Go to `Authentication -> Providers -> Email`
- Enable Email provider

2. **Enable Phone Provider**
- Go to `Authentication -> Providers -> Phone`
- Enable Phone provider
- Configure SMS provider (for example Twilio)

3. **Enable Google Provider**
- Go to `Authentication -> Providers -> Google`
- Add Google Client ID and Client Secret
- Add redirect URL(s) required by Supabase/Google

4. **Use OTP instead of magic link (Email Templates)**
- Go to `Authentication -> Email Templates`
- Replace:
  - `{{ .ConfirmationURL }}`
- With:
  - `{{ .Token }}`

This enables true OTP code entry flow for email.

---

## API Endpoints (Backend)

- `POST /auth/email/send-otp`
- `POST /auth/email/verify-otp`
- `POST /auth/phone/send-otp`
- `POST /auth/phone/verify-otp`
- `POST /auth/google/start`
- `POST /auth/logout`

Backward compatibility:
- `POST /auth/send-otp` (email send)
- `POST /auth/verify-otp` (email verify)

---

## Notes

- If phone OTP fails, check SMS provider setup in Supabase.
- If email OTP sends magic links instead of codes, re-check Email Template placeholders.
- Frontend session persists automatically through Supabase client.
