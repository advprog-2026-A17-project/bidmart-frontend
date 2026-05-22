import { useNowTick } from '../hooks/useNowTick';
import AppIcon from '../components/AppIcon';

interface SessionCountdownProps {
    expiresAt: number | null;
    enabled: boolean;
}

const formatSessionRemaining = (seconds: number | null) => {
    if (seconds === null) return null;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = seconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
    }
    return `${minutes}:${String(remaining).padStart(2, '0')}`;
};

export default function SessionCountdown({ expiresAt, enabled }: SessionCountdownProps) {
    const nowMs = useNowTick(1000);
    const remainingSeconds = expiresAt && enabled
        ? Math.max(0, Math.floor((expiresAt - nowMs) / 1000))
        : null;

    if (remainingSeconds === null) return null;

    return (
        <div className={`session-timer ${remainingSeconds <= 300 ? 'session-timer-warning' : ''}`}>
            <AppIcon name="clock" size={16} />
            <span>Session ends in {formatSessionRemaining(remainingSeconds)}</span>
        </div>
    );
}
