import React, { useState } from 'react';

interface UnregisteredEmailModalProps {
    email: string;
    onClose: () => void;
    onRegister: (role: string) => void;
    loading: boolean;
}

const UnregisteredEmailModal: React.FC<UnregisteredEmailModalProps> = ({ email, onClose, onRegister, loading }) => {
    const [role, setRole] = useState('BUYER');

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Account Not Found</h2>
                <p>
                    The email <strong>{email}</strong> is not registered.
                    Would you like to create a new account instead?
                </p>
                
                <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Select Role</label>
                    <select 
                        value={role} 
                        onChange={(e) => setRole(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                        disabled={loading}
                    >
                        <option value="BUYER">Buyer</option>
                        <option value="SELLER">Seller</option>
                    </select>
                </div>

                <div className="modal-actions">
                    <button className="secondary-button" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button className="primary-button" onClick={() => onRegister(role)} disabled={loading}>
                        {loading ? 'Registering...' : 'Register Now'}
                    </button>
                </div>
            </div>
            <style>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .modal-content {
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    text-align: center;
                }
                .modal-content h2 {
                    margin-top: 0;
                    color: #333;
                }
                .modal-content p {
                    color: #666;
                    line-height: 1.5;
                }
                .modal-actions {
                    margin-top: 2rem;
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                }
            `}</style>
        </div>
    );
};

export default UnregisteredEmailModal;
