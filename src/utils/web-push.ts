import { gatewayUrl, readApiError } from '../config/apiClient';

type VapidKeyResponse = {
    publicKey?: string;
    enabled?: boolean;
};

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
};

const isPushSupported = (): boolean =>
    typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;

export const registerWebPushSubscription = async (
    authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): Promise<{ ok: boolean; message?: string }> => {
    if (!isPushSupported()) {
        return { ok: false, message: 'Browser push notifications are not supported on this device.' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        return { ok: false, message: 'Notification permission was not granted.' };
    }

    const vapidResponse = await authenticatedFetch(gatewayUrl('/api/v1/notifications/push/vapid-public-key'));
    if (!vapidResponse.ok) {
        return { ok: false, message: await readApiError(vapidResponse, 'Failed to load push configuration') };
    }

    const vapidPayload = await vapidResponse.json() as VapidKeyResponse;
    if (!vapidPayload.enabled || !vapidPayload.publicKey) {
        return { ok: false, message: 'Push notifications are not configured on the server yet.' };
    }

    const registration = await navigator.serviceWorker.register('/push-sw.js');
    await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPayload.publicKey) as BufferSource,
    });

    const json = subscription.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
        return { ok: false, message: 'Could not read browser push subscription keys.' };
    }

    const registerResponse = await authenticatedFetch(gatewayUrl('/api/v1/notifications/push/subscriptions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            endpoint,
            keys: { p256dh, auth },
        }),
    });

    if (!registerResponse.ok) {
        return { ok: false, message: await readApiError(registerResponse, 'Failed to register push subscription') };
    }

    return { ok: true };
};

export const unregisterWebPushSubscription = async (
    authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): Promise<void> => {
    if (!isPushSupported()) {
        return;
    }

    const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
    if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
        }
    }

    await authenticatedFetch(gatewayUrl('/api/v1/notifications/push/subscriptions'), {
        method: 'DELETE',
    });
};
