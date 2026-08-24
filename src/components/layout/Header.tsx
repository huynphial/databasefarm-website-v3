import React, { useState, useEffect } from 'react';
import { Clock, Shield, Eye, Timer, Database, Server } from 'lucide-react';
import { NavigationTab } from './Sidebar';
import { UserRole } from '../../types';
import { AUTH_CONFIG } from '../../config/authConfig';

interface HeaderProps {
  activeTab: NavigationTab;
  userRole: UserRole;
  storageType?: 'prisma' | 'memory';
  onRoleChange?: (newRole: UserRole) => void;
  onToggleRole?: () => void;
}

const titles: Record<NavigationTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard Overview',
    subtitle: 'System health summary and real-time active alerts',
  },
  databases: {
    title: 'Monitored Databases',
    subtitle: 'Manage monitored instance endpoints, credentials, and connection configuration',
  },
  groups: {
    title: 'Database Groups',
    subtitle: 'Group mapping, template bindings, and Telegram / Email notification routing',
  },
  templates: {
    title: 'Monitoring Templates',
    subtitle: 'Engine-compatible metric blueprints strictly tailored per database engine',
  },
  'analytics-database': {
    title: 'Analytics Database',
    subtitle: 'Single-instance deep performance dashboard, multi-type metric breakdowns, and interactive telemetry charts',
  },
  metrics: {
    title: 'Metrics Management',
    subtitle: 'SQL health queries, evaluation thresholds, and active monitoring state',
  },
  'alert-history': {
    title: 'Alert History Log',
    subtitle: 'Audited log of cleared and historical alert events (30-day default query optimization)',
  },
  'alert-notification-logs': {
    title: 'Alert Notification Audit Log',
    subtitle: 'Comprehensive audit trail of dispatched alert notifications across all channels and gateways',
  },
  'active-alerts': {
    title: 'Active Alerts',
    subtitle: 'Dedicated real-time incident monitoring with 1-Minute Auto-Refresh control',
  },
  'audit-logs': {
    title: 'Audit Trail Log',
    subtitle: 'Comprehensive audit trail logging all user actions, authentication attempts, and entity updates',
  },
  'system-settings': {
    title: 'System Settings & API Collector',
    subtitle: 'Central MySQL database configuration, external API Collector parameters, and global rules',
  },
  'raw-measurements': {
    title: 'Raw Query History',
    subtitle: 'Real-time telemetry stream of raw probe query executions, attribute measurements, and threshold evaluations',
  },
};

export const Header: React.FC<HeaderProps> = ({ activeTab, userRole, storageType = 'memory', onRoleChange, onToggleRole }) => {
  const currentInfo = titles[activeTab] || {
    title: 'Dashboard',
    subtitle: 'Database Monitoring System',
  };

  // Real-time Expiration Countdown
  const initialSeconds = (AUTH_CONFIG.session?.inactivityTimeoutMinutes ?? 30) * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);

  useEffect(() => {
    const timerId = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          return initialSeconds; // reset on expire to simulate continuous user session or loop
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [initialSeconds]);

  const formatCountdown = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleRoleClick = () => {
    if (onRoleChange) {
      const nextRole: UserRole = userRole === 'ADMIN' ? 'VIEWER' : 'ADMIN';
      onRoleChange(nextRole);
    } else if (onToggleRole) {
      onToggleRole();
    }
  };

  const isTimerLow = secondsRemaining < 300; // Under 5 minutes
  const isTimerUrgent = secondsRemaining < 60; // Under 1 minute

  return (
    <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 sm:px-8 bg-white shrink-0 select-none transition-colors">
      <div>
        <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
          {currentInfo.title}
        </h1>
        <p className="text-xs text-slate-500 hidden sm:block">
          {currentInfo.subtitle}
        </p>
      </div>

      {/* Stacked Info Columns Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-slate-50 border border-slate-200/80 rounded-lg p-1.5 shadow-2xs divide-x divide-slate-200 text-[10px] font-mono">
          {/* Column 1: Storage Provider | Collector Status */}
          <div className="px-2.5 flex flex-col justify-center gap-0.5">
            <div
              title={`Active persistence provider: ${storageType.toUpperCase()}`}
              className="flex items-center gap-1.5 font-semibold text-slate-700"
            >
              <Database className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>
                STORE: {storageType === 'prisma' ? 'PRISMA (MYSQL)' : 'IN-MEMORY'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>COLLECTOR: ACTIVE</span>
            </div>
          </div>

          {/* Column 2: Session Expiration Countdown | User Role */}
          <div className="px-2.5 flex flex-col justify-center gap-0.5 pl-2.5">
            <div
              title="Dynamic session inactivity timeout countdown"
              className={`flex items-center gap-1.5 font-semibold ${
                isTimerUrgent ? 'text-rose-600 font-bold animate-pulse' : isTimerLow ? 'text-amber-600' : 'text-slate-600'
              }`}
            >
              <Timer className={`w-3.5 h-3.5 shrink-0 ${isTimerUrgent ? 'text-rose-500' : 'text-indigo-500'}`} />
              <span>EXPIRY: {formatCountdown(secondsRemaining)}</span>
            </div>
            <button
              onClick={handleRoleClick}
              title="Click to toggle between Admin and View-Only role"
              className="flex items-center gap-1.5 font-semibold hover:opacity-80 transition-opacity cursor-pointer text-left"
            >
              {userRole === 'ADMIN' ? (
                <>
                  <Shield className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="text-indigo-600 font-bold">ROLE: ADMIN</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-emerald-600 font-bold">ROLE: VIEWER</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
