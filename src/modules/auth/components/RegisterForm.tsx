import React, { useState } from 'react';
import { requestRegistration } from '../utils/auth-api';
import GoogleLoginButton from './GoogleLoginButton';
import PasswordField from '../../../components/PasswordField';

interface RegisterFormProps {
    initialRole?: 'BUYER' | 'SELLER';
    onSwitchTab: () => void;
}

const ROLES = [
    {
        value: 'BUYER',
        title: 'Pembeli',
        description: 'Jelajahi lelang, menawar, kelola saldo dompet, dan lacak pembelian.',
        icon: 'shopping_bag',
    },
    {
        value: 'SELLER',
        title: 'Penjual',
        description: 'Kelola Seller Studio, buat listing, publikasikan lelang, dan kelola pencairan.',
        icon: 'storefront',
    },
] as const;

const RegisterForm: React.FC<RegisterFormProps> = ({ initialRole = 'BUYER', onSwitchTab }) => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'BUYER' | 'SELLER'>(initialRole);
    const [loading, setLoading] = useState(false);
    const [oauthBusy, setOauthBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (oauthBusy) {
            return;
        }
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const result = await requestRegistration(email, password, role);
            if (result.kind === 'error') {
                setError(result.message);
                return;
            }
            setSuccess(role === 'BUYER'
                ? 'Akun pembeli dibuat. Verifikasi email lalu masuk untuk mulai berbelanja.'
                : 'Akun penjual dibuat. Verifikasi email lalu masuk ke Seller Studio.');
            setPassword('');
            // Optionally, you can automatically switch back to login here after a delay
        } catch (err: unknown) {
            setError('Failed to connect to Auth Service via API Gateway.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleRegister} className="auth-form">
            {error && <div className="toast-error">{error}</div>}
            {success && <div className="toast-success">{success}</div>}

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
            <div className="field">
                <span>Daftar sebagai</span>
                <div className="account-type-grid" role="radiogroup" aria-label="Daftar sebagai">
                    {ROLES.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            className={`account-type-card ${role === item.value ? 'account-type-card-active' : ''}`}
                            onClick={() => setRole(item.value)}
                            role="radio"
                            aria-checked={role === item.value}
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
                            <strong>{item.title}</strong>
                            <small>{item.description}</small>
                        </button>
                    ))}
                </div>
            </div>
            <button className="primary-button" type="submit" disabled={loading || oauthBusy}>
                {loading ? 'Registering...' : 'Create Account'}
            </button>
            {googleClientId && (
                <>
                    <div className="oauth-divider">or</div>
                    <GoogleLoginButton
                        clientId={googleClientId}
                        disabled={loading || oauthBusy}
                        onError={(message) => {
                            setError(message);
                            setSuccess(null);
                        }}
                        onClearError={() => setError(null)}
                        onBusyChange={setOauthBusy}
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
