import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { requestEmailVerification } from '../utils/auth-api';
import PageToast from '../../../components/PageToast';

const VerifyEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    
    // Prevents the effect from running twice in React Strict Mode
    const hasAttempted = useRef(false);

    useEffect(() => {
        if (!token) {
            setTimeout(() => {
                setStatus('error');
                setErrorMessage('No verification token found in the URL.');
            }, 0);
            return;
        }

        if (hasAttempted.current) return;
        hasAttempted.current = true;

        const verify = async () => {
            try {
                const result = await requestEmailVerification(token);
                if (result.kind === 'success') {
                    setStatus('success');
                } else {
                    setStatus('error');
                    setErrorMessage(result.message);
                }
            } catch (err) {
                setStatus('error');
                setErrorMessage('Failed to connect to the server.');
                console.error(err);
            }
        };

        verify();
    }, [token]);

    const toastError = status === 'error' ? errorMessage : null;
    const toastSuccess = status === 'success' ? 'Your email has been verified.' : null;

    return (
        <div className="auth-wrap">
            <PageToast error={toastError} success={toastSuccess} />
            <div className="auth-card" style={{ textAlign: 'center' }}>
                <div className="auth-logo-wrap">
                    <div className="app-logo">BM</div>
                    <h1>Email Verification</h1>
                </div>

                {status === 'loading' && (
                    <div style={{ padding: '2rem 0' }}>
                        <p className="text-muted">Verifying your email address, please wait...</p>
                        {/* You can replace this with a spinner if you have one */}
                        <div className="spinner" style={{ marginTop: '1rem' }}>⌛</div>
                    </div>
                )}

                {status === 'success' && (
                    <div style={{ padding: '1rem 0' }}>
                        <h2 style={{ marginTop: 0 }}>Email verified</h2>
                        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                            Your BidMart account is now fully active. You can log in to start bidding and selling.
                        </p>
                        <button 
                            className="primary-button" 
                            onClick={() => navigate('/login')} // Adjust this route to wherever your AuthPage lives
                        >
                            Go to Login
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div style={{ padding: '1rem 0' }}>
                        <h2 style={{ marginTop: 0 }}>Verification failed</h2>
                        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                            {errorMessage} If you are having trouble, try requesting a new verification link from the login page.
                        </p>
                        <button 
                            className="secondary-button" 
                            onClick={() => navigate('/login')}
                        >
                            Back to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VerifyEmailPage;