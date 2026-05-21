import React, { useState } from 'react';

type PasswordFieldProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    minLength?: number;
    autoComplete?: string;
    showToggle?: boolean;
    visible?: boolean;
    onVisibleChange?: (visible: boolean) => void;
};

export const PasswordField: React.FC<PasswordFieldProps> = ({
    label,
    value,
    onChange,
    placeholder = '••••••••',
    required = false,
    minLength,
    autoComplete,
    showToggle = true,
    visible: controlledVisible,
    onVisibleChange,
}) => {
    const [internalVisible, setInternalVisible] = useState(false);
    const visible = controlledVisible ?? internalVisible;
    const toggleVisible = () => {
        const next = !visible;
        if (onVisibleChange) {
            onVisibleChange(next);
        } else {
            setInternalVisible(next);
        }
    };

    return (
        <label className="field">
            <span>{label}</span>
            <div className="password-row">
                <input
                    className="form-input"
                    type={showToggle && visible ? 'text' : 'password'}
                    placeholder={placeholder}
                    value={value}
                    required={required}
                    minLength={minLength}
                    autoComplete={autoComplete}
                    onChange={(event) => onChange(event.target.value)}
                />
                {showToggle && (
                    <button type="button" className="secondary-button" onClick={toggleVisible}>
                        {visible ? 'Hide' : 'Show'}
                    </button>
                )}
            </div>
        </label>
    );
};

export default PasswordField;
