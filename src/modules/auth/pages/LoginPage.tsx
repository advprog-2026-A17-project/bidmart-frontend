import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import type { AuthLoginResult } from '../../../context/auth-context';
import { apiUrl } from '../../../config/api';

type Tab = 'login' | 'register';

const ROLES = ['BUYER', 'SELLER'];

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

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setRole('BUYER');
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
            const response = await fetch(apiUrl('/api/v1/auth/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (response.status === 401) {
                setError('Invalid email or password.');
                return;
            }
            if (!response.ok) {
                setError(`Login failed: HTTP ${response.status}`);
                return;
            }

            const loginResult: AuthLoginResult = await response.json();
            login(loginResult);
            navigate('/');
        } catch (err: unknown) {
            setError('Failed to connect to Auth Service via API Gateway.');
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
            const response = await fetch(apiUrl('/api/v1/auth/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({})) as { message?: string };
                setError(errData.message ?? `Registration failed: HTTP ${response.status}`);
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

                {tab === 'login' ? (
                    <form onSubmit={handleLogin} className="auth-form">
                        <label className="field">
                            Email Address
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
                            Password
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
                            {loading ? 'Logging in...' : 'Log In'}
                        </button>
                        <p className="text-muted auth-switch">
                            No account?{' '}
                            <button type="button" className="link-button" onClick={() => handleTabSwitch('register')}>
                                Register here
                            </button>
                        </p>
                    </form>
                ) : (
                    <form onSubmit={handleRegister} className="auth-form">
                        <label className="field">
                            Email
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
                            Password
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
                            Role
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
                            {loading ? 'Registering...' : 'Create Account'}
                        </button>
                        <p className="text-muted auth-switch">
                            Already have an account?{' '}
                            <button type="button" className="link-button" onClick={() => handleTabSwitch('login')}>
                                Log in
                            </button>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
};

export default LoginPage;
