import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ProfileAvatarWithFallback } from '../../../components/ProfileAvatar';
import { useAuth } from '../../../context/useAuth';
import { useAuthenticatedFetch } from '../../../context/useAuthenticatedFetch';
import { gatewayUrl, readApiError } from '../../../config/apiClient';
import PageToast from '../../../components/PageToast';

type RoleResponse = {
    id: string;
    name: string;
    permissions: string[];
};

type PermissionResponse = {
    id: string;
    name: string;
};

type AdminUser = {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    enabled: boolean;
    roles: Array<{ id: string; name: string }>;
};

const PROTECTED_ROLES = new Set(['BUYER', 'SELLER', 'ADMIN']);

type ConfirmAction =
    | { type: 'ban'; user: AdminUser }
    | { type: 'unban'; user: AdminUser }
    | { type: 'deleteRole'; roleName: string };

type PermissionToggleGridProps = {
    catalog: string[];
    selected: Set<string>;
    onToggle: (permission: string, enabled: boolean) => void;
    disabled?: boolean;
};

const PermissionToggleGrid = ({ catalog, selected, onToggle, disabled }: PermissionToggleGridProps) => (
    <div className="permission-toggle-grid">
        {catalog.map((permission) => {
            const active = selected.has(permission);
            return (
                <label key={permission} className={`permission-toggle ${active ? 'is-active' : ''}`}>
                    <input
                        type="checkbox"
                        checked={active}
                        disabled={disabled}
                        onChange={(event) => onToggle(permission, event.target.checked)}
                    />
                    <span className="permission-toggle-label">{permission}</span>
                    <span className="permission-toggle-state">{active ? 'Aktif' : 'Nonaktif'}</span>
                </label>
            );
        })}
    </div>
);

