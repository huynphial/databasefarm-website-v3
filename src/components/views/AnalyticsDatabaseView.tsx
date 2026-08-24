import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Database,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Server,
  Layers,
  Activity,
  Gauge,
  LineChart as LineChartIcon,
  AreaChart as AreaChartIcon,
  ChevronDown,
  TrendingUp,
  Cpu,
  Radio,
  FileCode,
  Calendar,
  Zap,
  Info,
  Check,
  ArrowUpDown,
  ListFilter,
  CheckCheck,
  Table as TableIcon,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  SlidersHorizontal,
  Tag,
  FileText,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
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
import { getDbEngineBadgeClass, getDbEngineHexColor } from '../../config/dbEngines';
import { formatTimeVN, cn } from '../../lib/utils';
import { useToast } from '../ui/Toast';

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

const OBJECT_COLORS = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#84cc16', // Lime
];

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
  const { toast } = useToast();
  const chartSectionRef = useRef<HTMLDivElement>(null);

  // 1. FILTER CONTROLS STATE
  const [selectedEngineType, setSelectedEngineType] = useState<string>('ALL');
  const [dbSearchQuery, setDbSearchQuery] = useState<string>('');
  const [isDbDropdownOpen, setIsDbDropdownOpen] = useState<boolean>(false);
  const dbDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Click outside and escape key listener for Target Database dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dbDropdownRef.current && !dbDropdownRef.current.contains(event.target as Node)) {
        setIsDbDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDbDropdownOpen(false);
      }
    };
    if (isDbDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDbDropdownOpen]);

  // Focus search input when database dropdown opens
  useEffect(() => {
    if (isDbDropdownOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isDbDropdownOpen]);

  // Time Filter State (Default: 24h)
  const [timeRangePreset, setTimeRangePreset] = useState<'1h' | '6h' | '24h' | '3d' | '7d' | 'all' | 'custom'>('24h');
  const [fromDateTime, setFromDateTime] = useState<string>(() => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [toDateTime, setToDateTime] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 16);
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  // 2. CHART SELECTION STATE
  const [chartMetricId, setChartMetricId] = useState<string>('');
  const [chartAttributeName, setChartAttributeName] = useState<string>('value');
  const [chartObjectName, setChartObjectName] = useState<string>('ALL');
  const [chartType, setChartType] = useState<'area' | 'line' | 'table'>('area');

  // History Table Filter, Sorting, & Pagination State
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [tableSortOrder, setTableSortOrder] = useState<'desc' | 'asc'>('desc');
  const [tableCurrentPage, setTableCurrentPage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);

  // Searchable databases list for dropdown selection
  const searchableDatabases = useMemo(() => {
    return databases.filter((db) => {
      const matchEngine =
        selectedEngineType === 'ALL' ||
        db.dbType.toUpperCase() === selectedEngineType.toUpperCase();
      const q = dbSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        db.name.toLowerCase().includes(q) ||
        (db.databaseName && db.databaseName.toLowerCase().includes(q)) ||
        db.host.toLowerCase().includes(q) ||
        String(db.port || '').includes(q) ||
        (db.environment && db.environment.toLowerCase().includes(q)) ||
        db.dbType.toLowerCase().includes(q) ||
        (db.note && db.note.toLowerCase().includes(q)) ||
        (db.tags && db.tags.some((t) => t.toLowerCase().includes(q)));
      return matchEngine && matchSearch;
    });
  }, [databases, selectedEngineType, dbSearchQuery]);

  // Ensure selectedDbId stays valid if deleted
  useEffect(() => {
    if (databases.length > 0) {
      const exists = databases.some((d) => d.id === selectedDbId);
      if (!exists) {
        setSelectedDbId(databases[0].id);
      }
    }
  }, [databases, selectedDbId]);

  // Selected Database Instance
  const selectedDb = useMemo(() => {
    return databases.find((d) => d.id === selectedDbId) || databases[0];
  }, [databases, selectedDbId]);

  // Quick Preset Handler
  const handleSelectTimePreset = (preset: '1h' | '6h' | '24h' | '3d' | '7d' | 'all') => {
    setTimeRangePreset(preset);
    const now = new Date();
    setToDateTime(now.toISOString().slice(0, 16));

    if (preset === 'all') {
      const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      setFromDateTime(past.toISOString().slice(0, 16));
    } else if (preset === '1h') {
      const past = new Date(Date.now() - 1 * 60 * 60 * 1000);
      setFromDateTime(past.toISOString().slice(0, 16));
    } else if (preset === '6h') {
      const past = new Date(Date.now() - 6 * 60 * 60 * 1000);
      setFromDateTime(past.toISOString().slice(0, 16));
    } else if (preset === '24h') {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      setFromDateTime(past.toISOString().slice(0, 16));
    } else if (preset === '3d') {
      const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      setFromDateTime(past.toISOString().slice(0, 16));
    } else if (preset === '7d') {
      const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      setFromDateTime(past.toISOString().slice(0, 16));
    }
  };

  // Time boundaries in milliseconds
  const fromTimeMs = useMemo(() => {
    return fromDateTime ? new Date(fromDateTime).getTime() : 0;
  }, [fromDateTime]);

  const toTimeMs = useMemo(() => {
    return toDateTime ? new Date(toDateTime).getTime() : Date.now() + 86400000;
  }, [toDateTime]);

  // Telemetry measurements for the selected database within time filter
  const dbMeasurements = useMemo(() => {
    if (!selectedDb) return [];
    return rawMeasurements.filter((m) => {
      if (m.dbId !== selectedDb.id) return false;
      const t = new Date(m.measuredAt).getTime();
      return t >= fromTimeMs && t <= toTimeMs;
    });
  }, [rawMeasurements, selectedDb, fromTimeMs, toTimeMs]);

  // All historical measurements for selected database (for fallback if time filter is narrow)
  const allDbMeasurements = useMemo(() => {
    if (!selectedDb) return [];
    return rawMeasurements.filter((m) => m.dbId === selectedDb.id);
  }, [rawMeasurements, selectedDb]);

  // Active alerts for the selected target database
  const targetDbAlerts = useMemo(() => {
    if (!selectedDb) return [];
    return activeAlerts.filter((a) => a.dbId === selectedDb.id);
  }, [activeAlerts, selectedDb]);

  // Applicable metrics for this database (via selectedDb.metricIds or engine matching)
  const applicableMetrics = useMemo(() => {
    if (!selectedDb) return metrics;
    if (selectedDb.metricIds && selectedDb.metricIds.length > 0) {
      const explicit = metrics.filter((m) => selectedDb.metricIds?.includes(m.id));
      if (explicit.length > 0) return explicit;
    }
    // Fallback: metrics matching the database engine type
    return metrics.filter(
      (m) =>
        !m.databaseEngineId ||
        databaseEngines.find((e) => e.id === m.databaseEngineId)?.dbCode.toUpperCase() ===
          selectedDb.dbType.toUpperCase()
    );
  }, [selectedDb, metrics, databaseEngines]);

  // Metric Categories: Type 1, Type 2, Type 3
  const type1Metrics = useMemo(() => {
    return applicableMetrics.filter((m) => (m.metricQueryType ?? 1) === 1);
  }, [applicableMetrics]);

  const type2Metrics = useMemo(() => {
    return applicableMetrics.filter((m) => m.metricQueryType === 2);
  }, [applicableMetrics]);

  const type3Metrics = useMemo(() => {
    return applicableMetrics.filter((m) => m.metricQueryType === 3);
  }, [applicableMetrics]);

  // Initial chart metric setup
  useEffect(() => {
    if (applicableMetrics.length > 0) {
      const exists = applicableMetrics.some((m) => m.id === chartMetricId);
      if (!exists) {
        setChartMetricId(applicableMetrics[0].id);
      }
    }
  }, [applicableMetrics, chartMetricId]);

  const activeChartMetric = useMemo(() => {
    return applicableMetrics.find((m) => m.id === chartMetricId) || applicableMetrics[0];
  }, [applicableMetrics, chartMetricId]);

  // Discover NUMERIC-ONLY attributes for the selected chart metric
  const numericAttributesForChart = useMemo(() => {
    if (!activeChartMetric) return [{ key: 'value', label: 'value (Metric Value)' }];

    const metricQueryType = activeChartMetric.metricQueryType ?? 1;

    // Type 3 metric: Check perAttribute configuration and raw measurements
    if (metricQueryType === 3) {
      const attributesMap = new Map<string, string>();

      // Check configured attributes with NUMBER type
      if (activeChartMetric.thresholdsConfig?.perAttribute) {
        activeChartMetric.thresholdsConfig.perAttribute.forEach((attr) => {
          if (attr.valueType === 'NUMBER' || !attr.valueType) {
            attributesMap.set(attr.attributeName, attr.attributeName);
          }
        });
      }

      // Also check measured attributes for numeric values
      allDbMeasurements
        .filter((m) => m.metricId === activeChartMetric.id)
        .forEach((m) => {
          if (m.attributeName) {
            const rawVal = m.value.replace(/[^0-9.-]/g, '');
            const isNum = !isNaN(parseFloat(rawVal)) && isFinite(Number(rawVal));
            if (isNum && (m.valueType === 'NUMBER' || !m.valueType)) {
              attributesMap.set(m.attributeName, m.attributeName);
            }
          }
        });

      const list = Array.from(attributesMap.keys()).map((k) => ({
        key: k,
        label: `${k} (Numeric)`,
      }));

      return list.length > 0 ? list : [{ key: 'value', label: 'value (Numeric)' }];
    }

    // Type 1 & 2 metrics:
    // If valueType is NUMBER, return 'value' or discovered numeric attribute
    const attrNames = new Set<string>();
    allDbMeasurements
      .filter((m) => m.metricId === activeChartMetric.id)
      .forEach((m) => {
        if (m.attributeName) attrNames.add(m.attributeName);
      });

    if (attrNames.size > 0) {
      return Array.from(attrNames).map((a) => ({ key: a, label: `${a} (Value)` }));
    }

    return [{ key: 'value', label: 'value (Numeric)' }];
  }, [activeChartMetric, allDbMeasurements]);

  // Keep selected chart attribute valid
  useEffect(() => {
    if (numericAttributesForChart.length > 0) {
      const exists = numericAttributesForChart.some((a) => a.key === chartAttributeName);
      if (!exists) {
        setChartAttributeName(numericAttributesForChart[0].key);
      }
    }
  }, [numericAttributesForChart, chartAttributeName]);

  // Discover all objects available for the active chart metric
  const availableObjectsForChart = useMemo(() => {
    if (!activeChartMetric || !selectedDb) return [];
    const objects = new Set<string>();

    allDbMeasurements
      .filter((m) => m.metricId === activeChartMetric.id)
      .forEach((m) => {
        if (m.objectName) objects.add(m.objectName);
      });

    metricHistory
      .filter((h) => h.dbId === selectedDb.id && h.metricId === activeChartMetric.id)
      .forEach((h) => {
        if (h.objectName) objects.add(h.objectName);
      });

    return Array.from(objects);
  }, [activeChartMetric, selectedDb, allDbMeasurements, metricHistory]);

  // Keep selected object valid
  useEffect(() => {
    if (chartObjectName !== 'ALL' && !availableObjectsForChart.includes(chartObjectName)) {
      setChartObjectName('ALL');
    }
  }, [availableObjectsForChart, chartObjectName]);

  // Helper to parse numeric values cleanly (handles "91.4%", "184", "0s", "124.50 MB")
  const parseNumericValue = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // Compile Time-Series Chart Data Points
  const chartTimeSeriesData = useMemo(() => {
    if (!selectedDb || !activeChartMetric) return [];

    // Filter relevant raw measurements
    const relevantMeasurements = dbMeasurements.filter((m) => {
      const matchMetric = m.metricId === activeChartMetric.id;
      const matchAttr =
        chartAttributeName === 'value' ||
        m.attributeName === chartAttributeName ||
        !m.attributeName;
      return matchMetric && matchAttr;
    });

    // Also include metric history data points if available
    const relevantHistory = metricHistory.filter((h) => {
      const matchDb = h.dbId === selectedDb.id;
      const matchMetric = h.metricId === activeChartMetric.id;
      const matchAttr =
        chartAttributeName === 'value' ||
        h.attributeName === chartAttributeName ||
        !h.attributeName;
      const t = new Date(h.createdAt).getTime();
      const matchTime = t >= fromTimeMs && t <= toTimeMs;
      return matchDb && matchMetric && matchAttr && matchTime;
    });

    // Combine and sort chronologically (oldest to newest)
    const combinedPoints: Array<{
      id: string;
      timestamp: number;
      createdAt: string;
      objectName: string;
      value: number;
    }> = [];

    relevantMeasurements.forEach((m) => {
      combinedPoints.push({
        id: m.id,
        timestamp: new Date(m.measuredAt).getTime(),
        createdAt: m.measuredAt,
        objectName: m.objectName || 'INSTANCE',
        value: parseNumericValue(m.value),
      });
    });

    relevantHistory.forEach((h) => {
      // Avoid duplicate timestamps for same object
      const alreadyHas = combinedPoints.some(
        (p) => Math.abs(p.timestamp - new Date(h.createdAt).getTime()) < 1000 && p.objectName === (h.objectName || 'INSTANCE')
      );
      if (!alreadyHas) {
        combinedPoints.push({
          id: h.id,
          timestamp: new Date(h.createdAt).getTime(),
          createdAt: h.createdAt,
          objectName: h.objectName || 'INSTANCE',
          value: parseNumericValue(h.value),
        });
      }
    });

    combinedPoints.sort((a, b) => a.timestamp - b.timestamp);

    // If specific object selected, filter down
    if (chartObjectName !== 'ALL') {
      const singleObjPoints = combinedPoints.filter(
        (p) => p.objectName === chartObjectName
      );

      return singleObjPoints.map((p) => ({
        id: p.id,
        timestamp: p.timestamp,
        createdAt: p.createdAt,
        shortTime: new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: 'short',
        }).format(new Date(p.timestamp)),
        formattedTime: formatTimeVN(p.createdAt),
        value: p.value,
        [p.objectName]: p.value,
      }));
    }

    // If "ALL" objects: Group by timestamp bucket (within 30 seconds) to build multi-object lines
    const timeBuckets: Map<
      number,
      {
        timestamp: number;
        createdAt: string;
        shortTime: string;
        formattedTime: string;
        value: number;
        [objectKey: string]: any;
      }
    > = new Map();

    combinedPoints.forEach((p) => {
      // Bucket by 1-minute window
      const bucketKey = Math.floor(p.timestamp / 60000) * 60000;
      if (!timeBuckets.has(bucketKey)) {
        timeBuckets.set(bucketKey, {
          timestamp: p.timestamp,
          createdAt: p.createdAt,
          shortTime: new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short',
          }).format(new Date(p.timestamp)),
          formattedTime: formatTimeVN(p.createdAt),
          value: p.value,
        });
      }
      const item = timeBuckets.get(bucketKey)!;
      item[p.objectName] = p.value;
      item.value = p.value; // primary value fallback
    });

    return Array.from(timeBuckets.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [
    selectedDb,
    activeChartMetric,
    dbMeasurements,
    metricHistory,
    chartAttributeName,
    chartObjectName,
    fromTimeMs,
    toTimeMs,
  ]);

  // Chart Summary Statistics (Max, Min, Avg, Latest)
  const chartStats = useMemo(() => {
    if (chartTimeSeriesData.length === 0) {
      return { latest: 0, max: 0, min: 0, avg: 0, count: 0 };
    }

    const values = chartTimeSeriesData.map((d) => d.value);
    const latest = values[values.length - 1] ?? 0;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

    return {
      latest: Number(latest.toFixed(2)),
      max: Number(max.toFixed(2)),
      min: Number(min.toFixed(2)),
      avg: Number(avg.toFixed(2)),
      count: values.length,
    };
  }, [chartTimeSeriesData]);

  // Active Metric Threshold Values for Chart Reference Lines
  const chartThresholds = useMemo(() => {
    if (!activeChartMetric) return { warn: null, high: null, crit: null };

    // If Type 3 metric with perAttribute config
    if (activeChartMetric.metricQueryType === 3 && activeChartMetric.thresholdsConfig?.perAttribute) {
      const matched = activeChartMetric.thresholdsConfig.perAttribute.find(
        (a) => a.attributeName === chartAttributeName
      );
      if (matched) {
        return {
          warn: matched.warn ? parseFloat(matched.warn) : null,
          high: matched.high ? parseFloat(matched.high) : null,
          crit: matched.critical ? parseFloat(matched.critical) : null,
        };
      }
    }

    return {
      warn: activeChartMetric.thresholdWarn ? parseFloat(activeChartMetric.thresholdWarn) : null,
      high: activeChartMetric.thresholdHigh ? parseFloat(activeChartMetric.thresholdHigh) : null,
      crit: activeChartMetric.thresholdCritical ? parseFloat(activeChartMetric.thresholdCritical) : null,
    };
  }, [activeChartMetric, chartAttributeName]);

  // History table items list for Table View
  const historyTableItems = useMemo(() => {
    if (!selectedDb || !activeChartMetric) return [];

    // Filter relevant raw measurements
    const relevantMeasurements = dbMeasurements.filter((m) => {
      const matchMetric = m.metricId === activeChartMetric.id;
      const matchAttr =
        chartAttributeName === 'value' ||
        m.attributeName === chartAttributeName ||
        !m.attributeName;
      const matchObj =
        chartObjectName === 'ALL' || (m.objectName || 'INSTANCE') === chartObjectName;
      return matchMetric && matchAttr && matchObj;
    });

    const relevantHistory = metricHistory.filter((h) => {
      const matchDb = h.dbId === selectedDb.id;
      const matchMetric = h.metricId === activeChartMetric.id;
      const matchAttr =
        chartAttributeName === 'value' ||
        h.attributeName === chartAttributeName ||
        !h.attributeName;
      const matchObj =
        chartObjectName === 'ALL' || (h.objectName || 'INSTANCE') === chartObjectName;
      const t = new Date(h.createdAt).getTime();
      const matchTime = t >= fromTimeMs && t <= toTimeMs;
      return matchDb && matchMetric && matchAttr && matchObj && matchTime;
    });

    const rows: Array<{
      id: string;
      timestamp: number;
      measuredAt: string;
      formattedTime: string;
      objectName: string;
      attributeName: string;
      value: number;
      rawValue: string;
      status: 'NORMAL' | 'WARN' | 'HIGH' | 'CRITICAL';
    }> = [];

    relevantMeasurements.forEach((m) => {
      const numVal = parseNumericValue(m.value);
      let status: 'NORMAL' | 'WARN' | 'HIGH' | 'CRITICAL' = 'NORMAL';
      if (chartThresholds.crit !== null && numVal >= chartThresholds.crit) status = 'CRITICAL';
      else if (chartThresholds.high !== null && numVal >= chartThresholds.high) status = 'HIGH';
      else if (chartThresholds.warn !== null && numVal >= chartThresholds.warn) status = 'WARN';

      rows.push({
        id: m.id,
        timestamp: new Date(m.measuredAt).getTime(),
        measuredAt: m.measuredAt,
        formattedTime: formatTimeVN(m.measuredAt),
        objectName: m.objectName || 'INSTANCE',
        attributeName: m.attributeName || chartAttributeName || 'value',
        value: numVal,
        rawValue: m.value,
        status,
      });
    });

    relevantHistory.forEach((h) => {
      const alreadyHas = rows.some(
        (r) =>
          r.id === h.id ||
          (Math.abs(r.timestamp - new Date(h.createdAt).getTime()) < 1000 &&
            r.objectName === (h.objectName || 'INSTANCE'))
      );
      if (!alreadyHas) {
        const numVal = parseNumericValue(h.value);
        let status: 'NORMAL' | 'WARN' | 'HIGH' | 'CRITICAL' = 'NORMAL';
        if (chartThresholds.crit !== null && numVal >= chartThresholds.crit) status = 'CRITICAL';
        else if (chartThresholds.high !== null && numVal >= chartThresholds.high) status = 'HIGH';
        else if (chartThresholds.warn !== null && numVal >= chartThresholds.warn) status = 'WARN';

        rows.push({
          id: h.id,
          timestamp: new Date(h.createdAt).getTime(),
          measuredAt: h.createdAt,
          formattedTime: formatTimeVN(h.createdAt),
          objectName: h.objectName || 'INSTANCE',
          attributeName: h.attributeName || chartAttributeName || 'value',
          value: numVal,
          rawValue: String(h.value),
          status,
        });
      }
    });

    return rows;
  }, [
    selectedDb,
    activeChartMetric,
    dbMeasurements,
    metricHistory,
    chartAttributeName,
    chartObjectName,
    fromTimeMs,
    toTimeMs,
    chartThresholds,
  ]);

  // Filter and sort History Table records
  const filteredSortedTableItems = useMemo(() => {
    let result = [...historyTableItems];

    if (tableSearchTerm.trim()) {
      const q = tableSearchTerm.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.objectName.toLowerCase().includes(q) ||
          item.attributeName.toLowerCase().includes(q) ||
          item.formattedTime.toLowerCase().includes(q) ||
          item.rawValue.toLowerCase().includes(q) ||
          item.status.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (tableSortOrder === 'asc') {
        return a.timestamp - b.timestamp;
      }
      return b.timestamp - a.timestamp;
    });

    return result;
  }, [historyTableItems, tableSearchTerm, tableSortOrder]);

  const totalTablePages = Math.max(1, Math.ceil(filteredSortedTableItems.length / tablePageSize));
  const paginatedTableItems = useMemo(() => {
    const start = (tableCurrentPage - 1) * tablePageSize;
    return filteredSortedTableItems.slice(start, start + tablePageSize);
  }, [filteredSortedTableItems, tableCurrentPage, tablePageSize]);

  // Reset page when search or filters change
  useEffect(() => {
    setTableCurrentPage(1);
  }, [chartMetricId, chartAttributeName, chartObjectName, tableSearchTerm, tablePageSize]);

  // Export History Table CSV
  const handleExportTableCSV = () => {
    if (filteredSortedTableItems.length === 0) {
      toast({
        title: 'No Data to Export',
        description: 'There are no historical telemetry rows to export for the selected filter.',
        type: 'warning',
      });
      return;
    }

    const headers = [
      'Timestamp (UTC+7)',
      'Database',
      'Engine',
      'Metric',
      'Object',
      'Attribute',
      'Value',
      'Status',
      'Warn Threshold',
      'High Threshold',
      'Crit Threshold',
    ];
    const rows = filteredSortedTableItems.map((item) => [
      `"${item.formattedTime}"`,
      `"${selectedDb?.name || ''}"`,
      `"${selectedDb?.dbType || ''}"`,
      `"${activeChartMetric?.name || ''}"`,
      `"${item.objectName}"`,
      `"${item.attributeName}"`,
      `"${item.rawValue}"`,
      `"${item.status}"`,
      `"${chartThresholds.warn ?? ''}"`,
      `"${chartThresholds.high ?? ''}"`,
      `"${chartThresholds.crit ?? ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${selectedDb?.name || 'db'}_${activeChartMetric?.name || 'metric'}_history_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'CSV Export Complete',
      description: `Exported ${filteredSortedTableItems.length} records to CSV.`,
      type: 'success',
    });
  };

  // Quick Action to plot a specific metric & scroll down
  const handleQuickChart = (metricId: string, attributeName = 'value', objectName = 'ALL') => {
    setChartMetricId(metricId);
    setChartAttributeName(attributeName);
    setChartObjectName(objectName);
    if (chartSectionRef.current) {
      chartSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => {
      setIsRefreshing(false);
      toast({
        title: 'Telemetry Refreshed',
        description: `Loaded latest metrics for ${selectedDb?.name || 'database'}.`,
        type: 'success',
      });
    }, 600);
  };

  // Status Badge Component Helper
  const renderStatusBadge = (status: string | undefined) => {
    const s = (status || 'UP').toUpperCase();
    if (s === 'UP' || s === 'NORMAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          ONLINE (UP)
        </span>
      );
    }
    if (s === 'DOWN' || s === 'CRITICAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          OFFLINE (DOWN)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        WARNING (DEGRADED)
      </span>
    );
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-slate-50">
      {/* ========================================================================= */}
      {/* 1. FILTER CONTROLS BAR: Database Type, Target Database, Time Filter */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs relative z-30">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-t-2xl">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Database Telemetry & Single-Instance Analytics
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Stream
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Filter target database, inspect real-time multi-type metrics, active alerts, and time-series trends
              </p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Auto-poll: <strong className="text-slate-800 font-semibold">{systemSettings?.collectorPollIntervalSeconds ?? 30}s</strong></span>
            </div>

            <button
              onClick={handleRefreshData}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-2 h-9 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white rounded-xl text-xs font-semibold shadow-2xs hover:shadow-sm transition-all cursor-pointer w-full sm:w-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Polling...' : 'Refresh Data'}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Filter 1: Database Engine */}
          <div className="md:col-span-3 space-y-2">
            <div className="h-5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Database Engine</span>
              </label>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                {databaseEngines.length} types
              </span>
            </div>

            <div className="relative">
              <select
                value={selectedEngineType}
                onChange={(e) => setSelectedEngineType(e.target.value)}
                className="w-full h-10 appearance-none bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200 hover:border-slate-300 text-slate-900 text-xs font-medium rounded-xl px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Database Types ({databases.length})</option>
                {databaseEngines.map((eng) => {
                  const count = databases.filter(
                    (d) => d.dbType.toUpperCase() === eng.dbCode.toUpperCase()
                  ).length;
                  return (
                    <option key={eng.id} value={eng.dbCode}>
                      {eng.dbName} ({count})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Filter 2: Target Database (Searchable Selection Dropdown) */}
          <div className="md:col-span-4 space-y-2" ref={dbDropdownRef}>
            <div className="h-5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <Server className="w-3.5 h-3.5 text-indigo-500" />
                <span>Target Database</span>
              </label>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                {searchableDatabases.length} matches
              </span>
            </div>

            <div className="relative">
              {/* Dropdown Trigger Button */}
              <button
                type="button"
                onClick={() => setIsDbDropdownOpen((prev) => !prev)}
                className={cn(
                  'w-full h-10 flex items-center justify-between gap-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl px-3 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs group',
                  isDbDropdownOpen && 'ring-2 ring-indigo-500/20 border-indigo-500'
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      (selectedDb?.status || 'UP').toUpperCase() === 'UP' || (selectedDb?.status || 'UP').toUpperCase() === 'NORMAL'
                        ? 'bg-emerald-500'
                        : (selectedDb?.status || '').toUpperCase() === 'DOWN' || (selectedDb?.status || '').toUpperCase() === 'CRITICAL'
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                    )}
                  />
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 truncate">
                      {selectedDb ? selectedDb.name : 'Select Database...'}
                    </span>
                    {selectedDb && (
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline truncate">
                        ({selectedDb.host}:{selectedDb.port})
                      </span>
                    )}
                  </div>
                  {selectedDb && (
                    <span
                      className={cn(
                        'text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0',
                        getDbEngineBadgeClass(selectedDb.dbType)
                      )}
                    >
                      {selectedDb.dbType}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 group-hover:text-slate-600',
                    isDbDropdownOpen && 'rotate-180 text-indigo-600'
                  )}
                />
              </button>

              {/* Popover Dropdown Panel */}
              {isDbDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-80 w-full min-w-[280px]">
                  {/* Search input header */}
                  <div className="p-2.5 bg-slate-50 border-b border-slate-200">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search by name, host, IP, schema, engine..."
                        value={dbSearchQuery}
                        onChange={(e) => setDbSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-lg pl-8 pr-7 py-1.5 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
                      />
                      {dbSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setDbSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs p-0.5 rounded cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Database List */}
                  <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-60">
                    {searchableDatabases.length === 0 ? (
                      <div className="p-4 text-center text-slate-400">
                        <Database className="w-6 h-6 mx-auto text-slate-300 mb-1.5" />
                        <p className="text-xs font-semibold text-slate-600">No matching databases</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {dbSearchQuery ? `No database matching "${dbSearchQuery}"` : 'No databases configured'}
                        </p>
                        {dbSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setDbSearchQuery('')}
                            className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                          >
                            Clear search query
                          </button>
                        )}
                      </div>
                    ) : (
                      searchableDatabases.map((db) => {
                        const isSelected = db.id === selectedDbId;
                        const dbAlerts = activeAlerts.filter((a) => a.dbId === db.id);
                        const isUp = (db.status || 'UP').toUpperCase() === 'UP' || (db.status || 'UP').toUpperCase() === 'NORMAL';
                        const isDown = (db.status || '').toUpperCase() === 'DOWN' || (db.status || '').toUpperCase() === 'CRITICAL';

                        return (
                          <button
                            key={db.id}
                            type="button"
                            onClick={() => {
                              setSelectedDbId(db.id);
                              setIsDbDropdownOpen(false);
                              if (selectedEngineType !== 'ALL' && selectedEngineType.toUpperCase() !== db.dbType.toUpperCase()) {
                                setSelectedEngineType('ALL');
                              }
                            }}
                            className={cn(
                              'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-indigo-50/50 transition-colors cursor-pointer group',
                              isSelected && 'bg-indigo-50/80'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span
                                className={cn(
                                  'w-2 h-2 rounded-full shrink-0',
                                  isUp ? 'bg-emerald-500' : isDown ? 'bg-rose-500' : 'bg-amber-500'
                                )}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={cn('text-xs font-bold text-slate-900', isSelected && 'text-indigo-900')}>
                                    {db.name}
                                  </span>
                                  <span
                                    className={cn(
                                      'text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                                      getDbEngineBadgeClass(db.dbType)
                                    )}
                                  >
                                    {db.dbType}
                                  </span>
                                  {db.environment && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                                      {db.environment}
                                    </span>
                                  )}
                                  {dbAlerts.length > 0 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-0.5">
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      {dbAlerts.length}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-2 truncate">
                                  <span>{db.host}:{db.port}</span>
                                  {db.databaseName && <span>• {db.databaseName}</span>}
                                </div>
                              </div>
                            </div>

                            {isSelected && (
                              <Check className="w-4 h-4 text-indigo-600 shrink-0 font-bold" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
                    <span>{searchableDatabases.length} databases</span>
                    {selectedEngineType !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setSelectedEngineType('ALL')}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
                      >
                        Show all engines
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filter 3: Time Filter From - To */}
          <div className="md:col-span-5 space-y-2">
            <div className="h-5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span>Time Window</span>
              </label>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                {(['1h', '6h', '24h', '3d', '7d', 'all'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectTimePreset(preset)}
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer',
                      timeRangePreset === preset
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    )}
                  >
                    {preset.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Time pickers row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input
                  type="datetime-local"
                  value={fromDateTime}
                  onChange={(e) => {
                    setFromDateTime(e.target.value);
                    setTimeRangePreset('custom');
                  }}
                  className="w-full h-10 bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200 hover:border-slate-300 text-slate-800 text-xs rounded-xl px-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all font-mono shadow-2xs cursor-pointer"
                  title="From Timestamp (UTC+7)"
                />
              </div>

              <div className="relative">
                <input
                  type="datetime-local"
                  value={toDateTime}
                  onChange={(e) => {
                    setToDateTime(e.target.value);
                    setTimeRangePreset('custom');
                  }}
                  className="w-full h-10 bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200 hover:border-slate-300 text-slate-800 text-xs rounded-xl px-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all font-mono shadow-2xs cursor-pointer"
                  title="To Timestamp (UTC+7)"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Filter Summary Context Strip */}
        <div className="px-6 py-2.5 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 rounded-b-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-slate-400" />
              Active Scope:
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold text-[11px]">
              Engine: <strong className="text-slate-900">{selectedEngineType === 'ALL' ? 'All Engines' : selectedEngineType}</strong>
            </span>
            {selectedDb && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold text-[11px]">
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    (selectedDb.status || 'UP').toUpperCase() === 'UP' || (selectedDb.status || 'UP').toUpperCase() === 'NORMAL'
                      ? 'bg-emerald-500'
                      : (selectedDb.status || '').toUpperCase() === 'DOWN' || (selectedDb.status || '').toUpperCase() === 'CRITICAL'
                      ? 'bg-rose-500'
                      : 'bg-amber-500'
                  )}
                />
                Instance: <strong className="text-indigo-600">{selectedDb.name}</strong>
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px]">
              Window: <strong className="text-slate-900">{timeRangePreset.toUpperCase()}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
            <span>Configured Metrics: <strong className="text-slate-800">{applicableMetrics.length}</strong></span>
            <span>•</span>
            <span>Active Alerts: <strong className={targetDbAlerts.length > 0 ? 'text-rose-600' : 'text-slate-800'}>{targetDbAlerts.length}</strong></span>
            <span>•</span>
            <span>Data Points: <strong className="text-slate-800">{dbMeasurements.length}</strong></span>
          </div>
        </div>
      </div>

      {/* If no selected database found */}
      {!selectedDb ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
          <Database className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Database Instance Selected</h3>
          <p className="text-xs text-slate-500 mt-1">
            Please adjust your database type filter or create a new database in the Monitored Databases tab.
          </p>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 2. TOP BAR: Database Name, Up/Down, Last Poll, IP Port */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              {/* Left Column: DB Identity & Status */}
              <div className="flex items-start sm:items-center gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-md"
                  style={{ backgroundColor: getDbEngineHexColor(selectedDb.dbType, databaseEngines) }}
                >
                  <Server className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      {selectedDb.name}
                    </h1>

                    {/* DB Engine Badge */}
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${getDbEngineBadgeClass(
                        selectedDb.dbType
                      )}`}
                    >
                      {selectedDb.dbType}
                    </span>

                    {/* Environment Badge */}
                    {selectedDb.environment && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        {selectedDb.environment}
                      </span>
                    )}

                    {/* Tag Badges */}
                    {selectedDb.tags && selectedDb.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        {selectedDb.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-extrabold tracking-wider uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* UP / DOWN Status Badge */}
                    {renderStatusBadge(selectedDb.status)}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                      <Zap className="w-3.5 h-3.5 text-indigo-500" />
                      ID: <code className="font-mono text-slate-900 bg-slate-100 px-1 py-0.5 rounded">{selectedDb.id}</code>
                    </span>

                    {selectedDb.databaseName && (
                      <span className="flex items-center gap-1 text-slate-600">
                        <Database className="w-3.5 h-3.5 text-slate-400" />
                        Schema/SID: <strong className="text-slate-800">{selectedDb.databaseName}</strong>
                      </span>
                    )}

                    {selectedDb.authMethod && (
                      <span className="text-slate-500">
                        Auth: <span className="text-slate-700 font-medium">{selectedDb.authMethod}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Connection Endpoint (IP:Port), Polling Frequency & Last Poll */}
              <div className="flex flex-wrap items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                {/* IP & Port Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Endpoint (IP : Port)
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-900">
                      {selectedDb.host}:{selectedDb.port}
                    </div>
                  </div>
                </div>

                {/* Query Frequency Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Query Frequency
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-900">
                      {selectedDb.pollIntervalMinutes ?? 5} min interval
                    </div>
                  </div>
                </div>

                {/* Last Poll Timestamp */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Last Poll Timestamp
                    </div>
                    <div className="text-xs font-medium text-slate-900">
                      {selectedDb.lastCheckAt ? formatTimeVN(selectedDb.lastCheckAt) : 'Never polled'}
                    </div>
                  </div>
                </div>

                {/* Active Alerts Count Chip */}
                <div
                  className={`border rounded-xl px-3.5 py-2 flex items-center gap-2.5 ${
                    targetDbAlerts.length > 0
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                      Active Incidents
                    </div>
                    <div className="text-xs font-extrabold">
                      {targetDbAlerts.length} Active {targetDbAlerts.length === 1 ? 'Alert' : 'Alerts'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Operational Note Row */}
            {selectedDb.note && (
              <div className="pt-3 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-700 bg-amber-50/60 border border-amber-200/60 p-3 rounded-xl">
                <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-amber-900 uppercase tracking-wider text-[10px] block">
                    Operational Note
                  </span>
                  <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">{selectedDb.note}</p>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 3. SHOW ACTIVE ALERT TABLE FOR SELECTED DATABASE */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    Active Alerts for {selectedDb.name}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        targetDbAlerts.length > 0
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {targetDbAlerts.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time threshold violations and connectivity incidents currently triggering notifications
                  </p>
                </div>
              </div>
            </div>

            {targetDbAlerts.length === 0 ? (
              <div className="p-6 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold">All Health Probes Normal</h4>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    There are no active alerts or threshold breaches recorded for{' '}
                    <strong>{selectedDb.name}</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3.5">Severity</th>
                      <th className="py-2.5 px-3.5">Metric Check</th>
                      <th className="py-2.5 px-3.5">Target Object</th>
                      <th className="py-2.5 px-3.5">Incident Message</th>
                      <th className="py-2.5 px-3.5">Triggered Time (UTC+7)</th>
                      {userRole === 'ADMIN' && onClearAlert && <th className="py-2.5 px-3.5 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {targetDbAlerts.map((alert) => {
                      const level = alert.alertLevel || 'WARN';
                      const badgeClass =
                        level === 'CRITICAL' || level === 'DOWN'
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : level === 'HIGH'
                          ? 'bg-orange-100 text-orange-800 border-orange-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200';

                      return (
                        <tr key={alert.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3.5 font-bold">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] ${badgeClass}`}>
                              <AlertTriangle className="w-3 h-3" />
                              {level}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-slate-900">
                            {alert.metricName}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-[11px] text-slate-600">
                            {alert.objectName || 'INSTANCE'}
                          </td>
                          <td className="py-3 px-3.5 font-medium text-slate-800 max-w-md">
                            {alert.message}
                          </td>
                          <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px]">
                            {formatTimeVN(alert.createdAt)}
                          </td>
                          {userRole === 'ADMIN' && onClearAlert && (
                            <td className="py-3 px-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {onAcknowledgeAlert && (
                                  <button
                                    onClick={() => onAcknowledgeAlert(alert.id)}
                                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold rounded border border-amber-200 transition-colors cursor-pointer"
                                  >
                                    Acknowledge
                                  </button>
                                )}
                                <button
                                  onClick={() => onClearAlert(alert.id)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded border border-slate-300 transition-colors cursor-pointer"
                                >
                                  Clear
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 4. SHOW TABLE FOR ALL METRIC TYPE 1 (Single Attribute of Single Object) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    Metric Type 1: Single Attribute of Single Object
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {type1Metrics.length} Metrics
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Consolidated status table for instance-level scalar probes and single health indicators
                  </p>
                </div>
              </div>
            </div>

            {type1Metrics.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
                No Type 1 metrics configured for this database.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3.5">Metric Check Name</th>
                      <th className="py-2.5 px-3.5">Value Type</th>
                      <th className="py-2.5 px-3.5">Latest Measured Value</th>
                      <th className="py-2.5 px-3.5">Evaluation Status</th>
                      <th className="py-2.5 px-3.5">Threshold Rule</th>
                      <th className="py-2.5 px-3.5">Frequency</th>
                      <th className="py-2.5 px-3.5">Last Measured (UTC+7)</th>
                      <th className="py-2.5 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {type1Metrics.map((metric) => {
                      // Find most recent measurement for this metric
                      const latestMeasurement = allDbMeasurements
                        .filter((m) => m.metricId === metric.id)
                        .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())[0];

                      const value = latestMeasurement ? latestMeasurement.value : 'N/A';
                      const status = latestMeasurement ? latestMeasurement.status : 'NORMAL';

                      const statusBadge =
                        status === 'CRITICAL' || status === 'DOWN'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : status === 'WARNING'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                      const thresholdText =
                        metric.thresholdWarn || metric.thresholdHigh || metric.thresholdCritical
                          ? `Warn: ${metric.thresholdWarn || '-'} / High: ${metric.thresholdHigh || '-'} / Crit: ${metric.thresholdCritical || '-'} (${metric.thresholdOperator || '>='})`
                          : 'No threshold';

                      return (
                        <tr key={metric.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3.5">
                            <div className="font-bold text-slate-900">{metric.name}</div>
                            {metric.templateName && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                Template: {metric.templateName}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                              {metric.valueType}
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {value}
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}>
                              {status === 'NORMAL' ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              {status}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-mono text-[11px] text-slate-600">
                            {thresholdText}
                          </td>
                          <td className="py-3 px-3.5 text-slate-500 font-medium">
                            Cycle {metric.cycle ?? 1}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">
                            {latestMeasurement ? formatTimeVN(latestMeasurement.measuredAt) : 'No data yet'}
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            <button
                              onClick={() => handleQuickChart(metric.id, 'value', 'ALL')}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <TrendingUp className="w-3 h-3" />
                              View Chart
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 5. SHOW TABLES FOR EACH METRIC TYPE 2 (Single Attr of Multi Objs) */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Metric Type 2: Single Attribute of Multiple Objects
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    {type2Metrics.length} Metric {type2Metrics.length === 1 ? 'Table' : 'Tables'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Individual breakdown tables per metric for multi-entity probes (tablespaces, sessions, connection pools)
                </p>
              </div>
            </div>

            {type2Metrics.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-xs">
                No Type 2 metrics configured for this database instance.
              </div>
            ) : (
              <div className="space-y-4">
                {type2Metrics.map((metric) => {
                  // Find all unique objects measured for this metric within time range (or overall)
                  const metricMeasurements = (dbMeasurements.length > 0 ? dbMeasurements : allDbMeasurements)
                    .filter((m) => m.metricId === metric.id);

                  // Group by objectName to get latest measurement per object
                  const objectMap = new Map<string, RawMeasurementEntity>();
                  metricMeasurements.forEach((m) => {
                    const objName = m.objectName || 'GLOBAL';
                    const existing = objectMap.get(objName);
                    if (!existing || new Date(m.measuredAt).getTime() > new Date(existing.measuredAt).getTime()) {
                      objectMap.set(objName, m);
                    }
                  });

                  const objectRows = Array.from(objectMap.values());

                  const thresholdSummary =
                    metric.thresholdWarn || metric.thresholdHigh || metric.thresholdCritical
                      ? `Warn: ${metric.thresholdWarn || '-'} / High: ${metric.thresholdHigh || '-'} / Crit: ${metric.thresholdCritical || '-'} (${metric.thresholdOperator || '>='})`
                      : 'No explicit threshold';

                  return (
                    <div
                      key={metric.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3"
                    >
                      {/* Metric Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{metric.name}</h4>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                              Type 2 Metric
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              ({objectRows.length} {objectRows.length === 1 ? 'object' : 'objects'})
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-mono truncate max-w-xl">
                            {thresholdSummary} • Cycle: {metric.cycle ?? 1}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQuickChart(metric.id, 'value', 'ALL')}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            Chart Metric ({metric.name})
                          </button>
                        </div>
                      </div>

                      {/* Objects Table */}
                      {objectRows.length === 0 ? (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                          No object telemetry records collected yet for this metric within the selected time range.
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-left text-xs text-slate-700">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                              <tr>
                                <th className="py-2.5 px-3.5">Object Identifier</th>
                                <th className="py-2.5 px-3.5">Attribute Name</th>
                                <th className="py-2.5 px-3.5">Measured Value</th>
                                <th className="py-2.5 px-3.5">Status</th>
                                <th className="py-2.5 px-3.5">Threshold Evaluation</th>
                                <th className="py-2.5 px-3.5">Last Measured (UTC+7)</th>
                                <th className="py-2.5 px-3.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {objectRows.map((row) => {
                                const statusBadge =
                                  row.status === 'CRITICAL' || row.status === 'DOWN'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : row.status === 'WARNING'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                                return (
                                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 px-3.5 font-bold font-mono text-slate-900 flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
                                      {row.objectName || 'INSTANCE'}
                                    </td>
                                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-600">
                                      {row.attributeName || 'value'}
                                    </td>
                                    <td className="py-2.5 px-3.5">
                                      <span className="font-mono font-bold text-slate-900 text-sm">
                                        {row.value}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3.5">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}>
                                        {row.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-500">
                                      {row.triggeredThreshold || thresholdSummary}
                                    </td>
                                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-500">
                                      {formatTimeVN(row.measuredAt)}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-right">
                                      <button
                                        onClick={() => handleQuickChart(metric.id, row.attributeName || 'value', row.objectName)}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors cursor-pointer inline-flex items-center gap-1"
                                      >
                                        <TrendingUp className="w-3 h-3" />
                                        Chart Object
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 6. SHOW TABLES FOR EACH METRIC TYPE 3 (Multi Attrs of Multi Objs) */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Metric Type 3: Multiple Attributes of Multiple Objects
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {type3Metrics.length} Multi-Attribute {type3Metrics.length === 1 ? 'Table' : 'Tables'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Rich multi-column analytics tables with per-attribute return types and independent threshold boundaries
                </p>
              </div>
            </div>

            {type3Metrics.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-xs">
                No Type 3 metrics configured for this database instance.
              </div>
            ) : (
              <div className="space-y-4">
                {type3Metrics.map((metric) => {
                  // Discover all attributes and objects for this metric
                  const metricMeasurements = (dbMeasurements.length > 0 ? dbMeasurements : allDbMeasurements)
                    .filter((m) => m.metricId === metric.id);

                  // Extract dynamic list of attribute names
                  const attributeNamesSet = new Set<string>();
                  if (metric.thresholdsConfig?.perAttribute) {
                    metric.thresholdsConfig.perAttribute.forEach((a) => attributeNamesSet.add(a.attributeName));
                  }
                  metricMeasurements.forEach((m) => {
                    if (m.attributeName) attributeNamesSet.add(m.attributeName);
                  });

                  const attributeColumns = Array.from(attributeNamesSet);

                  // Group by objectName -> object row with attribute key-values
                  const objectRowsMap = new Map<
                    string,
                    {
                      objectName: string;
                      attributes: Record<string, string>;
                      status: string;
                      measuredAt: string;
                    }
                  >();

                  metricMeasurements.forEach((m) => {
                    const objName = m.objectName || 'GLOBAL';
                    if (!objectRowsMap.has(objName)) {
                      objectRowsMap.set(objName, {
                        objectName: objName,
                        attributes: {},
                        status: 'NORMAL',
                        measuredAt: m.measuredAt,
                      });
                    }
                    const item = objectRowsMap.get(objName)!;
                    if (m.attributeName) {
                      item.attributes[m.attributeName] = m.value;
                    }
                    if (m.status === 'CRITICAL' || m.status === 'DOWN') {
                      item.status = m.status;
                    } else if (m.status === 'WARNING' && item.status !== 'CRITICAL') {
                      item.status = 'WARNING';
                    }
                    if (new Date(m.measuredAt).getTime() > new Date(item.measuredAt).getTime()) {
                      item.measuredAt = m.measuredAt;
                    }
                  });

                  const objectRows = Array.from(objectRowsMap.values());

                  return (
                    <div
                      key={metric.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3"
                    >
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{metric.name}</h4>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                              Type 3 Multi-Attribute
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              ({objectRows.length} {objectRows.length === 1 ? 'object' : 'objects'})
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium">
                            Columns: {attributeColumns.join(', ') || 'Dynamic'} • Cycle: {metric.cycle ?? 1}
                          </p>
                        </div>

                        {attributeColumns.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {attributeColumns.slice(0, 3).map((attr) => (
                              <button
                                key={attr}
                                onClick={() => handleQuickChart(metric.id, attr, 'ALL')}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <TrendingUp className="w-3 h-3" />
                                Chart {attr}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Multi-Column Table */}
                      {objectRows.length === 0 ? (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                          No multi-attribute measurements recorded yet for this metric.
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-left text-xs text-slate-700">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                              <tr>
                                <th className="py-2.5 px-3.5">Object Identifier</th>
                                {attributeColumns.map((col) => (
                                  <th key={col} className="py-2.5 px-3.5">
                                    {col}
                                  </th>
                                ))}
                                <th className="py-2.5 px-3.5">Overall Status</th>
                                <th className="py-2.5 px-3.5">Last Measured (UTC+7)</th>
                                <th className="py-2.5 px-3.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {objectRows.map((row) => {
                                const statusBadge =
                                  row.status === 'CRITICAL' || row.status === 'DOWN'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : row.status === 'WARNING'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                                return (
                                  <tr key={row.objectName} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 px-3.5 font-bold font-mono text-slate-900 flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                      {row.objectName}
                                    </td>
                                    {attributeColumns.map((col) => {
                                      const val = row.attributes[col] || '-';
                                      return (
                                        <td key={col} className="py-2.5 px-3.5 font-mono text-slate-800 font-semibold">
                                          {val}
                                        </td>
                                      );
                                    })}
                                    <td className="py-2.5 px-3.5">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}>
                                        {row.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-500">
                                      {formatTimeVN(row.measuredAt)}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-right">
                                      <button
                                        onClick={() =>
                                          handleQuickChart(
                                            metric.id,
                                            attributeColumns[0] || 'value',
                                            row.objectName
                                          )
                                        }
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors cursor-pointer inline-flex items-center gap-1"
                                      >
                                        <TrendingUp className="w-3 h-3" />
                                        Chart Object
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 7. SHOW CHARTS (CHOOSE METRIC, CHOOSE ATTRIBUTE [NUMBER ONLY], OBJECT)   */}
          {/* ========================================================================= */}
          <div
            ref={chartSectionRef}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-5"
          >
            {/* Chart Control Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <LineChartIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    Interactive Performance & Telemetry Visualizer
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select metric, numeric attribute, and target object to plot responsive time-series trends
                  </p>
                </div>
              </div>

              {/* Chart Type Toggle (Area vs Line vs Table) */}
              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setChartType('area')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                      chartType === 'area'
                        ? 'bg-white text-indigo-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <AreaChartIcon className="w-3.5 h-3.5" />
                    Area
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('line')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                      chartType === 'line'
                        ? 'bg-white text-indigo-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <LineChartIcon className="w-3.5 h-3.5" />
                    Line
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('table')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                      chartType === 'table'
                        ? 'bg-white text-indigo-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    History Table
                  </button>
                </div>
              </div>
            </div>

            {/* Three Mandatory Selectors: Choose Metric, Choose Attribute (Number Only), Choose Object */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Selector 1: Choose Metric */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-indigo-500" />
                  1. Choose Metric Check *
                </label>
                <div className="relative">
                  <select
                    value={chartMetricId}
                    onChange={(e) => setChartMetricId(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs"
                  >
                    {applicableMetrics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.metricQueryType ? `Type ${m.metricQueryType}` : 'Type 1'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Selector 2: Choose Attribute (Only Number) */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  2. Choose Attribute (Only Number) *
                </label>
                <div className="relative">
                  <select
                    value={chartAttributeName}
                    onChange={(e) => setChartAttributeName(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs"
                  >
                    {numericAttributesForChart.map((attr) => (
                      <option key={attr.key} value={attr.key}>
                        {attr.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Selector 3: Choose Object (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-purple-500" />
                  3. Choose Object (Optional)
                </label>
                <div className="relative">
                  <select
                    value={chartObjectName}
                    onChange={(e) => setChartObjectName(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">ALL (Compare All Objects)</option>
                    {availableObjectsForChart.map((obj) => (
                      <option key={obj} value={obj}>
                        Object: {obj}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Quick Stat Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Latest Value
                </div>
                <div className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                  {chartStats.latest}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Maximum Peak
                </div>
                <div className="text-base font-extrabold text-rose-600 font-mono mt-0.5">
                  {chartStats.max}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Minimum Value
                </div>
                <div className="text-base font-extrabold text-emerald-600 font-mono mt-0.5">
                  {chartStats.min}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Average Value
                </div>
                <div className="text-base font-extrabold text-indigo-600 font-mono mt-0.5">
                  {chartStats.avg}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Samples Collected
                </div>
                <div className="text-base font-extrabold text-slate-700 font-mono mt-0.5">
                  {chartStats.count} pts
                </div>
              </div>
            </div>

            {/* Threshold Guide Line Indicators */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
              <div className="flex items-center gap-4">
                {chartThresholds.warn !== null && (
                  <div className="flex items-center gap-1.5 text-amber-600 font-semibold">
                    <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                    <span>Warn: {chartThresholds.warn}</span>
                  </div>
                )}
                {chartThresholds.high !== null && (
                  <div className="flex items-center gap-1.5 text-orange-600 font-semibold">
                    <span className="w-3 h-0.5 bg-orange-500 inline-block" />
                    <span>High: {chartThresholds.high}</span>
                  </div>
                )}
                {chartThresholds.crit !== null && (
                  <div className="flex items-center gap-1.5 text-rose-600 font-semibold">
                    <span className="w-3 h-0.5 bg-rose-500 inline-block" />
                    <span>Crit: {chartThresholds.crit}</span>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-400 font-medium">
                Timezone: Asia/Ho_Chi_Minh (UTC+7)
              </div>
            </div>

            {/* Visualizer Display: History Table or Chart Canvas */}
            {chartType === 'table' ? (
              <div className="space-y-4 pt-2">
                {/* Table Control Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2.5 flex-1 max-w-md">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search history by object, status, value, or time..."
                        value={tableSearchTerm}
                        onChange={(e) => setTableSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    {tableSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setTableSearchTerm('')}
                        className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer shrink-0"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setTableSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors cursor-pointer shadow-2xs"
                      title="Sort by Timestamp"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                      <span>{tableSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportTableCSV}
                      disabled={filteredSortedTableItems.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {/* Table Data Grid */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <th className="py-3 px-4 font-semibold">Timestamp (UTC+7)</th>
                          <th className="py-3 px-4 font-semibold">Target Object</th>
                          <th className="py-3 px-4 font-semibold">Attribute</th>
                          <th className="py-3 px-4 font-semibold text-right">Measured Value</th>
                          <th className="py-3 px-4 font-semibold text-center">Status</th>
                          <th className="py-3 px-4 font-semibold">Threshold Rules</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {paginatedTableItems.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 px-4 text-center text-slate-400">
                              <Activity className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                              <p className="font-semibold text-slate-600">No telemetry history records found</p>
                              <p className="text-[11px] text-slate-400 mt-1">
                                {tableSearchTerm
                                  ? 'Try adjusting your search keywords or clear the filter.'
                                  : 'No historical records match the chosen metric, attribute, and time window.'}
                              </p>
                            </td>
                          </tr>
                        ) : (
                          paginatedTableItems.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-indigo-50/30 transition-colors group"
                            >
                              <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{item.formattedTime}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 font-medium text-slate-800">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono">
                                  <Server className="w-3 h-3 text-slate-500" />
                                  {item.objectName}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-mono text-slate-600 text-[11px]">
                                {item.attributeName}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-900">
                                  {item.rawValue}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                                    item.status === 'NORMAL' &&
                                      'bg-emerald-50 text-emerald-700 border-emerald-200',
                                    item.status === 'WARN' &&
                                      'bg-amber-50 text-amber-700 border-amber-200',
                                    item.status === 'HIGH' &&
                                      'bg-orange-50 text-orange-700 border-orange-200',
                                    item.status === 'CRITICAL' &&
                                      'bg-rose-50 text-rose-700 border-rose-200'
                                  )}
                                >
                                  {item.status === 'NORMAL' && (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  )}
                                  {item.status === 'WARN' && (
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  )}
                                  {item.status === 'HIGH' && (
                                    <AlertTriangle className="w-3 h-3 text-orange-600" />
                                  )}
                                  {item.status === 'CRITICAL' && (
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                  )}
                                  {item.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                                <div className="flex items-center gap-2 text-[10px]">
                                  {chartThresholds.warn !== null && (
                                    <span className="text-amber-600 font-medium">
                                      W: {chartThresholds.warn}
                                    </span>
                                  )}
                                  {chartThresholds.high !== null && (
                                    <span className="text-orange-600 font-medium">
                                      H: {chartThresholds.high}
                                    </span>
                                  )}
                                  {chartThresholds.crit !== null && (
                                    <span className="text-rose-600 font-medium">
                                      C: {chartThresholds.crit}
                                    </span>
                                  )}
                                  {chartThresholds.warn === null &&
                                    chartThresholds.high === null &&
                                    chartThresholds.crit === null && (
                                      <span className="text-slate-400 italic">None configured</span>
                                    )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Pagination Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                    <div className="flex items-center gap-3">
                      <span>
                        Showing{' '}
                        <strong className="text-slate-800 font-semibold">
                          {filteredSortedTableItems.length === 0
                            ? 0
                            : (tableCurrentPage - 1) * tablePageSize + 1}
                        </strong>{' '}
                        to{' '}
                        <strong className="text-slate-800 font-semibold">
                          {Math.min(
                            tableCurrentPage * tablePageSize,
                            filteredSortedTableItems.length
                          )}
                        </strong>{' '}
                        of{' '}
                        <strong className="text-slate-800 font-semibold">
                          {filteredSortedTableItems.length}
                        </strong>{' '}
                        records
                      </span>

                      <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                        <span className="text-[11px] text-slate-400">Rows per page:</span>
                        <select
                          value={tablePageSize}
                          onChange={(e) => {
                            setTablePageSize(Number(e.target.value));
                            setTableCurrentPage(1);
                          }}
                          className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-medium">
                        Page {tableCurrentPage} of {totalTablePages}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setTableCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={tableCurrentPage <= 1}
                          className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          title="Previous page"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTableCurrentPage((p) => Math.min(totalTablePages, p + 1))}
                          disabled={tableCurrentPage >= totalTablePages}
                          className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          title="Next page"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-80 w-full pt-2">
                {chartTimeSeriesData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full bg-slate-50 rounded-xl border border-slate-200 text-slate-500 p-6 text-center">
                    <Activity className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-700">No time-series measurements found</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      No data points match the selected metric ({activeChartMetric?.name}), attribute (
                      {chartAttributeName}), and time range. Try expanding the time filter or picking another metric.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'area' && (chartObjectName !== 'ALL' || availableObjectsForChart.length <= 1) ? (
                      <AreaChart
                        data={chartTimeSeriesData}
                        margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="shortTime"
                          stroke="#64748b"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#64748b"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          tickLine={false}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderColor: '#e2e8f0',
                            borderRadius: '0.75rem',
                            fontSize: '12px',
                            color: '#0f172a',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          }}
                          labelFormatter={(_, payload) => {
                            if (payload && payload.length > 0) {
                              return payload[0].payload.formattedTime;
                            }
                            return '';
                          }}
                          formatter={(val: any) => [val, `${activeChartMetric?.name} (${chartAttributeName})`]}
                        />
                        {chartThresholds.warn !== null && (
                          <ReferenceLine
                            y={chartThresholds.warn}
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            label={{ value: 'Warn', fill: '#f59e0b', fontSize: 10 }}
                          />
                        )}
                        {chartThresholds.high !== null && (
                          <ReferenceLine
                            y={chartThresholds.high}
                            stroke="#f97316"
                            strokeDasharray="4 4"
                            label={{ value: 'High', fill: '#f97316', fontSize: 10 }}
                          />
                        )}
                        {chartThresholds.crit !== null && (
                          <ReferenceLine
                            y={chartThresholds.crit}
                            stroke="#f43f5e"
                            strokeDasharray="4 4"
                            label={{ value: 'Crit', fill: '#f43f5e', fontSize: 10 }}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="value"
                          name={activeChartMetric?.name || 'Metric'}
                          stroke="#6366f1"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#analyticsGradient)"
                          activeDot={{ r: 5, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    ) : (
                      /* Multi-Line or Standard Line Chart */
                      <LineChart
                        data={chartTimeSeriesData}
                        margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="shortTime"
                          stroke="#64748b"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#64748b"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          tickLine={false}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderColor: '#e2e8f0',
                            borderRadius: '0.75rem',
                            fontSize: '12px',
                            color: '#0f172a',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          }}
                          labelFormatter={(_, payload) => {
                            if (payload && payload.length > 0) {
                              return payload[0].payload.formattedTime;
                            }
                            return '';
                          }}
                        />
                        {chartThresholds.warn !== null && (
                          <ReferenceLine
                            y={chartThresholds.warn}
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                          />
                        )}
                        {chartThresholds.high !== null && (
                          <ReferenceLine
                            y={chartThresholds.high}
                            stroke="#f97316"
                            strokeDasharray="4 4"
                          />
                        )}
                        {chartThresholds.crit !== null && (
                          <ReferenceLine
                            y={chartThresholds.crit}
                            stroke="#f43f5e"
                            strokeDasharray="4 4"
                          />
                        )}

                        {/* If comparing all objects, render a distinct line per object */}
                        {chartObjectName === 'ALL' && availableObjectsForChart.length > 1 ? (
                          <>
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                            {availableObjectsForChart.map((objName, idx) => (
                              <Line
                                key={objName}
                                type="monotone"
                                dataKey={objName}
                                name={`Object: ${objName}`}
                                stroke={OBJECT_COLORS[idx % OBJECT_COLORS.length]}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                                connectNulls
                              />
                            ))}
                          </>
                        ) : (
                          <Line
                            type="monotone"
                            dataKey="value"
                            name={activeChartMetric?.name || 'Metric Value'}
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
                          />
                        )}
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
