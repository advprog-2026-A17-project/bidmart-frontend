import React, { useState } from 'react';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import ForgotPasswordForm from '../components/ForgotPasswordForm';

type Tab = 'login' | 'register' | 'forgot-password';

const AuthPage: React.FC = () => {
    const [tab, setTab] = useState<Tab>('login');

    return (
        <div className="auth-wrap">
            <div className="auth-card">
                <div className="auth-logo-wrap">
                    <div className="app-logo">BM</div>
                    <h1>BidMart</h1>
                    <p>Win amazing items at great prices</p>
                </div>

                <div className="auth-tabs">
                    {(['login', 'register'] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`auth-tab ${tab === t ? 'auth-tab-active' : ''}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {tab === 'login' && (
                    <LoginForm 
                        onSwitchTab={() => setTab('register')} 
                        onForgotPassword={() => setTab('forgot-password')} 
                    />
                )}
                {tab === 'register' && (
                    <RegisterForm onSwitchTab={() => setTab('login')} />
                )}
                {tab === 'forgot-password' && (
                    <ForgotPasswordForm onBackToLogin={() => setTab('login')} />
                )}
            </div>
        </div>
    );
};

export default AuthPage;