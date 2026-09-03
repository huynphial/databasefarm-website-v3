import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Eye, Timer, Globe } from 'lucide-react';
import { NavigationTab } from './Sidebar';
import { UserRole, DatabasePollLogEntity } from '../../types';
import { storage } from '../../lib/storage';
import { useTranslation } from '../../i18n';

interface HeaderProps {
  activeTab: NavigationTab;
  userRole: UserRole;
  storageType?: 'prisma' | 'memory';
  sessionTimeoutMinutes?: number;
  databasePollLogs?: DatabasePollLogEntity[];
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  userRole,
  storageType = 'memory',
  sessionTimeoutMinutes,
  databasePollLogs = [],
}) => {
  const { t, language, setLanguage } = useTranslation();

  // 30-minute status evaluation rule based on database_poll_log.started_at
  const isCollectorOn = useMemo(() => {
    if (!databasePollLogs || databasePollLogs.length === 0) return false;
    const now = Date.now();
    const thirtyMinutesMs = 30 * 60 * 1000;
    return databasePollLogs.some((log) => {
      if (!log.startedAt) return false;
      const t = new Date(log.startedAt).getTime();
      return !isNaN(t) && now - t >= 0 && now - t <= thirtyMinutesMs;
    });
  }, [databasePollLogs]);

  const getTabTitleInfo = (tab: NavigationTab) => {
    switch (tab) {
      case 'dashboard':
        return {
          title: t('header.dashboardTitle'),
          subtitle: t('header.dashboardSubtitle'),
        };
      case 'databases':
        return {
          title: t('header.databasesTitle'),
          subtitle: t('header.databasesSubtitle'),
        };
      case 'groups':
        return {
          title: t('header.groupsTitle'),
          subtitle: t('header.groupsSubtitle'),
        };
      case 'templates':
        return {
          title: t('header.templatesTitle'),
          subtitle: t('header.templatesSubtitle'),
        };
      case 'analytics-database':
        return {
          title: t('header.analyticsTitle'),
          subtitle: t('header.analyticsSubtitle'),
        };
      case 'metrics':
        return {
          title: t('header.metricsTitle'),
          subtitle: t('header.metricsSubtitle'),
        };
      case 'alert-history':
        return {
          title: t('header.alertHistoryTitle'),
          subtitle: t('header.alertHistorySubtitle'),
        };
      case 'alert-notification-logs':
        return {
          title: t('header.alertNotificationLogsTitle'),
          subtitle: t('header.alertNotificationLogsSubtitle'),
        };
      case 'monitor-poll-logs':
        return {
          title: t('header.monitorPollLogsTitle'),
          subtitle: t('header.monitorPollLogsSubtitle'),
        };
      case 'active-alerts':
        return {
          title: t('header.activeAlertsTitle'),
          subtitle: t('header.activeAlertsSubtitle'),
        };
      case 'audit-logs':
        return {
          title: t('header.auditLogsTitle'),
          subtitle: t('header.auditLogsSubtitle'),
        };
      case 'system-settings':
        return {
          title: t('header.systemSettingsTitle'),
          subtitle: t('header.systemSettingsSubtitle'),
        };
      case 'raw-measurements':
        return {
          title: t('header.rawMeasurementsTitle'),
          subtitle: t('header.rawMeasurementsSubtitle'),
        };
      case 'account':
        return {
          title: t('header.accountTitle'),
          subtitle: t('header.accountSubtitle'),
        };
      default:
        return {
          title: t('common.appTitle'),
          subtitle: t('common.appSubtitle'),
        };
    }
  };

  const currentInfo = getTabTitleInfo(activeTab);

  // Real-time Expiration Countdown from systemSettings & user activity
  const timeoutMins = sessionTimeoutMinutes && sessionTimeoutMinutes > 0 ? sessionTimeoutMinutes : 30;
  const timeoutMs = timeoutMins * 60 * 1000;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const last = storage.getLastActivity();
    const remainingMs = Math.max(0, last + timeoutMs - Date.now());
    return Math.floor(remainingMs / 1000);
  });

  useEffect(() => {
    const updateCountdown = () => {
      const last = storage.getLastActivity();
      const remainingMs = Math.max(0, last + timeoutMs - Date.now());
      setSecondsRemaining(Math.floor(remainingMs / 1000));
    };

    updateCountdown();
    const timerId = setInterval(updateCountdown, 1000);
    return () => clearInterval(timerId);
  }, [timeoutMs]);

  const formatCountdown = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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

      {/* Stacked Info Columns Toolbar with Minimized EN/VI Language Selector */}
      <div className="flex items-center gap-3">
        {/* Status Toolbar */}
        <div className="flex items-center bg-slate-50 border border-slate-200/80 rounded-lg p-1.5 shadow-2xs divide-x divide-slate-200 text-[10px] font-mono">
          {/* Column 1: Minimized Language Selector (EN/VI) | Collector Status */}
          <div className="px-2.5 flex flex-col justify-center gap-0.5">
            <div
              title={t('header.switchLanguage')}
              className="flex items-center gap-1.5 font-semibold text-slate-700"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded text-[10px]">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                    language === 'en'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('vi')}
                  className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                    language === 'vi'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  VI
                </button>
              </div>
            </div>
            <div
              title={
                isCollectorOn
                  ? 'Collector is ON: Telemetry sweep recorded in database_poll_log within the last 30 minutes'
                  : 'Collector is OFF: No telemetry sweep recorded in database_poll_log in the last 30 minutes'
              }
              className={`flex items-center gap-1.5 font-semibold ${
                isCollectorOn ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isCollectorOn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span>{isCollectorOn ? t('header.collectorOn') : t('header.collectorOff')}</span>
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
              <span>{t('common.sessionExpiry')}: {formatCountdown(secondsRemaining)}</span>
            </div>
            <div
              title={`Authenticated account security role: ${userRole}`}
              className="flex items-center gap-1.5 font-semibold text-left select-none"
            >
              {userRole === 'ADMIN' ? (
                <>
                  <Shield className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="text-indigo-600 font-bold">{t('common.roleAdmin')}</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-emerald-600 font-bold">{t('common.roleViewer')}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

