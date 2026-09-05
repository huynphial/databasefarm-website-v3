import React, { useState, useEffect, useRef } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../i18n';

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export type AutoRefreshOption = 'off' | '15s' | '30s' | '1m' | '5m';

const SECONDS_MAP: Record<AutoRefreshOption, number> = {
  off: 0,
  '15s': 15,
  '30s': 30,
  '1m': 60,
  '5m': 300,
};

export interface AutoRefreshControlProps {
  /** Async or sync callback to execute on refresh */
  onRefresh: () => void | Promise<void>;
  /** Default auto refresh option. Defaults to '30s' */
  defaultOption?: AutoRefreshOption;
  /** Toast title to display upon manual refresh */
  toastTitle?: string;
  /** Toast description to display upon manual refresh */
  toastDescription?: string;
  /** Optional container class overrides */
  className?: string;
}

export const AutoRefreshControl: React.FC<AutoRefreshControlProps> = ({
  onRefresh,
  defaultOption = '30s',
  toastTitle,
  toastDescription,
  className,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [autoRefreshOption, setAutoRefreshOption] = useState<AutoRefreshOption>(defaultOption);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number | null>(
    SECONDS_MAP[defaultOption] || null
  );
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Keep a fresh reference to onRefresh callback to prevent stale closures in interval
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Handle auto refresh timer tick
  useEffect(() => {
    if (autoRefreshOption === 'off') {
      setSecondsUntilRefresh(null);
      return;
    }

    const totalSeconds = SECONDS_MAP[autoRefreshOption] || 30;
    setSecondsUntilRefresh(totalSeconds);

    const timerId = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev === null || prev <= 1) {
          // Trigger scheduled refresh
          Promise.resolve(onRefreshRef.current()).catch((err) => {
            console.error('AutoRefresh execution error:', err);
          });
          return totalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [autoRefreshOption]);

  // Handle manual user refresh click
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshRef.current();
    } catch (err) {
      console.error('Manual refresh execution error:', err);
    }

    if (autoRefreshOption !== 'off') {
      const totalSeconds = SECONDS_MAP[autoRefreshOption] || 30;
      setSecondsUntilRefresh(totalSeconds);
    }

    setTimeout(() => {
      setIsRefreshing(false);
      if (toastTitle) {
        toast({
          title: toastTitle,
          description: toastDescription || 'Data successfully refreshed.',
          type: 'info',
        });
      }
    }, 400);
  };

  return (
    <div className={cn('flex items-center gap-2 shrink-0', className)}>
      {/* Auto Refresh Select Dropdown */}
      <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-semibold shadow-2xs">
        <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
        <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
          {t('monitorPollLog.autoRefresh') || 'Auto Refresh:'}
        </span>
        <select
          value={autoRefreshOption}
          onChange={(e) => setAutoRefreshOption(e.target.value as AutoRefreshOption)}
          className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
        >
          <option value="off">Off</option>
          <option value="15s">15s</option>
          <option value="30s">30s</option>
          <option value="1m">1m</option>
          <option value="5m">5m</option>
        </select>
        {secondsUntilRefresh !== null && (
          <span className="text-[10px] font-mono text-indigo-600 font-bold ml-0.5">
            ({secondsUntilRefresh}s)
          </span>
        )}
      </div>

      {/* Manual Refresh Button */}
      <button
        type="button"
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
      >
        <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin text-indigo-600')} />
        <span>{isRefreshing ? 'Refreshing...' : t('common.refresh') || 'Refresh'}</span>
      </button>
    </div>
  );
};
