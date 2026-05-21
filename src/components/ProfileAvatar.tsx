import React from 'react';
import { isValidImageReference } from '../utils/avatar-image';

type ProfileAvatarProps = {
    src?: string | null;
    name?: string | null;
    size?: number;
    className?: string;
};

const FALLBACK_ICON = <span className="material-symbols-outlined">person</span>;

const AvatarFallback: React.FC<{ size: number; className?: string; hidden?: boolean }> = ({
    size,
    className = '',
    hidden = false,
}) => (
    <span
        className={`profile-avatar-fallback ${className}`.trim()}
        style={{
            width: size,
            height: size,
            display: hidden ? 'none' : 'inline-flex',
            fontSize: Math.max(12, Math.round(size * 0.42)),
        }}
        aria-hidden="true"
    >
        {FALLBACK_ICON}
    </span>
);

const revealFallback = (image: HTMLImageElement) => {
    image.style.display = 'none';
    const fallback = image.parentElement?.querySelector('.profile-avatar-fallback');
    if (fallback instanceof HTMLElement) {
        fallback.style.display = 'inline-flex';
    }
};

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
    src,
    name,
    size = 40,
    className = '',
}) => {
    const label = name?.trim() || 'User';
    const trimmedSrc = src?.trim() || null;
    const safeSrc = trimmedSrc && isValidImageReference(trimmedSrc) ? trimmedSrc : null;

    if (!safeSrc) {
        return <AvatarFallback size={size} className={className} />;
    }

    return (
        <span className="profile-avatar-wrap" style={{ width: size, height: size }}>
            <img
                src={safeSrc}
                alt={`${label} profile`}
                className={`profile-avatar-image ${className}`.trim()}
                style={{ width: size, height: size }}
                onError={(event) => revealFallback(event.currentTarget)}
            />
            <AvatarFallback size={size} hidden />
        </span>
    );
};

export const ProfileAvatarWithFallback = ProfileAvatar;

export default ProfileAvatar;
