import { insertRunningLogsBulk } from './data_connecter/mockEnergy';

let _worker = null;
let _subscribers = new Set();

function notify(payload) {
  _subscribers.forEach((s) => {
    try { s(payload); } catch (e) { console.error('mockEnergy subscriber error', e); }
  });
}

function createGenerator(profileName) {
  if (profileName === 'fixed') return () => ({ kW: 1.0, kWH: 1.0 });
  if (profileName === 'sinusoidal') {
    return (ts) => {
      const hour = ts.getHours();
      const min = 0.1, max = 5.0, phase = 15;
      const amplitude = (max - min) / 2;
      const mid = (max + min) / 2;
      const angle = ((hour - phase) / 24) * 2 * Math.PI;
      const base = mid + amplitude * Math.sin(angle);
      const noise = (Math.random() - 0.5) * Math.max(0.05, amplitude * 0.1);
      const kW = +(Math.max(min, base + noise)).toFixed(4);
      return { kW, kWH: +kW.toFixed(4) };
    };
  }
  if (profileName === 'peak') {
    return (ts) => {
      const hour = ts.getHours();
      const off = 0.2, peak = 4.0, startPeak = 7, endPeak = 19;
      const inPeak = hour >= startPeak && hour < endPeak;
      const base = inPeak ? peak : off;
      const noise = (Math.random() - 0.5) * Math.max(0.05, base * 0.1);
      const kW = +(Math.max(0, base + noise)).toFixed(4);
      return { kW, kWH: +kW.toFixed(4) };
    };
  }
  return () => {
    const kW = +(Math.random() * 4.9 + 0.1).toFixed(4);
    return { kW, kWH: kW };
  };
}

function roundTo4(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10000) / 10000;
}

export function subscribe(fn) {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

export function isRunning() {
  return Boolean(_worker && !_worker.stopped);
}

export function stopGeneration() {
  if (_worker) {
    _worker.stopped = true;
    notify({ type: 'stopped' });
  }
}

export async function startGeneration({ meters = [], start, end, intervalHours = 1, profile = 'sinusoidal', startingKwh = 1000, batchSize = 200 } = {}) {
  if (!Array.isArray(meters) || meters.length === 0) throw new Error('meters required');
  // stop previous
  stopGeneration();

  const generator = createGenerator(profile);
  const msPerHour = 60 * 60 * 1000;
  const s = new Date(start);
  const e = new Date(end);

  _worker = { stopped: false };
  notify({ type: 'started', meters: meters.length });

  (async () => {
    try {
      let total = 0;
      // estimate total
      const hours = Math.max(0, Math.ceil((e - s) / (intervalHours * msPerHour)));
      total = meters.length * hours;
      let completed = 0;
      notify({ type: 'progress', total, completed });

      for (const snid of meters) {
        if (_worker.stopped) break;
        let cursor = new Date(s);
        let runningTotal = roundTo4(startingKwh);
        const logs = [];

        while (cursor < e) {
          if (_worker.stopped) break;
          const { kW, kWH } = generator(new Date(cursor));
          runningTotal = roundTo4(runningTotal + Number(kWH || 0));
          logs.push({ snid, timestamp: cursor.toISOString(), kW: roundTo4(kW), kWH: runningTotal });

          // flush in batches to avoid huge payloads
          if (logs.length >= batchSize) {
            await insertRunningLogsBulk(logs.splice(0));
            completed += batchSize;
            notify({ type: 'progress', total, completed });
          }

          cursor = new Date(cursor.getTime() + intervalHours * msPerHour);
        }

        if (logs.length > 0 && !_worker.stopped) {
          await insertRunningLogsBulk(logs);
          completed += logs.length;
          notify({ type: 'progress', total, completed });
        }
      }

      if (!_worker.stopped) {
        notify({ type: 'complete', total });
      }
    } catch (err) {
      console.error('Background generation failed', err);
      notify({ type: 'error', error: String(err) });
    } finally {
      if (_worker) _worker.stopped = true;
    }
  })();

  return _worker;
}

export async function importExcelFile(file) {
  // parse Excel or CSV to array of logs { snid, timestamp, kW, kWH }
  if (!file) throw new Error('file is required');
  // dynamic import xlsx
  let XLSX;
  try {
    XLSX = await import('xlsx');
  } catch (err) {
    throw new Error('xlsx library not found. Install with `npm install xlsx` in frontend folder');
  }

  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: null });

  // Expect columns: snid, timestamp, kW, kWH (case-insensitive)
  const logs = json.map((row) => {
    const keys = Object.keys(row);
    const lower = {};
    keys.forEach(k => lower[k.toLowerCase().trim()] = row[k]);
    return {
      snid: String(lower.snid || lower.meter || lower.meterid || lower.meter_sn || '').trim(),
      timestamp: (lower.timestamp || lower.time || lower.ts) ? new Date(lower.timestamp || lower.time || lower.ts).toISOString() : null,
      kW: roundTo4(lower.kw || lower.power || 0),
      kWH: roundTo4(lower.kwh || lower.energy || 0),
    };
  }).filter(l => l.snid && l.timestamp);

  return logs;
}
