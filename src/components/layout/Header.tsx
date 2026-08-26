import React, { useState, useEffect, useRef } from 'react';
import { Clock, Shield, Eye, Timer, Database, Server, Globe, ChevronDown, Check } from 'lucide-react';
import { NavigationTab } from './Sidebar';
import { UserRole } from '../../types';
import { AUTH_CONFIG } from '../../config/authConfig';
import { storage } from '../../lib/storage';
import { useTranslation, AVAILABLE_LANGUAGES, LanguageCode } from '../../i18n';

interface HeaderProps {
  activeTab: NavigationTab;
  userRole: UserRole;
  storageType?: 'prisma' | 'memory';
  sessionTimeoutMinutes?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  userRole,
  storageType = 'memory',
  sessionTimeoutMinutes,
}) => {
  const { t, language, setLanguage } = useTranslation();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const currentLangObj = AVAILABLE_LANGUAGES.find((l) => l.code === language) || AVAILABLE_LANGUAGES[0];

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

      {/* Stacked Info Columns Toolbar & Language Selector */}
      <div className="flex items-center gap-3">
        {/* Language Selector Dropdown */}
        <div className="relative" ref={langDropdownRef}>
          <button
            type="button"
            onClick={() => setLangDropdownOpen((prev) => !prev)}
            title={t('header.switchLanguage')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition cursor-pointer shadow-2xs"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-sm leading-none">{currentLangObj.flag}</span>
            <span className="font-semibold uppercase tracking-wider text-[11px]">{currentLangObj.code}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {langDropdownOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                {t('header.language')}
              </div>
              {AVAILABLE_LANGUAGES.map((item) => {
                const isSelected = item.code === language;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setLanguage(item.code as LanguageCode);
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/80 text-indigo-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{item.flag}</span>
                      <div className="text-left">
                        <div>{item.nativeName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{item.name}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Toolbar */}
        <div className="flex items-center bg-slate-50 border border-slate-200/80 rounded-lg p-1.5 shadow-2xs divide-x divide-slate-200 text-[10px] font-mono">
          {/* Column 1: Storage Provider | Collector Status */}
          <div className="px-2.5 flex flex-col justify-center gap-0.5">
            <div
              title={`Active persistence provider: ${storageType.toUpperCase()}`}
              className="flex items-center gap-1.5 font-semibold text-slate-700"
            >
              <Database className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>
                {storageType === 'prisma' ? t('header.storePrisma') : t('header.storeMemory')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>{t('header.collectorActive')}</span>
            </div>
          </div>

          {/* Column 2: Session Expiration Countdown | User Role (Static view of account role) */}
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

