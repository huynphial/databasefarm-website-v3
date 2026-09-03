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
  if (typeUpper === 'MARIADB') return 'text-amber-800 bg-amber-50 border-amber-300';
  if (typeUpper === 'DB2') return 'text-cyan-800 bg-cyan-50 border-cyan-300';
  if (typeUpper === 'MONGODB' || typeUpper === 'MONGO') return 'text-emerald-800 bg-emerald-50 border-emerald-300';
  if (typeUpper === 'REDIS') return 'text-red-700 bg-red-50 border-red-200';
  if (typeUpper === 'SINGLESTORE') return 'text-purple-700 bg-purple-50 border-purple-200';
  if (typeUpper === 'CLICKHOUSE') return 'text-yellow-800 bg-yellow-50 border-yellow-300';
  if (typeUpper === 'ELASTICSEARCH') return 'text-teal-800 bg-teal-50 border-teal-300';
  if (typeUpper === 'OPENSEARCH') return 'text-sky-800 bg-sky-50 border-sky-300';
  if (typeUpper === 'CASSANDRA') return 'text-cyan-900 bg-cyan-50 border-cyan-200';
  if (typeUpper === 'SAPHANA') return 'text-blue-900 bg-blue-50 border-blue-300';
  if (typeUpper === 'SNOWFLAKE') return 'text-cyan-700 bg-cyan-50 border-cyan-200';
  if (typeUpper === 'BIGQUERY') return 'text-indigo-700 bg-indigo-50 border-indigo-200';
  if (typeUpper === 'REDSHIFT') return 'text-violet-700 bg-violet-50 border-violet-200';
  if (typeUpper === 'DATABRICKS') return 'text-rose-700 bg-rose-50 border-rose-200';

  return 'text-slate-700 bg-slate-100 border-slate-200';
};

export const getDbEngineHexColor = (code: string, dynamicEngines?: DatabaseEngineEntity[]): string => {
  if (dynamicEngines && dynamicEngines.length > 0) {
    const found = dynamicEngines.find((e) => e.dbCode.toUpperCase() === (code || '').toUpperCase());
    if (found?.dbColor) return found.dbColor;
  }
  const engine = getDbEngineConfig(code);
  if (engine?.color) return engine.color;

  const typeUpper = (code || '').toUpperCase();
  if (typeUpper === 'ORACLE') return '#EA580C';
  if (typeUpper === 'MYSQL') return '#16A34A';
  if (typeUpper === 'POSTGRES' || typeUpper === 'POSTGRESQL') return '#2563EB';
  if (typeUpper === 'MSSQL' || typeUpper === 'SQLSERVER') return '#0F172A';
  if (typeUpper === 'MARIADB') return '#C05621';
  if (typeUpper === 'DB2') return '#0062FF';
  if (typeUpper === 'MONGODB' || typeUpper === 'MONGO') return '#059669';
  if (typeUpper === 'REDIS') return '#DC2626';
  if (typeUpper === 'SINGLESTORE') return '#9333EA';
  if (typeUpper === 'CLICKHOUSE') return '#F59E0B';
  if (typeUpper === 'ELASTICSEARCH') return '#005571';
  if (typeUpper === 'OPENSEARCH') return '#005FB8';
  if (typeUpper === 'CASSANDRA') return '#1287A5';
  if (typeUpper === 'SAPHANA') return '#008FD3';
  if (typeUpper === 'SNOWFLAKE') return '#29B5E8';
  if (typeUpper === 'BIGQUERY') return '#4285F4';
  if (typeUpper === 'REDSHIFT') return '#8C4FFF';
  if (typeUpper === 'DATABRICKS') return '#FF3621';
  return '#475569';
};

export const getDbEngineTagStyle = (code: string): string => {
  const typeUpper = (code || '').toUpperCase();
  if (typeUpper === 'ORACLE') return 'bg-orange-100 text-orange-800 border-orange-300 font-bold';
  if (typeUpper === 'MYSQL') return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
  if (typeUpper === 'POSTGRES' || typeUpper === 'POSTGRESQL') return 'bg-blue-100 text-blue-800 border-blue-300 font-bold';
  if (typeUpper === 'MSSQL' || typeUpper === 'SQLSERVER') return 'bg-slate-900 text-slate-100 border-slate-800 font-bold';
  if (typeUpper === 'MARIADB') return 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
  if (typeUpper === 'DB2') return 'bg-cyan-100 text-cyan-900 border-cyan-300 font-bold';
  if (typeUpper === 'MONGODB') return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
  if (typeUpper === 'REDIS') return 'bg-red-100 text-red-900 border-red-300 font-bold';
  if (typeUpper === 'SINGLESTORE') return 'bg-purple-100 text-purple-800 border-purple-300 font-bold';
  if (typeUpper === 'CLICKHOUSE') return 'bg-yellow-100 text-yellow-900 border-yellow-300 font-bold';
  if (typeUpper === 'ELASTICSEARCH') return 'bg-teal-100 text-teal-900 border-teal-300 font-bold';
  if (typeUpper === 'OPENSEARCH') return 'bg-sky-100 text-sky-900 border-sky-300 font-bold';
  if (typeUpper === 'CASSANDRA') return 'bg-cyan-100 text-cyan-950 border-cyan-300 font-bold';
  if (typeUpper === 'SAPHANA') return 'bg-blue-100 text-blue-950 border-blue-300 font-bold';
  if (typeUpper === 'SNOWFLAKE') return 'bg-sky-100 text-sky-800 border-sky-300 font-bold';
  if (typeUpper === 'BIGQUERY') return 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold';
  if (typeUpper === 'REDSHIFT') return 'bg-violet-100 text-violet-800 border-violet-300 font-bold';
  if (typeUpper === 'DATABRICKS') return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
  return 'bg-slate-100 text-slate-800 border-slate-300 font-bold';
};
