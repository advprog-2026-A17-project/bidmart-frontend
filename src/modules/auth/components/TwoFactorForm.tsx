import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import { requestTwoFactorLogin } from '../utils/auth-api';

interface TwoFactorFormProps {
    challengeToken: string;
    onCancel: () => void;
}

const TwoFactorForm: React.FC<TwoFactorFormProps> = ({ challengeToken, onCancel }) => {
    const { login } = useAuth();
    const navigate = useNavigate();
    
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTwoFactorLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const result = await requestTwoFactorLogin(challengeToken, twoFactorCode);
            if (result.kind === 'error') {
                setError(result.message);
                return;
            }
            if (result.kind === 'challenge') {
                setError('Two-factor verification requires a new login challenge.');
                return;
            }
            if (result.kind === 'email_not_verified') {
                setError(result.message);
                return;
            }
            login(result.payload);
            navigate('/');
        } catch (err: unknown) {
            setError('Failed to verify two-factor challenge via API Gateway.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleTwoFactorLogin} className="auth-form">
            {error && <div className="toast-error">{error}</div>}
            <div className="toast-success">Two-factor verification required.</div>
            
            <label className="field">
                <span>Two-factor code</span>
                <input
                    className="form-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={twoFactorCode}
                    required
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                />
            </label>
            <button className="primary-button" type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
            <button type="button" className="secondary-button" onClick={onCancel}>
                Back
            </button>
        </form>
    );
};

export default TwoFactorForm;