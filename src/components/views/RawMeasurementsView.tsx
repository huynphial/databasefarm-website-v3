import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  Search,
  RefreshCw,
  Download,
  Clock,
  Database,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  RotateCcw,
  FolderKanban,
  FileCode2,
  Box,
  Tag,
  SlidersHorizontal,
  ShieldAlert,
  Terminal,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  RawMeasurementEntity,
  DatabaseEntity,
  MetricEntity,
  DatabaseEngineEntity,
  RawMeasurementFilter,
  GroupEntity,
  TemplateEntity,
} from '../../types';
import { getDbEngineBadgeClass, getDbEngineHexColor } from '../../config/dbEngines';
import { useTranslation } from '../../i18n';
import { api } from '../../lib/api';
import { DatabaseEngineFilter } from '../common/DatabaseEngineFilter';
import { TargetDatabaseFilter } from '../common/TargetDatabaseFilter';
import { SearchableSelect, SearchableOption } from '../common/SearchableSelect';

interface RawMeasurementsViewProps {
  measurements: RawMeasurementEntity[];
  databases: DatabaseEntity[];
  metrics: MetricEntity[];
  groups?: GroupEntity[];
  templates?: TemplateEntity[];
  databaseEngines?: DatabaseEngineEntity[];
  timestampFormat?: string;
  onRefresh: () => void;
  onSimulatePoll?: () => void;
  showInfoTips?: boolean;
}

