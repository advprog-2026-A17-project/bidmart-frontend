import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import AuctionDetailPage from './modules/auction/pages/AuctionDetailPage';
import CataloguePage from './modules/catalogue/pages/CataloguePage';
import WalletPage from './modules/wallet/pages/WalletPage';
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
        <nav className="app-nav">
            <strong className="app-brand">BidMart</strong>
            <Link to="/" className="app-nav-link">Home (Catalogue)</Link>
            <Link to="/auctions/demo" className="app-nav-link">Live Auction</Link>
            <Link to="/wallet" className="app-nav-link">Wallet</Link>
            <div className="app-nav-right">
                {user ? (
                    <>
                        <span className="app-user-pill">
                            {user.email}
                            {user.roles?.length > 0 && (
                                <span className="app-role-pill">
                                    {user.roles[0].name}
                                </span>
                            )}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="app-logout-button"
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <Link to="/login" className="app-nav-link">Login</Link>
                )}
            </div>
        </nav>
    );
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="app-container">
                    <Navbar />
                    <main className="app-main">
                        <Routes>
                            <Route path="/" element={<CataloguePage />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/auctions/:id" element={<AuctionDetailPage />} />
                            <Route path="/wallet" element={<WalletPage />} />
                        </Routes>
                    </main>
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;
