import React, { useMemo } from 'react';
import { DatabaseEntity, DatabaseEngineEntity } from '../../types';
import { DB_ENGINES } from '../../config/dbEngines';
import { useTranslation } from '../../i18n';

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export interface DatabaseEngineFilterProps {
  /** Currently selected engine code or 'ALL' */
  value: string;
  /** Callback when selection changes */
  onChange: (value: string) => void;
  /** Array of monitored databases from table databases */
  databases: DatabaseEntity[];
  /** Optional dynamic engines configuration from database_engine table */
  databaseEngines?: DatabaseEngineEntity[];
  /** Custom label for 'ALL' option */
  allLabel?: string;
  /** Optional element ID */
  id?: string;
  /** Custom CSS classes for styling flexibility */
  className?: string;
}

export const DatabaseEngineFilter: React.FC<DatabaseEngineFilterProps> = ({
  value,
  onChange,
  databases = [],
  databaseEngines,
  allLabel,
  id,
  className,
}) => {
  const { t } = useTranslation();

  // Compute database counts per dbType and list ONLY engines that have monitored databases and are active
  const availableEngineOptions = useMemo(() => {
    const countsMap = new Map<string, number>();

    databases.forEach((db) => {
      const dbTypeUpper = (db.dbType || '').toUpperCase();
      if (dbTypeUpper) {
        countsMap.set(dbTypeUpper, (countsMap.get(dbTypeUpper) || 0) + 1);
      }
    });

    // Build map of engine names
    const engineNameMap = new Map<string, string>();
    const activeEngineSet = new Set<string>();

    // From dynamic database_engine table config if available
    if (databaseEngines && databaseEngines.length > 0) {
      databaseEngines.forEach((e) => {
        if (e.statusOnOff === 'ACTIVE') {
          activeEngineSet.add(e.dbCode.toUpperCase());
          engineNameMap.set(e.dbCode.toUpperCase(), e.dbName);
        }
      });
    }

    // From default DB_ENGINES config
    DB_ENGINES.forEach((e) => {
      if (!engineNameMap.has(e.code.toUpperCase())) {
        engineNameMap.set(e.code.toUpperCase(), e.name);
      }
    });

    // Extract only engine codes that have count > 0 in table databases and are active
    const activeEngineCodes = Array.from(countsMap.keys()).filter((codeUpper) => {
      if (databaseEngines && databaseEngines.length > 0) {
        return activeEngineSet.has(codeUpper);
      }
      return true;
    });

    const options = activeEngineCodes.map((codeUpper) => {
      const name = engineNameMap.get(codeUpper) || codeUpper;
      const count = countsMap.get(codeUpper) || 0;
      return {
        code: codeUpper,
        name,
        count,
      };
    });

    // Sort options alphabetically by engine name
    options.sort((a, b) => a.name.localeCompare(b.name));

    return options;
  }, [databases, databaseEngines]);

  const defaultAllLabel = allLabel || t('common.allEngines') || 'All Database Engines';

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'bg-slate-50 border border-slate-300 text-xs px-2.5 py-1 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs',
        className
      )}
    >
      <option value="ALL">
        {defaultAllLabel} ({databases.length})
      </option>
      {availableEngineOptions.map((eng) => (
        <option key={eng.code} value={eng.code}>
          {eng.name} ({eng.count})
        </option>
      ))}
    </select>
  );
};
