import { useEffect, useState } from 'react';

export const useNowTick = (intervalMs = 1000): number => {
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => {
            setNowMs(Date.now());
        }, intervalMs);

        return () => window.clearInterval(timer);
    }, [intervalMs]);

    return nowMs;
};
