import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  DatabaseEntity,
  MetricEntity,
  RawMeasurementEntity,
  MetricHistoryEntity,
  ActiveAlertEntity,
  DatabaseEngineEntity,
  SystemSettingsEntity,
  UserRole,
} from '../../types';
import { api } from '../../lib/api';
import { combineTelemetryDataPoints } from './analytics/analyticsUtils';
import { DatabaseFilterHeader } from './analytics/DatabaseFilterHeader';
import { AnalyticsSummaryCards } from './analytics/AnalyticsSummaryCards';
import { MetricType1Table } from './analytics/MetricType1Table';
import { MetricType2Tables } from './analytics/MetricType2Tables';
import { MetricType3Tables } from './analytics/MetricType3Tables';
import { TelemetryVisualizer } from './analytics/TelemetryVisualizer';
import { DatabaseAlertsList } from './analytics/DatabaseAlertsList';

interface AnalyticsDatabaseViewProps {
  databases: DatabaseEntity[];
  metrics: MetricEntity[];
  rawMeasurements: RawMeasurementEntity[];
  metricHistory?: MetricHistoryEntity[];
  activeAlerts: ActiveAlertEntity[];
  databaseEngines?: DatabaseEngineEntity[];
  systemSettings?: SystemSettingsEntity;
  userRole?: UserRole;
  initialDbId?: string;
  onRefresh?: () => void;
  onClearAlert?: (alertId: string) => Promise<any> | void;
  onAcknowledgeAlert?: (alertId: string) => Promise<any> | void;
  showInfoTips?: boolean;
}

