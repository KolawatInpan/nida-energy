import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fmtDateTime, fmtTime } from '../../utils/dateFormat';
import {
  getSimulatorInfo,
  listMeters,
  getMeterLogs,
  getSimulatedPower,
  triggerEnergyFeedSync,
  getSyncStatus,
  getPairingData,
  saveDeviceMapping,
  saveBuildingMap,
} from '../../core/data_connecter/powerSimulator';
import OpenApiViewer from './OpenApiViewer';

// ─── Constants ───────────────────────────────────────────────────

const FEED_URL = 'http://10.10.161.239:8089';
const MOCK_URL = 'http://localhost:8089';
const REFRESH_INTERVAL = 30_000; // 30s auto-refresh
const LOG_LIMIT = 50; // fetch last 50 logs

// ─── Helpers ─────────────────────────────────────────────────────

/** Map meter "S-XXX-TYPE-NNNN" → "XXX" or "XXX-TYPE-NNNN" → "XXX" (building code) */
function buildingCode(meterId) {
  const parts = (meterId || '').split('-');
  if (parts[0] === 'S') return parts[1] || '—';   // S-XXX-TYPE-NNNN
  return parts[0] || '—';                           // XXX-TYPE-NNNN
}

/** Map meter type: PRD=Producer, CON=Consumer, BAT=Battery */
function meterTypeLabel(meterId) {
  const parts = (meterId || '').split('-');
  const t = parts[0] === 'S' ? (parts[2] || '') : (parts[1] || '');
  if (t === 'PRD') return '☀️ Producer';
  if (t === 'CON') return '🏠 Consumer';
  if (t === 'BAT') return '🔋 Battery';
  return t;
}

function typeBadge(meterId) {
  const parts = (meterId || '').split('-');
  const t = parts[0] === 'S' ? (parts[2] || '') : (parts[1] || '');
  if (t === 'PRD') return { icon: '☀️', label: 'Producer', bg: '#dcfce7', color: '#166534', border: '#bbf7d0' };
  if (t === 'CON') return { icon: '🏠', label: 'Consumer', bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' };
  if (t === 'BAT') return { icon: '🔋', label: 'Battery', bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' };
  return { icon: '❓', label: t || 'Unknown', bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
}

// ─── Status Badge ────────────────────────────────────────────────

function StatusBadge({ online }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 600,
        background: online ? '#dcfce7' : '#fee2e2',
        color: online ? '#166534' : '#991b1b',
      }}
    >
      <span
        style={{
          width: 8, height: 8, borderRadius: '50%',
          background: online ? '#22c55e' : '#ef4444',
          display: 'inline-block',
        }}
      />
      {online ? 'Connected' : 'Disconnected'}
    </span>
  );
}

// ─── Log Row ─────────────────────────────────────────────────────

