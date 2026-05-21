import React, { useState } from 'react';
import { requestRegistration } from '../utils/auth-api';
import PasswordField from '../../../components/PasswordField';
import PageToast from '../../../components/PageToast';
import GoogleLoginButton from './GoogleLoginButton';
import TwoFactorForm from './TwoFactorForm';

interface RegisterFormProps {
    onSwitchTab: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchTab }) => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [oauthBusy, setOauthBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [twoFactorChallenge, setTwoFactorChallenge] = useState<string | null>(null);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (oauthBusy) {
            return;
        }
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const result = await requestRegistration(email, password);
            if (result.kind === 'error') {
                setError(result.message);
                return;
            }
            setSuccess(
                'Akun dibuat. Verifikasi email Anda, lalu masuk. Setelah login, lengkapi profil di halaman onboarding.'
            );
            setPassword('');
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
        <form onSubmit={handleRegister} className="auth-form">
            <PageToast error={error} success={success} />

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
            <PasswordField
                label="Password"
                value={password}
                onChange={setPassword}
                required
                visible={showPassword}
                onVisibleChange={setShowPassword}
            />
            <button className="primary-button auth-primary-action" type="submit" disabled={loading || oauthBusy}>
                {loading ? 'Registering...' : 'Create Account'}
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
                        onTwoFactorChallenge={(token) => setTwoFactorChallenge(token)}
                    />
                </>
            )}
            <p className="text-muted auth-switch">
                Already have an account?{' '}
                <button type="button" className="link-button" onClick={onSwitchTab}>
                    Log in
                </button>
            </p>
        </form>
    );
};

export default RegisterForm;