export const RawMeasurementsView: React.FC<RawMeasurementsViewProps> = ({
  measurements,
  databases,
  metrics,
  groups = [],
  templates = [],
  databaseEngines = [],
  timestampFormat = 'HH24:MI:SS DD/MM/YYYY',
  onRefresh,
  showInfoTips = true,
}) => {
  const { t } = useTranslation();
  const [measurementsData, setMeasurementsData] = useState<RawMeasurementEntity[]>(measurements);
  const [isSearching, setIsSearching] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [minDurationInput, setMinDurationInput] = useState<string>('0');
  const [appliedMinDuration, setAppliedMinDuration] = useState<number>(0);
  const [engineFilter, setEngineFilter] = useState<string>('ALL');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [selectedTemplateFilter, setSelectedTemplateFilter] = useState<string>('ALL');
  const [selectedDbFilter, setSelectedDbFilter] = useState<string>('ALL');
  const [selectedMetricFilter, setSelectedMetricFilter] = useState<string>('ALL');
  const [selectedObjectFilter, setSelectedObjectFilter] = useState<string>('ALL');
  const [selectedAttributeFilter, setSelectedAttributeFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Date Range Filter (Default: Last 24 Hours)
  const [fromDate, setFromDate] = useState<string>(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Pagination state (Default: 50 per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Dynamic discovery of unique objects and attributes
  const availableObjects = useMemo(() => {
    const set = new Set<string>();
    const allSources = [...measurementsData, ...measurements];
    allSources.forEach((m) => {
      if (m.objectName && m.objectName.trim()) {
        if (selectedMetricFilter !== 'ALL' && m.metricId !== selectedMetricFilter) return;
        if (selectedDbFilter !== 'ALL' && m.dbId !== selectedDbFilter) return;
        set.add(m.objectName.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [measurementsData, measurements, selectedMetricFilter, selectedDbFilter]);

  const availableAttributes = useMemo(() => {
    const set = new Set<string>();
    if (selectedMetricFilter !== 'ALL') {
      const met = metrics.find((m) => m.id === selectedMetricFilter);
      if (met?.thresholdsConfig?.perAttribute) {
        met.thresholdsConfig.perAttribute.forEach((a) => {
          if (a.attributeName && a.attributeName.trim()) set.add(a.attributeName.trim());
        });
      }
    } else {
      metrics.forEach((m) => {
        if (m.thresholdsConfig?.perAttribute) {
          m.thresholdsConfig.perAttribute.forEach((a) => {
            if (a.attributeName && a.attributeName.trim()) set.add(a.attributeName.trim());
          });
        }
      });
    }
    const allSources = [...measurementsData, ...measurements];
    allSources.forEach((m) => {
      if (m.attributeName && m.attributeName.trim()) {
        if (selectedMetricFilter !== 'ALL' && m.metricId !== selectedMetricFilter) return;
        if (selectedDbFilter !== 'ALL' && m.dbId !== selectedDbFilter) return;
        set.add(m.attributeName.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [measurementsData, measurements, metrics, selectedMetricFilter, selectedDbFilter]);

  const hasCustomQueryRef = useRef(false);

  // Sync with prop updates or trigger initial query
  useEffect(() => {
    if (!hasCustomQueryRef.current) {
      if (measurements && measurements.length > 0) {
        setMeasurementsData(measurements);
      } else {
        handleRunQuery();
      }
    }
  }, [measurements]);

  // Options for Database Groups filter
  const groupOptions = useMemo<SearchableOption[]>(() => {
    return groups.map((g) => {
      const dbsInGroup = databases.filter(
        (db) => g.databaseIds?.includes(db.id) || db.groupIds?.includes(g.id)
      );
      return {
        value: g.id,
        label: g.name,
        subLabel: g.description || undefined,
        count: dbsInGroup.length,
        badge: `${dbsInGroup.length} DB${dbsInGroup.length === 1 ? '' : 's'}`,
        badgeColor: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
        icon: <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />,
      };
    });
  }, [groups, databases]);

  // Options for Metric Templates filter
  const templateOptions = useMemo<SearchableOption[]>(() => {
    return templates.map((t) => {
      const metricsInTmpl = metrics.filter(
        (m) => t.metricIds?.includes(m.id) || m.templateId === t.id || m.templateIds?.includes(t.id)
      );
      return {
        value: t.id,
        label: t.name,
        subLabel: t.targetDbType ? `Engine: ${t.targetDbType}` : (t.description || undefined),
        count: metricsInTmpl.length,
        badge: t.targetDbType && t.targetDbType !== 'ALL' ? t.targetDbType : `${metricsInTmpl.length} Metrics`,
        badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        icon: <FileCode2 className="w-3.5 h-3.5 text-emerald-600" />,
      };
    });
  }, [templates, metrics]);

  // Options for Metrics filter
  const metricOptions = useMemo<SearchableOption[]>(() => {
    let filtered = metrics;
    if (engineFilter !== 'ALL') {
      filtered = filtered.filter(
        (m) =>
          !m.databaseEngine?.engineCode ||
          m.databaseEngine.engineCode.toUpperCase() === engineFilter.toUpperCase()
      );
    }
    if (selectedTemplateFilter !== 'ALL') {
      const tmpl = templates.find((t) => t.id === selectedTemplateFilter);
      filtered = filtered.filter(
        (m) =>
          tmpl?.metricIds?.includes(m.id) ||
          m.templateId === selectedTemplateFilter ||
          m.templateIds?.includes(selectedTemplateFilter)
      );
    }

    return filtered.map((m) => {
      const typeLabel = m.metricQueryType ? `Type ${m.metricQueryType}` : undefined;
      const engineCode = m.databaseEngine?.engineCode || m.databaseEngineId;
      return {
        value: m.id,
        label: m.name,
        subLabel: m.sqlQuery ? m.sqlQuery.replace(/\s+/g, ' ').slice(0, 80) : undefined,
        badge: engineCode ? engineCode : typeLabel,
        badgeColor: engineCode ? getDbEngineBadgeClass(engineCode) : 'bg-slate-100 text-slate-700 border border-slate-200',
        icon: <Activity className="w-3.5 h-3.5 text-purple-600" />,
      };
    });
  }, [metrics, engineFilter, selectedTemplateFilter, templates]);

  // Options for Objects filter
  const objectOptions = useMemo<SearchableOption[]>(() => {
    return availableObjects.map((obj) => ({
      value: obj,
      label: obj,
      icon: <Box className="w-3.5 h-3.5 text-amber-600" />,
    }));
  }, [availableObjects]);

  // Options for Attributes filter
  const attributeOptions = useMemo<SearchableOption[]>(() => {
    return availableAttributes.map((attr) => ({
      value: attr,
      label: attr,
      icon: <Tag className="w-3.5 h-3.5 text-cyan-600" />,
    }));
  }, [availableAttributes]);

  // Options for Status filter (Poll Status)
  const statusOptions = useMemo<SearchableOption[]>(() => {
    return [
      { value: 'SUCCESS', label: 'SUCCESS (OK)', badge: 'SUCCESS', badgeColor: 'bg-emerald-100 text-emerald-800 border border-emerald-300', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> },
      { value: 'FAIL', label: 'FAIL (Error)', badge: 'FAIL', badgeColor: 'bg-red-100 text-red-800 border border-red-300', icon: <XCircle className="w-3.5 h-3.5 text-red-600" /> },
    ];
  }, []);

  // Target databases scoped to selected group if active
  const databasesForFilter = useMemo(() => {
    if (selectedGroupFilter === 'ALL') return databases;
    const grp = groups.find((g) => g.id === selectedGroupFilter);
    return databases.filter(
      (db) => grp?.databaseIds?.includes(db.id) || db.groupIds?.includes(selectedGroupFilter)
    );
  }, [databases, selectedGroupFilter, groups]);

  // Execute database query with filter criteria without row limits
  const handleRunQuery = useCallback(async (overrideFilter?: Partial<RawMeasurementFilter> & { groupFilter?: string; templateFilter?: string }) => {
    setIsSearching(true);
    hasCustomQueryRef.current = true;
    try {
      const activeDb = overrideFilter?.dbId !== undefined ? overrideFilter.dbId : selectedDbFilter;
      const activeGroup = overrideFilter?.groupFilter !== undefined ? overrideFilter.groupFilter : selectedGroupFilter;
      const activeMetric = overrideFilter?.metricId !== undefined ? overrideFilter.metricId : selectedMetricFilter;
      const activeTemplate = overrideFilter?.templateFilter !== undefined ? overrideFilter.templateFilter : selectedTemplateFilter;
      const activeEngine = overrideFilter?.dbType !== undefined ? overrideFilter.dbType : engineFilter;
      const activeObject = overrideFilter?.objectName !== undefined ? overrideFilter.objectName : selectedObjectFilter;
      const activeAttribute = overrideFilter?.attributeName !== undefined ? overrideFilter.attributeName : selectedAttributeFilter;
      const activeStatus = overrideFilter?.status !== undefined ? overrideFilter.status : selectedStatusFilter;
      const activeFrom = overrideFilter?.fromDate !== undefined ? overrideFilter.fromDate : fromDate;
      const activeTo = overrideFilter?.toDate !== undefined ? overrideFilter.toDate : toDate;
      const activeSearch = overrideFilter?.searchTerm !== undefined ? overrideFilter.searchTerm : searchTerm;
      const activeMinDuration = overrideFilter?.minDurationMs !== undefined
        ? overrideFilter.minDurationMs
        : (minDurationInput.trim() === '' || isNaN(Number(minDurationInput)) ? 0 : Math.max(0, Number(minDurationInput)));

      setAppliedMinDuration(activeMinDuration);

      // 1. Resolve database IDs from group filter if active
      let targetDbIds: string[] | undefined = undefined;
      if (activeGroup !== 'ALL') {
        const grp = groups.find((g) => g.id === activeGroup);
        const ids = new Set<string>();
        if (grp?.databaseIds) grp.databaseIds.forEach((id) => ids.add(id));
        databases.forEach((db) => {
          if (db.groupIds?.includes(activeGroup)) ids.add(db.id);
        });
        targetDbIds = Array.from(ids);
      }

      // 2. Resolve metric IDs from template filter if active
      let targetMetricIds: string[] | undefined = undefined;
      if (activeTemplate !== 'ALL') {
        const tmpl = templates.find((t) => t.id === activeTemplate);
        const ids = new Set<string>();
        if (tmpl?.metricIds) tmpl.metricIds.forEach((id) => ids.add(id));
        metrics.forEach((m) => {
          if (m.templateId === activeTemplate || m.templateIds?.includes(activeTemplate)) {
            ids.add(m.id);
          }
        });
        targetMetricIds = Array.from(ids);
      }

      const queryFilter: RawMeasurementFilter = {
        dbId: activeDb !== 'ALL' ? activeDb : undefined,
        dbIds: targetDbIds && targetDbIds.length > 0 ? targetDbIds : undefined,
        groupId: activeGroup !== 'ALL' ? activeGroup : undefined,
        metricId: activeMetric !== 'ALL' ? activeMetric : undefined,
        metricIds: targetMetricIds && targetMetricIds.length > 0 ? targetMetricIds : undefined,
        templateId: activeTemplate !== 'ALL' ? activeTemplate : undefined,
        dbType: activeEngine !== 'ALL' ? activeEngine : undefined,
        status: activeStatus !== 'ALL' ? activeStatus : undefined,
        pollStatus: activeStatus !== 'ALL' ? activeStatus : undefined,
        objectName: activeObject !== 'ALL' ? activeObject : undefined,
        attributeName: activeAttribute !== 'ALL' ? activeAttribute : undefined,
        fromDate: activeFrom || undefined,
        toDate: activeTo || undefined,
        searchTerm: activeSearch?.trim() || undefined,
        minDurationMs: activeMinDuration,
        limit: 0, // 0 indicates unlimited: return all database rows matching criteria from Prisma
      };

      const data = await api.getRawMeasurements(queryFilter);

      setMeasurementsData(data || []);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to query raw measurements from database:', err);
    } finally {
      setIsSearching(false);
    }
  }, [
    selectedDbFilter,
    selectedGroupFilter,
    selectedMetricFilter,
    selectedTemplateFilter,
    engineFilter,
    selectedObjectFilter,
    selectedAttributeFilter,
    selectedStatusFilter,
    fromDate,
    toDate,
    searchTerm,
    groups,
    databases,
    templates,
    metrics,
  ]);

  // Reset all filters to default state and execute search (default to 24h)
  const handleResetFilters = async () => {
    const defaultFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const defaultTo = new Date().toISOString().slice(0, 10);
    setSearchTerm('');
    setMinDurationInput('0');
    setAppliedMinDuration(0);
    setEngineFilter('ALL');
    setSelectedGroupFilter('ALL');
    setSelectedTemplateFilter('ALL');
    setSelectedDbFilter('ALL');
    setSelectedMetricFilter('ALL');
    setSelectedObjectFilter('ALL');
    setSelectedAttributeFilter('ALL');
    setSelectedStatusFilter('ALL');
    setFromDate(defaultFrom);
    setToDate(defaultTo);
    setCurrentPage(1);

    await handleRunQuery({
      searchTerm: '',
      minDurationMs: 0,
      dbType: 'ALL',
      groupFilter: 'ALL',
      templateFilter: 'ALL',
      dbId: 'ALL',
      metricId: 'ALL',
      status: 'ALL',
      pollStatus: 'ALL',
      objectName: 'ALL',
      attributeName: 'ALL',
      fromDate: defaultFrom,
      toDate: defaultTo,
    });
  };

  // Quick Date Presets
  const handleSetQuickDate = (days: number | 'ALL') => {
    let nextFrom = '';
    let nextTo = '';
    if (days !== 'ALL') {
      const now = new Date();
      const past = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      nextTo = now.toISOString().slice(0, 10);
      nextFrom = past.toISOString().slice(0, 10);
    }
    setFromDate(nextFrom);
    setToDate(nextTo);
    setCurrentPage(1);
    handleRunQuery({ fromDate: nextFrom, toDate: nextTo });
  };

  // Client-side fallback filter ensure perfect synchronization with view state
  const filteredMeasurements = useMemo(() => {
    // 1. Get database IDs matching selected group if active
    let allowedDbIdsByGroup: Set<string> | null = null;
    if (selectedGroupFilter !== 'ALL') {
      const grp = groups.find((g) => g.id === selectedGroupFilter);
      allowedDbIdsByGroup = new Set<string>();
      if (grp?.databaseIds) {
        grp.databaseIds.forEach((id) => allowedDbIdsByGroup!.add(id));
      }
      databases.forEach((db) => {
        if (db.groupIds?.includes(selectedGroupFilter)) {
          allowedDbIdsByGroup!.add(db.id);
        }
      });
    }

    // 2. Get metric IDs matching selected template if active
    let allowedMetricIdsByTemplate: Set<string> | null = null;
    if (selectedTemplateFilter !== 'ALL') {
      const tmpl = templates.find((t) => t.id === selectedTemplateFilter);
      allowedMetricIdsByTemplate = new Set<string>();
      if (tmpl?.metricIds) {
        tmpl.metricIds.forEach((id) => allowedMetricIdsByTemplate!.add(id));
      }
      metrics.forEach((m) => {
        if (m.templateId === selectedTemplateFilter || m.templateIds?.includes(selectedTemplateFilter)) {
          allowedMetricIdsByTemplate!.add(m.id);
        }
      });
    }

    return measurementsData.filter((item) => {
      const matchEngine = engineFilter === 'ALL' || (item.dbType || '').toUpperCase() === engineFilter.toUpperCase();
      const matchGroup = !allowedDbIdsByGroup || allowedDbIdsByGroup.has(item.dbId);
      const matchTemplate = !allowedMetricIdsByTemplate || allowedMetricIdsByTemplate.has(item.metricId);
      const matchDb = selectedDbFilter === 'ALL' || item.dbId === selectedDbFilter;
      const matchMetric = selectedMetricFilter === 'ALL' || item.metricId === selectedMetricFilter;
      const matchStatus =
        selectedStatusFilter === 'ALL' ||
        (selectedStatusFilter === 'FAIL'
          ? ((item.pollStatus || '').toUpperCase() === 'FAIL' || (item.pollStatus || '').toUpperCase() === 'FAILED' || (item.pollStatus || '').toUpperCase() === 'ERROR')
          : (item.pollStatus || 'SUCCESS').toUpperCase() === selectedStatusFilter.toUpperCase());
      const matchObject =
        selectedObjectFilter === 'ALL' ||
        (item.objectName || 'INSTANCE').trim().toLowerCase() === selectedObjectFilter.trim().toLowerCase();
      const matchAttribute =
        selectedAttributeFilter === 'ALL' ||
        (item.attributeName || 'value').trim().toLowerCase() === selectedAttributeFilter.trim().toLowerCase();

      let matchDate = true;
      const itemDateStr = item.measuredAt ? item.measuredAt.slice(0, 10) : '';
      if (fromDate && itemDateStr && itemDateStr < fromDate) matchDate = false;
      if (toDate && itemDateStr && itemDateStr > toDate) matchDate = false;

      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        (item.dbName && item.dbName.toLowerCase().includes(q)) ||
        (item.metricName && item.metricName.toLowerCase().includes(q)) ||
        (item.objectName && item.objectName.toLowerCase().includes(q)) ||
        (item.attributeName && item.attributeName.toLowerCase().includes(q)) ||
        (item.value && item.value.toLowerCase().includes(q)) ||
        (item.pollStatus && item.pollStatus.toLowerCase().includes(q)) ||
        (item.pollResponse && item.pollResponse.toLowerCase().includes(q)) ||
        (item.dbType && item.dbType.toLowerCase().includes(q));

      const itemDuration = item.queryDurationMs !== undefined && item.queryDurationMs !== null ? Number(item.queryDurationMs) : 0;
      const matchDuration = itemDuration >= appliedMinDuration;

      return matchEngine && matchGroup && matchTemplate && matchDb && matchMetric && matchStatus && matchObject && matchAttribute && matchDate && matchSearch && matchDuration;
    });
  }, [
    measurementsData,
    appliedMinDuration,
    engineFilter,
    selectedGroupFilter,
    selectedTemplateFilter,
    selectedDbFilter,
    selectedMetricFilter,
    selectedStatusFilter,
    selectedObjectFilter,
    selectedAttributeFilter,
    groups,
    templates,
    databases,
    metrics,
    fromDate,
    toDate,
    searchTerm,
  ]);

  // Paginated Slices
  const totalPages = Math.max(1, Math.ceil(filteredMeasurements.length / pageSize));
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredMeasurements.slice(startIdx, startIdx + pageSize);
  }, [filteredMeasurements, currentPage, pageSize]);

  const handleExportCsv = () => {
    if (filteredMeasurements.length === 0) return;
    const headers = [
      'ID',
      'Database Type',
      'Database Name',
      'Metric Name',
      'Object Name',
      'Attribute Name',
      'Poll Status',
      'Measured Value',
      'Query Duration (ms)',
      'Poll Response / Error',
      'Triggered Threshold',
      'Cycle',
      'Timestamp (UTC+7)',
    ];

    const rows = filteredMeasurements.map((m) => [
      m.id,
      m.dbType,
      `"${(m.dbName || '').replace(/"/g, '""')}"`,
      `"${(m.metricName || '').replace(/"/g, '""')}"`,
      `"${(m.objectName || '').replace(/"/g, '""')}"`,
      `"${(m.attributeName || 'value').replace(/"/g, '""')}"`,
      m.pollStatus || (m.status === 'ERROR' || m.status === 'FAIL' || m.status === 'DOWN' ? 'FAIL' : 'SUCCESS'),
      `"${String(m.value || '').replace(/"/g, '""')}"`,
      m.queryDurationMs !== undefined && m.queryDurationMs !== null ? m.queryDurationMs : 0,
      `"${String(m.pollResponse || m.response || '').replace(/"/g, '""')}"`,
      `"${(m.triggeredThreshold || 'Normal / In Bounds').replace(/"/g, '""')}"`,
      m.cycle ?? 1,
      formatExactTime(m.measuredAt),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `raw_measurements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  function formatExactTime(isoStr: string) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();

      const fmt = timestampFormat || 'HH24:MI:SS DD/MM/YYYY';
      if (fmt === 'DD/MM/YYYY HH24:MI:SS') {
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      }
      if (fmt === 'YYYY-MM-DD HH:mm:ss') {
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      }
      return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
    } catch {
      return isoStr;
    }
  }

  function formatRelativeTime(isoStr: string) {
    if (!isoStr) return '-';
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
      if (diffSec < 45) return t('rawMeasurements.justNow');
      if (diffSec < 90) return `1 ${t('rawMeasurements.minAgo')}`;
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} ${t('rawMeasurements.minsAgo')}`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ${t('rawMeasurements.hoursAgo')}`;
      return `${Math.floor(diffSec / 86400)} ${t('rawMeasurements.daysAgo')}`;
    } catch {
      return isoStr;
    }
  }

  const getStatusBadgeMeta = (pollStatus?: string) => {
    const ps = (pollStatus || 'SUCCESS').toUpperCase();

    if (ps === 'FAIL' || ps === 'FAILED' || ps === 'ERROR') {
      return { badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500', label: 'FAIL', isFail: true };
    }
    if (ps === 'TIMEOUT') {
      return { badge: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500', label: 'TIMEOUT', isFail: true };
    }
    return { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'SUCCESS', isFail: false };
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    appliedMinDuration > 0 ||
    minDurationInput.trim() !== '' && minDurationInput.trim() !== '0' ||
    engineFilter !== 'ALL' ||
    selectedGroupFilter !== 'ALL' ||
    selectedTemplateFilter !== 'ALL' ||
    selectedDbFilter !== 'ALL' ||
    selectedMetricFilter !== 'ALL' ||
    selectedStatusFilter !== 'ALL' ||
    selectedObjectFilter !== 'ALL' ||
    selectedAttributeFilter !== 'ALL';

  return (
    <div className="p-6 sm:p-8 flex-1 flex flex-col gap-5 overflow-y-auto bg-slate-50/50">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            {t('rawMeasurements.title')}
          </h2>
          <p className="text-xs text-slate-500">
            {t('rawMeasurements.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={filteredMeasurements.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('rawMeasurements.exportCsv')}</span>
          </button>
          <button
            onClick={() => {
              handleRunQuery();
              onRefresh();
            }}
            disabled={isSearching}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title={t('rawMeasurements.refresh')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin text-indigo-600' : ''}`} />
            <span>{t('rawMeasurements.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Info Tip */}
      {showInfoTips && (
        <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl text-indigo-950 flex items-start gap-2.5 text-xs shadow-2xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            {t('rawMeasurements.pipelineInfo')}
          </div>
        </div>
      )}

      {/* Control Bar: Search Input, Date Range, Filters & Search Trigger */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
        {/* Row 1: Search Form + Search Button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunQuery();
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t('rawMeasurements.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Duration Filter Input */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs shrink-0">
            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <label htmlFor="rawMinDurationInput" className="font-semibold text-slate-600 whitespace-nowrap text-[11px]">
              {t('rawMeasurements.minDuration')}:
            </label>
            <div className="flex items-center">
              <input
                id="rawMinDurationInput"
                type="number"
                min="0"
                step="10"
                placeholder="0"
                value={minDurationInput}
                onChange={(e) => setMinDurationInput(e.target.value)}
                className="w-16 bg-transparent font-bold text-slate-800 focus:outline-hidden text-xs text-right pr-0.5 font-mono"
              />
              <span className="text-[11px] text-slate-500 font-semibold">ms</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Dedicated Search / Query Execution Button */}
            <button
              type="submit"
              disabled={isSearching}
              className="flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
            >
              <Search className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
              <span>{isSearching ? t('rawMeasurements.querying') : t('rawMeasurements.searchButton')}</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={isSearching}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                title={t('rawMeasurements.resetFilters')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('rawMeasurements.resetFilters')}</span>
              </button>
            )}
          </div>
        </form>

        {/* Row 2: Date Range Filter + Filter Dropdowns */}
        <div className="space-y-3 pt-2.5 border-t border-slate-100 text-xs">
          {/* Sub-row 1: Date Range Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 text-[11px] text-slate-600 font-semibold mr-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>{t('rawMeasurements.dateRange')}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-medium">{t('rawMeasurements.from')}</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-medium">{t('rawMeasurements.to')}</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              {/* Quick Presets */}
              <div className="flex items-center gap-1 ml-1">
                <button
                  type="button"
                  onClick={() => handleSetQuickDate(1)}
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  {t('rawMeasurements.last24h')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDate(3)}
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  {t('rawMeasurements.last3Days')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDate(7)}
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  {t('rawMeasurements.last7Days')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickDate('ALL')}
                  className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  {t('rawMeasurements.all')}
                </button>
              </div>

              {/* Quick Duration Presets */}
              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
                <span className="text-[10px] text-slate-400 font-medium">Duration:</span>
                <button
                  type="button"
                  onClick={() => {
                    setMinDurationInput('0');
                    setCurrentPage(1);
                    handleRunQuery({ minDurationMs: 0 });
                  }}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                    appliedMinDuration === 0 ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  &gt;= 0ms
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMinDurationInput('50');
                    setCurrentPage(1);
                    handleRunQuery({ minDurationMs: 50 });
                  }}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                    appliedMinDuration === 50 ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  &gt;= 50ms
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMinDurationInput('200');
                    setCurrentPage(1);
                    handleRunQuery({ minDurationMs: 200 });
                  }}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                    appliedMinDuration === 200 ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  &gt;= 200ms
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMinDurationInput('1000');
                    setCurrentPage(1);
                    handleRunQuery({ minDurationMs: 1000 });
                  }}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                    appliedMinDuration === 1000 ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  &gt;= 1s
                </button>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3" />
                <span>Filters active</span>
              </div>
            )}
          </div>

          {/* Sub-row 2: Searchable Dropdown Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-2">
            {/* 1. DB Engine Filter */}
            <div>
              <DatabaseEngineFilter
                value={engineFilter}
                onChange={(val) => {
                  setEngineFilter(val);
                  setCurrentPage(1);
                  handleRunQuery({ dbType: val });
                }}
                databases={databases}
                databaseEngines={databaseEngines}
                allLabel={t('rawMeasurements.allEngines')}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
              />
            </div>

            {/* 2. Database Group Filter (Searchable) */}
            <div>
              <SearchableSelect
                value={selectedGroupFilter}
                onChange={(val) => {
                  setSelectedGroupFilter(val);
                  setCurrentPage(1);
                  handleRunQuery({ groupFilter: val });
                }}
                options={groupOptions}
                allLabel={t('rawMeasurements.allGroups')}
                allSubLabel="Show telemetry across all database groups"
                placeholder={t('rawMeasurements.searchGroup')}
                title={t('rawMeasurements.databaseGroup')}
                icon={<FolderKanban className="w-3.5 h-3.5" />}
                className="w-full"
                popoverMinWidth="min-w-[260px]"
                emptyText={t('rawMeasurements.noMatchingItems')}
              />
            </div>

            {/* 3. Metric Template Filter (Searchable) */}
            <div>
              <SearchableSelect
                value={selectedTemplateFilter}
                onChange={(val) => {
                  setSelectedTemplateFilter(val);
                  setCurrentPage(1);
                  handleRunQuery({ templateFilter: val });
                }}
                options={templateOptions}
                allLabel={t('rawMeasurements.allTemplates')}
                allSubLabel="Show telemetry from all metric templates"
                placeholder={t('rawMeasurements.searchTemplate')}
                title={t('rawMeasurements.metricTemplate')}
                icon={<FileCode2 className="w-3.5 h-3.5" />}
                className="w-full"
                popoverMinWidth="min-w-[260px]"
                emptyText={t('rawMeasurements.noMatchingItems')}
              />
            </div>

            {/* 4. Target Database Filter (Searchable) */}
            <div>
              <TargetDatabaseFilter
                value={selectedDbFilter}
                onChange={(val) => {
                  setSelectedDbFilter(val);
                  setCurrentPage(1);
                  handleRunQuery({ dbId: val });
                }}
                databases={databasesForFilter}
                selectedEngineType={engineFilter}
                onEngineChange={(eng) => setEngineFilter(eng)}
                allLabel={t('rawMeasurements.allDatabases')}
                variant="compact"
                className="w-full"
              />
            </div>

            {/* 5. Metric Filter (Searchable) */}
            <div>
              <SearchableSelect
                value={selectedMetricFilter}
                onChange={(val) => {
                  setSelectedMetricFilter(val);
                  setCurrentPage(1);
                  handleRunQuery({ metricId: val });
                }}
                options={metricOptions}
                allLabel={t('rawMeasurements.allMetrics')}
                allSubLabel="Show telemetry across all metrics"
                placeholder={t('rawMeasurements.searchMetric')}
                title={t('rawMeasurements.metricName')}
                icon={<Activity className="w-3.5 h-3.5" />}
                className="w-full"
                popoverMinWidth="min-w-[300px] sm:min-w-[360px]"
                emptyText={t('rawMeasurements.noMatchingItems')}
              />
            </div>

            {/* 6. Poll Status Filter (Searchable) */}
            <div>
              <SearchableSelect
                value={selectedStatusFilter}
                onChange={(val) => {
                  setSelectedStatusFilter(val);
                  setCurrentPage(1);
                  handleRunQuery({ status: val });
                }}
                options={statusOptions}
                allLabel={t('rawMeasurements.allStatuses')}
                allSubLabel="Filter by poll metric status"
                placeholder="Filter status..."
                title={t('rawMeasurements.pollStatus')}
                icon={<ShieldAlert className="w-3.5 h-3.5" />}
                className="w-full"
                popoverMinWidth="min-w-[200px]"
                emptyText={t('rawMeasurements.noMatchingItems')}
              />
            </div>

            {/* 7. Object Name Filter (Searchable) */}
            <div>
              <SearchableSelect
                value={selectedObjectFilter}
                onChange={(val) => {
                  setSelectedObjectFilter(val);
                  setCurrentPage(1);
                  handleRunQuery({ objectName: val });
                }}
                options={objectOptions}
                allLabel={t('rawMeasurements.allObjects')}
                allSubLabel="Show telemetry from all objects/entities"
                placeholder={t('rawMeasurements.searchObject')}
                title={t('rawMeasurements.objectName')}
                icon={<Box className="w-3.5 h-3.5" />}
                className="w-full"
                popoverMinWidth="min-w-[240px]"
                emptyText={t('rawMeasurements.noMatchingItems')}
              />
            </div>

            {/* 8. Attribute Name Filter (Searchable) */}
            <div>
              <SearchableSelect
                value={selectedAttributeFilter}
                onChange={(val) => {
                  setSelectedAttributeFilter(val);
                  setCurrentPage(1);
                  handleRunQuery({ attributeName: val });
                }}
                options={attributeOptions}
                allLabel={t('rawMeasurements.allAttributes')}
                allSubLabel="Show telemetry for all attributes/fields"
                placeholder={t('rawMeasurements.searchAttribute')}
                title={t('rawMeasurements.attributeName')}
                icon={<Tag className="w-3.5 h-3.5" />}
                className="w-full"
                popoverMinWidth="min-w-[240px]"
                emptyText={t('rawMeasurements.noMatchingItems')}
              />
            </div>
          </div>
        </div>

        {/* Row 3: Telemetry Count & Timezone Indicator */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100 font-mono">
          <span>
            {t('rawMeasurements.showing')} <strong className="text-slate-800">{filteredMeasurements.length}</strong> {t('rawMeasurements.matchingEntries')} ({t('rawMeasurements.total')}: {measurementsData.length})
          </span>
          <span>{t('rawMeasurements.timezone')}</span>
        </div>
      </div>

      {/* Raw Measurements Data Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="overflow-x-auto w-full rounded-t-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3.5 w-[150px] whitespace-nowrap">{t('rawMeasurements.timestamp')}</th>
                <th className="py-2.5 px-3.5 w-[180px]">{t('rawMeasurements.database')}</th>
                <th className="py-2.5 px-3.5 w-[180px]">{t('rawMeasurements.metricName')}</th>
                <th className="py-2.5 px-3.5 w-[160px]">{t('rawMeasurements.objectAttribute')}</th>
                <th className="py-2.5 px-3.5 w-[110px] whitespace-nowrap">{t('rawMeasurements.queryDuration')}</th>
                <th className="py-2.5 px-3.5 w-[120px]">{t('rawMeasurements.pollStatus')}</th>
                <th className="py-2.5 px-3.5 min-w-[260px]">{t('rawMeasurements.measuredValue')}</th>
                <th className="py-2.5 px-3.5 w-[80px] text-center whitespace-nowrap">{t('rawMeasurements.cycle')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">{t('rawMeasurements.noMeasurementsFound')}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t('rawMeasurements.noMeasurementsFoundSub')}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => {
                  const db = databases.find((d) => d.id === item.dbId);
                  const ipPort = db ? `${db.host}:${db.port}` : '127.0.0.1:3306';
                  const badgeClass = getDbEngineBadgeClass(item.dbType);
                  const hexColor = getDbEngineHexColor(item.dbType, databaseEngines);
                  const statusMeta = getStatusBadgeMeta(item.pollStatus);
                  const displayPollStatus = item.pollStatus || 'SUCCESS';
                  const serverResponse = item.pollResponse || item.response;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Timestamp */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap align-top">
                        <div className="font-mono text-[11px] text-slate-800 font-semibold">
                          {formatExactTime(item.measuredAt)}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{formatRelativeTime(item.measuredAt)}</span>
                        </div>
                      </td>

                      {/* 2. Database & Entity */}
                      <td className="py-2.5 px-3.5 align-top">
                        <div className="space-y-0.5">
                          {/* Line 1: Database Name */}
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate max-w-[150px]" title={item.dbName}>{item.dbName}</span>
                          </div>
                          {/* Line 2: IP Address : Port */}
                          <div className="text-[10px] text-slate-400 font-mono">
                            {ipPort}
                          </div>
                        </div>
                      </td>

                      {/* 3. Metric Name Column */}
                      <td className="py-2.5 px-3.5 align-top">
                        <div className="space-y-1">
                          {/* Line 1: Metric Name */}
                          <div className="text-xs font-bold text-slate-900 leading-tight">
                            {item.metricName}
                          </div>
                          {/* Line 2: Database Type brand tag */}
                          <div>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${badgeClass}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hexColor }} />
                              {item.dbType}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 4. Object Attribute Column */}
                      <td className="py-2.5 px-3.5 font-mono align-top">
                        <div className="space-y-0.5">
                          {/* Line 1: Object Name */}
                          <div className="text-xs font-semibold text-slate-800">
                            {item.objectName || 'INSTANCE'}
                          </div>
                          {/* Line 2: Attribute Name */}
                          <div className="text-[10px] text-slate-500">
                            {item.attributeName || 'value'}
                          </div>
                        </div>
                      </td>

                      {/* 5. Query Duration Column */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap align-top font-mono text-[11px]">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold border ${
                            (item.queryDurationMs ?? 0) >= 1000
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : (item.queryDurationMs ?? 0) >= 500
                              ? 'bg-sky-50 text-sky-800 border-sky-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <Clock className="w-3 h-3 text-slate-400" />
                          {item.queryDurationMs !== undefined && item.queryDurationMs !== null ? `${item.queryDurationMs}ms` : '0ms'}
                        </span>
                      </td>

                      {/* 6. Poll Status Column */}
                      <td className="py-2.5 px-3.5 align-top">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.badge}`}>
                          {statusMeta.isFail ? (
                            <XCircle className="w-3 h-3 text-red-600 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          )}
                          {displayPollStatus}
                        </span>
                      </td>

                      {/* 6. Measured Value & Poll Response */}
                      <td className="py-2.5 px-3.5 align-top space-y-1.5">
                        <div className="font-mono text-xs font-semibold text-slate-900 bg-slate-50/80 border border-slate-200/80 rounded-md px-2.5 py-1.5 break-all max-h-[120px] overflow-y-auto">
                          {item.value !== undefined && item.value !== null && item.value !== '' ? item.value : '0'}
                        </div>
                        {serverResponse && (
                          statusMeta.isFail || displayPollStatus === 'FAIL' || displayPollStatus === 'ERROR' ? (
                            <div className="text-[11px] font-mono text-red-800 bg-red-50 border border-red-200 rounded p-1.5 break-all max-h-[120px] overflow-y-auto flex items-start gap-1.5 shadow-2xs">
                              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <span className="text-[9px] font-bold text-red-700 uppercase mr-1">{t('rawMeasurements.serverError')}:</span>
                                <span className="font-medium">{serverResponse}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] font-mono text-slate-600 bg-slate-100/70 border border-slate-200 rounded p-1.5 break-all max-h-[90px] overflow-y-auto flex items-start gap-1">
                              <Terminal className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">{t('rawMeasurements.response')}:</span>
                                <span>{serverResponse}</span>
                              </div>
                            </div>
                          )
                        )}
                      </td>

                      {/* 7. Cycle */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap font-mono text-[11px] text-slate-600 align-top">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">
                          {t('rawMeasurements.cycle')} {item.cycle ?? 1}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs rounded-b-xl">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <span>{t('rawMeasurements.rowsPerPage')}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
            <span className="text-slate-400">|</span>
            <span className="font-mono text-[11px]">
              {filteredMeasurements.length === 0
                ? `0 ${t('rawMeasurements.of')} 0`
                : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredMeasurements.length)} ${t('rawMeasurements.of')} ${filteredMeasurements.length}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
              className="px-2 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer"
              title="First Page"
            >
              «
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {t('rawMeasurements.prev')}
            </button>
            <span className="px-3 py-1 bg-white border border-indigo-300 text-indigo-700 font-bold rounded text-xs">
              {t('rawMeasurements.page')} {currentPage} {t('rawMeasurements.of')} {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              {t('rawMeasurements.next')}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer"
              title="Last Page"
            >
              »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
