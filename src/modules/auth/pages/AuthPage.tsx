import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BackButton from '../../../components/BackButton';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import ForgotPasswordForm from '../components/ForgotPasswordForm';

type Tab = 'login' | 'register' | 'forgot-password';

const AuthPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const requestedTab = searchParams.get('tab') === 'register' ? 'register' : 'login';
    const [tab, setTab] = useState<Tab>(requestedTab);

    return (
        <div className="auth-wrap">
            <div className="auth-card">
                <BackButton fallback="/" />
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
