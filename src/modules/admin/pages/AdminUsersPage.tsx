import React from 'react';
import AdminAuthPage from '../../auth/pages/AdminAuthPage';

const AdminUsersPage: React.FC = () => (
    <div className="section-stack">
        <section className="page-head studio-head">
            <h1>Users</h1>
            <p className="text-muted">Manage roles, permissions, and account status.</p>
        </section>
        <AdminAuthPage />
    </div>
);

export default AdminUsersPage;
