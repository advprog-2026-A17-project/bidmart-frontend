import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import type { AuthUser } from '../context/auth-context';

/**
 * Custom hook for listening to session revocation events.
 * When a REVOKE_SESSION message is received, it triggers a logout.
 */
export const useSessionRevocation = (
    user: AuthUser | null,
    tokenId: string | null,
    logout: (() => void) | null,
) => {
    const { subscribe, unsubscribe, isConnected } = useWebSocket();

    useEffect(() => {
        console.log('[SessionRevocation] Hook triggered:', { isConnected, hasUser: !!user, tokenId });
        
        if (!isConnected || !user || !tokenId || !logout) {
            return;
        }

        const destination = `/topic/sessions/${tokenId}`;
        console.log('[SessionRevocation] Subscribing to:', destination);

        const handleRevocation = (message: unknown) => {
            console.warn('[SessionRevocation] RECEIVED revocation event:', message);
            
            // Immediately logout the user
            if (logout) {
                console.log('[SessionRevocation] Triggering logout redirect...');
                logout();
                // Redirect to login
                window.location.href = '/login';
            }
        };

        subscribe(destination, handleRevocation);

        return () => {
            console.log('[SessionRevocation] Unsubscribing from:', destination);
            unsubscribe(destination);
        };
    }, [isConnected, user, tokenId, subscribe, unsubscribe, logout]);
};
