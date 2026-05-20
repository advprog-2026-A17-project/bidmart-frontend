import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import { requestLogin, requestResendVerification } from '../utils/auth-api';
import { resolvePostLoginPath } from '../utils/post-auth-navigation';
import GoogleLoginButton from './GoogleLoginButton';
import TwoFactorForm from './TwoFactorForm';

export const LOGIN_VERIFY_ENDPOINT = '/api/v1/auth/2fa/login-verify';

interface LoginFormProps {
    onSwitchTab: () => void;
    onForgotPassword: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchTab, onForgotPassword }) => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [oauthBusy, setOauthBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [twoFactorChallenge, setTwoFactorChallenge] = useState<string | null>(null);

    // Email-not-verified state
    const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (oauthBusy) {
            return;
        }
        setLoading(true);
        setError(null);
        setUnverifiedEmail(null);
        setResendSuccess(false);
        try {
            const result = await requestLogin(email, password);
            if (result.kind === 'email_not_verified') {
                setError(result.message);
                setUnverifiedEmail(result.email);
                return;
            }
            if (result.kind === 'error') {
                setError(result.message);
                return;
            }
            if (result.kind === 'challenge') {
                setTwoFactorChallenge(result.token);
                return;
            }
            login(result.payload);
            navigate(await resolvePostLoginPath(result.payload.accessToken));
        } catch (err: unknown) {
            setError('Failed to connect to Auth Service via API Gateway.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleResendVerification = async () => {
        if (!unverifiedEmail || resendLoading) return;
        setResendLoading(true);
        setResendSuccess(false);
        try {
            const result = await requestResendVerification(unverifiedEmail);
            if (result.kind === 'success') {
                setResendSuccess(true);
                setError(null);
            } else {
                setError(result.message);
            }
        } catch {
            setError('Failed to resend verification email. Please try again.');
        } finally {
            setResendLoading(false);
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
            {error && (
                <div className="toast-error">
                    {error}
                    {unverifiedEmail && !resendSuccess && (
                        <div style={{ marginTop: '8px' }}>
                            <button
                                type="button"
                                className="link-button"
                                onClick={handleResendVerification}
                                disabled={resendLoading}
                                style={{ fontSize: '0.85rem' }}
                            >
                                {resendLoading ? 'Sending...' : '📧 Resend verification email'}
                            </button>
                        </div>
                    )}
                </div>
            )}
            {resendSuccess && (
                <div className="toast-success">
                    ✅ Verification email sent! Please check your inbox and spam folder.
                </div>
            )}
            
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
                <div className="field-footer">
                    <button
                        type="button"
                        className="link-button field-link"
                        onClick={onForgotPassword}
                    >
                        Forgot password?
                    </button>
                </div>
            </label>
            <button className="primary-button auth-primary-action" type="submit" disabled={loading || oauthBusy}>
                {loading ? 'Logging in...' : 'Log In'}
            </button>
            {googleClientId && (
                <>
                    <div className="oauth-divider">or</div>
                    <GoogleLoginButton
                        clientId={googleClientId}
                        disabled={loading || oauthBusy}
                        onError={(message) => setError(message)}
                        onClearError={() => setError(null)}
                        onBusyChange={setOauthBusy}
                    />
                </>
            )}
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
