import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import type { AuthUser } from '../../../context/auth-context';
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

            const user: AuthUser = await response.json();
            login(user);
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

            setSuccess('Account created! You can now log in.');
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
        <div className="dashboard-container" style={{ maxWidth: 420 }}>
            <h1 style={{ marginBottom: 0 }}>BidMart</h1>
            <p className="text-muted" style={{ textAlign: 'center', marginTop: 4, marginBottom: 20 }}>
                Your marketplace for live auctions
            </p>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
                {(['login', 'register'] as Tab[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => handleTabSwitch(t)}
                        style={{
                            flex: 1,
                            padding: '10px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontWeight: tab === t ? 700 : 400,
                            color: tab === t ? '#2b6cb0' : '#718096',
                            borderBottom: tab === t ? '2px solid #2b6cb0' : '2px solid transparent',
                            marginBottom: -2,
                            textTransform: 'capitalize',
                            fontSize: '0.95rem',
                        }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {error && <div className="toast-error">{error}</div>}
            {success && <div className="toast-success">{success}</div>}

            {tab === 'login' ? (
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.9rem', color: '#4a5568' }}>
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
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.9rem', color: '#4a5568' }}>
                        Password
                        <input
                            className="form-input"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            required
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </label>
                    <button className="bid-button" type="submit" disabled={loading} style={{ marginTop: 4 }}>
                        {loading ? 'Logging in...' : 'Log In'}
                    </button>
                    <p className="text-muted" style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                        No account?{' '}
                        <span
                            style={{ color: '#2b6cb0', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => handleTabSwitch('register')}
                        >
                            Register here
                        </span>
                    </p>
                </form>
            ) : (
                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.9rem', color: '#4a5568' }}>
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
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.9rem', color: '#4a5568' }}>
                        Password
                        <input
                            className="form-input"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            required
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.9rem', color: '#4a5568' }}>
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
                    <button className="bid-button" type="submit" disabled={loading} style={{ marginTop: 4 }}>
                        {loading ? 'Registering...' : 'Create Account'}
                    </button>
                    <p className="text-muted" style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                        Already have an account?{' '}
                        <span
                            style={{ color: '#2b6cb0', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => handleTabSwitch('login')}
                        >
                            Log in
                        </span>
                    </p>
                </form>
            )}
        </div>
    );
};

export default LoginPage;
