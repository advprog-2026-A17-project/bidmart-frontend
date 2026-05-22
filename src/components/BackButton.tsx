import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from './AppIcon';

const BackButton: React.FC<{ label?: string; fallback?: string }> = ({ label = 'Back', fallback = '/' }) => {
    const navigate = useNavigate();

    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate(fallback);
    };

    return (
        <button type="button" className="back-button" onClick={goBack}>
            <AppIcon name="chevronLeft" size={18} />
            {label}
        </button>
    );
};

export default BackButton;
