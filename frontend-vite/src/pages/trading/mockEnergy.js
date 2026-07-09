import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Button, Select, InputNumber, Progress, message, Space, Modal } from 'antd';
import dayjs from 'dayjs';
import {
  PlayCircleOutlined, StopOutlined, DeleteOutlined, ExperimentOutlined, SyncOutlined
} from '@ant-design/icons';
import { getMeters, resetEnergyLogs } from '../../core/data_connecter/mockEnergy';
import * as mockService from '../../core/mockEnergyService';

function getRoundedNow() {
  return dayjs().startOf('hour');
}

export default function MockEnergy() {
  const [meters, setMeters] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [startDate, setStartDate] = useState(() => dayjs().startOf('day').format('YYYY-MM-DDTHH:mm'));
  const [endDate, setEndDate] = useState(() => getRoundedNow().format('DD MMM YYYY HH:mm'));
  const [intervalHours, setIntervalHours] = useState(1);
  const [profile, setProfile] = useState('sinusoidal');
  const [startingKwh, setStartingKwh] = useState(0);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [totalInserts, setTotalInserts] = useState(0);
  const [completedInserts, setCompletedInserts] = useState(0);
  const [backgroundRunning, setBackgroundRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [loadingMeters, setLoadingMeters] = useState(true);

  // Load meters
  useEffect(() => {
    (async () => {
      setLoadingMeters(true);
      try {
        const list = await getMeters();
        setMeters(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load meters', err);
        message.error('Failed to load meters');
      } finally {
        setLoadingMeters(false);
      }
    })();
  }, []);

  // Auto-update end date every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setEndDate(getRoundedNow().format('DD MMM YYYY HH:mm'));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = mockService.subscribe((msg) => {
      if (msg.type === 'progress') {
        setTotalInserts(msg.total || 0);
        setCompletedInserts(msg.completed || 0);
        setProgress(msg.total ? Math.round((msg.completed || 0) / msg.total * 100) : 0);
      }
      if (msg.type === 'started') { setStatus('Generating...'); setBackgroundRunning(true); }
      if (msg.type === 'stopped') { setStatus('Stopped'); setBackgroundRunning(false); }
      if (msg.type === 'complete') { setStatus('Complete!'); setBackgroundRunning(false); message.success('Generation complete'); }
      if (msg.type === 'error') { setStatus('Error'); setBackgroundRunning(false); message.error(msg.error || 'Generation failed'); }
    });
    return () => unsub();
  }, []);

  const handleGenerate = () => {
    if (selectedRowKeys.length === 0) return message.warning('Select at least one meter');
    if (!startDate) return message.warning('Select a start date');
    const start = dayjs(startDate);
    const end = dayjs().startOf('hour');
    if (!start.isValid() || end.valueOf() <= start.valueOf()) return message.warning('End time must be after start time');

    setSubmitting(true);
    try {
      mockService.startGeneration({
        meters: selectedRowKeys,
        start: start.toISOString(),
        end: end.toISOString(),
        intervalHours: Number(intervalHours),
        profile,
        startingKwh: Number(startingKwh),
        meterTypes: meterMetaMap,
      });
      message.info('Background generation started');
    } catch (err) {
      message.error('Failed to start generation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStop = () => {
    mockService.stopGeneration();
    setBackgroundRunning(false);
    setStatus('Stopped');
    setProgress(0);
    setTotalInserts(0);
    setCompletedInserts(0);
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const result = await resetEnergyLogs();
      const cleared = result?.cleared || result || {};
      const rm = cleared.runningMeter || 0;
      const hr = cleared.hourlyEnergy || 0;
      const dy = cleared.dailyEnergy || 0;
      setTotalInserts(0); setCompletedInserts(0); setProgress(0);
      setStatus('');
      message.success(`Cleared: ${rm} running logs, ${hr} hourly, ${dy} daily`);
    } catch (err) {
      console.error('Reset failed', err);
      message.error('Reset failed: ' + (err?.response?.data?.error || err?.message || 'Unknown error'));
    } finally {
      setResetting(false);
    }
  };

  const classifyType = (t) => {
    const lower = String(t || '').toLowerCase();
    if (lower.includes('produce') || lower.includes('producer')) return 'produce';
    if (lower.includes('consume') || lower.includes('consumer')) return 'consume';
    if (lower.includes('battery') || lower.includes('bat') || lower.includes('ess')) return 'battery';
    return 'other';
  };

  // Build meter metadata map for type-aware profiles (memoized)
  const meterMetaMap = useMemo(() => {
    const map = {};
    meters.forEach(m => {
      map[m.snid] = {
        type: m.type,
        capacity: Number(m.capacity || 0),
        buildingName: m.buildingName || '',
        startingKwh: Number(m.kWH || m.value || 0),
      };
    });
    return map;
  }, [meters]);

  const produceMeters = meters.filter(m => classifyType(m.type) === 'produce');
  const consumeMeters = meters.filter(m => classifyType(m.type) === 'consume');
  const batteryMeters = meters.filter(m => classifyType(m.type) === 'battery');

  return (
    <div className="p-5 md:p-8 min-h-screen" style={{ background: 'linear-gradient(180deg, #f0f9ff 0%, #f8fafc 100%)' }}>
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <ExperimentOutlined className="text-cyan-500" /> Mock Energy Generator
            </h1>
            <p className="text-sm text-slate-500 mt-1">Generate synthetic energy data for testing dashboard & market features</p>
          </div>
          <Space wrap>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleGenerate} loading={submitting} disabled={backgroundRunning} size="large">
              Generate
            </Button>
            <Button icon={<StopOutlined />} onClick={handleStop} disabled={!backgroundRunning} danger size="large">
              Stop
            </Button>
            <Button icon={<DeleteOutlined />} loading={resetting} disabled={backgroundRunning} size="large"
              onClick={() => Modal.confirm({
                title: 'Delete all generated energy data?',
                content: 'This will clear all running meter logs and aggregated energy data.',
                okText: 'Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                onOk: handleReset,
              })}>
              Reset Data
            </Button>
          </Space>
        </div>

        {/* Settings */}
        <Card className="!rounded-xl shadow-sm border-slate-200" title={<span className="font-semibold text-slate-700">⚙️ Generation Settings</span>}>
          <div className="flex gap-3">
            <div className="flex-1 min-w-[190px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Date &amp; Time</label>
              <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">End Time (auto)</label>
              <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-slate-700 font-mono">
                {endDate}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Rounded to :00, auto-updates</p>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Value Profile</label>
              <Select value={profile} onChange={setProfile} className="w-full" size="large"
                getPopupContainer={trigger => trigger.parentNode}
                options={[
                  { value: 'sinusoidal', label: '🌊 Sinusoidal (daily cycle)' },
                  { value: 'peak', label: '📈 Peak Hours' },
                  { value: 'random', label: '🎲 Random' },
                  { value: 'fixed', label: '📏 Fixed' },
                ]}
              />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Interval (h)</label>
              <InputNumber min={1} max={24} value={intervalHours} onChange={setIntervalHours} className="w-full" size="large" addonAfter="hrs" />
            </div>
            <div className="flex-1 min-w-[110px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Starting kWh</label>
              <InputNumber min={0} value={startingKwh} onChange={setStartingKwh} className="w-full" size="large" addonAfter="kWh" />
            </div>
          </div>

          {status && !backgroundRunning && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-slate-600">{status}</p>
            </div>
          )}
        </Card>

        {/* Progress (standalone — always visible during generation) */}
        {backgroundRunning && (
          <div className="bg-blue-50 rounded-xl border border-blue-300 shadow-sm px-4 py-2 flex items-center gap-3" style={{height: 40}}>
            <SyncOutlined spin className="text-blue-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-blue-700 flex-shrink-0">{status}</span>
            <div className="flex-1 min-w-0">
              <Progress percent={progress} strokeColor="#2563eb" size="small" showInfo={false} />
            </div>
            <span className="text-[11px] text-blue-500 font-mono flex-shrink-0 tabular-nums">{completedInserts}/{totalInserts}</span>
            <button onClick={handleStop} className="flex-shrink-0 px-2.5 py-0.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-md flex items-center gap-1" style={{height: 26, lineHeight: '26px'}}>
              <StopOutlined /> Stop
            </button>
          </div>
        )}

        {/* Meter Selection */}
        <Card
          className="!rounded-xl shadow-sm border-slate-200"
          title={<span className="font-semibold text-slate-700">🔌 Select Meters</span>}
          extra={
            <Space size="small">
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">{selectedRowKeys.length} of {meters.length}</span>
              <Button size="small" onClick={() => setSelectedRowKeys(meters.map(m => m.snid).filter(Boolean))}>All</Button>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>Clear</Button>
            </Space>
          }
        >
          {meters.length === 0 && !loadingMeters ? (
            <div className="text-center py-12 text-slate-400">
              <ExperimentOutlined style={{fontSize: 36, marginBottom: 8}} />
              <p className="font-medium">No meters registered</p>
              <p className="text-sm mt-1">Add meters via Admin → Meters first</p>
            </div>
          ) : (
            <div style={{display: 'flex', gap: 14}}>
              {/* Producer */}
              <div style={{flex: 1, minWidth: 0}}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Producer</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{produceMeters.length}</span>
                </div>
                <div className="space-y-1.5">
                  {produceMeters.map(m => {
                    const snid = m.snid || '';
                    const sel = selectedRowKeys.includes(snid);
                    return (
                      <div key={snid} onClick={() => setSelectedRowKeys(p => sel ? p.filter(k => k !== snid) : [...p, snid])}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all text-left ${
                          sel ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-200' : 'border-slate-150 bg-white hover:border-orange-200'
                        }`}>
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-mono font-semibold text-orange-600 truncate">{snid}</div>
                            <div className="text-xs text-slate-600 truncate mt-0.5">{m.buildingName || '-'}</div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            {sel && <span className="text-orange-500 text-xs">✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {produceMeters.length === 0 && <div className="text-center py-4 text-slate-200 text-xs">—</div>}
                </div>
              </div>

              {/* Consumer */}
              <div style={{flex: 1, minWidth: 0}}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Consumer</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{consumeMeters.length}</span>
                </div>
                <div className="space-y-1.5">
                  {consumeMeters.map(m => {
                    const snid = m.snid || '';
                    const sel = selectedRowKeys.includes(snid);
                    return (
                      <div key={snid} onClick={() => setSelectedRowKeys(p => sel ? p.filter(k => k !== snid) : [...p, snid])}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all text-left ${
                          sel ? 'border-purple-400 bg-purple-50 ring-1 ring-purple-200' : 'border-slate-150 bg-white hover:border-purple-200'
                        }`}>
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-mono font-semibold text-purple-600 truncate">{snid}</div>
                            <div className="text-xs text-slate-600 truncate mt-0.5">{m.buildingName || '-'}</div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            {sel && <span className="text-purple-500 text-xs">✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {consumeMeters.length === 0 && <div className="text-center py-4 text-slate-200 text-xs">—</div>}
                </div>
              </div>

              {/* Battery */}
              <div style={{flex: 1, minWidth: 0}}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Battery</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{batteryMeters.length}</span>
                </div>
                <div className="space-y-1.5">
                  {batteryMeters.map(m => {
                    const snid = m.snid || '';
                    const sel = selectedRowKeys.includes(snid);
                    const cap = Number(m.capacity) || 0;
                    const val = Number(m.value) || 0;
                    const pct = cap > 0 ? Math.min(100, Math.round(val / cap * 100)) : 0;
                    return (
                      <div key={snid} onClick={() => setSelectedRowKeys(p => sel ? p.filter(k => k !== snid) : [...p, snid])}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all text-left ${
                          sel ? 'border-green-400 bg-green-50 ring-1 ring-green-200' : 'border-slate-150 bg-white hover:border-green-200'
                        }`}>
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-mono font-semibold text-green-600 truncate">{snid}</div>
                            <div className="text-xs text-slate-600 truncate mt-0.5">{m.buildingName || '-'}</div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            {sel && <span className="text-green-500 text-xs">✓</span>}
                          </div>
                        </div>
                        <div className="mt-1.5">
                          <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                            <span>{pct}%</span><span>{val.toFixed(0)}/{cap.toFixed(0)} kWh</span>
                          </div>
                          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-400 rounded-full" style={{width: `${pct}%`}} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {batteryMeters.length === 0 && <div className="text-center py-4 text-slate-200 text-xs">—</div>}
                </div>
              </div>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
