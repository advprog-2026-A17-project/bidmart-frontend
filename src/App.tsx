import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import CatalogPage from './modules/catalogue/pages/CatalogPage';
import LoginPage from './modules/auth/pages/LoginPage';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import './App.css';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav style={{ padding: '1rem', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', gap: '20px', alignItems: 'center' }}>
            <strong className="text-gradient" style={{ fontSize: '1.2rem', marginRight: '20px' }}>BidMart</strong>
            <Link to="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 500 }}>Katalog Lelang</Link>
            
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '15px' }}>
                {user ? (
                    <>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            {user.email}
                            {user.roles?.length > 0 && (
                                <span style={{ marginLeft: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                    {user.roles[0].name}
                                </span>
                            )}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="btn btn-danger"
                            style={{ padding: '6px 14px', fontSize: '0.9rem' }}
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <Link to="/login" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.9rem', textDecoration: 'none' }}>Login</Link>
                )}
            </div>
        </nav>
    );
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                    <Navbar />
                    <main style={{ flex: 1 }}>
                        <Routes>
                            <Route path="/" element={<CatalogPage />} />
                            <Route path="/login" element={<LoginPage />} />
                        </Routes>
                    </main>
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;