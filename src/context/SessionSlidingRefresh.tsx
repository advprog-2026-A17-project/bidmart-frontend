import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

/**
 * Extends the session when the user navigates between SPA routes.
 * Does not reload the page — only may call the token refresh API in the background.
 */
const SessionSlidingRefresh = () => {
    const { pathname, search } = useLocation();
    const { maybeRefreshSession, user } = useAuth();
    const skipInitialRef = useRef(true);

    useEffect(() => {
        if (!user) {
            skipInitialRef.current = true;
            return;
        }

        if (skipInitialRef.current) {
            skipInitialRef.current = false;
            return;
        }

        maybeRefreshSession();
    }, [maybeRefreshSession, pathname, search, user]);

    return null;
};

export default SessionSlidingRefresh;
