import React from 'react';
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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { UserRole } from '../../types';

export type NavigationTab =
  | 'dashboard'
  | 'raw-measurements'
  | 'databases'
  | 'groups'
  | 'templates'
  | 'analytics'
  | 'metrics'
  | 'active-alerts'
  | 'alert-history'
  | 'alert-notification-logs'
  | 'audit-logs'
  | 'system-settings';

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
  const monitoringItems = [
    { id: 'dashboard' as NavigationTab, label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'active-alerts' as NavigationTab, label: 'Active Alerts', icon: ShieldAlert },
    { id: 'databases' as NavigationTab, label: 'Monitored Databases', icon: Database },
    { id: 'groups' as NavigationTab, label: 'Database Groups', icon: FolderKanban },
    { id: 'analytics' as NavigationTab, label: 'Analytics & Trends', icon: LineChart },
    { id: 'raw-measurements' as NavigationTab, label: 'Raw Query History', icon: Activity },
  ];

  const configurationItems = [
    { id: 'system-settings' as NavigationTab, label: 'System Settings', icon: Sliders },
    { id: 'templates' as NavigationTab, label: 'Monitoring Templates', icon: Layers },
    { id: 'metrics' as NavigationTab, label: 'Metrics Management', icon: Gauge },
    { id: 'alert-history' as NavigationTab, label: 'Alert History Log', icon: History },
    { id: 'alert-notification-logs' as NavigationTab, label: 'Alert Notification Log', icon: BellRing },
    { id: 'audit-logs' as NavigationTab, label: 'Audit Trail Log', icon: FileText },
  ];

  return (
    <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 select-none transition-colors">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20 text-white shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-base tracking-tight text-slate-900 block truncate">DatabaseFarm</span>
            <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider block">Powered by Google AI</span>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Monitoring
          </div>
          <div className="space-y-1">
            {monitoringItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg transition-all font-medium text-left cursor-pointer',
                    isActive
                      ? 'bg-white text-indigo-600 shadow-xs border border-slate-200 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-colors',
                      isActive ? 'text-indigo-600' : 'text-slate-400'
                    )}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Configuration & Logs
          </div>
          <div className="space-y-1">
            {configurationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg transition-all font-medium text-left cursor-pointer',
                    isActive
                      ? 'bg-white text-indigo-600 shadow-xs border border-slate-200 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-colors',
                      isActive ? 'text-indigo-600' : 'text-slate-400'
                    )}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Author & System Badge */}
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

      {/* User Card in Footer */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-xs text-indigo-600">
            {currentUser.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-xs font-semibold text-slate-900 truncate">{currentUser.username}</div>
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
          <button
            onClick={onLogout}
            title="Sign out"
            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
