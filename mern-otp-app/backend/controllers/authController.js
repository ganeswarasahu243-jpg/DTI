const supabase = require('../utils/supabaseClient');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;
const OTP_REGEX = /^\d{6}$/;

function normalize(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
    return normalize(value).toLowerCase();
}

function normalizePhone(value) {
    return normalize(value).replace(/\s+/g, '');
}

function normalizeOtp(value) {
    return normalize(value).replace(/\D/g, '').slice(0, 6);
}

function mapSupabaseError(error, fallbackMessage) {
    const raw = String(error?.message || fallbackMessage || 'Request failed.');
    const code = String(error?.code || '');

    if (/rate limit|too many requests/i.test(raw) || /over_.*rate_limit/i.test(code)) {
        return 'Email OTP is temporarily rate-limited by Supabase. Please wait a minute and try again.';
    }

    if (/token.*expired/i.test(raw)) {
        return 'OTP expired. Please request a new code.';
    }

    if (/token has expired or is invalid|invalid otp|verification failed|token/i.test(raw) && /invalid|expired|token|otp/i.test(raw)) {
        return 'Invalid OTP. Please check the code and try again.';
    }

    if (/invalid api key|apikey|jwt malformed|unauthorized/i.test(raw)) {
        return 'Supabase credentials look invalid. Please verify SUPABASE_URL and SUPABASE_ANON_KEY.';
    }

    if (/sms|phone provider|twilio|message service/i.test(raw)) {
        return 'Phone OTP is not configured yet. Enable an SMS provider in Supabase.';
    }

    if (/email/i.test(raw) && /disabled|provider/i.test(raw)) {
        return 'Email provider is disabled in Supabase. Please enable it in Auth settings.';
    }

    return fallbackMessage || raw;
}

function sessionPayload(session) {
    if (!session) {
        return null;
    }

    return {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: session.token_type,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        user: session.user || null,
    };
}

exports.sendEmailOtp = async (req, res) => {
    const email = normalizeEmail(req.body?.email);

    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: true,
        },
    });

    if (error) {
        return res.status(400).json({
            success: false,
            message: mapSupabaseError(error, 'Unable to send email OTP right now. Please try again.'),
        });
    }

    return res.status(200).json({
        success: true,
        message: 'Email OTP sent. Check your inbox for the 6-digit code.',
    });
};

exports.verifyEmailOtp = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const token = normalizeOtp(req.body?.otp || req.body?.token);

    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    if (!OTP_REGEX.test(token)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid 6-digit OTP.' });
    }

    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
    });

    if (error) {
        return res.status(400).json({
            success: false,
            message: mapSupabaseError(error, 'Unable to verify email OTP.'),
        });
    }

    return res.status(200).json({
        success: true,
        message: 'Email verified successfully.',
        session: sessionPayload(data?.session),
        user: data?.user || data?.session?.user || null,
    });
};

exports.sendPhoneOtp = async (req, res) => {
    const phone = normalizePhone(req.body?.phone);

    if (!PHONE_REGEX.test(phone)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid phone number in E.164 format.' });
    }

    const { error } = await supabase.auth.signInWithOtp({
        phone,
    });

    if (error) {
        return res.status(400).json({
            success: false,
            message: mapSupabaseError(error, 'Unable to send phone OTP right now. Please try again.'),
        });
    }

    return res.status(200).json({
        success: true,
        message: 'Phone OTP sent. Check your SMS for the 6-digit code.',
    });
};

exports.verifyPhoneOtp = async (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    const token = normalizeOtp(req.body?.otp || req.body?.token);

    if (!PHONE_REGEX.test(phone)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid phone number in E.164 format.' });
    }

    if (!OTP_REGEX.test(token)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid 6-digit OTP.' });
    }

    const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
    });

    if (error) {
        return res.status(400).json({
            success: false,
            message: mapSupabaseError(error, 'Unable to verify phone OTP.'),
        });
    }

    return res.status(200).json({
        success: true,
        message: 'Phone verified successfully.',
        session: sessionPayload(data?.session),
        user: data?.user || data?.session?.user || null,
    });
};

exports.googleOAuthStart = async (req, res) => {
    const redirectTo = normalize(req.body?.redirectTo) || 'http://localhost:3000';

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
        },
    });

    if (error || !data?.url) {
        return res.status(400).json({
            success: false,
            message: mapSupabaseError(error, 'Unable to start Google login.'),
        });
    }

    return res.status(200).json({
        success: true,
        url: data.url,
    });
};

exports.logout = async (_req, res) => {
    const { error } = await supabase.auth.signOut();

    if (error) {
        return res.status(400).json({
            success: false,
            message: mapSupabaseError(error, 'Unable to logout right now.'),
        });
    }

    return res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
    });
};

// Backward-compatible aliases for existing endpoints.
exports.sendOtp = exports.sendEmailOtp;
exports.verifyOtp = exports.verifyEmailOtp;
