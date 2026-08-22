import enginesData from './dbEngines.json';
import { DatabaseEngineEntity, DbEngineConfig } from '../types';

export const DEFAULT_DB_ENGINES: DbEngineConfig[] = enginesData as DbEngineConfig[];

export const DB_ENGINES: DbEngineConfig[] = DEFAULT_DB_ENGINES;

export const getDbEngineConfig = (code: string): DbEngineConfig | undefined => {
  return DEFAULT_DB_ENGINES.find((e) => e.code.toUpperCase() === (code || '').toUpperCase());
};

export const getDbEngineBadgeClass = (code: string): string => {
  const engine = getDbEngineConfig(code);
  if (engine?.badgeColor) return engine.badgeColor;

  const typeUpper = (code || '').toUpperCase();
  if (typeUpper === 'ORACLE') return 'text-orange-700 bg-orange-50 border-orange-200';
  if (typeUpper === 'MYSQL') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (typeUpper === 'POSTGRES' || typeUpper === 'POSTGRESQL') return 'text-blue-700 bg-blue-50 border-blue-200';
  if (typeUpper === 'MSSQL' || typeUpper === 'SQLSERVER') return 'text-slate-900 bg-slate-100 border-slate-300';
  if (typeUpper === 'SINGLESTORE') return 'text-purple-700 bg-purple-50 border-purple-200';
  if (typeUpper === 'MONGODB' || typeUpper === 'MONGO') return 'text-emerald-800 bg-emerald-50 border-emerald-300';
  if (typeUpper === 'REDIS') return 'text-amber-700 bg-amber-50 border-amber-200';

  return 'text-slate-700 bg-slate-100 border-slate-200';
};

export const getDbEngineHexColor = (code: string, dynamicEngines?: DatabaseEngineEntity[]): string => {
  if (dynamicEngines && dynamicEngines.length > 0) {
    const found = dynamicEngines.find((e) => e.dbCode.toUpperCase() === (code || '').toUpperCase());
    if (found?.dbColor) return found.dbColor;
  }
  const typeUpper = (code || '').toUpperCase();
  if (typeUpper === 'ORACLE') return '#EA580C';
  if (typeUpper === 'MYSQL') return '#16A34A';
  if (typeUpper === 'POSTGRES' || typeUpper === 'POSTGRESQL') return '#2563EB';
  if (typeUpper === 'MSSQL' || typeUpper === 'SQLSERVER') return '#0F172A';
  if (typeUpper === 'SINGLESTORE') return '#9333EA';
  if (typeUpper === 'MONGODB' || typeUpper === 'MONGO') return '#059669';
  if (typeUpper === 'REDIS') return '#D97706';
  return '#475569';
};

export const getDbEngineTagStyle = (code: string): string => {
  const typeUpper = (code || '').toUpperCase();
  if (typeUpper === 'ORACLE') {
    return 'bg-orange-100 text-orange-800 border-orange-300 font-bold';
  }
  if (typeUpper === 'MYSQL') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
  }
  if (typeUpper === 'POSTGRES' || typeUpper === 'POSTGRESQL') {
    return 'bg-blue-100 text-blue-800 border-blue-300 font-bold';
  }
  if (typeUpper === 'MSSQL' || typeUpper === 'SQLSERVER') {
    return 'bg-slate-900 text-slate-100 border-slate-800 font-bold';
  }
  if (typeUpper === 'SINGLESTORE') {
    return 'bg-purple-100 text-purple-800 border-purple-300 font-bold';
  }
  if (typeUpper === 'MONGODB') {
    return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
  }
  if (typeUpper === 'REDIS') {
    return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
  }
  return 'bg-slate-100 text-slate-800 border-slate-300 font-bold';
};
