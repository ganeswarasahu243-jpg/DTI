import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[1-9]\d{7,14}$/;
const demoEmail = (process.env.REACT_APP_DEMO_EMAIL || '').trim().toLowerCase();
const demoPassword = process.env.REACT_APP_DEMO_PASSWORD || '';
const supabaseUrl = (process.env.REACT_APP_SUPABASE_URL || '').trim();
const apiBaseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const hasDemoCredentials = Boolean(demoEmail && demoPassword);

function apiUrl(path) {
    return `${apiBaseUrl}${path}`;
}

async function postJson(path, payload) {
    let response;

    try {
        response = await fetch(apiUrl(path), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
    } catch (_error) {
        throw new Error(`Cannot reach OTP server (${apiBaseUrl}). Make sure the backend is running.`);
    }

    let result = {};

    try {
        result = await response.json();
    } catch (_error) {
        result = {};
    }

    if (!response.ok || result.success === false) {
        throw new Error(result.message || `OTP request failed with status ${response.status}.`);
    }

    return result;
}

function mapAuthError(error) {
    const raw = String(error?.message || '').trim();
    const code = String(error?.code || '').trim();

    if (!raw) {
        return 'Something went wrong. Please try again.';
    }

    if (/rate limit|too many requests/i.test(raw) || /over_.*rate_limit/i.test(code)) {
        return 'Email OTP is temporarily rate-limited by Supabase. Please wait a minute and try again.';
    }

    if (/token.*expired/i.test(raw)) {
        return 'Your OTP expired. Please request a new code.';
    }

    if (/token has expired or is invalid|invalid|verification failed/i.test(raw)) {
        return 'Invalid OTP. Please check your code and try again.';
    }

    if (/phone provider|sms provider|twilio|message service/i.test(raw)) {
        return 'Phone OTP is not configured yet. Please enable an SMS provider in Supabase.';
    }

    if (/email.*provider.*disabled/i.test(raw)) {
        return 'Email OTP provider is disabled in Supabase. Please enable it in Auth settings.';
    }

    if (/invalid login credentials|email not confirmed/i.test(raw)) {
        return 'Demo credentials are invalid or the account is not confirmed.';
    }

    if (/failed to fetch|networkerror|load failed/i.test(raw)) {
        return `Cannot reach Supabase (${supabaseUrl || 'missing URL'}). Check REACT_APP_SUPABASE_URL, internet, VPN/proxy, or firewall.`;
    }

    return raw;
}

const OTPVerification = () => {
    const [tab, setTab] = useState('email');
    const [email, setEmail] = useState('');
    const [emailOtp, setEmailOtp] = useState('');
    const [phone, setPhone] = useState('');
    const [phoneOtp, setPhoneOtp] = useState('');
    const [loadingAction, setLoadingAction] = useState('');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
    const [session, setSession] = useState(null);

    useEffect(() => {
        let mounted = true;

        async function bootstrapSession() {
            const { data, error } = await supabase.auth.getSession();
            if (!mounted) {
                return;
            }

            if (error) {
                setMessageType('error');
                setMessage(mapAuthError(error));
                return;
            }

            setSession(data?.session || null);
        }

        bootstrapSession();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession || null);
        });

        return () => {
            mounted = false;
            authListener?.subscription?.unsubscribe();
        };
    }, []);

    const setStatus = (type, text) => {
        setMessageType(type);
        setMessage(text);
    };

    const sendEmailOtp = async () => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!emailPattern.test(normalizedEmail)) {
            setStatus('error', 'Please enter a valid email address.');
            return;
        }

        setLoadingAction('send-email');
        setMessage('');

        try {
            const result = await postJson('/auth/email/send-otp', { email: normalizedEmail });
            setStatus('success', result.message || 'Email OTP sent. Check your inbox for the 6-digit code.');
        } catch (error) {
            setStatus('error', mapAuthError(error));
        } finally {
            setLoadingAction('');
        }
    };

    const verifyEmailOtp = async () => {
        const normalizedEmail = email.trim().toLowerCase();
        const token = emailOtp.replace(/\D/g, '').slice(0, 6);

        if (!emailPattern.test(normalizedEmail)) {
            setStatus('error', 'Please enter a valid email address.');
            return;
        }

        if (!/^\d{6}$/.test(token)) {
            setStatus('error', 'Please enter a valid 6-digit OTP.');
            return;
        }

        setLoadingAction('verify-email');
        setMessage('');

        try {
            const result = await postJson('/auth/email/verify-otp', {
                email: normalizedEmail,
                otp: token,
            });
            setSession(result.session || (result.user ? { user: result.user } : null));
            setStatus('success', result.message || 'Email OTP verified. You are now logged in.');
            setEmailOtp('');
        } catch (error) {
            setStatus('error', mapAuthError(error));
        } finally {
            setLoadingAction('');
        }
    };

    const sendPhoneOtp = async () => {
        const normalizedPhone = phone.replace(/\s+/g, '');
        if (!phonePattern.test(normalizedPhone)) {
            setStatus('error', 'Please enter a valid phone number in E.164 format (example: +14155552671).');
            return;
        }

        setLoadingAction('send-phone');
        setMessage('');

        try {
            const result = await postJson('/auth/phone/send-otp', { phone: normalizedPhone });
            setStatus('success', result.message || 'Phone OTP sent. Check your SMS for the 6-digit code.');
        } catch (error) {
            setStatus('error', mapAuthError(error));
        } finally {
            setLoadingAction('');
        }
    };

    const verifyPhoneOtp = async () => {
        const normalizedPhone = phone.replace(/\s+/g, '');
        const token = phoneOtp.replace(/\D/g, '').slice(0, 6);

        if (!phonePattern.test(normalizedPhone)) {
            setStatus('error', 'Please enter a valid phone number in E.164 format.');
            return;
        }

        if (!/^\d{6}$/.test(token)) {
            setStatus('error', 'Please enter a valid 6-digit OTP.');
            return;
        }

        setLoadingAction('verify-phone');
        setMessage('');

        try {
            const result = await postJson('/auth/phone/verify-otp', {
                phone: normalizedPhone,
                otp: token,
            });
            setSession(result.session || (result.user ? { user: result.user } : null));
            setStatus('success', result.message || 'Phone OTP verified. You are now logged in.');
            setPhoneOtp('');
        } catch (error) {
            setStatus('error', mapAuthError(error));
        } finally {
            setLoadingAction('');
        }
    };

    const continueWithGoogle = async () => {
        setLoadingAction('google');
        setMessage('');

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });

        if (error) {
            setStatus('error', mapAuthError(error));
            setLoadingAction('');
        }
    };

    const continueWithDemo = async () => {
        if (!hasDemoCredentials) {
            setStatus('error', 'Demo login is not configured. Set REACT_APP_DEMO_EMAIL and REACT_APP_DEMO_PASSWORD in frontend/.env.');
            return;
        }

        setLoadingAction('demo');
        setMessage('');

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: demoEmail,
                password: demoPassword,
            });

            if (error) {
                setStatus('error', mapAuthError(error));
            } else {
                setSession(data?.session || null);
                setStatus('success', `Logged in with demo account (${demoEmail}).`);
            }
        } catch (error) {
            setStatus('error', mapAuthError(error));
        } finally {
            setLoadingAction('');
        }
    };

    const logout = async () => {
        setLoadingAction('logout');
        setMessage('');

        const { error } = await supabase.auth.signOut();

        if (error) {
            setStatus('error', mapAuthError(error));
        } else {
            setSession(null);
            setStatus('success', 'Logged out successfully.');
        }

        setLoadingAction('');
    };

    const user = session?.user || null;

    return (
        <main className="auth-shell">
            <section className="auth-card">
                <h1>Supabase OTP Authentication</h1>
                <p className="subtitle">Email OTP, Phone OTP, and Google sign in from one clean screen.</p>

                {user ? (
                    <div className="session-box">
                        <p><strong>Logged in as:</strong> {user.email || user.phone || user.id}</p>
                        <p><strong>User ID:</strong> {user.id}</p>
                        <button type="button" onClick={logout} disabled={loadingAction === 'logout'}>
                            {loadingAction === 'logout' ? 'Logging out...' : 'Logout'}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="tab-row">
                            <button
                                type="button"
                                className={tab === 'email' ? 'active' : ''}
                                onClick={() => setTab('email')}
                            >
                                Email OTP
                            </button>
                            <button
                                type="button"
                                className={tab === 'phone' ? 'active' : ''}
                                onClick={() => setTab('phone')}
                            >
                                Phone OTP
                            </button>
                        </div>

                        {tab === 'email' ? (
                            <div className="form-grid">
                                <label>
                                    Email
                                    <input
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                    />
                                </label>

                                <div className="button-row">
                                    <button type="button" onClick={sendEmailOtp} disabled={loadingAction === 'send-email'}>
                                        {loadingAction === 'send-email' ? 'Sending...' : 'Send Email OTP'}
                                    </button>
                                </div>

                                <label>
                                    Email OTP
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="6-digit code"
                                        value={emailOtp}
                                        onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                    />
                                </label>

                                <div className="button-row">
                                    <button type="button" onClick={verifyEmailOtp} disabled={loadingAction === 'verify-email'}>
                                        {loadingAction === 'verify-email' ? 'Verifying...' : 'Verify Email OTP'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="form-grid">
                                <label>
                                    Phone Number
                                    <input
                                        type="tel"
                                        placeholder="+14155552671"
                                        value={phone}
                                        onChange={(event) => setPhone(event.target.value)}
                                    />
                                </label>

                                <div className="button-row">
                                    <button type="button" onClick={sendPhoneOtp} disabled={loadingAction === 'send-phone'}>
                                        {loadingAction === 'send-phone' ? 'Sending...' : 'Send Phone OTP'}
                                    </button>
                                </div>

                                <label>
                                    Phone OTP
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="6-digit code"
                                        value={phoneOtp}
                                        onChange={(event) => setPhoneOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                    />
                                </label>

                                <div className="button-row">
                                    <button type="button" onClick={verifyPhoneOtp} disabled={loadingAction === 'verify-phone'}>
                                        {loadingAction === 'verify-phone' ? 'Verifying...' : 'Verify Phone OTP'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="divider">or</div>

                        <button
                            type="button"
                            className="google-btn"
                            onClick={continueWithGoogle}
                            disabled={loadingAction === 'google'}
                        >
                            {loadingAction === 'google' ? 'Redirecting...' : 'Continue with Google'}
                        </button>

                        <div className="divider">or</div>

                        <button
                            type="button"
                            className="demo-btn"
                            onClick={continueWithDemo}
                            disabled={loadingAction === 'demo' || !hasDemoCredentials}
                        >
                            {loadingAction === 'demo'
                                ? 'Signing in...'
                                : hasDemoCredentials
                                    ? 'Continue with Demo Account'
                                    : 'Demo Account Not Configured'}
                        </button>
                    </>
                )}

                {message ? (
                    <p className={`message ${messageType}`}>{message}</p>
                ) : null}
            </section>
        </main>
    );
};

export default OTPVerification;
