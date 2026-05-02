import React, { useState } from 'react';
import { requestRegistration } from '../utils/auth-api';

interface RegisterFormProps {
    onSwitchTab: () => void;
}

const ROLES = ['BUYER', 'SELLER'];

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchTab }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('BUYER');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

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
                {loading ? 'Registering...' : 'Create Account'}
            </button>
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