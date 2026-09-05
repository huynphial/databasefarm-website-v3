import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Database,
  Gauge,
  Layers,
  FolderKanban,
  LineChart,
  History,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Server,
  ExternalLink,
  Sparkles,
  Sliders,
  FileText,
  Activity,
  BellRing,
  BarChart3,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { UserRole } from '../../types';
import { useTranslation } from '../../i18n';

export type NavigationTab =
  | 'dashboard'
  | 'raw-measurements'
  | 'databases'
  | 'groups'
  | 'templates'
  | 'analytics-database'
  | 'metrics'
  | 'active-alerts'
  | 'alert-history'
  | 'alert-notification-logs'
  | 'monitor-poll-logs'
  | 'audit-logs'
  | 'system-settings'
  | 'account';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  currentUser: {
    username: string;
    role: UserRole;
  };
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onLogout,
}) => {
  const { t } = useTranslation();

  // Load persistent collapsed state from localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dbmon_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dbmon_sidebar_collapsed', String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const monitoringItems = [
    { id: 'dashboard' as NavigationTab, label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'active-alerts' as NavigationTab, label: t('nav.activeAlerts'), icon: ShieldAlert },
    { id: 'databases' as NavigationTab, label: t('nav.databases'), icon: Database },
    { id: 'groups' as NavigationTab, label: t('nav.groups'), icon: FolderKanban },
    { id: 'analytics-database' as NavigationTab, label: t('nav.analyticsDatabase'), icon: BarChart3 },
    { id: 'raw-measurements' as NavigationTab, label: t('nav.rawMeasurements'), icon: Activity },
  ];

  const configurationItems = [
    { id: 'templates' as NavigationTab, label: t('nav.templates'), icon: Layers },
    { id: 'metrics' as NavigationTab, label: t('nav.metrics'), icon: Gauge },
    { id: 'alert-history' as NavigationTab, label: t('nav.alertHistory'), icon: History },
    { id: 'alert-notification-logs' as NavigationTab, label: t('nav.alertNotificationLogs'), icon: BellRing, adminOnly: true },
    { id: 'monitor-poll-logs' as NavigationTab, label: t('nav.monitorPollLogs'), icon: Activity, adminOnly: true },
    { id: 'audit-logs' as NavigationTab, label: t('nav.auditLogs'), icon: FileText, adminOnly: true },
    { id: 'account' as NavigationTab, label: t('nav.account'), icon: KeyRound },
    { id: 'system-settings' as NavigationTab, label: t('nav.systemSettings'), icon: Sliders, adminOnly: true },
  ];

  return (
    <aside
      className={cn(
        'bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 select-none transition-all duration-200 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand Header & Toggle Button */}
      <div
        className={cn(
          'border-b border-slate-200 bg-white transition-all',
          isCollapsed ? 'p-2.5 flex flex-col items-center gap-2' : 'p-4 flex items-center justify-between gap-2'
        )}
      >
        <div
          className={cn('flex items-center gap-3 min-w-0', isCollapsed && 'justify-center')}
          title={isCollapsed ? `${t('common.appTitle')} - ${t('common.appSubtitle')}` : undefined}
        >
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20 text-white shrink-0">
            <Server className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <span className="font-bold text-base tracking-tight text-slate-900 block truncate">
                {t('common.appTitle')}
              </span>
              <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider block">
                {t('common.appSubtitle')}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={toggleCollapsed}
          title={isCollapsed ? (t('nav.expandSidebar') || 'Expand Sidebar') : (t('nav.collapseSidebar') || 'Collapse Sidebar')}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className={cn('flex-1 space-y-4 overflow-y-auto', isCollapsed ? 'p-2' : 'p-4')}>
        <div>
          {!isCollapsed ? (
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              {t('nav.sectionMonitoring')}
            </div>
          ) : (
            <div className="my-1 border-t border-slate-200/60" />
          )}
          <div className="space-y-1">
            {monitoringItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  title={item.label}
                  className={cn(
                    'w-full flex items-center text-xs rounded-lg transition-all font-medium cursor-pointer',
                    isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2 text-left',
                    isActive
                      ? 'bg-white text-indigo-600 shadow-xs border border-slate-200 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0 transition-colors',
                      isActive ? 'text-indigo-600' : 'text-slate-400'
                    )}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {!isCollapsed ? (
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              {t('nav.sectionConfiguration')}
            </div>
          ) : (
            <div className="my-2 border-t border-slate-200/60" />
          )}
          <div className="space-y-1">
            {configurationItems
              .filter((item) => !item.adminOnly || currentUser.role === 'ADMIN')
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    title={item.label}
                    className={cn(
                      'w-full flex items-center text-xs rounded-lg transition-all font-medium cursor-pointer',
                      isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2 text-left',
                      isActive
                        ? 'bg-white text-indigo-600 shadow-xs border border-slate-200 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive ? 'text-indigo-600' : 'text-slate-400'
                      )}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
          </div>
        </div>
      </nav>

      {/* Author & System Badge */}
      {!isCollapsed ? (
        <div className="px-4 py-3 border-t border-slate-200/80 bg-slate-100/60">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              Author
            </span>
            <a
              href="https://www.linkedin.com/in/nguyenxuanluu/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
              title="View LinkedIn Profile"
            >
              <span>Nguyen Xuan Luu</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <div className="text-[10px] text-slate-400">
            DatabaseFarm • Powered by Google AI
          </div>
        </div>
      ) : (
        <div className="py-2.5 flex justify-center border-t border-slate-200/80 bg-slate-100/60">
          <a
            href="https://www.linkedin.com/in/nguyenxuanluu/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800 p-1.5 rounded hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="DatabaseFarm • Author: Nguyen Xuan Luu"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          </a>
        </div>
      )}

      {/* User Card in Footer */}
      <div className={cn('border-t border-slate-200 bg-white', isCollapsed ? 'p-2.5 flex flex-col items-center gap-2' : 'p-4')}>
        {!isCollapsed ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectTab('account')}
              title="View Account & Security Settings"
              className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-xs text-indigo-600 group-hover:bg-indigo-100 transition-colors shrink-0">
                {currentUser.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-xs font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                  {currentUser.username}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                  {currentUser.role === 'ADMIN' ? (
                    <>
                      <ShieldCheck className="w-3 h-3 text-indigo-600" />
                      <span className="text-indigo-600 font-semibold uppercase tracking-wider">ADMIN</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-500 font-medium uppercase tracking-wider">VIEW-ONLY</span>
                    </>
                  )}
                </div>
              </div>
            </button>
            <button
              onClick={onLogout}
              title={t('nav.logout')}
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectTab('account')}
              title={`${currentUser.username} (${currentUser.role})`}
              className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-xs text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              {currentUser.username.slice(0, 2).toUpperCase()}
            </button>
            <button
              onClick={onLogout}
              title={t('nav.logout')}
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
