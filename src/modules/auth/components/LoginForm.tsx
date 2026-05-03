import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import { requestLogin, requestRegistration } from '../utils/auth-api';
import TwoFactorForm from './TwoFactorForm';
import UnregisteredEmailModal from './UnregisteredEmailModal';

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
    const [success, setSuccess] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [twoFactorChallenge, setTwoFactorChallenge] = useState<string | null>(null);
    const [showUnregisteredModal, setShowUnregisteredModal] = useState(false);

    const handleDirectRegister = async (role: string) => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const result = await requestRegistration(email, password, role);
            if (result.kind === 'error') {
                setError(result.message);
                setShowUnregisteredModal(false);
                return;
            }
            setSuccess('Account created. Please verify your email before logging in.');
            setShowUnregisteredModal(false);
        } catch (err: unknown) {
            setError('Failed to connect to Auth Service via API Gateway.');
            setShowUnregisteredModal(false);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const result = await requestLogin(email, password);
            if (result.kind === 'error') {
                if (result.code === 'USER_NOT_FOUND') {
                    setShowUnregisteredModal(true);
                } else {
                    setError(result.message);
                }
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
        <>
            {showUnregisteredModal && (
                <UnregisteredEmailModal
                    email={email}
                    onClose={() => setShowUnregisteredModal(false)}
                    onRegister={handleDirectRegister}
                    loading={loading}
                />
            )}
            <form onSubmit={handleLogin} className="auth-form">
            {error && <div className="toast-error">{error}</div>}
            {success && <div className="toast-success">{success}</div>}
            
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
                {loading ? 'Logging in...' : 'Log In'}
            </button>
            <p className="text-muted auth-switch">
                No account?{' '}
                <button type="button" className="link-button" onClick={onSwitchTab}>
                    Register here
                </button>
            </p>
                
            <button 
                type="button" 
                className="link-button" 
                onClick={onForgotPassword}
                style={{ fontSize: '0.85rem' }}
            >
                Forgot password?
            </button>
        </form>
        </>
    );
};

export default LoginForm;