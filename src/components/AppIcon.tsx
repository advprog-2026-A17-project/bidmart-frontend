import React from 'react';

type AppIconName =
    | 'alert'
    | 'archive'
    | 'bell'
    | 'box'
    | 'check'
    | 'chevronLeft'
    | 'chevronRight'
    | 'clock'
    | 'close'
    | 'filter'
    | 'gavel'
    | 'home'
    | 'logIn'
    | 'logOut'
    | 'list'
    | 'package'
    | 'refresh'
    | 'search'
    | 'truck'
    | 'eye'
    | 'eyeOff'
    | 'wallet';

type AppIconProps = {
    name: AppIconName;
    className?: string;
    size?: number;
    title?: string;
};

const paths: Record<AppIconName, React.ReactNode> = {
    alert: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 4.2 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" /></>,
    archive: <><path d="M3 7h18" /><path d="M5 7v13h14V7" /><path d="M8 7V4h8v3" /><path d="M10 12h4" /></>,
    bell: <><path d="M12 3.5a4 4 0 0 0-4 4v1.1c0 1.2-.4 2.3-1.2 3.3L5.6 13.5a1.5 1.5 0 0 0 1.2 2.5h10.4a1.5 1.5 0 0 0 1.2-2.5l-1.2-1.6A5.3 5.3 0 0 1 16 8.6V7.5a4 4 0 0 0-4-4Z" /><path d="M10 18a2 2 0 0 0 4 0" /></>,
    box: <><path d="m3 7 9 5 9-5" /><path d="M12 22V12" /><path d="m21 7-9-5-9 5v10l9 5 9-5Z" /></>,
    check: <path d="m20 6-11 11-5-5" />,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
    filter: <><path d="M3 5h18" /><path d="M6 12h12" /><path d="M10 19h4" /></>,
    gavel: <><path d="m14 13-7 7" /><path d="m8 6 10 10" /><path d="m6 8 4-4 10 10-4 4Z" /><path d="M3 21h8" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10" /><path d="M9 21v-6h6v6" /></>,
    logIn: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="m10 17 5-5-5-5" /><path d="M15 12H3" /></>,
    logOut: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
    list: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></>,
    package: <><path d="M16.5 9.4 7.5 4.2" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /><path d="m21 7-9-5-9 5v10l9 5 9-5Z" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.9-4" /><path d="M5 3v4h4" /><path d="M4 13a8 8 0 0 0 14.9 4" /><path d="M19 21v-4h-4" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    truck: <><path d="M10 17H6V5h10v12h-2" /><path d="M16 8h3l2 3v6h-3" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <><path d="m3 3 18 18" /><path d="M10.6 10.6a3 3 0 0 0 3.8 3.8" /><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.1 4.2" /><path d="M6.6 6.6A17.7 17.7 0 0 0 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.1-.8" /></>,
    wallet: <><path d="M4 7h16v12H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14" /><path d="M16 12h4" /></>,
};

const AppIcon: React.FC<AppIconProps> = ({ name, className, size = 20, title }) => (
    <svg
        className={className ? `app-icon ${className}` : 'app-icon'}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
    >
        {title && <title>{title}</title>}
        {paths[name]}
    </svg>
);

export default AppIcon;