export const AnalyticsDatabaseView: React.FC<AnalyticsDatabaseViewProps> = ({
  databases,
  metrics,
  rawMeasurements,
  metricHistory = [],
  activeAlerts,
  databaseEngines = [],
  systemSettings,
  userRole = 'VIEWER',
  initialDbId,
  onRefresh,
  onClearAlert,
  onAcknowledgeAlert,
  showInfoTips = true,
}) => {
  const chartSectionRef = useRef<HTMLDivElement>(null);

  // 1. FILTER CONTROLS STATE
  const [selectedEngineType, setSelectedEngineType] = useState<string>('ALL');
  const [dbSearchQuery, setDbSearchQuery] = useState<string>('');

  const [selectedDbId, setSelectedDbId] = useState<string>(() => {
    if (initialDbId && databases.some((d) => d.id === initialDbId)) return initialDbId;
    return databases[0]?.id || '';
  });

  // Synchronize when initialDbId prop updates (e.g. clicked from Dashboard or Monitored Databases)
  useEffect(() => {
    if (initialDbId) {
      const exists = databases.find((d) => d.id === initialDbId);
      if (exists) {
        setSelectedDbId(initialDbId);
        setSelectedEngineType('ALL');
        setDbSearchQuery('');
      }
    }
  }, [initialDbId, databases]);

  // Selected Database Entity
  const selectedDb = useMemo(() => {
    return databases.find((d) => d.id === selectedDbId) || databases[0];
  }, [databases, selectedDbId]);

  // Active Alerts for Selected DB
  const selectedDbAlerts = useMemo(() => {
    if (!selectedDb) return [];
    return activeAlerts.filter((a) => String(a.dbId) === String(selectedDb.id));
  }, [selectedDb, activeAlerts]);

  // 2. TIME RANGE STATE
  const [timePreset, setTimePreset] = useState<string>('24h');
  const [fromDateTime, setFromDateTime] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return d.toISOString().slice(0, 16);
  });
  const [toDateTime, setToDateTime] = useState<string>(() => {
    return new Date().toISOString().slice(0, 16);
  });

  const handleSelectTimePreset = (preset: string) => {
    setTimePreset(preset);
    const now = new Date();
    let past = new Date();
    if (preset === '1h') past.setHours(now.getHours() - 1);
    else if (preset === '6h') past.setHours(now.getHours() - 6);
    else if (preset === '24h') past.setHours(now.getHours() - 24);
    else if (preset === '7d') past.setDate(now.getDate() - 7);

    setFromDateTime(past.toISOString().slice(0, 16));
    setToDateTime(now.toISOString().slice(0, 16));
  };

  // 3. DYNAMIC TELEMETRY QUERYING FROM DATABASE
  const [queriedRawMeasurements, setQueriedRawMeasurements] = useState<RawMeasurementEntity[]>([]);
  const [queriedMetricHistory, setQueriedMetricHistory] = useState<MetricHistoryEntity[]>([]);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState<boolean>(false);
  const [hasFetchedOnce, setHasFetchedOnce] = useState<boolean>(false);

  const fetchDbTelemetry = useCallback(async () => {
    if (!selectedDb?.id) return;
    setIsLoadingTelemetry(true);
    try {
      const fromIso = fromDateTime ? new Date(fromDateTime).toISOString() : undefined;
      const toIso = toDateTime ? new Date(toDateTime).toISOString() : undefined;

      const [raws, history] = await Promise.all([
        api.getRawMeasurements({
          dbId: selectedDb.id,
          fromDate: fromIso,
          toDate: toIso,
          limit: 10000,
        }).catch(() => []),
        api.getMetricHistory(selectedDb.id, undefined, fromIso, toIso).catch(() => []),
      ]);

      setQueriedRawMeasurements(Array.isArray(raws) ? raws : []);
      setQueriedMetricHistory(Array.isArray(history) ? history : []);
      setHasFetchedOnce(true);
    } catch (err) {
      console.error('Failed to query database telemetry points:', err);
    } finally {
      setIsLoadingTelemetry(false);
    }
  }, [selectedDb?.id, fromDateTime, toDateTime]);

  // Query database whenever selected DB or time window changes
  useEffect(() => {
    fetchDbTelemetry();
  }, [fetchDbTelemetry]);

  // Handle manual refresh button
  const handleRefresh = async () => {
    await fetchDbTelemetry();
    if (onRefresh) {
      await onRefresh();
    }
  };

  // 4. COMBINE ALL TELEMETRY MEASUREMENTS (from queried rawMeasurements AND metricHistory / database table metric_data_points)
  const unifiedMeasurements = useMemo(() => {
    if (!selectedDb) return [];
    const activeRaws = hasFetchedOnce ? queriedRawMeasurements : rawMeasurements;
    const activeHistory = hasFetchedOnce ? queriedMetricHistory : metricHistory;

    const combined = combineTelemetryDataPoints(activeRaws, activeHistory, selectedDb.id, selectedDb.name);

    // Apply strict time filter on combined points
    const fromMs = fromDateTime ? new Date(fromDateTime).getTime() : 0;
    const toMs = toDateTime ? new Date(toDateTime).getTime() : Infinity;

    return combined.filter((p) => {
      const t = new Date(p.measuredAt).getTime();
      if (isNaN(t)) return true;
      return (!fromMs || t >= fromMs) && (!toMs || t <= toMs);
    });
  }, [selectedDb, hasFetchedOnce, queriedRawMeasurements, queriedMetricHistory, rawMeasurements, metricHistory, fromDateTime, toDateTime]);

  // Filter metrics applicable to selected DB (matching dbType or inherited from metricIds)
  const applicableMetrics = useMemo(() => {
    if (!selectedDb) return [];
    const dbEngineUpper = selectedDb.dbType.toUpperCase();
    return metrics.filter((m) => {
      // Direct metric ID assignment
      if (selectedDb.metricIds && selectedDb.metricIds.includes(m.id)) return true;
      // Database Engine Type match
      const mEngineUpper = (m.databaseEngine?.dbCode || '').toUpperCase();
      if (!mEngineUpper || mEngineUpper === dbEngineUpper || mEngineUpper === 'ALL') return true;
      return false;
    });
  }, [selectedDb, metrics]);

  // Categorize metrics into Types 1, 2, and 3
  const type1Metrics = useMemo(() => {
    return applicableMetrics.filter((m) => !m.metricQueryType || m.metricQueryType === 1);
  }, [applicableMetrics]);

  const type2Metrics = useMemo(() => {
    return applicableMetrics.filter((m) => m.metricQueryType === 2);
  }, [applicableMetrics]);

  const type3Metrics = useMemo(() => {
    return applicableMetrics.filter((m) => m.metricQueryType === 3);
  }, [applicableMetrics]);

  // 5. CHART SELECTION STATE
  const [chartMetricId, setChartMetricId] = useState<string>('');
  const [chartAttributeName, setChartAttributeName] = useState<string>('value');
  const [chartObjectName, setChartObjectName] = useState<string>('ALL');

  // Set default metric for chart when applicable metrics update
  useEffect(() => {
    if (applicableMetrics.length > 0 && !applicableMetrics.some((m) => m.id === chartMetricId)) {
      const defaultMetric = applicableMetrics[0];
      setChartMetricId(defaultMetric.id);
      let initialAttr = 'value';
      if (defaultMetric.thresholdsConfig?.perAttribute && defaultMetric.thresholdsConfig.perAttribute.length > 0) {
        initialAttr = defaultMetric.thresholdsConfig.perAttribute[0].attributeName;
      }
      setChartAttributeName(initialAttr);
      setChartObjectName('ALL');
    }
  }, [applicableMetrics, chartMetricId]);

  // Quick Action Handler to focus and update chart
  const handleQuickChart = (metricId: string, attrName: string, objName: string) => {
    setChartMetricId(metricId);
    setChartAttributeName(attrName || 'value');
    setChartObjectName(objName || 'ALL');
    if (chartSectionRef.current) {
      chartSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-6 overflow-y-auto bg-slate-50/50">
      {/* 1. Filter Header (Engine, DB selector, Time range, Refresh) */}
      <DatabaseFilterHeader
        databases={databases}
        databaseEngines={databaseEngines}
        selectedDbId={selectedDbId}
        onSelectDbId={setSelectedDbId}
        selectedEngineType={selectedEngineType}
        onSelectEngineType={setSelectedEngineType}
        dbSearchQuery={dbSearchQuery}
        onSearchQueryChange={setDbSearchQuery}
        timePreset={timePreset}
        onSelectTimePreset={handleSelectTimePreset}
        fromDateTime={fromDateTime}
        onFromDateTimeChange={setFromDateTime}
        toDateTime={toDateTime}
        onToDateTimeChange={setToDateTime}
        onRefresh={handleRefresh}
        isLoading={isLoadingTelemetry}
      />

      {/* 2. Overview Summary Cards */}
      <AnalyticsSummaryCards
        selectedDb={selectedDb}
        applicableMetricsCount={applicableMetrics.length}
        activeAlerts={selectedDbAlerts}
        telemetryPointsCount={unifiedMeasurements.length}
      />

      {/* 3. Active Alerts Panel */}
      {selectedDb && (
        <DatabaseAlertsList
          activeAlerts={selectedDbAlerts}
          selectedDbName={selectedDb.name}
          onClearAlert={onClearAlert}
          onAcknowledgeAlert={onAcknowledgeAlert}
        />
      )}

      {/* 4. Metric Type 1: Single Attribute of Single Object */}
      <MetricType1Table
        type1Metrics={type1Metrics}
        unifiedMeasurements={unifiedMeasurements}
        onQuickChart={handleQuickChart}
      />

      {/* 5. Metric Type 2: Single Attribute of Multiple Objects */}
      <MetricType2Tables
        type2Metrics={type2Metrics}
        unifiedMeasurements={unifiedMeasurements}
        onQuickChart={handleQuickChart}
      />

      {/* 6. Metric Type 3: Multiple Attributes of Multiple Objects */}
      <MetricType3Tables
        type3Metrics={type3Metrics}
        unifiedMeasurements={unifiedMeasurements}
        onQuickChart={handleQuickChart}
      />

      {/* 7. Interactive Performance & Telemetry Visualizer */}
      <TelemetryVisualizer
        ref={chartSectionRef}
        applicableMetrics={applicableMetrics}
        unifiedMeasurements={unifiedMeasurements}
        chartMetricId={chartMetricId}
        setChartMetricId={setChartMetricId}
        chartAttributeName={chartAttributeName}
        setChartAttributeName={setChartAttributeName}
        chartObjectName={chartObjectName}
        setChartObjectName={setChartObjectName}
      />
    </div>
  );
};
