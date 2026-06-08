const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '(configured)' : '(missing)');
console.log('SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);

const authRoutes = require('./routes/authRoutes');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

// Middleware
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');

    if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && isLocalhost)) {
        if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
        }
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    return next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting to prevent OTP spam
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5 // limit each IP to 5 requests per windowMs
});
app.use('/auth/send-otp', limiter);
app.use('/auth/email/send-otp', limiter);
app.use('/auth/phone/send-otp', limiter);
app.use('/send-otp', limiter);

// Routes
app.use('/auth', authRoutes);
app.use('/', authRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
