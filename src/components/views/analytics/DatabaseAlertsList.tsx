import React from 'react';
import { ShieldAlert, CheckCheck, XCircle } from 'lucide-react';
import { ActiveAlertEntity } from '../../../types';
import { formatTimeVN } from '../../../lib/utils';
import { useLanguage } from '../../../i18n/LanguageContext';

interface DatabaseAlertsListProps {
  activeAlerts: ActiveAlertEntity[];
  selectedDbName: string;
  onClearAlert?: (alertId: string) => Promise<any> | void;
  onAcknowledgeAlert?: (alertId: string) => Promise<any> | void;
}

export const DatabaseAlertsList: React.FC<DatabaseAlertsListProps> = ({
  activeAlerts,
  selectedDbName,
  onClearAlert,
  onAcknowledgeAlert,
}) => {
  const { t } = useLanguage();
  if (activeAlerts.length === 0) return null;

  return (
    <div className="bg-white border border-rose-200 rounded-2xl p-5 shadow-2xs space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-rose-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-rose-950">{t('analytics.activeAlertsForName', { name: selectedDbName })}</h4>
            <p className="text-xs text-rose-700 font-medium">
              {t('analytics.openIncidentsCount', { count: activeAlerts.length })}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-rose-100 overflow-x-auto">
        {activeAlerts.map((alert) => {
          const hasObject = Boolean(alert.objectName && alert.objectName.trim() !== '');
          const alertTitle = hasObject ? `${alert.metricName} of ${alert.objectName}` : alert.metricName;
          const isAck = alert.status === 'ACKNOWLEDGED' || Boolean(alert.acknowledgedAt);

          return (
            <div key={alert.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      alert.alertLevel === 'CRITICAL' || alert.alertLevel === 'DOWN'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : alert.alertLevel === 'HIGH'
                        ? 'bg-orange-100 text-orange-800 border-orange-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    {alert.alertLevel}
                  </span>
                  {isAck && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      {t('analytics.ack')}
                    </span>
                  )}
                  <span className="font-bold text-slate-900 truncate" title={alertTitle}>
                    {alertTitle}
                  </span>
                </div>
                <p className="text-slate-600 font-semibold truncate">{alert.message}</p>
                <p className="text-[12px] text-slate-600 font-semibold pt-0.5">{t('analytics.triggered')} {formatTimeVN(alert.createdAt)}</p>
              </div>

              
            </div>
          );
        })}
      </div>
    </div>
  );
};
