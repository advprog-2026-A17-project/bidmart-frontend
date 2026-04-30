import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import type { AuthLoginResult } from '../../../context/auth-context';
import { apiUrl } from '../../../config/api';
import { readApiError } from '../../../config/apiClient';

type Tab = 'login' | 'register';

const ROLES = ['BUYER', 'SELLER'];

type LoginResponsePayload = AuthLoginResult | { challengeToken: string };
type LoginOutcome =
    | { kind: 'success'; payload: AuthLoginResult }
    | { kind: 'challenge'; token: string }
    | { kind: 'error'; message: string };
type RegistrationOutcome =
    | { kind: 'success' }
    | { kind: 'error'; message: string };

const isTwoFactorChallenge = (payload: LoginResponsePayload): payload is { challengeToken: string } =>
    'challengeToken' in payload;

const postJson = async <T,>(path: string, body: unknown): Promise<{ response: Response; payload: T | null }> => {
    const response = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const payload = response.ok ? await response.json() as T : null;
    return { response, payload };
};

const submitLabel = (loading: boolean, idleLabel: string, loadingLabel: string): string =>
    loading ? loadingLabel : idleLabel;

const requestLogin = async (email: string, password: string): Promise<LoginOutcome> => {
    const { response, payload } = await postJson<LoginResponsePayload>('/api/v1/auth/login', { email, password });

    if (response.status === 401) {
        return { kind: 'error', message: 'Invalid email or password.' };
    }
    if (!response.ok) {
        return { kind: 'error', message: `Login failed: HTTP ${response.status}` };
    }
    if (!payload) {
        return { kind: 'error', message: 'Login failed: empty response.' };
    }
    if (isTwoFactorChallenge(payload)) {
        return { kind: 'challenge', token: payload.challengeToken };
    }
    return { kind: 'success', payload };
};

const requestTwoFactorLogin = async (
    challengeToken: string,
    code: string,
): Promise<LoginOutcome> => {
    const { response, payload } = await postJson<AuthLoginResult>(
        '/api/v1/auth/2fa/login-verify',
        { challengeToken, code },
    );

    if (!response.ok) {
        return { kind: 'error', message: await readApiError(response, 'Two-factor verification failed') };
    }
    if (!payload) {
        return { kind: 'error', message: 'Two-factor verification failed: empty response.' };
    }
    return { kind: 'success', payload };
};

const requestRegistration = async (
    email: string,
    password: string,
    role: string,
): Promise<RegistrationOutcome> => {
    const response = await fetch(apiUrl('/api/v1/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
    });

    if (response.ok) {
        return { kind: 'success' };
    }

    const errData = await response.json().catch(() => ({})) as { message?: string };
    return { kind: 'error', message: errData.message ?? `Registration failed: HTTP ${response.status}` };
};

const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [tab, setTab] = useState<Tab>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('BUYER');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [twoFactorChallenge, setTwoFactorChallenge] = useState<string | null>(null);
    const [twoFactorCode, setTwoFactorCode] = useState('');

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setRole('BUYER');
        setTwoFactorChallenge(null);
        setTwoFactorCode('');
        setError(null);
        setSuccess(null);
    };

    const handleTabSwitch = (t: Tab) => {
        setTab(t);
        resetForm();
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const result = await requestLogin(email, password);
            if (result.kind === 'error') {
                setError(result.message);
                return;
            }
            if (result.kind === 'challenge') {
                setTwoFactorChallenge(result.token);
                setSuccess('Two-factor verification required.');
                return;
            }
            login(result.payload);
            navigate('/');
        } catch (err: unknown) {
            setError('Failed to connect to Auth Service via API Gateway.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleTwoFactorLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!twoFactorChallenge) return;
        setLoading(true);
        setError(null);
        try {
            const result = await requestTwoFactorLogin(twoFactorChallenge, twoFactorCode);
            if (result.kind === 'error') {
                setError(result.message);
                return;
            }
            if (result.kind === 'challenge') {
                setError('Two-factor verification requires a new login challenge.');
                return;
            }
            login(result.payload);
            navigate('/');
        } catch (err: unknown) {
            setError('Failed to verify two-factor challenge via API Gateway.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const result = await requestRegistration(email, password, role);
            if (result.kind === 'error') {
                setError(result.message);
                return;
            }
            setSuccess('Account created. Please verify your email before logging in.');
            setTab('login');
            setPassword('');
        } catch (err: unknown) {
            setError('Failed to connect to Auth Service via API Gateway.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    let formContent: React.ReactNode;
    if (tab === 'login' && twoFactorChallenge) {
        formContent = (
            <form onSubmit={handleTwoFactorLogin} className="auth-form">
                <label className="field">
                    <span>Two-factor code</span>
                    <input
                        className="form-input"
                        type="text"
                        inputMode="numeric"
                        placeholder="123456"
                        value={twoFactorCode}
                        required
                        onChange={(e) => setTwoFactorCode(e.target.value)}
                    />
                </label>
                <button className="primary-button" type="submit" disabled={loading}>
                    {submitLabel(loading, 'Verify & Continue', 'Verifying...')}
                </button>
                <button type="button" className="secondary-button" onClick={() => setTwoFactorChallenge(null)}>
                    Back
                </button>
            </form>
        );
    } else if (tab === 'login') {
        formContent = (
            <form onSubmit={handleLogin} className="auth-form">
                <label className="field">
                    <span>Email Address</span>
                    <input
                        className="form-input"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        required
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </label>
                <label className="field">
                    <span>Password</span>
                    <div className="password-row">
                        <input
                            className="form-input"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={password}
                            required
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button type="button" className="secondary-button" onClick={() => setShowPassword((v) => !v)}>
                            {showPassword ? 'Hide' : 'Show'}
                        </button>
                    </div>
                </label>
                <button className="primary-button" type="submit" disabled={loading}>
                    {submitLabel(loading, 'Log In', 'Logging in...')}
                </button>
                <p className="text-muted auth-switch">
                    No account?{' '}
                    <button type="button" className="link-button" onClick={() => handleTabSwitch('register')}>
                        Register here
                    </button>
                </p>
            </form>
        );
    } else {
        formContent = (
            <form onSubmit={handleRegister} className="auth-form">
                <label className="field">
                    <span>Email</span>
                    <input
                        className="form-input"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        required
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </label>
                <label className="field">
                    <span>Password</span>
                    <input
                        className="form-input"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        required
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </label>
                <label className="field">
                    <span>Role</span>
                    <select
                        className="form-input"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                    >
                        {ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                </label>
                <button className="primary-button" type="submit" disabled={loading}>
                    {submitLabel(loading, 'Create Account', 'Registering...')}
                </button>
                <p className="text-muted auth-switch">
                    Already have an account?{' '}
                    <button type="button" className="link-button" onClick={() => handleTabSwitch('login')}>
                        Log in
                    </button>
                </p>
            </form>
        );
    }

    return (
        <div className="auth-wrap">
            <div className="auth-card">
                <div className="auth-logo-wrap">
                    <div className="app-logo">BM</div>
                    <h1>BidMart</h1>
                    <p>Win amazing items at great prices</p>
                </div>

                <div className="auth-tabs">
                    {(['login', 'register'] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => handleTabSwitch(t)}
                            className={`auth-tab ${tab === t ? 'auth-tab-active' : ''}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {error && <div className="toast-error">{error}</div>}
                {success && <div className="toast-success">{success}</div>}

                {formContent}
            </div>
        </div>
    );
};

export default LoginPage;
