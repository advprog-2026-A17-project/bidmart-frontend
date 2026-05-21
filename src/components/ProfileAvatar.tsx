import React from 'react';

type ProfileAvatarProps = {
    src?: string | null;
    name?: string | null;
    size?: number;
    className?: string;
};

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
    src,
    name,
    size = 40,
    className = '',
}) => {
    const trimmedSrc = src?.trim() || null;
    const label = name?.trim() || 'User';

    if (trimmedSrc) {
        return (
            <img
                src={trimmedSrc}
                alt={`${label} profile`}
                className={`profile-avatar-image ${className}`.trim()}
                style={{ width: size, height: size }}
                onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.style.display = 'none';
                    const fallback = event.currentTarget.nextElementSibling;
                    if (fallback instanceof HTMLElement) {
                        fallback.style.display = 'inline-flex';
                    }
                }}
            />
        );
    }

    return (
        <span
            className={`profile-avatar-fallback ${className}`.trim()}
            style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.42)) }}
            aria-hidden="true"
        >
            <span className="material-symbols-outlined">person</span>
        </span>
    );
};

export const ProfileAvatarWithFallback: React.FC<ProfileAvatarProps> = (props) => {
    const trimmedSrc = props.src?.trim() || null;
    const label = props.name?.trim() || 'User';
    const size = props.size ?? 40;

    return (
        <span className="profile-avatar-wrap" style={{ width: size, height: size }}>
            {trimmedSrc ? (
                <>
                    <img
                        src={trimmedSrc}
                        alt={`${label} profile`}
                        className={`profile-avatar-image ${props.className ?? ''}`.trim()}
                        style={{ width: size, height: size }}
                        onError={(event) => {
                            event.currentTarget.style.display = 'none';
                            const fallback = event.currentTarget.parentElement?.querySelector('.profile-avatar-fallback');
                            if (fallback instanceof HTMLElement) {
                                fallback.style.display = 'inline-flex';
                            }
                        }}
                    />
                    <span
                        className="profile-avatar-fallback"
                        style={{ width: size, height: size, display: 'none', fontSize: Math.max(12, Math.round(size * 0.42)) }}
                        aria-hidden="true"
                    >
                        <span className="material-symbols-outlined">person</span>
                    </span>
                </>
            ) : (
                <ProfileAvatar {...props} />
            )}
        </span>
    );
};

export default ProfileAvatar;
