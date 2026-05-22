import { apiUrl } from '../../../config/api';
import { readApiError } from '../../../config/apiClient';
import type { AuthLoginResult } from '../../../context/auth-context';

export type LoginResponsePayload = AuthLoginResult | { challengeToken: string };

export type LoginOutcome =
    | { kind: 'success'; payload: AuthLoginResult }
    | { kind: 'challenge'; token: string }
    | { kind: 'email_not_verified'; email: string; message: string }
    | { kind: 'error'; message: string };

export type RegistrationOutcome =
    | { kind: 'success' }
    | { kind: 'error'; message: string };

export const isTwoFactorChallenge = (payload: LoginResponsePayload): payload is { challengeToken: string } =>
    'challengeToken' in payload;

export const postJson = async <T,>(path: string, body: unknown): Promise<{ response: Response; payload: T | null }> => {
    const response = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const payload = response.ok ? await response.json() as T : null;
    return { response, payload };
};

export const requestLogin = async (email: string, password: string): Promise<LoginOutcome> => {
    const response = await fetch(apiUrl('/api/v1/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (response.status === 401) {
        return { kind: 'error', message: 'Invalid email or password.' };
    }
    if (response.status === 403) {
        const errData = await response.json().catch(() => ({})) as { error?: string; message?: string };
        if (errData.error === 'EMAIL_NOT_VERIFIED') {
            return { kind: 'email_not_verified', email, message: 'Your email is not verified yet. Please check your inbox for the verification link, or resend it below.' };
        }
        return { kind: 'error', message: errData.message ?? 'Access denied.' };
    }
    if (!response.ok) {
        return { kind: 'error', message: await readApiError(response, 'Login failed') };
    }

    const payload = await response.json() as LoginResponsePayload | null;
    if (!payload) {
        return { kind: 'error', message: 'Login failed: empty response.' };
    }
    if (isTwoFactorChallenge(payload)) {
        return { kind: 'challenge', token: payload.challengeToken };
    }
    return { kind: 'success', payload };
};

export const requestTwoFactorLogin = async (challengeToken: string, code: string): Promise<LoginOutcome> => {
    const { response, payload } = await postJson<AuthLoginResult>(
        '/api/v1/auth/2fa/login-verify',
        { challengeToken, code },
    );

    if (!response.ok) {
        return { kind: 'error', message: await readApiError(response, 'Two-factor verification failed') };
    }
    if (!payload) {
        return { kind: 'error', message: 'Two-factor verification failed: empty response.' };
    }
    return { kind: 'success', payload };
};

export const requestOAuthLogin = async (provider: 'google', idToken: string): Promise<LoginOutcome> => {
    const response = await fetch(apiUrl('/api/v1/auth/oauth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, idToken }),
    });

    if (!response.ok) {
        return { kind: 'error', message: await readApiError(response, 'OAuth login failed') };
    }

    const payload = await response.json() as LoginResponsePayload | null;
    if (!payload) {
        return { kind: 'error', message: 'OAuth login failed: empty response.' };
    }
    if (isTwoFactorChallenge(payload)) {
        return { kind: 'challenge', token: payload.challengeToken };
    }
    return { kind: 'success', payload: payload as AuthLoginResult };
};

export const requestRegistration = async (email: string, password: string): Promise<RegistrationOutcome> => {
    const response = await fetch(apiUrl('/api/v1/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
        return { kind: 'success' };
    }

    const errData = await response.json().catch(() => ({})) as { message?: string };
    return { kind: 'error', message: errData.message ?? `Registration failed: HTTP ${response.status}` };
};

export const requestEmailVerification = async (token: string): Promise<{ kind: 'success' } | { kind: 'error'; message: string }> => {
    const response = await fetch(apiUrl('/api/v1/auth/verify-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    });

    if (response.ok) {
        return { kind: 'success' };
    }

    const errData = await response.json().catch(() => ({})) as { message?: string };
    return { kind: 'error', message: errData.message ?? 'Verification failed. The link may be invalid or expired.' };
};

export const requestForgotPassword = async (email: string): Promise<{ kind: 'success' } | { kind: 'error'; message: string }> => {
    const response = await fetch(apiUrl('/api/v1/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });

    if (response.ok || response.status === 204) {
        return { kind: 'success' };
    }

    return { kind: 'error', message: await readApiError(response, 'Failed to request password reset.') };
};

export const requestResetPassword = async (
    token: string,
    newPassword: string,
): Promise<{ kind: 'success' } | { kind: 'error'; message: string }> => {
    const response = await fetch(apiUrl('/api/v1/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
    });

    if (response.ok || response.status === 204) {
        return { kind: 'success' };
    }

    return { kind: 'error', message: await readApiError(response, 'Password reset failed. The link may be invalid or expired.') };
};

export type PublicSellerProfile = {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
};

export const fetchPublicSellerProfile = async (userId: string): Promise<PublicSellerProfile | null> => {
    const response = await fetch(apiUrl(`/api/v1/auth/users/${userId}/public-profile`));
    if (!response.ok) {
        return null;
    }
    return response.json() as Promise<PublicSellerProfile>;
};

export type ResendVerificationOutcome =
    | { kind: 'success' }
    | { kind: 'cooldown'; message: string }
    | { kind: 'error'; message: string };

export const requestResendVerification = async (email: string): Promise<ResendVerificationOutcome> => {
    const response = await fetch(apiUrl('/api/v1/auth/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });

    if (response.ok || response.status === 204) {
        return { kind: 'success' };
    }

    const errData = await response.json().catch(() => ({})) as { message?: string; error?: string };
    if (response.status === 429 || errData.error === 'VERIFICATION_RESEND_COOLDOWN') {
        return {
            kind: 'cooldown',
            message: errData.message ?? 'Please wait before requesting another verification email.',
        };
    }

    return { kind: 'error', message: errData.message ?? 'Failed to resend verification email.' };
};