function LogRow({ log }) {
  const ts = log.DataDateTime
    ? fmtDateTime(new Date(log.DataDateTime))
    : log.createAt
      ? fmtDateTime(new Date(log.createAt * 1000))
      : '—';
  const tb = typeBadge(log.Device);
  const bld = buildingCode(log.Device);
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '6px 8px', fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', whiteSpace: 'nowrap' }}>{ts}</td>
      <td style={{ padding: '6px 8px', fontSize: 11, fontFamily: 'monospace', color: '#334155' }}>{log.Device}</td>
      <td style={{ padding: '6px 8px', fontSize: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 4, fontWeight: 600, background: tb.bg, color: tb.color, border: `1px solid ${tb.border}` }}>
          {tb.icon} {tb.label}
        </span>
      </td>
      <td style={{ padding: '6px 8px', fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>{bld}</td>
      <td style={{ padding: '6px 8px', fontSize: 12, fontFamily: 'monospace', textAlign: 'right', color: '#2563eb', fontWeight: 500 }}>
        {log.kW != null ? Number(log.kW).toFixed(2) : '—'}
      </td>
      <td style={{ padding: '6px 8px', fontSize: 12, fontFamily: 'monospace', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
        {log.kWh != null ? Number(log.kWh).toFixed(2) : '—'}
      </td>
    </tr>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function ApiStatus() {
  const [online, setOnline] = useState(null);
  const [info, setInfo] = useState(null);
  const [meters, setMeters] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  // Cache last successful data — shown when feed is unreachable
  const [cachedMeters, setCachedMeters] = useState([]);
  const [cachedLogs, setCachedLogs] = useState([]);
  const [cachedAt, setCachedAt] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [syncResult, setSyncResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // { latestRunningMeter, totalRunningMeterRows, ... }
  const [importLogsFile, setImportLogsFile] = useState(null); // meterlog_all.json
  const [importMetersFile, setImportMetersFile] = useState(null); // vmeter.json
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [syncPreview, setSyncPreview] = useState(null); // { meters, logs, topKwh, lowKwh, topDevice, lowDevice }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [hiddenMeters, setHiddenMeters] = useState(() => {
    try { return JSON.parse(localStorage.getItem('apiStatusHiddenMeters') || '[]'); } catch { return []; }
  });
  const [showHidden, setShowHidden] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(() => {
    try { return JSON.parse(localStorage.getItem('apiStatusAutoRefresh') ?? 'true'); } catch { return true; }
  });

  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => {
      const next = !prev;
      localStorage.setItem('apiStatusAutoRefresh', JSON.stringify(next));
      return next;
    });
  };

  const toggleHideMeter = (meterId) => {
    setHiddenMeters(prev => {
      const next = prev.includes(meterId) ? prev.filter(id => id !== meterId) : [...prev, meterId];
      localStorage.setItem('apiStatusHiddenMeters', JSON.stringify(next));
      return next;
    });
  };

  // ─── API Tester state ────────────────────────────
  const [testerEndpoint, setTesterEndpoint] = useState('info');
  const [testerParams, setTesterParams] = useState({ type: 'producer', peak: '5', device: '', limit: '10' });
  const [testerResult, setTesterResult] = useState(null);
  const [testerLoading, setTesterLoading] = useState(false);

  // ─── Meter Pairing state ────────────────────────
  const [pairingData, setPairingData] = useState(null);
  const [deviceMapping, setDeviceMapping] = useState({});
  const [savingMap, setSavingMap] = useState(false);

  // ─── Building Pairing state ─────────────────────
  const [buildingMap, setBuildingMap] = useState({});
  const [savingBuildingMap, setSavingBuildingMap] = useState(false);
  const [selectedSystemBuilding, setSelectedSystemBuilding] = useState(null);

  const handleBuildingPair = (code, name) => {
    const updated = { ...buildingMap };
    if (name) {
      updated[code] = name;
    } else {
      delete updated[code];
    }
    setBuildingMap(updated);
  };

  const onSelectSystemBuilding = (name) => {
    setSelectedSystemBuilding(selectedSystemBuilding === name ? null : name);
    setSelectedSystemMeter(null); // clear meter selection
  };

  const onPairBuilding = async (code) => {
    if (!selectedSystemBuilding) return;
    const updated = { ...buildingMap, [code]: selectedSystemBuilding };
    setBuildingMap(updated);
    setSelectedSystemBuilding(null);
    try { await saveBuildingMap(updated); } catch (_) {}
  };

  const unpairBuilding = async (code) => {
    const updated = { ...buildingMap };
    delete updated[code];
    setBuildingMap(updated);
    try { await saveBuildingMap(updated); } catch (_) {}
  };

  const cancelSelection = () => {
    setSelectedSystemBuilding(null);
    setSelectedSystemMeter(null);
  };

  const saveBuildingMapping = async () => {
    setSavingBuildingMap(true);
    try {
      await saveBuildingMap(buildingMap);
      await loadPairing();
    } catch (e) {
      console.error('[ApiStatus] Save building map failed:', e.message);
    }
    setSavingBuildingMap(false);
  };

  // ─── Meter Pairing state ─────────────────────────
  const [selectedSystemMeter, setSelectedSystemMeter] = useState(null);

  const onSelectSystemMeter = (snid) => {
    setSelectedSystemMeter(selectedSystemMeter === snid ? null : snid);
    setSelectedSystemBuilding(null); // clear building selection
  };

  const onPairMeter = async (sourceDevice) => {
    if (!selectedSystemMeter) return;
    const updated = { ...deviceMapping, [sourceDevice]: selectedSystemMeter };
    setDeviceMapping(updated);
    setSelectedSystemMeter(null);
    try { await saveDeviceMapping(updated); } catch (_) {}
  };

  const unpairMeter = async (sourceDevice) => {
    const updated = { ...deviceMapping };
    delete updated[sourceDevice];
    setDeviceMapping(updated);
    try { await saveDeviceMapping(updated); } catch (_) {}
  };

  const saveMapping = async () => {
    setSavingMap(true);
    try {
      await saveDeviceMapping(deviceMapping);
      await loadPairing();
    } catch (e) {
      console.error('[ApiStatus] Save mapping failed:', e.message);
    }
    setSavingMap(false);
  };

  const loadPairing = async () => {
    try {
      const data = await getPairingData();
      setPairingData(data);
      setDeviceMapping(data.mapping || {});
      setBuildingMap(data.buildingMap || {});
    } catch (e) {
      console.warn('[ApiStatus] Pairing load failed:', e.message);
    }
  };

  // ─── Manual Sync ──────────────────────────────────
  // ─── Import production data to local mock-simulator ──
  const handleImportFiles = async () => {
    if (!importLogsFile || !importMetersFile) {
      setImportMsg({ ok: false, text: 'Please select both meterlog_all.json and vmeter.json' });
      return;
    }
    setImporting(true);
    setImportMsg(null);
    try {
      const readJson = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try { resolve(JSON.parse(reader.result)); } catch (e) { reject(new Error(`${file.name} is not valid JSON`)); }
        };
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        reader.readAsText(file);
      });
      const logs = await readJson(importLogsFile);
      const meters = await readJson(importMetersFile);
      if (!Array.isArray(logs) || !Array.isArray(meters)) throw new Error('Both files must be JSON arrays');

      const res = await fetch(`${MOCK_URL}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meters, logs }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || `HTTP ${res.status}`);
      setImportMsg({ ok: true, text: `Imported ${result.meters} meters + ${result.logs} logs into local mock-simulator` });
    } catch (e) {
      console.error('[ApiStatus] Import failed:', e);
      setImportMsg({ ok: false, text: `Import failed: ${e.message}` });
    } finally {
      setImporting(false);
    }
  };

  // ─── Manual Sync ──────────────────────────────────
  const manualSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await triggerEnergyFeedSync();
      setSyncResult(result);
      getSyncStatus().then(s => setSyncStatus(s)).catch(() => {});
    } catch (e) {
      setSyncResult({ success: false, error: e.message, logs: [] });
    }
    setSyncing(false);
  };

  // ─── Preview before sync ──────────────────────────
  const openSyncPreview = async () => {
    setPreviewLoading(true);
    try {
      const [meterData, logData, pairing] = await Promise.all([
        listMeters().catch(() => []),
        getMeterLogs({ limit: 50 }).catch(() => []),
        getPairingData().catch(() => null),
      ]);
      const meters = Array.isArray(meterData) ? meterData : meterData?.meters ?? [];
      const logs = Array.isArray(logData) ? logData : logData?.logs ?? [];
      const sourceMeters = pairing?.sourceMeters || [];
      const currentMapping = pairing?.mapping || {};
      
      // Find highest & lowest energy devices
      const byDevice = {};
      for (const log of logs) {
        const dev = log.Device; if (!dev) continue;
        if (!(dev in byDevice)) byDevice[dev] = { kWh: log.kWh, kW: log.kW, device: dev, type: meterTypeLabel(dev), bld: buildingCode(dev) };
      }
      const entries = Object.values(byDevice).sort((a, b) => (Number(b.kWh) || 0) - (Number(a.kWh) || 0));
      const topKwh = entries[0] || null;
      const lowKwh = entries[entries.length - 1] || null;
      
      // Pairing status: which source meters are paired/unpaired
      const pairedCount = Object.keys(currentMapping).length;
      const unpairedSource = sourceMeters.filter(m => !currentMapping[m.meter_id]);
      
      setSyncPreview({ meters, logs, topKwh, lowKwh, entryCount: entries.length, pairedCount, unpairedSource, totalSource: sourceMeters.length });
    } catch (e) {
      console.warn('[ApiStatus] Preview failed:', e.message);
    }
    setPreviewLoading(false);
  };

  // ─── API Tester ───────────────────────────────────
  const runTester = async () => {
    setTesterLoading(true);
    setTesterResult(null);
    try {
      let data;
      switch (testerEndpoint) {
        case 'info':
          data = await getSimulatorInfo();
          break;
        case 'vmeter':
          data = await listMeters();
          break;
        case 'meterlog':
          data = await getMeterLogs({
            device: testerParams.device || undefined,
            limit: Number(testerParams.limit) || 10,
          });
          break;
        case 'simulation':
          data = await getSimulatedPower(
            testerParams.type,
            Number(testerParams.peak),
            undefined,
            testerParams.type === 'battery' ? 16 : undefined,
          );
          break;
        default:
          throw new Error('Unknown endpoint');
      }
      setTesterResult({ ok: true, data });
    } catch (e) {
      setTesterResult({ ok: false, error: e.message });
    }
    setTesterLoading(false);
  };

  const refresh = useCallback(async () => {
    setError('');
    try {
      const infoData = await getSimulatorInfo();
      setInfo(infoData);
      setOnline(true);
      setError('');

      try {
        const meterData = await listMeters();
        const sorted = (Array.isArray(meterData) ? meterData : meterData?.meters ?? [])
          .sort((a, b) => (Number(b.kwh) || 0) - (Number(a.kwh) || 0)); // highest kWh first
        setMeters(sorted);
        setCachedMeters(sorted);
      } catch (e) {
        console.warn('[ApiStatus] Failed to fetch meters:', e.message);
      }

      try {
        const params = { limit: LOG_LIMIT };
        if (selectedDevice) params.device = selectedDevice;
        const logData = await getMeterLogs(params);
        let logArr = Array.isArray(logData) ? logData : logData?.logs ?? [];
        // Show the LATEST 50 logs (newest first)
        logArr = logArr
          .slice()
          .sort((a, b) => {
            const ta = a.DataDateTime ? new Date(a.DataDateTime).getTime() : (a.createAt || 0) * 1000;
            const tb = b.DataDateTime ? new Date(b.DataDateTime).getTime() : (b.createAt || 0) * 1000;
            return tb - ta;
          })
          .slice(0, LOG_LIMIT);
        setLogs(logArr);
        setCachedLogs(logArr);
        setCachedAt(new Date());
      } catch (e) {
        console.warn('[ApiStatus] Failed to fetch logs:', e.message);
      }

      loadPairing().catch(() => {});
      getSyncStatus().then(s => setSyncStatus(s)).catch(() => {});
    } catch (e) {
      setOnline(false);
      const msg = String(e.message || '');
      setError(msg.includes('NetworkError') || msg.includes('fetch') ? 'Feed unreachable (VPN required)' : msg);
      // Fallback to cached data
      if (cachedMeters.length > 0) {
        setMeters(cachedMeters);
        setLogs(cachedLogs);
      } else {
        setInfo(null);
      }
    }
    setLastRefresh(new Date());
  }, [selectedDevice]);

  useEffect(() => {
    refresh();
    loadPairing(); // auto-load building/meter pairing on mount
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  // Group logs by Device → latest kWh per meter, sorted by kWh descending
  const latestKwhByDevice = useMemo(() => {
    const map = {};
    for (const log of logs) {
      const dev = log.Device;
      if (!dev) continue;
      if (!(dev in map)) {
        map[dev] = { kWh: log.kWh, kW: log.kW, time: log.DataDateTime, building: buildingCode(dev), type: meterTypeLabel(dev) };
      }
    }
    // Sort entries by kWh descending
    return Object.fromEntries(
      Object.entries(map).sort((a, b) => (Number(b[1].kWh) || 0) - (Number(a[1].kWh) || 0))
    );
  }, [logs]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* ── Header ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0f172a' }}>🔌 API Status</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Energy Feed · {FEED_URL}
            {!online && cachedMeters.length > 0 && cachedAt && (
              <span style={{ marginLeft: 8, color: '#f59e0b', fontSize: 11 }}>
                ⚠️ Showing cached data from {fmtTime(cachedAt)}
              </span>
            )}
          </p>
          {syncStatus && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#475569' }}>
              📡 Synced to:{' '}
              <strong style={{ color: '#0f172a' }}>
                {syncStatus.latestRunningMeter
                  ? fmtDateTime(new Date(syncStatus.latestRunningMeter))
                  : syncStatus.fileCursor
                    ? `File cursor: ${syncStatus.fileCursor}`
                    : 'Not started'}
              </strong>
              <span style={{ marginLeft: 10, color: '#94a3b8', fontSize: 11 }}>
                ({syncStatus.totalRunningMeterRows?.toLocaleString() || 0} records · every {syncStatus.syncIntervalSec}s)
              </span>
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {online !== null && <StatusBadge online={online} />}
          <button
            onClick={toggleAutoRefresh}
            title={autoRefresh ? 'Auto-refresh ON — click to pause' : 'Auto-refresh OFF — click to resume'}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: autoRefresh ? '#dcfce7' : '#fee2e2',
              color: autoRefresh ? '#166534' : '#991b1b',
            }}
          >
            {autoRefresh ? '🟢 Auto' : '⏸ Paused'}
          </button>
          <button onClick={refresh} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#374151' }}>
            🔄 Refresh
          </button>
          <button
            onClick={() => window.open('/mock-energy', '_blank')}
            title="Open Mock Energy Generator"
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #06b6d4', background: '#ecfeff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#0891b2' }}
          >
            ⚡ Mock Energy
          </button>
          <button
            onClick={openSyncPreview}
            disabled={previewLoading}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #fbbf24', background: '#fffbeb',
              cursor: previewLoading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, color: '#92400e',
              opacity: previewLoading ? 0.6 : 1,
            }}
          >
            {previewLoading ? '⏳ Loading…' : '⚡ Manual Fetch'}
          </button>
          <label
            title="Import production meterlog_all.json + vmeter.json into local mock-simulator"
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #a78bfa', background: '#f5f3ff',
              cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#7c3aed',
            }}
          >
            📥 Import
            <input
              type="file"
              accept=".json"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                const logs = files.find(f => /meterlog/i.test(f.name));
                const meters = files.find(f => /vmeter/i.test(f.name));
                if (logs) setImportLogsFile(logs);
                if (meters) setImportMetersFile(meters);
              }}
              style={{ display: 'none' }}
            />
          </label>
          {(importLogsFile || importMetersFile) && (
            <button
              onClick={handleImportFiles}
              disabled={importing}
              style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid #7c3aed', background: '#7c3aed',
                cursor: importing ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, color: '#fff',
                opacity: importing ? 0.6 : 1,
              }}
            >
              {importing ? '⏳ Importing…' : `⬆️ Upload (${[importLogsFile?.name, importMetersFile?.name].filter(Boolean).length} files)`}
            </button>
          )}
        </div>
      </div>

      {/* ── Import Result ──────────────────────────── */}
      {importMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: importMsg.ok ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${importMsg.ok ? '#bbf7d0' : '#fecaca'}`,
          color: importMsg.ok ? '#166534' : '#991b1b',
        }}>
          {importMsg.ok ? '✅ ' : '❌ '}{importMsg.text}
        </div>
      )}

      {/* ── Error Banner ───────────────────────────── */}
      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error}
          <div style={{ marginTop: 4, fontSize: 11, color: '#b91c1c' }}>
            The energy feed is only available on production (via compute3 VPN).
          </div>
        </div>
      )}

      {/* ── Sync Result ───────────────────────────── */}
      {syncResult && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: syncResult.success ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${syncResult.success ? '#bbf7d0' : '#fecaca'}`,
          color: syncResult.success ? '#166534' : '#991b1b',
        }}>
          <strong>{syncResult.success ? '✅ Sync Complete' : '❌ Sync Failed'}</strong>
          {syncResult.elapsedMs != null && <span style={{ marginLeft: 8, color: '#64748b', fontSize: 11 }}>({syncResult.elapsedMs}ms)</span>}
          {syncResult.error && <div style={{ marginTop: 4 }}>{syncResult.error}</div>}
          {syncResult.logs && syncResult.logs.length > 0 && (
            <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', background: '#1e293b', borderRadius: 6, padding: 8 }}>
              {syncResult.logs.map((l, i) => (
                <div key={i} style={{
                  fontFamily: 'monospace', fontSize: 10, padding: '1px 0',
                  color: l.level === 'error' ? '#fca5a5' : l.level === 'warn' ? '#fde68a' : '#a7f3d0',
                }}>
                  [{l.time}ms] {l.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── OpenAPI Documentation ──────────────────── */}
      <OpenApiViewer />

      {/* ── Building Pairing ──────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
            🏗️ Building Pairing — Click left then right to pair
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {selectedSystemBuilding && (
              <button onClick={cancelSelection}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', fontSize: 11, color: '#991b1b' }}>
                ✕ Cancel
              </button>
            )}
            <button onClick={loadPairing}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 11, color: '#374151' }}>
              🔄 Load
            </button>
            <button onClick={saveBuildingMapping} disabled={savingBuildingMap}
              style={{ padding: '5px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: savingBuildingMap ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, opacity: savingBuildingMap ? 0.6 : 1 }}>
              {savingBuildingMap ? '💾 Saving…' : '💾 Save'}
            </button>
          </div>
        </div>

        {selectedSystemBuilding && (
          <div style={{ padding: '6px 12px', marginBottom: 10, borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1e40af' }}>
            👆 Selected: <strong>{selectedSystemBuilding}</strong> — now click a building code on the right to pair
          </div>
        )}

        {!pairingData ? (
          <p style={{ fontSize: 12, color: '#94a3b8' }}>Click "Load" to fetch data.</p>
        ) : (!pairingData.buildings || pairingData.buildings.length === 0) ? (
          <p style={{ fontSize: 12, color: '#f59e0b' }}>⚠️ No buildings found in system DB.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Left: System buildings */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>🏢 System Buildings</h4>
              {(pairingData.buildings || []).map(b => {
                const pairedCode = Object.entries(buildingMap).find(([, name]) => name === b);
                const isSelected = selectedSystemBuilding === b;
                return (
                  <div key={b} onClick={() => onSelectSystemBuilding(b)} style={{
                    padding: '6px 10px', fontSize: 12, borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                    background: isSelected ? '#2563eb' : pairedCode ? '#f0fdf4' : undefined,
                    color: isSelected ? '#fff' : '#0f172a',
                    borderRadius: isSelected ? 4 : 0,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>{b}</span>
                    {pairedCode && <span style={{ fontSize: 10, color: isSelected ? '#bfdbfe' : '#16a34a' }}>← {pairedCode[0]}</span>}
                  </div>
                );
              })}
            </div>
            {/* Right: Source codes */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>📡 Source Codes</h4>
              {(() => {
                const codes = new Set();
                for (const m of pairingData.sourceMeters || []) {
                  const parts = (m.meter_id || '').split('-');
                  const code = parts[0] === 'S' ? parts[1] : parts[0];
                  if (code) codes.add(code);
                }
                if (codes.size === 0) return <p style={{ fontSize: 11, color: '#94a3b8' }}>No source meters — source API may be unreachable.</p>;
                return [...codes].sort().map(code => {
                  const pairedName = buildingMap[code];
                  return (
                    <div key={code} onClick={() => pairedName ? unpairBuilding(code) : onPairBuilding(code)} style={{
                      padding: '6px 10px', fontSize: 12, borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                      background: pairedName ? '#f0fdf4' : '#fffbf0',
                      borderRadius: 4, marginBottom: 2,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }} title={pairedName ? 'Click to unpair' : (selectedSystemBuilding ? 'Click to pair' : 'Select a building first')}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{code}</span>
                      {pairedName ? (
                        <span style={{ fontSize: 11, color: '#16a34a' }}>→ {pairedName} ✕</span>
                      ) : selectedSystemBuilding ? (
                        <span style={{ fontSize: 10, color: '#2563eb' }}>← click to pair</span>
                      ) : (
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>select left</span>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ── Meter Pairing ─────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
            🔗 Meter Pairing — Click left then right to pair
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {selectedSystemMeter && (
              <button onClick={cancelSelection}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', fontSize: 11, color: '#991b1b' }}>
                ✕ Cancel
              </button>
            )}
            <button onClick={loadPairing}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 11, color: '#374151' }}>
              🔄 Load
            </button>
            <button onClick={saveMapping} disabled={savingMap}
              style={{ padding: '5px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: savingMap ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, opacity: savingMap ? 0.6 : 1 }}>
              {savingMap ? '💾 Saving…' : '💾 Save'}
            </button>
          </div>
        </div>

        {selectedSystemMeter && (
          <div style={{ padding: '6px 12px', marginBottom: 10, borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1e40af' }}>
            👆 Selected: <strong>{selectedSystemMeter}</strong> — now click a source meter on the right to pair
          </div>
        )}

        {!pairingData ? (
          <p style={{ fontSize: 12, color: '#94a3b8' }}>Click "Load" to fetch data.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* ── Left: System Meters (by building) ── */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>
                🏢 System Meters
              </h4>
              {(() => {
                const byBuilding = {};
                for (const m of pairingData.systemMeters || []) {
                  const b = m.buildingName || 'Unknown';
                  if (!byBuilding[b]) byBuilding[b] = [];
                  byBuilding[b].push(m);
                }
                return Object.entries(byBuilding).map(([bld, meters]) => (
                  <div key={bld} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, padding: '2px 8px', background: '#f1f5f9', borderRadius: 4 }}>
                      {bld} ({meters.length})
                    </div>
                    {meters.map(m => {
                      const paired = Object.entries(deviceMapping).find(([, snid]) => snid === m.snid);
                      const isSelected = selectedSystemMeter === m.snid;
                      return (
                        <div key={m.snid} onClick={() => onSelectSystemMeter(m.snid)} style={{
                          padding: '6px 10px', fontSize: 11, fontFamily: 'monospace',
                          borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: isSelected ? '#2563eb' : paired ? '#f0fdf4' : undefined,
                          color: isSelected ? '#fff' : '#0f172a',
                          borderRadius: 4,
                        }}>
                          <span>
                            <span>{m.snid}</span>
                            {(() => {
                              const t = (m.type || '').toLowerCase();
                              const cols = t.includes('produc') ? { icon: '☀️', bg: '#dcfce7', color: '#166534' }
                                : t.includes('consum') ? { icon: '🏠', bg: '#dbeafe', color: '#1e40af' }
                                : t.includes('batt') ? { icon: '🔋', bg: '#f3e8ff', color: '#6b21a8' }
                                : { icon: '', bg: '#f1f5f9', color: '#64748b' };
                              return (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 4, padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 600, background: cols.bg, color: cols.color }}>
                                  {cols.icon} {m.type}
                                </span>
                              );
                            })()}
                          </span>
                          {paired && <span style={{ fontSize: 10, color: isSelected ? '#bfdbfe' : '#16a34a' }}>← {paired[0]}</span>}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>

            {/* ── Right: Source Meters (by building code) ── */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>
                📡 Source Meters
              </h4>
              {(() => {
                const byCode = {};
                for (const m of pairingData.sourceMeters || []) {
                  const parts = (m.meter_id || '').split('-');
                  const code = parts[0] === 'S' ? parts[1] : parts[0] || '?';
                  if (!byCode[code]) byCode[code] = [];
                  byCode[code].push(m);
                }
                if (Object.keys(byCode).length === 0) return <p style={{ fontSize: 11, color: '#94a3b8' }}>No source meters — source API may be unreachable.</p>;
                const bm = pairingData.buildingMap || {};
                const sortedCodes = Object.keys(byCode).sort((a, b) => (bm[a] || a).localeCompare(bm[b] || b));
                return sortedCodes.map(code => (
                  <div key={code} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, padding: '2px 8px', background: '#fef3c7', borderRadius: 4 }}>
                      🏷️ {bm[code] ? `${code} → ${bm[code]}` : code} ({byCode[code].length})
                    </div>
                    {byCode[code].map(m => {
                      const pairedSnid = deviceMapping[m.meter_id];
                      return (
                        <div key={m.meter_id} onClick={() => pairedSnid ? unpairMeter(m.meter_id) : onPairMeter(m.meter_id)} style={{
                          padding: '6px 10px', fontSize: 11, borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                          background: pairedSnid ? '#f0fdf4' : '#fffbf0',
                          borderRadius: 4, marginBottom: 2,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }} title={pairedSnid ? 'Click to unpair' : (selectedSystemMeter ? 'Click to pair' : 'Select a meter first')}>
                          <span style={{ fontFamily: 'monospace' }}>{m.meter_id}
                            {(() => { const tb = typeBadge(m.meter_id); return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 4, padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 600, background: tb.bg, color: tb.color, border: `1px solid ${tb.border}` }}>
                                {tb.icon} {tb.label}
                              </span>
                            );})()}
                            <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 10 }}>{m.kwh != null ? Number(m.kwh).toLocaleString('en-US', {maximumFractionDigits: 0}) + ' kWh' : ''}</span>
                          </span>
                          {pairedSnid ? (
                            <span style={{ fontSize: 10, color: '#16a34a' }}>→ {pairedSnid} ✕</span>
                          ) : selectedSystemMeter ? (
                            <span style={{ fontSize: 10, color: '#2563eb' }}>← click to pair</span>
                          ) : (
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>select left</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ── SNID Mismatch Check ───────────────────── */}
      {(() => {
        if (!pairingData) return null;
        const sourceIds = new Set((pairingData.sourceMeters || []).map(m => m.meter_id));
        const systemSnids = new Set((pairingData.systemMeters || []).map(m => m.snid));
        const mappedSourceIds = new Set(Object.keys(deviceMapping));
        const mappedSystemSnids = new Set(Object.values(deviceMapping));

        // Source meters not paired to any system meter
        const unpairedSource = [...sourceIds].filter(id => !mappedSourceIds.has(id) && !systemSnids.has(id));
        // System meters not paired to any source meter
        const unpairedSystem = (pairingData.systemMeters || []).filter(m => !mappedSystemSnids.has(m.snid));
        // System meters where SNID doesn't directly match any source meter
        const sourceButNoSystem = [...sourceIds].filter(id => !systemSnids.has(id) && !mappedSourceIds.has(id));
        // Total mismatches
        const totalMismatch = unpairedSource.length + sourceButNoSystem.length;

        if (totalMismatch === 0 && unpairedSystem.length === 0) return null;

        return (
          <div style={{ background: '#fffbf0', borderRadius: 10, border: '1px solid #fde68a', padding: '16px 20px', marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: '#92400e' }}>
              ⚠️ SNID Mismatches ({totalMismatch + unpairedSystem.length})
            </h3>

            {sourceButNoSystem.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: '#b45309', margin: '0 0 4px' }}>
                  🔴 Source meters not in system ({sourceButNoSystem.length})
                </h4>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {sourceButNoSystem.sort().map(id => (
                    <span key={id} style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace',
                      background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca',
                    }}>
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {unpairedSource.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: '#b45309', margin: '0 0 4px' }}>
                  🟡 Unpaired source meters ({unpairedSource.length})
                </h4>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {unpairedSource.sort().map(id => (
                    <span key={id} style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace',
                      background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a',
                    }}>
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {unpairedSystem.length > 0 && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: '#b45309', margin: '0 0 4px' }}>
                  🟠 System meters not paired ({unpairedSystem.length})
                </h4>
                {unpairedSystem.sort((a,b) => (a.buildingName||'').localeCompare(b.buildingName||'')).map(m => (
                  <div key={m.snid} style={{ display: 'inline-flex', gap: 6, margin: '2px 6px 2px 0', alignItems: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace',
                      background: '#ffedd5', color: '#9a3412', border: '1px solid #fed7aa',
                    }}>
                      {m.snid}
                    </span>
                    <span style={{ fontSize: 10, color: '#78716c' }}>{m.buildingName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── kWh by Meter (Summary) ─────────────────── */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
          📊 kWh by Meter SNID ({Object.keys(latestKwhByDevice).length} meters)
        </h3>
        {Object.keys(latestKwhByDevice).length === 0 ? (
          <p style={{ fontSize: 13, color: '#94a3b8' }}>No log data yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Device (SNID)</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Building</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>kW (latest)</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>kWh (latest)</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(latestKwhByDevice).map(([dev, d]) => (
                <tr key={dev} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selectedDevice === dev ? '#eff6ff' : undefined }}
                  onClick={() => setSelectedDevice(selectedDevice === dev ? '' : dev)}>
                  <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: '#0f172a', fontWeight: 500 }}>{dev}</td>
                  <td style={{ padding: '8px 12px', fontSize: 10 }}>
                    {(() => { const tb = typeBadge(dev); return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: tb.bg, color: tb.color, border: `1px solid ${tb.border}` }}>
                        {tb.icon} {tb.label}
                      </span>
                    );})()}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: '#64748b' }}>{d.building}</td>
                  <td style={{ padding: '8px 12px', fontSize: 13, fontFamily: 'monospace', textAlign: 'right', color: '#2563eb', fontWeight: 500 }}>
                    {d.kW != null ? Number(d.kW).toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 14, fontFamily: 'monospace', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>
                    {d.kWh != null ? Number(d.kWh).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {d.time ? new Date(d.time).toLocaleString('en-GB') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {selectedDevice && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
            🔍 Filtering logs for <strong>{selectedDevice}</strong>. Click row again to clear filter.
          </div>
        )}
      </div>

      {/* ── Source Meters ─────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
            🔌 Energy Feed Meters ({meters.filter(m => showHidden || !hiddenMeters.includes(m.meter_id ?? m.id)).length}/{meters.length})
          </h3>
          {hiddenMeters.length > 0 && (
            <button onClick={() => setShowHidden(!showHidden)}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: showHidden ? '#f0fdf4' : '#fff', cursor: 'pointer', fontSize: 11, color: '#374151' }}>
              {showHidden ? '🙈 Hide Hidden' : `👁️ Show Hidden (${hiddenMeters.length})`}
            </button>
          )}
        </div>
        {meters.length === 0 ? (
          <p style={{ fontSize: 13, color: '#94a3b8' }}>No meter data available.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Meter ID</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Type</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>kWh</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {meters.filter(m => showHidden || !hiddenMeters.includes(m.meter_id ?? m.id)).map((m) => {
                const mid = m.meter_id ?? m.id;
                const isHidden = hiddenMeters.includes(mid);
                return (
                <tr key={mid} style={{ borderBottom: '1px solid #f1f5f9', opacity: isHidden ? 0.4 : 1 }}>
                  <td style={{ padding: '6px 12px', fontSize: 12, fontFamily: 'monospace', color: '#0f172a' }}>{mid}</td>
                  <td style={{ padding: '6px 12px', fontSize: 12, color: '#334155' }}>{m.name ?? '—'}</td>
                  <td style={{ padding: '6px 12px', fontSize: 12 }}>
                    {(() => { const tb = typeBadge(mid); return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: tb.bg, color: tb.color, border: `1px solid ${tb.border}` }}>
                        {tb.icon} {tb.label}
                      </span>
                    );})()}
                  </td>
                  <td style={{ padding: '6px 12px', fontSize: 13, fontFamily: 'monospace', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                    {m.kwh != null ? Number(m.kwh).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <button onClick={() => toggleHideMeter(mid)}
                      title={isHidden ? 'Show meter' : 'Hide meter'}
                      style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: isHidden ? '#fef2f2' : '#f1f5f9', cursor: 'pointer', fontSize: 14 }}>
                      {isHidden ? '🙈' : '👁️'}
                    </button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Log Table ──────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '16px 20px' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
          📋 Logs ({logs.length}{selectedDevice ? ` · ${selectedDevice}` : ''})
        </h3>
        {logs.length === 0 ? (
          <p style={{ fontSize: 13, color: '#94a3b8' }}>No log data yet.</p>
        ) : (
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Time</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Device</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Bld</th>
                  <th style={{ textAlign: 'right', padding: '8px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>kW</th>
                  <th style={{ textAlign: 'right', padding: '8px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>kWh</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <LogRow key={log._id ?? i} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── API Tester ────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '16px 20px', marginTop: 16 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
          🧪 API Tester — Test source endpoints
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {['info','vmeter','meterlog','simulation'].map(ep => (
            <button key={ep} onClick={() => { setTesterEndpoint(ep); setTesterResult(null); }}
              style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: testerEndpoint === ep ? '#2563eb' : '#f1f5f9',
                color: testerEndpoint === ep ? '#fff' : '#475569',
                border: 'none',
              }}>
              {ep === 'info' ? 'GET /info' : ep === 'vmeter' ? 'GET /vmeter' : ep === 'meterlog' ? 'GET /meterlog' : 'GET /simulation/power'}
            </button>
          ))}
        </div>

        {/* Params */}
        {testerEndpoint === 'simulation' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={testerParams.type} onChange={e => setTesterParams({...testerParams, type: e.target.value})}
              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }}>
              <option value="producer">producer</option>
              <option value="consumer">consumer</option>
              <option value="battery">battery</option>
            </select>
            <input type="number" placeholder="peak (kW)" value={testerParams.peak}
              onChange={e => setTesterParams({...testerParams, peak: e.target.value})}
              style={{ width: 80, padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }} />
          </div>
        )}
        {testerEndpoint === 'meterlog' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" placeholder="device (optional)" value={testerParams.device}
              onChange={e => setTesterParams({...testerParams, device: e.target.value})}
              style={{ width: 160, padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }} />
            <input type="number" placeholder="limit" value={testerParams.limit}
              onChange={e => setTesterParams({...testerParams, limit: e.target.value})}
              style={{ width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12 }} />
          </div>
        )}

        <button onClick={runTester} disabled={testerLoading}
          style={{
            padding: '6px 16px', borderRadius: 6, border: 'none', cursor: testerLoading ? 'not-allowed' : 'pointer',
            background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, opacity: testerLoading ? 0.6 : 1,
          }}>
          {testerLoading ? '⏳ Sending…' : '▶ Send'}
        </button>

        {testerResult && (
          <div style={{ marginTop: 10, maxHeight: 300, overflowY: 'auto', background: '#1e293b', borderRadius: 6, padding: 10 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>
              {testerResult.ok ? '✅ 200 OK' : `❌ ${testerResult.error}`}
            </div>
            {testerResult.ok && (
              <pre style={{ fontFamily: 'monospace', fontSize: 10, color: '#a7f3d0', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(testerResult.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────── */}
      <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 12 }}>
        {autoRefresh
          ? `Auto-refresh every ${REFRESH_INTERVAL / 1000}s`
          : '⏸ Auto-refresh paused'}
        {lastRefresh && ` · Last: ${fmtTime(lastRefresh)}`}
      </p>

      {/* ── Sync Preview Modal ─────────────────────── */}
      {syncPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setSyncPreview(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 500, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>⚡ Confirm Sync</h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
              Review energy data before syncing to local database.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 12, border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>🟢 Highest Energy</div>
                {syncPreview.topKwh ? (
                  <>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{syncPreview.topKwh.device}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{syncPreview.topKwh.type} · {syncPreview.topKwh.bld}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', marginTop: 6 }}>{Number(syncPreview.topKwh.kWh).toFixed(2)} kWh</div>
                  </>
                ) : <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>No data</div>}
              </div>
              <div style={{ background: '#fef2f2', borderRadius: 8, padding: 12, border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600, textTransform: 'uppercase' }}>🔴 Lowest Energy</div>
                {syncPreview.lowKwh ? (
                  <>
                    <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{syncPreview.lowKwh.device}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{syncPreview.lowKwh.type} · {syncPreview.lowKwh.bld}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', marginTop: 6 }}>{Number(syncPreview.lowKwh.kWh).toFixed(2)} kWh</div>
                  </>
                ) : <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>No data</div>}
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 12, color: '#64748b' }}>
              📡 <strong>{syncPreview.meters.length}</strong> meters · <strong>{syncPreview.entryCount}</strong> devices with energy · <strong>{syncPreview.logs.length}</strong> logs
              <br />
              🔗 <strong>{syncPreview.pairedCount}/{syncPreview.totalSource}</strong> source meters paired
              {syncPreview.unpairedSource?.length > 0 && (
                <span style={{ color: '#dc2626', fontWeight: 600 }}> — {syncPreview.unpairedSource.length} unpaired!</span>
              )}
            </div>

            {syncPreview.unpairedSource?.length > 0 && (
              <div style={{ background: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 16, border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>⚠️ Unpaired Source Meters</div>
                <div style={{ fontSize: 11, color: '#991b1b', marginBottom: 8 }}>
                  These meters will NOT be synced. Pair them first in the Meter Pairing section below.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {syncPreview.unpairedSource.slice(0, 10).map(m => (
                    <span key={m.meter_id} style={{ padding: '2px 8px', borderRadius: 4, background: '#fee2e2', fontSize: 10, fontFamily: 'monospace', color: '#991b1b' }}>
                      {m.meter_id}
                    </span>
                  ))}
                  {syncPreview.unpairedSource.length > 10 && (
                    <span style={{ fontSize: 10, color: '#991b1b' }}>+{syncPreview.unpairedSource.length - 10} more</span>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setSyncPreview(null)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Cancel
              </button>
              <button onClick={async () => {
                setSyncPreview(null);
                await manualSync();
              }}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: '#fbbf24', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, color: '#92400e',
                }}>
                ⚡ Confirm & Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