const AdminAuthPage = () => {
    const { user } = useAuth();
    const authenticatedFetch = useAuthenticatedFetch();
    const isAdmin = useMemo(
        () => user?.roles?.some((role) => role.name === 'ADMIN') ?? false,
        [user]
    );

    const [roles, setRoles] = useState<RoleResponse[]>([]);
    const [permissionCatalog, setPermissionCatalog] = useState<string[]>([]);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [newRoleName, setNewRoleName] = useState('');
    const [newRolePermissions, setNewRolePermissions] = useState<Set<string>>(new Set());
    const [editingRole, setEditingRole] = useState<string | null>(null);
    const [editPermissions, setEditPermissions] = useState<Set<string>>(new Set());
    const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const clearFeedback = () => {
        setMessage(null);
        setError(null);
    };

    const runAdminMutation = async (
        action: () => Promise<void>,
        fallbackError: string,
        options?: { closeConfirm?: boolean },
    ) => {
        setLoading(true);
        clearFeedback();
        try {
            await action();
        } catch (err) {
            setError(err instanceof Error ? err.message : fallbackError);
        } finally {
            setLoading(false);
            if (options?.closeConfirm) {
                setConfirmAction(null);
            }
        }
    };

    const loadRoles = useCallback(async () => {
        const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/roles'));
        if (!response.ok) {
            throw new Error(await readApiError(response, 'Failed to load roles'));
        }
        const payload = await response.json() as RoleResponse[];
        setRoles(payload);
        return payload;
    }, [authenticatedFetch]);

    const loadPermissions = useCallback(async () => {
        const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/permissions'));
        if (!response.ok) {
            throw new Error(await readApiError(response, 'Failed to load permissions'));
        }
        const payload = await response.json() as PermissionResponse[];
        const names = payload.map((item) => item.name).sort((left, right) => left.localeCompare(right));
        setPermissionCatalog(names);
        return names;
    }, [authenticatedFetch]);

    const loadUsers = useCallback(async (search: string) => {
        const query = search.trim();
        const url = query.length > 0
            ? gatewayUrl(`/api/v1/auth/admin/users?search=${encodeURIComponent(query)}`)
            : gatewayUrl('/api/v1/auth/admin/users');
        const response = await authenticatedFetch(url);
        if (!response.ok) {
            throw new Error(await readApiError(response, 'Failed to load users'));
        }
        const payload = await response.json() as AdminUser[];
        setUsers(payload);
        const nextAssignments: Record<string, string> = {};
        for (const adminUser of payload) {
            const primaryRole = adminUser.roles[0]?.name ?? 'BUYER';
            nextAssignments[adminUser.id] = primaryRole;
        }
        setRoleAssignments(nextAssignments);
        return payload;
    }, [authenticatedFetch]);

    const refreshCatalog = useCallback(async () => {
        await Promise.all([loadRoles(), loadPermissions()]);
    }, [loadPermissions, loadRoles]);

    const refreshAll = useCallback(async () => {
        setLoading(true);
        clearFeedback();
        try {
            await Promise.all([loadRoles(), loadPermissions(), loadUsers(userSearch)]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to refresh admin data');
        } finally {
            setLoading(false);
        }
    }, [loadPermissions, loadRoles, loadUsers, userSearch]);

    useEffect(() => {
        if (!isAdmin) {
            return;
        }
        let cancelled = false;
        const bootstrap = async () => {
            setLoading(true);
            clearFeedback();
            try {
                await Promise.all([loadRoles(), loadPermissions(), loadUsers('')]);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load admin data');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        void bootstrap();
        return () => {
            cancelled = true;
        };
    }, [isAdmin, loadPermissions, loadRoles, loadUsers]);

    useEffect(() => {
        if (!isAdmin) {
            return;
        }
        const timer = window.setTimeout(() => {
            void loadUsers(userSearch).catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Failed to search users');
            });
        }, 300);
        return () => window.clearTimeout(timer);
    }, [isAdmin, loadUsers, userSearch]);

    const togglePermission = (
        permission: string,
        enabled: boolean,
        target: Set<string>,
        setter: (next: Set<string>) => void
    ) => {
        const next = new Set(target);
        if (enabled) {
            next.add(permission);
        } else {
            next.delete(permission);
        }
        setter(next);
    };

    const createRole = async (event: FormEvent) => {
        event.preventDefault();
        await runAdminMutation(async () => {
            const response = await authenticatedFetch(gatewayUrl('/api/v1/auth/roles'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newRoleName.trim(),
                    permissions: Array.from(newRolePermissions),
                }),
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to create role'));
            }
            setNewRoleName('');
            setNewRolePermissions(new Set());
            setMessage('Role created.');
            await refreshCatalog();
        }, 'Failed to create role');
    };

    const saveRolePermissions = async (roleName: string) => {
        await runAdminMutation(async () => {
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/auth/roles/${encodeURIComponent(roleName)}/permissions`),
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ permissions: Array.from(editPermissions) }),
                },
            );
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to update role permissions'));
            }
            setEditingRole(null);
            setMessage(`Permissions updated for ${roleName}.`);
            await refreshCatalog();
        }, 'Failed to update role permissions');
    };

    const deleteRole = async (roleName: string) => {
        await runAdminMutation(async () => {
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/auth/roles/${encodeURIComponent(roleName)}`),
                { method: 'DELETE' },
            );
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to delete role'));
            }
            if (editingRole === roleName) {
                setEditingRole(null);
            }
            setMessage(`Role ${roleName} deleted.`);
            await refreshAll();
        }, 'Failed to delete role');
    };

    const assignUserRole = async (userId: string) => {
        const role = roleAssignments[userId];
        if (!role) {
            return;
        }
        await runAdminMutation(async () => {
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/auth/users/${encodeURIComponent(userId)}/roles`),
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role }),
                },
            );
            if (!response.ok) {
                throw new Error(await readApiError(response, 'Failed to assign role'));
            }
            setMessage(`Role ${role} assigned.`);
            await loadUsers(userSearch);
        }, 'Failed to assign role');
    };

    const setUserEnabled = async (email: string, enabled: boolean) => {
        await runAdminMutation(async () => {
            const endpoint = enabled ? 'enable-user' : 'disable-user';
            const response = await authenticatedFetch(
                gatewayUrl(`/api/v1/auth/admin/${endpoint}?email=${encodeURIComponent(email)}`),
                { method: 'POST' },
            );
            if (!response.ok) {
                throw new Error(await readApiError(response, enabled ? 'Failed to unban user' : 'Failed to ban user'));
            }
            setMessage(enabled ? 'User unbanned.' : 'User banned and sessions revoked.');
            await loadUsers(userSearch);
        }, 'Failed to update user status', { closeConfirm: true });
    };

    const startEditingRole = (role: RoleResponse) => {
        setEditingRole(role.name);
        setEditPermissions(new Set(role.permissions));
    };

    const executeConfirmAction = async () => {
        if (!confirmAction) {
            return;
        }
        if (confirmAction.type === 'deleteRole') {
            await deleteRole(confirmAction.roleName);
            setConfirmAction(null);
            return;
        }
        const targetUser = confirmAction.user;
        await setUserEnabled(targetUser.email, confirmAction.type === 'unban');
    };

    if (!user) {
        return <Navigate to="/login" replace />;
    }
    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="panel-stack admin-auth-console">
            <section className="panel">
                <h2>Auth Admin Console</h2>
                <p className="text-muted">
                    Kelola peran kustom dengan permission granular, dan moderasi akun pengguna.
                </p>
                <PageToast error={error} success={message} />
            </section>

            <section className="panel">
                <div className="admin-section-head">
                    <h3>Pengguna</h3>
                    <input
                        className="admin-search-input"
                        type="search"
                        placeholder="Cari email, nama, atau role..."
                        value={userSearch}
                        onChange={(event) => setUserSearch(event.target.value)}
                        aria-label="Search users"
                    />
                </div>
                <div className="admin-user-grid">
                    {users.length === 0 ? (
                        <div className="empty-state">Tidak ada pengguna ditemukan.</div>
                    ) : (
                        users.map((adminUser) => {
                            const primaryRole = adminUser.roles[0]?.name ?? '—';
                            const isSelf = adminUser.email === user.email;
                            return (
                                <article key={adminUser.id} className="admin-user-card">
                                    <div className="admin-user-card-head">
                                        <ProfileAvatarWithFallback
                                            name={adminUser.displayName ?? adminUser.email}
                                            src={adminUser.avatarUrl}
                                            size={48}
                                        />
                                        <div>
                                            <strong>{adminUser.displayName || 'Unnamed user'}</strong>
                                            <p className="text-muted">{adminUser.email}</p>
                                        </div>
                                    </div>
                                    <div className="admin-user-meta">
                                        <span className={`status-pill ${adminUser.enabled ? 'is-active' : 'is-banned'}`}>
                                            {adminUser.enabled ? 'Aktif' : 'Dinonaktifkan'}
                                        </span>
                                        <span className="status-pill is-neutral">Role: {primaryRole}</span>
                                    </div>
                                    <div className="admin-user-actions">
                                        <label className="admin-inline-label">
                                            Role
                                            <select
                                                value={roleAssignments[adminUser.id] ?? primaryRole}
                                                onChange={(event) => setRoleAssignments((current) => ({
                                                    ...current,
                                                    [adminUser.id]: event.target.value,
                                                }))}
                                                disabled={loading || isSelf}
                                            >
                                                {roles
                                                    .filter((role) => role.name !== 'ADMIN')
                                                    .map((role) => (
                                                    <option key={role.id} value={role.name}>{role.name}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <button
                                            type="button"
                                            className="secondary-button"
                                            disabled={loading || isSelf}
                                            onClick={() => void assignUserRole(adminUser.id)}
                                        >
                                            Terapkan Role
                                        </button>
                                        {adminUser.enabled ? (
                                            <button
                                                type="button"
                                                className="danger-button"
                                                disabled={loading || isSelf}
                                                onClick={() => setConfirmAction({ type: 'ban', user: adminUser })}
                                            >
                                                Ban
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="primary-button"
                                                disabled={loading || isSelf}
                                                onClick={() => setConfirmAction({ type: 'unban', user: adminUser })}
                                            >
                                                Unban
                                            </button>
                                        )}
                                    </div>
                                    {isSelf && <p className="text-muted admin-self-note">Akun admin sendiri tidak dapat dimoderasi.</p>}
                                </article>
                            );
                        })
                    )}
                </div>
            </section>

            <section className="panel">
                <h3>Peran &amp; Permission</h3>
                <p className="text-muted">Daftar peran selalu sinkron dengan server. Centang permission seperti Discord.</p>

                <form onSubmit={createRole} className="admin-role-create">
                    <h4>Buat Role Baru</h4>
                    <label>
                        Nama Role
                        <input
                            value={newRoleName}
                            onChange={(event) => setNewRoleName(event.target.value)}
                            placeholder="MODERATOR"
                            required
                        />
                    </label>
                    <PermissionToggleGrid
                        catalog={permissionCatalog}
                        selected={newRolePermissions}
                        disabled={loading}
                        onToggle={(permission, enabled) => togglePermission(
                            permission,
                            enabled,
                            newRolePermissions,
                            setNewRolePermissions
                        )}
                    />
                    <button className="primary-button" type="submit" disabled={loading || permissionCatalog.length === 0}>
                        Buat Role
                    </button>
                </form>

                <div className="admin-role-list">
                    {roles.map((role) => {
                        const isProtected = PROTECTED_ROLES.has(role.name);
                        const isEditing = editingRole === role.name;
                        return (
                            <article key={role.id} className="admin-role-card">
                                <div className="admin-role-card-head">
                                    <div>
                                        <strong>{role.name}</strong>
                                        <p className="text-muted">
                                            {role.permissions.length} permission aktif
                                            {isProtected ? ' · role sistem' : ''}
                                        </p>
                                    </div>
                                    <div className="admin-role-card-actions">
                                        <button
                                            type="button"
                                            className="secondary-button"
                                            disabled={loading}
                                            onClick={() => (isEditing ? setEditingRole(null) : startEditingRole(role))}
                                        >
                                            {isEditing ? 'Tutup' : 'Edit Permission'}
                                        </button>
                                        {!isProtected && (
                                            <button
                                                type="button"
                                                className="danger-button"
                                                disabled={loading}
                                                onClick={() => setConfirmAction({ type: 'deleteRole', roleName: role.name })}
                                            >
                                                Hapus
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {isEditing && (
                                    <div className="admin-role-editor">
                                        <PermissionToggleGrid
                                            catalog={permissionCatalog}
                                            selected={editPermissions}
                                            disabled={loading}
                                            onToggle={(permission, enabled) => togglePermission(
                                                permission,
                                                enabled,
                                                editPermissions,
                                                setEditPermissions
                                            )}
                                        />
                                        <button
                                            type="button"
                                            className="primary-button"
                                            disabled={loading}
                                            onClick={() => void saveRolePermissions(role.name)}
                                        >
                                            Simpan Permission
                                        </button>
                                    </div>
                                )}
                                {!isEditing && role.permissions.length > 0 && (
                                    <p className="admin-role-permission-preview">{role.permissions.join(' · ')}</p>
                                )}
                            </article>
                        );
                    })}
                </div>
            </section>

            {confirmAction && (
                <div className="admin-modal-backdrop" role="presentation" onClick={() => setConfirmAction(null)}>
                    <div
                        className="admin-modal"
                        role="dialog"
                        aria-modal="true"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {confirmAction.type === 'ban' && (
                            <>
                                <h3>Ban pengguna?</h3>
                                <p>
                                    Akun <strong>{confirmAction.user.email}</strong> akan dinonaktifkan dan semua sesi aktif dicabut di semua perangkat.
                                </p>
                            </>
                        )}
                        {confirmAction.type === 'unban' && (
                            <>
                                <h3>Unban pengguna?</h3>
                                <p>
                                    Akun <strong>{confirmAction.user.email}</strong> akan diaktifkan kembali. Pengguna perlu login ulang.
                                </p>
                            </>
                        )}
                        {confirmAction.type === 'deleteRole' && (
                            <>
                                <h3>Hapus role?</h3>
                                <p>
                                    Role <strong>{confirmAction.roleName}</strong> akan dihapus permanen. Pastikan tidak ada pengguna yang masih memakai role ini.
                                </p>
                            </>
                        )}
                        <div className="admin-modal-actions">
                            <button type="button" className="secondary-button" onClick={() => setConfirmAction(null)}>
                                Batal
                            </button>
                            <button
                                type="button"
                                className={confirmAction.type === 'unban' ? 'primary-button' : 'danger-button'}
                                disabled={loading}
                                onClick={() => void executeConfirmAction()}
                            >
                                {confirmAction.type === 'ban' && 'Ban'}
                                {confirmAction.type === 'unban' && 'Unban'}
                                {confirmAction.type === 'deleteRole' && 'Hapus Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAuthPage;
