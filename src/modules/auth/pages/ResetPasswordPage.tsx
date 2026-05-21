import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PasswordField from '../../../components/PasswordField';
import { requestResetPassword } from '../utils/auth-api';

const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token') ?? '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (redirectTimerRef.current) {
            clearTimeout(redirectTimerRef.current);
        }
    }, []);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        if (!token) {
            setError('Reset link is missing or invalid. Request a new link from the login page.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        const outcome = await requestResetPassword(token, password);
        setLoading(false);

        if (outcome.kind === 'error') {
            setError(outcome.message);
            return;
        }

        setSuccess('Password updated. You can sign in with your new password.');
        redirectTimerRef.current = setTimeout(() => navigate('/login'), 1500);
    };

    return (
        <div className="page-wrap auth-page-wrap">
            <section className="panel auth-panel">
                <h1>Choose a new password</h1>
                <p className="text-muted">Enter a strong password for your BidMart account.</p>

                {error && <div className="toast-error">{error}</div>}
                {success && <div className="toast-success">{success}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <PasswordField
                        label="New password"
                        value={password}
                        onChange={setPassword}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        showToggle={false}
                    />
                    <PasswordField
                        label="Confirm password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        showToggle={false}
                    />
                    <button className="primary-button" type="submit" disabled={loading || !token}>
                        {loading ? 'Updating...' : 'Update password'}
                    </button>
                </form>

                <p className="text-muted" style={{ marginTop: '1rem' }}>
                    <Link to="/login">Back to login</Link>
                </p>
            </section>
        </div>
    );
};

export default ResetPasswordPage;
