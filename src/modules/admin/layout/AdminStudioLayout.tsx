import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const AdminStudioLayout: React.FC = () => (
    <div className="page-wrap admin-studio-layout">
        <aside className="admin-studio-sidebar panel">
            <p className="eyebrow">Admin Studio</p>
            <nav className="admin-studio-nav">
                <NavLink to="/admin/studio/users" className={({ isActive }) => `admin-studio-link ${isActive ? 'is-active' : ''}`}>
                    Users
                </NavLink>
                <NavLink to="/admin/studio/listings" className={({ isActive }) => `admin-studio-link ${isActive ? 'is-active' : ''}`}>
                    Listings
                </NavLink>
                <NavLink to="/admin/studio/disputes" className={({ isActive }) => `admin-studio-link ${isActive ? 'is-active' : ''}`}>
                    Disputes
                </NavLink>
            </nav>
        </aside>
        <section className="admin-studio-content">
            <Outlet />
        </section>
    </div>
);

export default AdminStudioLayout;
