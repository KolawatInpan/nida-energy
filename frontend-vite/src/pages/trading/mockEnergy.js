import React, { useEffect, useRef, useState } from 'react';
import { getMeters, insertRunningLogsBulk, resetEnergyLogs } from '../../core/data_connecter/mockEnergy';
import * as mockService from '../../core/mockEnergyService';

export default function MockEnergy() {
  const [meters, setMeters] = useState([]);
  const [selectedMeters, setSelectedMeters] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T00:00`;
  });
  const [endDate, setEndDate] = useState(() => {
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${nextDay.getFullYear()}-${pad(nextDay.getMonth() + 1)}-${pad(nextDay.getDate())}T00:00`;
  });
  const [intervalHours, setIntervalHours] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState('sinusoidal');
  const [status, setStatus] = useState('');
  const [totalInserts, setTotalInserts] = useState(0);
  const [completedInserts, setCompletedInserts] = useState(0);
  const [progress, setProgress] = useState(0);
  const [startingKwh, setStartingKwh] = useState(1000);
  const [resetting, setResetting] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [backgroundRunning, setBackgroundRunning] = useState(false);
  const stopRequestedRef = useRef(false);

  const roundTo4 = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 10000) / 10000;
  };

  useEffect(() => {
    (async () => {
      try {
        const list = await getMeters();
        setMeters(list || []);
      } catch (err) {
        console.error('Failed to load meters', err);
      }
    })();
  }, []);

  const toLocalMidnight = (input) => {
    // Accept either a datetime-local string or a Date; return local YYYY-MM-DDTHH:mm at 00:00
    const d = input ? new Date(input) : new Date();
    d.setHours(0, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${y}-${m}-${day}T${hh}:${mm}`;
  };

  const toggleMeter = (snid) => {
    setSelectedMeters(prev => prev.includes(snid) ? prev.filter(s => s !== snid) : [...prev, snid]);
  };

  const toggleAll = (ids) => {
    // ids: array of meter ids to toggle on/off
    const allSelected = ids.every(id => selectedMeters.includes(id));
    if (allSelected) {
      // remove all these ids
      setSelectedMeters(prev => prev.filter(id => !ids.includes(id)));
    } else {
      // add missing ids
      setSelectedMeters(prev => {
        const set = new Set(prev);
        ids.forEach(id => set.add(id));
        return Array.from(set);
      });
    }
  };

  const isMeterType = (meter, type) => {
    const normalized = String(meter?.type || '').trim().toLowerCase();
    if (type === 'produce') return Boolean(meter?.produceMeter) || normalized.includes('produce');
    if (type === 'consume') return Boolean(meter?.consumeMeter) || normalized.includes('consume');
    if (type === 'battery') return Boolean(meter?.batMeter) || normalized.includes('battery');
    return false;
  };

  const handleGenerate = async () => {
    if (selectedMeters.length === 0) return alert('Choose at least one meter');
    if (!startDate || !endDate) return alert('Choose start and end dates');
    const s = new Date(startDate);
    const e = new Date(endDate);
    s.setHours(0,0,0,0);
    e.setHours(0,0,0,0);
    if (isNaN(s) || isNaN(e) || e <= s) return alert('Invalid date range');

    try {
      setSubmitting(true);
      setStatus('Starting background generation...');
      mockService.startGeneration({ meters: selectedMeters, start: s.toISOString(), end: e.toISOString(), intervalHours: Number(intervalHours), profile, startingKwh: Number(startingKwh) });
    } catch (err) {
      console.error('Start generation failed', err);
      setStatus('Failed to start generation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStopGenerate = () => {
    mockService.stopGeneration();
    setStatus('Stop requested');
  };

  useEffect(() => {
    const unsub = mockService.subscribe((msg) => {
      if (msg.type === 'progress') {
        setTotalInserts(msg.total || 0);
        setCompletedInserts(msg.completed || 0);
        setProgress(msg.total ? Math.round((msg.completed||0)/msg.total*100) : 0);
        setStatus('Running in background...');
      }
      if (msg.type === 'started') setStatus('Background started');
      if (msg.type === 'started') setBackgroundRunning(true);
      if (msg.type === 'stopped') { setStatus('Background stopped'); setBackgroundRunning(false); }
      if (msg.type === 'complete') { setStatus('Background complete'); setBackgroundRunning(false); }
      if (msg.type === 'error') setStatus('Background error: ' + (msg.error||''));
    });
    return () => unsub();
  }, []);

  // Excel import handler
  const handleFileUpload = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setStatus('Parsing file...');
    try {
      const logs = await mockService.importExcelFile(file);
      if (!logs || logs.length === 0) return setStatus('No valid rows found in file');
      // send in background
      setStatus(`Uploading ${logs.length} rows...`);
      await insertRunningLogsBulk(logs);
      setStatus('Upload complete');
    } catch (err) {
      console.error('Import failed', err);
      setStatus(String(err));
    }
  };

  const handleResetEnergyLogs = async () => {
    if (!window.confirm('Reset all running meter logs and energy aggregate tables?')) return;

    setResetting(true);
    setStatus('Resetting energy logs...');
    try {
      const result = await resetEnergyLogs();
      const cleared = result?.cleared || {};
      setTotalInserts(0);
      setCompletedInserts(0);
      setProgress(0);
      setStatus(`Reset complete: ${cleared.runningMeter || 0} logs, ${cleared.hourlyEnergy || 0} hourly, ${cleared.dailyEnergy || 0} daily, ${cleared.weeklyEnergy || 0} weekly, ${cleared.monthlyEnergy || 0} monthly rows cleared.`);
    } catch (err) {
      console.error('Reset failed', err);
      setStatus('Reset failed — see console');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50 rounded-2xl border border-cyan-100 shadow-lg">

      <div className="mb-6 bg-white/80 backdrop-blur rounded-xl border border-cyan-100 p-4 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">Select meters (multiple)</label>
        <div className="mt-3 overflow-x-auto">
          <div className="flex flex-nowrap gap-4 min-w-[930px]">
          {/* Produce column */}
          <div className="border border-amber-200 rounded-xl p-3 max-h-64 overflow-auto w-[300px] shrink-0 bg-amber-50/60">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-amber-700">Produce meters</div>
              <label className="text-sm flex items-center gap-2 text-amber-800">
                <input type="checkbox" onChange={() => {
                  const ids = meters.filter(m => isMeterType(m, 'produce')).map(m => m.snid || m.meterName);
                  toggleAll(ids);
                }} checked={meters.length > 0 && meters.filter(m => isMeterType(m, 'produce')).every(m => selectedMeters.includes(m.snid || m.meterName))} />
                <span>All</span>
              </label>
            </div>
            {meters.length === 0 ? <div className="text-sm text-gray-500">No meters found</div> : (
              meters.filter(m => isMeterType(m, 'produce')).map(m => {
                const id = m.snid || m.meterName;
                return (
                  <label key={id} className="flex items-center gap-2 p-1">
                    <input type="checkbox" checked={selectedMeters.includes(id)} onChange={() => toggleMeter(id)} />
                    <span className="text-sm text-slate-700">{m.meterName || m.snid} - {m.buildingName || m.building}</span>
                  </label>
                )
              })
            )}
          </div>

          {/* Consume column */}
          <div className="border border-violet-200 rounded-xl p-3 max-h-64 overflow-auto w-[300px] shrink-0 bg-violet-50/60">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-violet-700">Consume meters</div>
              <label className="text-sm flex items-center gap-2 text-violet-800">
                <input type="checkbox" onChange={() => {
                  const ids = meters.filter(m => isMeterType(m, 'consume')).map(m => m.snid || m.meterName);
                  toggleAll(ids);
                }} checked={meters.length > 0 && meters.filter(m => isMeterType(m, 'consume')).every(m => selectedMeters.includes(m.snid || m.meterName))} />
                <span>All</span>
              </label>
            </div>
            {meters.length === 0 ? <div className="text-sm text-gray-500">No meters found</div> : (
              meters.filter(m => isMeterType(m, 'consume')).map(m => {
                const id = m.snid || m.meterName;
                return (
                  <label key={id} className="flex items-center gap-2 p-1">
                    <input type="checkbox" checked={selectedMeters.includes(id)} onChange={() => toggleMeter(id)} />
                    <span className="text-sm text-slate-700">{m.meterName || m.snid} - {m.buildingName || m.building}</span>
                  </label>
                )
              })
            )}
          </div>

          {/* Battery column */}
          <div className="border border-emerald-200 rounded-xl p-3 max-h-64 overflow-auto w-[300px] shrink-0 bg-emerald-50/60">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-emerald-700">Battery meters</div>
              <label className="text-sm flex items-center gap-2 text-emerald-800">
                <input type="checkbox" onChange={() => {
                  const ids = meters.filter(m => isMeterType(m, 'battery')).map(m => m.snid || m.meterName);
                  toggleAll(ids);
                }} checked={meters.length > 0 && meters.filter(m => isMeterType(m, 'battery')).every(m => selectedMeters.includes(m.snid || m.meterName))} />
                <span>All</span>
              </label>
            </div>
            {meters.length === 0 ? <div className="text-sm text-gray-500">No meters found</div> : (
              meters.filter(m => isMeterType(m, 'battery')).map(m => {
                const id = m.snid || m.meterName;
                return (
                  <label key={id} className="flex items-center gap-2 p-1">
                    <input type="checkbox" checked={selectedMeters.includes(id)} onChange={() => toggleMeter(id)} />
                    <span className="text-sm text-slate-700">{m.meterName || m.snid} - {m.buildingName || m.building}</span>
                  </label>
                )
              })
            )}
          </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-4 bg-white/80 backdrop-blur rounded-xl border border-cyan-100 p-4 shadow-sm md:flex-row">
        <div className="w-full min-w-0 md:basis-1/2 md:flex-1">
          <label className="block text-sm font-semibold text-slate-700">Start Date</label>
          <input type="datetime-local" value={startDate} onChange={e => setStartDate(toLocalMidnight(e.target.value))} className="w-full px-3 py-2 border border-cyan-200 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
        </div>
        <div className="w-full min-w-0 md:basis-1/2 md:flex-1">
          <label className="block text-sm font-semibold text-slate-700">End Date</label>
          <input type="datetime-local" value={endDate} onChange={e => setEndDate(toLocalMidnight(e.target.value))} className="w-full px-3 py-2 border border-cyan-200 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
        </div>
      </div>

      <div className="mb-4 overflow-x-auto">
        <div className="flex min-w-[1200px] flex-nowrap gap-4">
          <div className="w-full min-w-0 flex-1 rounded-xl border border-cyan-100 bg-white/80 p-4 shadow-sm backdrop-blur">
            <label className="block text-sm font-semibold text-slate-700">Value Profile</label>
            <select value={profile} onChange={e => setProfile(e.target.value)} className="w-full px-3 py-2 border border-cyan-200 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-cyan-400 bg-white">
              <option value="random">Random</option>
              <option value="sinusoidal">Sinusoidal (daily)</option>
              <option value="peak">Peak hours</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>

          <div className="w-full min-w-0 flex-1 rounded-xl border border-cyan-100 bg-white/80 p-4 shadow-sm backdrop-blur">
            <label className="block text-sm font-semibold text-slate-700">Interval Hours</label>
            <input type="number" min={1} value={intervalHours} onChange={e => setIntervalHours(e.target.value)} className="w-full px-3 py-2 border border-cyan-200 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            <div className="text-xs text-gray-500 mt-1">Advance timestamp by this many hours between inserts.</div>
          </div>

          <div className="w-full min-w-0 flex-1 rounded-xl border border-cyan-100 bg-white/80 p-4 shadow-sm backdrop-blur">
            <label className="block text-sm font-semibold text-slate-700">Starting kWH</label>
            <input type="number" min={0} value={startingKwh} onChange={e => setStartingKwh(Number(e.target.value))} className="w-full px-3 py-2 border border-cyan-200 rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            <div className="text-xs text-gray-500 mt-1">Initial cumulative kWH reading (per meter). Default ~1000.</div>
          </div>

          <div className="w-full min-w-0 flex-1 rounded-xl border border-cyan-100 bg-white/80 p-4 shadow-sm backdrop-blur">
            <label className="block text-sm font-semibold text-slate-700">Progress</label>
            <div className="w-full bg-slate-200 rounded-full h-4 mt-2 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 h-4 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-sm mt-2 text-slate-700 font-medium">{completedInserts} / {totalInserts} ({progress}%)</div>
            <div className="text-xs text-slate-500 mt-1">{status || 'Ready to generate mock records.'}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-white/80 backdrop-blur rounded-xl border border-cyan-100 p-4 shadow-sm">
        <button onClick={handleGenerate} disabled={submitting} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-700 text-white rounded-lg shadow hover:from-cyan-500 hover:to-blue-600 transition-colors disabled:opacity-60">
          {submitting ? 'Generating...' : 'Generate'}
        </button>
        <button onClick={handleStopGenerate} disabled={!backgroundRunning} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg shadow hover:from-amber-400 hover:to-orange-500 transition-colors disabled:opacity-60">
          Stop
        </button>
        <button onClick={handleResetEnergyLogs} disabled={resetting || submitting} className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-700 text-white rounded-lg shadow hover:from-rose-500 hover:to-red-600 transition-colors disabled:opacity-60">
          {resetting ? 'Resetting...' : 'Reset Energy Logs'}
        </button>
        <button onClick={() => { setSelectedMeters([]); setStartDate(''); setEndDate(''); setStatus(''); setIntervalHours(1); setStartingKwh(1000); setTotalInserts(0); setCompletedInserts(0); setProgress(0); }} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">Reset</button>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="px-2 py-1 border rounded ml-2 text-sm" />
        <div className="ml-auto text-sm text-slate-600 hidden md:block">Tip: Use Peak profile for daytime-heavy patterns.</div>
      </div>
      
    </div>
  );
}

