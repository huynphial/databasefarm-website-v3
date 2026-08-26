import React, { useState } from 'react';
import { Server, Lock, User, Sparkles, ExternalLink, ArrowRight, Eye, EyeOff, Globe } from 'lucide-react';
import { UserRole } from '../../types';
import { useToast } from '../ui/Toast';
import { api } from '../../lib/api';
import { useTranslation, AVAILABLE_LANGUAGES, LanguageCode } from '../../i18n';

interface LoginViewProps {
  onLogin: (username: string, role: UserRole) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const { t, language, setLanguage } = useTranslation();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser) {
      toast({ title: t('common.error'), description: 'Username is required.', type: 'error' });
      return;
    }
    if (!cleanPass) {
      toast({ title: t('common.error'), description: 'Password is required.', type: 'error' });
      return;
    }

    setIsLoading(true);

    try {
      const result = await api.login({ username: cleanUser, password: cleanPass });
      
      if (result.success && result.user) {
        onLogin(result.user.username, result.user.role);
        toast({
          title: 'Authentication Succeeded',
          description: `Signed in as ${result.user.fullName || result.user.username} (${result.user.role} Role).`,
          type: 'success',
        });
        return;
      }

      api.logAudit({
        userId: cleanUser || 'Anonymous',
        actionType: 'LOGIN_FAILED',
        targetEntity: 'AUTH',
        details: `Failed login attempt for user "${cleanUser}": ${result.message || 'Invalid credentials'}`,
      }).catch(() => {});

      toast({
        title: 'Authentication Failed',
        description: result.message || t('auth.invalidCredentials'),
        type: 'error',
      });
    } catch (err: any) {
      toast({
        title: 'Authentication Failed',
        description: err.message || 'Authentication request failed.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-indigo-50/25 to-slate-100 flex items-center justify-center p-4 sm:p-6 text-slate-900 font-sans relative">
      {/* Top Right Language Switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-1.5 bg-white/80 backdrop-blur-xs border border-slate-200 rounded-xl p-1 shadow-xs">
        <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
        {AVAILABLE_LANGUAGES.map((lang) => {
          const isActive = lang.code === language;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code as LanguageCode)}
              className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                isActive ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{lang.flag}</span>
              <span className="uppercase">{lang.code}</span>
            </button>
          );
        })}
      </div>

      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden">
        {/* Subtle Ambient Light Gradient Accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full" />

        {/* Logo and Brand */}
        <div className="text-center mb-6 relative">
          <div className="w-13 h-13 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-600/25 text-white mb-3 transition-transform hover:scale-105">
            <Server className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('common.appTitle')}</h1>
          <p className="text-xs font-semibold text-indigo-600 mt-1 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('auth.signInSubtitle')}</span>
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">{t('account.username')}</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                id="login-username-input"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('auth.usernamePlaceholder')}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all text-xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-slate-700 font-semibold">{t('databases.password')}</label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                id="login-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-10 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all text-xs"
              />
              <button
                type="button"
                id="login-toggle-password-visibility"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            id="login-submit-button"
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 mt-5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-xs"
          >
            <span>{isLoading ? t('common.loading') : t('auth.signInButton')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Author Footer */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <span>Author:</span>
          <a
            href="https://www.linkedin.com/in/nguyenxuanluu/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1"
          >
            <span>Nguyen Xuan Luu</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

