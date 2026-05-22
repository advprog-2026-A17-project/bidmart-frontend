import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import { requestOAuthLogin } from '../utils/auth-api';
import { resolvePostLoginPath } from '../utils/post-auth-navigation';

const GOOGLE_SCRIPT_ID = 'google-oauth-client';
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleLoginButtonProps {
    clientId: string;
    disabled?: boolean;
    onError: (message: string) => void;
    onClearError?: () => void;
    onBusyChange?: (busy: boolean) => void;
    onCredential?: (credential: string) => Promise<void>;
    onTwoFactorChallenge?: (challengeToken: string) => void;
    className?: string;
    width?: number;
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
    clientId,
    disabled = false,
    onError,
    onClearError,
    onBusyChange,
    onCredential,
    onTwoFactorChallenge,
    className = '',
    width = 320,
}) => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const buttonRef = useRef<HTMLDivElement>(null);
    const initializedRef = useRef(false);
    const [ready, setReady] = useState(false);

    const handleCredential = useCallback(async (response: GoogleCredentialResponse) => {
        if (!response.credential) {
            onError('Google login failed: missing credentials.');
            return;
        }

        onClearError?.();
        onBusyChange?.(true);

        try {
            if (onCredential) {
                await onCredential(response.credential);
                return;
            }

            const result = await requestOAuthLogin('google', response.credential);
            if (result.kind === 'challenge') {
                onTwoFactorChallenge?.(result.token);
                return;
            }
            if (result.kind !== 'success') {
                onError(result.kind === 'error' ? result.message : 'Google login requires a fresh login.');
                return;
            }
            login(result.payload);
            navigate(await resolvePostLoginPath(result.payload.accessToken));
        } catch (err: unknown) {
            onError(err instanceof Error ? err.message : 'Failed to connect to Auth Service via API Gateway.');
            console.error(err);
        } finally {
            onBusyChange?.(false);
        }
    }, [login, navigate, onBusyChange, onClearError, onCredential, onError, onTwoFactorChallenge]);

    useEffect(() => {
        if (!clientId) {
            return;
        }

        if (window.google?.accounts?.id) {
            setReady(true);
            return;
        }

        const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
        if (existingScript) {
            if (existingScript.getAttribute('data-loaded') === 'true') {
                setReady(true);
            } else {
                existingScript.addEventListener('load', () => setReady(true), { once: true });
            }
            return;
        }

        const script = document.createElement('script');
        script.id = GOOGLE_SCRIPT_ID;
        script.src = GOOGLE_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            script.setAttribute('data-loaded', 'true');
            setReady(true);
        };
        script.onerror = () => onError('Failed to load Google login.');
        document.head.appendChild(script);
    }, [clientId, onError]);

    useEffect(() => {
        if (!ready || !buttonRef.current || initializedRef.current) {
            return;
        }
        if (!window.google?.accounts?.id) {
            onError('Google login is not available.');
            return;
        }

        window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredential,
        });
        buttonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: width,
        });
        initializedRef.current = true;
    }, [clientId, handleCredential, onError, ready, width]);

    const isDisabled = disabled || !ready;

    return (
        <div className={`oauth-button ${className} ${isDisabled ? 'oauth-button-disabled' : ''}`}>
            <div ref={buttonRef} />
            {!ready && <div className="oauth-loading">Loading Google...</div>}
        </div>
    );
};

export default GoogleLoginButton;
