const express = require('express');
const {
  sendOtp,
  verifyOtp,
  sendEmailOtp,
  verifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  googleOAuthStart,
  logout,
} = require('../controllers/authController');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const otpLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many OTP requests, please try again later.',
});

router.post('/send-otp', otpLimiter, sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/email/send-otp', otpLimiter, sendEmailOtp);
router.post('/email/verify-otp', verifyEmailOtp);
router.post('/phone/send-otp', otpLimiter, sendPhoneOtp);
router.post('/phone/verify-otp', verifyPhoneOtp);
router.post('/google/start', googleOAuthStart);
router.post('/logout', logout);

module.exports = router;
