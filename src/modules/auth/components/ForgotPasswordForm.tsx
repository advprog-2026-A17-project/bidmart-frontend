import React, { useState } from 'react';
import PageToast from '../../../components/PageToast';
import { requestForgotPassword } from '../utils/auth-api';

interface ForgotPasswordFormProps {
    onBackToLogin: () => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBackToLogin }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        const outcome = await requestForgotPassword(email);
        if (outcome.kind === 'error') {
            setError(outcome.message);
        } else {
            setSuccess('If an account exists for that email, we have sent a password reset link.');
            setEmail('');
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleResetSubmit} className="auth-form">
            <div className="form-header text-center" style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Reset Password</h3>
                <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                    Enter your email address and we'll send you a link to reset your password.
                </p>
            </div>

            <PageToast error={error} success={success} />

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

            <button className="primary-button" type="submit" disabled={loading}>
                {loading ? 'Sending link...' : 'Send Reset Link'}
            </button>
            
            <button type="button" className="secondary-button" onClick={onBackToLogin}>
                Back to Login
            </button>
        </form>
    );
};

export default ForgotPasswordForm;