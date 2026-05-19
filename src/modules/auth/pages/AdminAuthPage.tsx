import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { gatewayUrl, readApiError } from '../../../config/apiClient';

type RoleResponse = {
    id: string;
    name: string;
    permissions: string[];
};

type SessionResponse = {
    tokenId: string;
    email: string;
    createdAt: string;
    revoked: boolean;
    deviceInfo: string | null;
};

type PolicyDiagnostics = {
    maxConcurrentSessions: number;
    rateLimitMaxAttempts: number;
    rateLimitWindowSeconds: number;
};

const normalizePermissions = (raw: string) =>
    raw
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

const AdminAuthPage = () => {
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const isAdmin = useMemo(
        () => user?.roles?.some((role) => role.name === 'ADMIN') ?? false,
        [user]
    );

    const [roles, setRoles] = useState<RoleResponse[]>([]);
    const [sessions, setSessions] = useState<SessionResponse[]>([]);
    const [diagnostics, setDiagnostics] = useState<PolicyDiagnostics | null>(null);
    const [targetEmail, setTargetEmail] = useState('');
    const [newRoleName, setNewRoleName] = useState('');
    const [newRolePermissions, setNewRolePermissions] = useState('');
    const [editRoleName, setEditRoleName] = useState('');
    const [editRolePermissions, setEditRolePermissions] = useState('');
    const [disableEmail, setDisableEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const clearFeedback = () => {
        setMessage(null);
        setError(null);
    };

    const loadRoles = useCallback(async () => {
        setLoading(true);
        clearFeedback();
        try {
            const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/roles'));
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to load roles'));
            }
            const payload = await response.json() as RoleResponse[];
            setRoles(payload);
            setMessage('Roles loaded.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load roles');
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch]);

    const loadDiagnostics = useCallback(async () => {
        setLoading(true);
        clearFeedback();
        try {
            const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/diagnostics/policies'));
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to load diagnostics'));
            }
            const payload = await response.json() as PolicyDiagnostics;
            setDiagnostics(payload);
            setMessage('Diagnostics loaded.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load diagnostics');
        } finally {
            setLoading(false);
        }
    }, [authenticatedFetch]);

    const createRole = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        clearFeedback();
        try {
            const permissions = normalizePermissions(newRolePermissions);
            const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/roles'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newRoleName.trim(),
                    permissions,
                }),
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to create role'));
            }
            setNewRoleName('');
            setNewRolePermissions('');
            setMessage('Role created.');
            await loadRoles();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create role');
        } finally {
            setLoading(false);
        }
    };

    const updateRolePermissions = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        clearFeedback();
        try {
            const permissions = normalizePermissions(editRolePermissions);
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/auth/roles/${encodeURIComponent(editRoleName.trim())}/permissions`),
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ permissions }),
                }
            );
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to update role permissions'));
            }
            setMessage('Role permissions updated.');
            await loadRoles();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update role permissions');
        } finally {
            setLoading(false);
        }
    };

    const disableUser = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        clearFeedback();
        try {
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/auth/admin/disable-user?email=${encodeURIComponent(disableEmail.trim())}`),
                { method: 'POST' }
            );
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to disable user'));
            }
            setMessage('User disabled and active sessions revoked.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to disable user');
        } finally {
            setLoading(false);
        }
    };

    const loadUserSessions = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        clearFeedback();
        try {
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/auth/sessions?email=${encodeURIComponent(targetEmail.trim())}`)
            );
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to load sessions'));
            }
            const payload = await response.json() as SessionResponse[];
            setSessions(payload);
            setMessage(`Loaded ${payload.length} active session(s).`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load sessions');
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return <Navigate to="/login" replace />;
    }
    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="panel-stack">
            <section className="panel">
                <h2>Auth Admin Console</h2>
                <p className="text-muted">Manage roles, permissions, user disable action, and session visibility.</p>
                {message && <div className="toast-success">{message}</div>}
                {error && <div className="toast-error">{error}</div>}
            </section>

            <section className="panel">
                <h3>Policy Diagnostics</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button className="primary-button" onClick={loadDiagnostics} disabled={loading}>Load Diagnostics</button>
                    {diagnostics && (
                        <div className="text-muted">
                            Max Sessions: <strong>{diagnostics.maxConcurrentSessions}</strong> | Rate Limit: <strong>{diagnostics.rateLimitMaxAttempts}</strong> / <strong>{diagnostics.rateLimitWindowSeconds}s</strong>
                        </div>
                    )}
                </div>
            </section>

            <section className="panel">
                <h3>Role Catalog</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button className="secondary-button" onClick={loadRoles} disabled={loading}>Refresh Roles</button>
                </div>
                <div className="analytics-table" style={{ marginTop: 12 }}>
                    {roles.length === 0 ? (
                        <div className="empty-state">No roles loaded yet.</div>
                    ) : (
                        roles.map((role) => (
                            <div key={role.id} className="analytics-row">
                                <span><strong>{role.name}</strong></span>
                                <span>{role.permissions.join(', ') || '-'}</span>
                            </div>
                        ))
                    )}
                </div>
            </section>

            <section className="panel">
                <h3>Create Role</h3>
                <form onSubmit={createRole} className="form-grid">
                    <label>
                        Role Name
                        <input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} required />
                    </label>
                    <label>
                        Permissions (comma-separated)
                        <input value={newRolePermissions} onChange={(event) => setNewRolePermissions(event.target.value)} required />
                    </label>
                    <button className="primary-button" type="submit" disabled={loading}>Create Role</button>
                </form>
            </section>

            <section className="panel">
                <h3>Update Role Permissions</h3>
                <form onSubmit={updateRolePermissions} className="form-grid">
                    <label>
                        Existing Role Name
                        <input value={editRoleName} onChange={(event) => setEditRoleName(event.target.value)} required />
                    </label>
                    <label>
                        New Permission Set (comma-separated)
                        <input value={editRolePermissions} onChange={(event) => setEditRolePermissions(event.target.value)} required />
                    </label>
                    <button className="primary-button" type="submit" disabled={loading}>Update Permissions</button>
                </form>
            </section>

            <section className="panel">
                <h3>Disable User</h3>
                <form onSubmit={disableUser} className="form-grid">
                    <label>
                        User Email
                        <input type="email" value={disableEmail} onChange={(event) => setDisableEmail(event.target.value)} required />
                    </label>
                    <button className="danger-button" type="submit" disabled={loading}>Disable User</button>
                </form>
            </section>

            <section className="panel">
                <h3>Inspect User Sessions</h3>
                <form onSubmit={loadUserSessions} className="form-grid">
                    <label>
                        User Email
                        <input type="email" value={targetEmail} onChange={(event) => setTargetEmail(event.target.value)} required />
                    </label>
                    <button className="secondary-button" type="submit" disabled={loading}>Load Sessions</button>
                </form>
                <div className="analytics-table" style={{ marginTop: 12 }}>
                    {sessions.length === 0 ? (
                        <div className="empty-state">No sessions loaded.</div>
                    ) : (
                        sessions.map((session) => (
                            <div key={session.tokenId} className="analytics-row">
                                <span>{session.email}</span>
                                <span>{session.deviceInfo || 'Unknown Device'}</span>
                                <span>{new Date(session.createdAt).toLocaleString()}</span>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};

export default AdminAuthPage;
