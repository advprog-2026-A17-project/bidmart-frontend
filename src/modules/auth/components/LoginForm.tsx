import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import { requestLogin } from '../utils/auth-api';
import TwoFactorForm from './TwoFactorForm';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LOGIN_VERIFY_ENDPOINT = '/api/v1/auth/2fa/login-verify';

interface LoginFormProps {
    onSwitchTab: () => void;
    onForgotPassword: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchTab, onForgotPassword }) => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [twoFactorChallenge, setTwoFactorChallenge] = useState<string | null>(null);

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

    if (twoFactorChallenge) {
        return (
            <TwoFactorForm 
                challengeToken={twoFactorChallenge} 
                onCancel={() => setTwoFactorChallenge(null)} 
            />
        );
    }

    return (
        <form onSubmit={handleLogin} className="auth-form">
            {error && <div className="toast-error">{error}</div>}
            
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

                <button 
                    type="button" 
                    className="link-button" 
                    onClick={onForgotPassword}
                    style={{ fontSize: '0.85rem' }}
                >
                    Forgot password?
                </button>
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
                <button type="button" className="link-button" onClick={onSwitchTab}>
                    Register here
                </button>
            </p>
        </form>
    );
};

export default LoginForm;