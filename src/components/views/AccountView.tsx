import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  KeyRound,
  Shield,
  ShieldCheck,
  Eye,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Save,
  RefreshCw,
  Info,
  Calendar,
  Sparkles,
  Users,
  UserPlus,
  UserX,
  Plus,
  Search,
  Check,
  X,
  Trash2,
  Filter,
} from 'lucide-react';
import { User, UserRole } from '../../types';
import { useToast } from '../ui/Toast';
import { api } from '../../lib/api';
import { AUTH_CONFIG } from '../../config/authConfig';
import { Dialog } from '../ui/Dialog';

interface AccountViewProps {
  currentUser: User;
  sessionTimeoutMinutes?: number;
}

export const AccountView: React.FC<AccountViewProps> = ({ currentUser, sessionTimeoutMinutes }) => {
  const { toast } = useToast();
  const isAdmin = currentUser.role === 'ADMIN';

  // --- Self Password State ---
  const [selfPasswordForm, setSelfPasswordForm] = useState({
    newPassword: '',
    confirmNewPassword: '',
  });
  const [isSubmittingSelf, setIsSubmittingSelf] = useState(false);
  const [showSelfNewPassword, setShowSelfNewPassword] = useState(false);
  const [showSelfConfirmPassword, setShowSelfConfirmPassword] = useState(false);
  const [selfPasswordError, setSelfPasswordError] = useState<string | null>(null);

  // --- Users Directory State (Admin) ---
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'VIEWER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOCKED'>('ALL');

  // --- Create User Modal State ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    username: '',
    role: 'VIEWER' as UserRole,
    password: '',
    confirmPassword: '',
    isLocked: false,
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // --- Reset User Password Modal State ---
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<User | null>(null);
  const [resetPasswordForm, setResetPasswordForm] = useState({
    newPassword: '',
    confirmNewPassword: '',
  });
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // --- Delete User Modal State ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Live validation for self password
  useEffect(() => {
    if (selfPasswordForm.confirmNewPassword && selfPasswordForm.newPassword !== selfPasswordForm.confirmNewPassword) {
      setSelfPasswordError('New passwords do not match');
    } else if (selfPasswordForm.newPassword && selfPasswordForm.newPassword.length < 6) {
      setSelfPasswordError('Password must be at least 6 characters');
    } else {
      setSelfPasswordError(null);
    }
  }, [selfPasswordForm.newPassword, selfPasswordForm.confirmNewPassword]);

  // Fetch all users for Admin
  const fetchUsers = async () => {
    if (!isAdmin) return;
    setIsLoadingUsers(true);
    try {
      const data = await api.getUsers();
      setUsers(data || []);
    } catch (err: any) {
      toast({
        title: 'Fetch Error',
        description: err.message || 'Failed to retrieve user accounts directory.',
        type: 'error',
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  // Handle Self Password Submit
  const handleSelfPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selfPasswordForm.newPassword) {
      toast({
        title: 'Validation Error',
        description: 'New password is required.',
        type: 'error',
      });
      return;
    }

    if (selfPasswordForm.newPassword.length < 6) {
      toast({
        title: 'Password Too Short',
        description: 'Password must be at least 6 characters long.',
        type: 'error',
      });
      return;
    }

    if (selfPasswordForm.newPassword !== selfPasswordForm.confirmNewPassword) {
      toast({
        title: 'Passwords Mismatch',
        description: 'New password and confirmation do not match.',
        type: 'error',
      });
      return;
    }

    setIsSubmittingSelf(true);
    try {
      // Find current user id
      const currentList = users.length > 0 ? users : await api.getUsers().catch(() => []);
      const matched = currentList.find(
        (u) => u.username.toLowerCase() === currentUser.username.toLowerCase()
      );
      const targetId = matched?.id || currentUser.id;

      await api.updateUser(targetId, {
        password: selfPasswordForm.newPassword,
      });

      api.logAudit({
        userId: currentUser.username,
        actionType: 'UPDATE',
        targetEntity: 'USER',
        targetId,
        details: `User "${currentUser.username}" self-updated account password successfully.`,
      }).catch(() => {});

      toast({
        title: 'Password Updated',
        description: 'Your account password has been updated successfully.',
        type: 'success',
      });

      setSelfPasswordForm({
        newPassword: '',
        confirmNewPassword: '',
      });
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message || 'Failed to update password. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSubmittingSelf(false);
    }
  };

  // Handle Create User
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = createUserForm.username.trim().toLowerCase();

    if (!cleanUsername) {
      toast({
        title: 'Validation Error',
        description: 'Username cannot be empty.',
        type: 'error',
      });
      return;
    }

    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      toast({
        title: 'Username Exists',
        description: `Username "${cleanUsername}" is already registered in the directory.`,
        type: 'error',
      });
      return;
    }

    if (!createUserForm.password || createUserForm.password.length < 6) {
      toast({
        title: 'Password Too Short',
        description: 'Initial password must be at least 6 characters.',
        type: 'error',
      });
      return;
    }

    if (createUserForm.password !== createUserForm.confirmPassword) {
      toast({
        title: 'Passwords Mismatch',
        description: 'Initial password and confirmation do not match.',
        type: 'error',
      });
      return;
    }

    setIsCreatingUser(true);
    try {
      const newUser = await api.createUser({
        username: cleanUsername,
        role: createUserForm.role,
        password: createUserForm.password,
        isLocked: createUserForm.isLocked,
      });

      api.logAudit({
        userId: currentUser.username,
        actionType: 'CREATE',
        targetEntity: 'USER',
        targetId: newUser.id,
        details: `Created new user account "${newUser.username}" with role ${newUser.role}`,
      }).catch(() => {});

      toast({
        title: 'User Account Created',
        description: `Account for "${cleanUsername}" registered successfully.`,
        type: 'success',
      });

      setIsCreateModalOpen(false);
      setCreateUserForm({
        username: '',
        role: 'VIEWER',
        password: '',
        confirmPassword: '',
        isLocked: false,
      });
      fetchUsers();
    } catch (err: any) {
      toast({
        title: 'Account Creation Failed',
        description: err.message || 'Failed to create user account.',
        type: 'error',
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Toggle User Lock
  const handleToggleLockUser = async (user: User) => {
    if (user.username.toLowerCase() === currentUser.username.toLowerCase()) {
      toast({
        title: 'Action Denied',
        description: 'You cannot lock your own active administrative session.',
        type: 'warning',
      });
      return;
    }

    const updatedState = !user.isLocked;
    try {
      await api.updateUser(user.id, {
        isLocked: updatedState,
      });

      api.logAudit({
        userId: currentUser.username,
        actionType: 'UPDATE',
        targetEntity: 'USER',
        targetId: user.id,
        details: `${updatedState ? 'Locked' : 'Unlocked'} user account "${user.username}"`,
      }).catch(() => {});

      toast({
        title: updatedState ? 'Account Locked' : 'Account Activated',
        description: `User "${user.username}" is now ${updatedState ? 'locked' : 'active'}.`,
        type: 'success',
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isLocked: updatedState } : u))
      );
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message || 'Failed to toggle account lock status.',
        type: 'error',
      });
    }
  };

  // Toggle User Role
  const handleToggleUserRole = async (user: User) => {
    if (user.username.toLowerCase() === currentUser.username.toLowerCase()) {
      toast({
        title: 'Action Denied',
        description: 'You cannot demote your own administrative role while logged in.',
        type: 'warning',
      });
      return;
    }

    const nextRole: UserRole = user.role === 'ADMIN' ? 'VIEWER' : 'ADMIN';
    try {
      await api.updateUser(user.id, {
        role: nextRole,
      });

      api.logAudit({
        userId: currentUser.username,
        actionType: 'UPDATE',
        targetEntity: 'USER',
        targetId: user.id,
        details: `Updated role for "${user.username}" to ${nextRole}`,
      }).catch(() => {});

      toast({
        title: 'Role Updated',
        description: `User "${user.username}" role updated to ${nextRole}.`,
        type: 'success',
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u))
      );
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message || 'Failed to update user role.',
        type: 'error',
      });
    }
  };

  // Open Reset Password Modal
  const handleOpenResetPassword = (user: User) => {
    setSelectedUserForReset(user);
    setResetPasswordForm({
      newPassword: '',
      confirmNewPassword: '',
    });
    setShowResetPassword(false);
    setIsResetModalOpen(true);
  };

  // Handle Reset Password Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForReset) return;

    if (!resetPasswordForm.newPassword || resetPasswordForm.newPassword.length < 6) {
      toast({
        title: 'Password Too Short',
        description: 'New password must be at least 6 characters.',
        type: 'error',
      });
      return;
    }

    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmNewPassword) {
      toast({
        title: 'Passwords Mismatch',
        description: 'New password and confirmation do not match.',
        type: 'error',
      });
      return;
    }

    setIsResettingPassword(true);
    try {
      await api.updateUser(selectedUserForReset.id, {
        password: resetPasswordForm.newPassword,
      });

      api.logAudit({
        userId: currentUser.username,
        actionType: 'UPDATE',
        targetEntity: 'USER',
        targetId: selectedUserForReset.id,
        details: `Administrator reset password for user "${selectedUserForReset.username}"`,
      }).catch(() => {});

      toast({
        title: 'Password Reset',
        description: `Password for "${selectedUserForReset.username}" has been reset.`,
        type: 'success',
      });

      setIsResetModalOpen(false);
      setSelectedUserForReset(null);
    } catch (err: any) {
      toast({
        title: 'Reset Failed',
        description: err.message || 'Failed to reset password.',
        type: 'error',
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Open Delete User Modal
  const handleOpenDeleteUser = (user: User) => {
    if (user.username.toLowerCase() === currentUser.username.toLowerCase()) {
      toast({
        title: 'Action Denied',
        description: 'You cannot delete your own active account.',
        type: 'warning',
      });
      return;
    }
    setSelectedUserForDelete(user);
    setIsDeleteModalOpen(true);
  };

  // Handle Delete User Submit
  const handleDeleteUserSubmit = async () => {
    if (!selectedUserForDelete) return;

    setIsDeletingUser(true);
    try {
      await api.deleteUser(selectedUserForDelete.id);

      api.logAudit({
        userId: currentUser.username,
        actionType: 'DELETE',
        targetEntity: 'USER',
        targetId: selectedUserForDelete.id,
        details: `Removed user account "${selectedUserForDelete.username}" (ID: ${selectedUserForDelete.id})`,
      }).catch(() => {});

      toast({
        title: 'User Removed',
        description: `Account "${selectedUserForDelete.username}" was deleted successfully.`,
        type: 'success',
      });

      setIsDeleteModalOpen(false);
      setSelectedUserForDelete(null);
      fetchUsers();
    } catch (err: any) {
      toast({
        title: 'Deletion Denied',
        description: err.message || 'Failed to remove user account.',
        type: 'error',
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchQuery ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole =
      roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && !u.isLocked) ||
      (statusFilter === 'LOCKED' && !!u.isLocked);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalAdmins = users.filter((u) => u.role === 'ADMIN').length;
  const totalViewers = users.filter((u) => u.role === 'VIEWER').length;
  const totalLocked = users.filter((u) => u.isLocked).length;
  const totalActive = users.filter((u) => !u.isLocked).length;

  const inactivityMinutes = sessionTimeoutMinutes && sessionTimeoutMinutes > 0 ? sessionTimeoutMinutes : (AUTH_CONFIG.session?.inactivityTimeoutMinutes ?? 30);

  // Format Helper for Last Login
  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return { text: 'Never Logged In', relative: 'Pending first login' };
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { text: 'Unknown', relative: '' };
      
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      let relative = '';
      if (diffMins < 1) relative = 'Just now';
      else if (diffMins < 60) relative = `${diffMins}m ago`;
      else if (diffMins < 1440) relative = `${Math.floor(diffMins / 60)}h ago`;
      else relative = `${Math.floor(diffMins / 1440)}d ago`;

      return {
        text: d.toLocaleString([], {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        relative,
      };
    } catch {
      return { text: 'Unknown', relative: '' };
    }
  };

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* Header Info Banner */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-base">Account Settings & Credentials</h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                  currentUser.role === 'ADMIN'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {currentUser.role === 'ADMIN' ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    ADMINISTRATOR
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    VIEWER
                  </>
                )}
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {isAdmin
                ? 'Manage system user accounts, lock status, security roles, reset credentials, and update your personal password.'
                : 'View your authenticated identity profile, session parameters, and update your login password.'}
            </p>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200/80 shrink-0">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span>SESSION TIMEOUT: {inactivityMinutes}m INACTIVITY</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: Personal Profile & Password Update */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: My Account Identity Profile */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-bold text-slate-900 text-sm">
              <UserIcon className="w-4 h-4 text-indigo-600" />
              <span>My Identity Profile</span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Username / Login ID</label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-800 flex items-center justify-between">
                  <span>{currentUser.username}</span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded border border-indigo-100">
                    LOGGED IN
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Assigned Security Role</label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 flex items-center gap-2">
                  {currentUser.role === 'ADMIN' ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span className="text-indigo-700">ADMIN (Full Administrative Rights)</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">VIEWER (Read-Only Observability)</span>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Account State</label>
                <div className="px-3 py-2 bg-emerald-50/60 border border-emerald-200/80 rounded-lg font-bold text-emerald-800 flex items-center gap-2">
                  <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ACTIVE & UNLOCKED</span>
                </div>
              </div>

              {currentUser.createdAt && (
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Account Provision Date</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-700 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(currentUser.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Role Permissions Summary */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                <span>Permissions Summary</span>
              </div>
              <ul className="space-y-1 text-slate-600 text-[11px] list-disc list-inside">
                {currentUser.role === 'ADMIN' ? (
                  <>
                    <li>Manage All User Accounts & Reset Passwords</li>
                    <li>Configure Monitored Databases & Endpoints</li>
                    <li>Dynamic Engines & Notification Dispatchers</li>
                    <li>System Settings & Infrastructure Maintenance</li>
                  </>
                ) : (
                  <>
                    <li>Live Telemetry Dashboards & Query Observability</li>
                    <li>Active Incidents & Alerts Overview</li>
                    <li>Performance Analytics & Metric Charts</li>
                    <li>Self Password Management</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column: Update My Password */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>Update My Password</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Changes take effect on your next login
              </span>
            </div>

            <form onSubmit={handleSelfPasswordSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg flex items-start gap-2.5 text-indigo-900">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  Establish a strong, unique password with at least 6 characters. Once changed, your credentials are encrypted securely.
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showSelfNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Enter new secure password (min 6 characters)"
                    value={selfPasswordForm.newPassword}
                    onChange={(e) =>
                      setSelfPasswordForm({ ...selfPasswordForm, newPassword: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900 font-mono text-xs focus:outline-none focus:border-indigo-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSelfNewPassword(!showSelfNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title={showSelfNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showSelfNewPassword ? <Eye className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <input
                    type={showSelfConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Re-type new password to confirm"
                    value={selfPasswordForm.confirmNewPassword}
                    onChange={(e) =>
                      setSelfPasswordForm({
                        ...selfPasswordForm,
                        confirmNewPassword: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900 font-mono text-xs focus:outline-none focus:border-indigo-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSelfConfirmPassword(!showSelfConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title={showSelfConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showSelfConfirmPassword ? <Eye className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {selfPasswordError && (
                <div className="flex items-center gap-2 text-rose-600 text-xs bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{selfPasswordError}</span>
                </div>
              )}

              {selfPasswordForm.newPassword &&
                selfPasswordForm.confirmNewPassword &&
                selfPasswordForm.newPassword === selfPasswordForm.confirmNewPassword &&
                selfPasswordForm.newPassword.length >= 6 && (
                  <div className="flex items-center gap-2 text-emerald-700 text-xs bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>Passwords match and satisfy security criteria.</span>
                  </div>
                )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setSelfPasswordForm({
                      newPassword: '',
                      confirmNewPassword: '',
                    })
                  }
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSelf || !!selfPasswordError || !selfPasswordForm.newPassword}
                  className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingSelf ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Password Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* SECTION 2: Admin Accounts Directory & Management Panel */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
          {/* Section Header & Stats Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">User Accounts Management Directory</h3>
                <p className="text-slate-500 text-xs">
                  Create new accounts, manage lock states, configure security roles, reset credentials, and track last login activity.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={fetchUsers}
                disabled={isLoadingUsers}
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Refresh user accounts list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreateUserForm({
                    username: '',
                    role: 'VIEWER',
                    password: '',
                    confirmPassword: '',
                    isLocked: false,
                  });
                  setShowCreatePassword(false);
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create New Account</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Summary Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Accounts</div>
                <div className="text-lg font-bold text-slate-800">{users.length}</div>
              </div>
              <Users className="w-5 h-5 text-indigo-600/60" />
            </div>

            <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-emerald-600">Active (Unlocked)</div>
                <div className="text-lg font-bold text-emerald-800">{totalActive}</div>
              </div>
              <Unlock className="w-5 h-5 text-emerald-600/60" />
            </div>

            <div className="bg-rose-50/50 border border-rose-200/70 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-rose-600">Locked Out</div>
                <div className="text-lg font-bold text-rose-800">{totalLocked}</div>
              </div>
              <Lock className="w-5 h-5 text-rose-600/60" />
            </div>

            <div className="bg-indigo-50/50 border border-indigo-200/70 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-indigo-600">Administrators</div>
                <div className="text-lg font-bold text-indigo-800">{totalAdmins}</div>
              </div>
              <ShieldCheck className="w-5 h-5 text-indigo-600/60" />
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-lg border border-slate-200">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                <Filter className="w-3.5 h-3.5" />
                <span className="font-semibold text-[11px]">Role:</span>
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">ADMIN Only</option>
                <option value="VIEWER">VIEWER Only</option>
              </select>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 ml-2">
                <span className="font-semibold text-[11px]">Status:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="LOCKED">LOCKED</option>
              </select>
            </div>
          </div>

          {/* User Accounts Directory Table */}
          {isLoadingUsers ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <span>Synchronizing user accounts directory...</span>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User Account</th>
                    <th className="px-4 py-3 font-semibold">Security Role</th>
                    <th className="px-4 py-3 font-semibold">Account Status</th>
                    <th className="px-4 py-3 font-semibold">Last Login</th>
                    <th className="px-4 py-3 font-semibold">Created Date</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400 font-medium">
                        {searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                          ? 'No user accounts match the current filter criteria.'
                          : 'No user accounts found in credentials directory.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isSelf = user.username.toLowerCase() === currentUser.username.toLowerCase();
                      const lastLoginInfo = formatTimestamp(user.lastLogin);
                      const isOnlineRecently =
                        user.lastLogin &&
                        Date.now() - new Date(user.lastLogin).getTime() < 30 * 60000;

                      return (
                        <tr
                          key={user.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelf ? 'bg-indigo-50/20' : ''
                          }`}
                        >
                          {/* Username & Avatar */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                  user.role === 'ADMIN'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {user.username.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{user.username}</span>
                                  {isSelf && (
                                    <span className="text-[9px] bg-indigo-100 text-indigo-700 font-mono font-bold px-1.5 py-0.2 rounded border border-indigo-200">
                                      CURRENT
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  ID: {user.id}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Security Role */}
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => handleToggleUserRole(user)}
                              className={`px-2.5 py-1 rounded-md font-bold text-[10px] inline-flex items-center gap-1.5 transition-all ${
                                user.role === 'ADMIN'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                              } ${isSelf ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                              title={
                                isSelf
                                  ? 'You cannot demote your own account'
                                  : 'Click to toggle role (ADMIN / VIEWER)'
                              }
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>{user.role}</span>
                            </button>
                          </td>

                          {/* Status: Active / Locked */}
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => handleToggleLockUser(user)}
                              className={`px-2.5 py-1 rounded-full font-bold text-[10px] inline-flex items-center gap-1.5 transition-all ${
                                user.isLocked
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              } ${isSelf ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                              title={
                                isSelf
                                  ? 'You cannot lock out your active session'
                                  : 'Click to toggle account lock status'
                              }
                            >
                              {user.isLocked ? (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>LOCKED</span>
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  <span>ACTIVE</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Last Login */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col text-[11px]">
                              <div className="font-mono text-slate-800 flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{lastLoginInfo.text}</span>
                              </div>
                              {lastLoginInfo.relative && (
                                <span className={`text-[10px] pl-4 font-medium ${isOnlineRecently ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                                  {lastLoginInfo.relative}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Created Date */}
                          <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Reset Password */}
                              <button
                                type="button"
                                onClick={() => handleOpenResetPassword(user)}
                                className="px-2 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 font-medium text-[11px]"
                                title={`Reset password for ${user.username}`}
                              >
                                <KeyRound className="w-3 h-3 text-indigo-500" />
                                <span>Reset Pass</span>
                              </button>

                              {/* Remove Account */}
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => handleOpenDeleteUser(user)}
                                className={`p-1.5 rounded-md border transition-colors ${
                                  isSelf
                                    ? 'text-slate-300 border-slate-100 cursor-not-allowed'
                                    : 'text-slate-400 border-slate-200 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 cursor-pointer'
                                }`}
                                title={
                                  isSelf
                                    ? 'You cannot delete your own account'
                                    : `Delete user account "${user.username}"`
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE NEW USER MODAL */}
      <Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New User Account"
        description="Create a new authenticated system operator or administrator account in the credentials directory."
        maxWidth="md"
      >
        <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Username (Unique Identifier) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. jdoe or dev_ops"
              value={createUserForm.username}
              onChange={(e) =>
                setCreateUserForm({ ...createUserForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })
              }
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Security Role *
            </label>
            <select
              value={createUserForm.role}
              onChange={(e) =>
                setCreateUserForm({ ...createUserForm, role: e.target.value as UserRole })
              }
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              <option value="VIEWER">VIEWER (Read-Only observability access)</option>
              <option value="ADMIN">ADMIN (Full administrative & management rights)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Initial Password *
            </label>
            <div className="relative">
              <input
                type={showCreatePassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Enter initial password (min 6 chars)"
                value={createUserForm.password}
                onChange={(e) =>
                  setCreateUserForm({ ...createUserForm, password: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowCreatePassword(!showCreatePassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                {showCreatePassword ? <Eye className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Confirm Initial Password *
            </label>
            <input
              type={showCreatePassword ? 'text' : 'password'}
              required
              minLength={6}
              placeholder="Re-type initial password"
              value={createUserForm.confirmPassword}
              onChange={(e) =>
                setCreateUserForm({ ...createUserForm, confirmPassword: e.target.value })
              }
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="initialLocked"
              checked={createUserForm.isLocked}
              onChange={(e) =>
                setCreateUserForm({ ...createUserForm, isLocked: e.target.checked })
              }
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="initialLocked" className="text-slate-700 font-medium cursor-pointer">
              Provision in LOCKED state (deactivated until manual activation)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingUser}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              {isCreatingUser ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Dialog>

      {/* RESET PASSWORD MODAL */}
      <Dialog
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title={`Reset Password for "${selectedUserForReset?.username}"`}
        description="Establish a new credentials password for this user account. The change takes effect immediately."
        maxWidth="md"
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              New Secure Password *
            </label>
            <div className="relative">
              <input
                type={showResetPassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Enter new password (min 6 chars)"
                value={resetPasswordForm.newPassword}
                onChange={(e) =>
                  setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                {showResetPassword ? <Eye className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Confirm Secure Password *
            </label>
            <input
              type={showResetPassword ? 'text' : 'password'}
              required
              minLength={6}
              placeholder="Re-type new password"
              value={resetPasswordForm.confirmNewPassword}
              onChange={(e) =>
                setResetPasswordForm({
                  ...resetPasswordForm,
                  confirmNewPassword: e.target.value,
                })
              }
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsResetModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isResettingPassword}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              {isResettingPassword ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Dialog>

      {/* DELETE USER CONFIRMATION MODAL */}
      <Dialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={`Delete User Account "${selectedUserForDelete?.username}"`}
        description="Are you sure you want to permanently remove this user account from the directory?"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-900">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Permanent Action:</span> User <span className="font-mono font-bold">"{selectedUserForDelete?.username}"</span> will be permanently deleted and cannot authenticate. This action will be recorded in the audit trail.
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteUserSubmit}
              disabled={isDeletingUser}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              {isDeletingUser ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Removing Account...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Account</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
