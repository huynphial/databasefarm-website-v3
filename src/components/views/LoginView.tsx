import React, { useState } from 'react';
import { Server, Lock, User, Sparkles, ExternalLink, ArrowRight } from 'lucide-react';
import { UserRole } from '../../types';
import { useToast } from '../ui/Toast';
import { verifyCredentials } from '../../config/authConfig';
import { api } from '../../lib/api';

interface LoginViewProps {
  onLogin: (username: string, role: UserRole) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast({ title: 'Validation Error', description: 'Username is required.', type: 'error' });
      return;
    }
    if (!password) {
      toast({ title: 'Validation Error', description: 'Password is required.', type: 'error' });
      return;
    }

    const verification = verifyCredentials(username.trim(), password);
    if (!verification.success || !verification.user) {
      api.logAudit({
        userId: username.trim() || 'Anonymous',
        actionType: 'LOGIN_FAILED',
        targetEntity: 'AUTH',
        details: `Failed authentication attempt for username "${username.trim() || 'Anonymous'}" - ${verification.message || 'Invalid credentials'}`,
      }).catch(() => {});

      toast({
        title: 'Authentication Failed',
        description: verification.message || 'Invalid credentials. Password verification failed.',
        type: 'error',
      });
      return;
    }

    const { user } = verification;

    // Record audit log for successful login
    api.logAudit({
      userId: user.username,
      actionType: 'LOGIN_SUCCESS',
      targetEntity: 'AUTH',
      targetId: user.username,
      details: `User "${user.fullName}" (${user.role} role) authenticated successfully`,
    }).catch(() => {});

    onLogin(user.username, user.role);
    toast({
      title: 'Authentication Succeeded',
      description: `Signed in as ${user.fullName} (${user.role} Role).`,
      type: 'success',
    });
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 dark:bg-[#020617] flex items-center justify-center p-6 text-slate-900 dark:text-slate-200 transition-colors duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl dark:shadow-2xl relative overflow-hidden">
        {/* Top Glow Accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-40 bg-indigo-500/10 dark:bg-indigo-600/20 blur-3xl pointer-events-none rounded-full" />

        {/* Logo and Brand */}
        <div className="text-center mb-8 relative">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white mb-3">
            <Server className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">DatabaseFarm</h1>
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Powered by Google AI
          </p>
        </div>

        {/* Minimal Clean Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Username</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-lg shadow-indigo-600/20 mt-4 cursor-pointer"
          >
            <span>Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Author Footer */}
        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span>Author:</span>
          <a
            href="https://www.linkedin.com/in/nguyenxuanluu/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
          >
            <span>Nguyen Xuan Luu</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
