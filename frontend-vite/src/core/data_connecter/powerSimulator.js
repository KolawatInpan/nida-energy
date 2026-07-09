/**
 * Data connector for Energy Feed API (external meter data source).
 * Routes through backend proxy to avoid CORS issues.
 */

async function feedRequest(path, options = {}) {
  const apiBase = (await import('./apiBase')).getApiBase();
  const url = `${apiBase}/energy-feed/proxy?path=${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Energy Feed error: ${res.status} — ${text}`);
  }
  return res.json();
}

// ─── Info ────────────────────────────────────────────────────────

/** GET /info — basic health check + metadata */
export async function getSimulatorInfo() {
  return feedRequest('/info');
}

// ─── Simulation ──────────────────────────────────────────────────

/**
 * GET /simulation/power — simulated power value
 * @param {'producer'|'consumer'|'battery'} type
 * @param {number} peak — peak capacity in kW
 * @param {number} [time] — unix timestamp (seconds)
 * @param {number} [capacity] — battery capacity in kWh (default 16.0)
 */
export async function getSimulatedPower(type, peak, time, capacity) {
  const params = new URLSearchParams({ type, peak: String(peak) });
  if (time != null) params.set('time', String(time));
  if (capacity != null) params.set('capacity', String(capacity));
  return feedRequest(`/simulation/power?${params}`);
}

// ─── Virtual Meters ──────────────────────────────────────────────

/** GET /vmeter — list all virtual meters */
export async function listMeters() {
  return feedRequest('/vmeter');
}

/** POST /vmeter — create a new virtual meter */
export async function createMeter({ meter_id, name, init_kwh = 0 }) {
  return feedRequest('/vmeter', {
    method: 'POST',
    body: JSON.stringify({ meter_id, name, init_kwh }),
  });
}

/** GET /vmeter/{meter_id} — get a single meter */
export async function getMeter(meterId) {
  return feedRequest(`/vmeter/${encodeURIComponent(meterId)}`);
}

/** DELETE /vmeter/{meter_id} — delete a meter */
export async function deleteMeter(meterId) {
  return feedRequest(`/vmeter/${encodeURIComponent(meterId)}`, { method: 'DELETE' });
}

/** PUT /vmeter/{meter_id}/kwh — update meter kWh */
export async function updateMeterKwh(meterId, kwh) {
  return feedRequest(`/vmeter/${encodeURIComponent(meterId)}/kwh`, {
    method: 'PUT',
    body: JSON.stringify({ kwh }),
  });
}

/** PUT /vmeter/{meter_id}/poweradd_period — add power period */
export async function addMeterPowerPeriod(meterId, power, period = 3600) {
  return feedRequest(`/vmeter/${encodeURIComponent(meterId)}/poweradd_period`, {
    method: 'PUT',
    body: JSON.stringify({ power, period }),
  });
}

// ─── Meter Logs ──────────────────────────────────────────────────

/**
 * GET /meterlog — query meter logs
 * @param {object} [filters]
 * @param {string} [filters.device] — meter_id filter
 * @param {string} [filters.timeFrom] — e.g. "2026-06-20T00:00"
 * @param {string} [filters.timeTo] — e.g. "2026-06-22T23:59"
 * @param {number} [filters.limit] — max 1000, default 100
 * @param {'json'|'jsonl'|'csv'} [filters.format] — default 'json'
 */
export async function getMeterLogs(filters = {}) {
  const params = new URLSearchParams();
  if (filters.device) params.set('device', filters.device);
  if (filters.timeFrom) params.set('time_from', filters.timeFrom);
  if (filters.timeTo) params.set('time_to', filters.timeTo);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.format) params.set('format', filters.format);
  return feedRequest(`/meterlog?${params}`);
}

/** POST /meterlog — create a meter log entry */
export async function createMeterLog({ Device, kW, kWh }) {
  return feedRequest('/meterlog', {
    method: 'POST',
    body: JSON.stringify({ Device, kW, kWh }),
  });
}

// ─── Backend Trigger ─────────────────────────────────────────────

/** POST /api/energy-feed/sync — manually trigger energy feed sync */
export async function triggerEnergyFeedSync() {
  const apiBase = (await import('./apiBase')).getApiBase();
  const res = await fetch(`${apiBase}/energy-feed/sync`, { method: 'POST' });
  if (!res.ok) throw new Error(`Sync failed: HTTP ${res.status}`);
  return res.json();
}

/** GET /api/energy-feed/pairing-data — system + source meters for pairing UI */
export async function getPairingData() {
  const apiBase = (await import('./apiBase')).getApiBase();
  const res = await fetch(`${apiBase}/energy-feed/pairing-data`);
  if (!res.ok) throw new Error(`Pairing data failed: HTTP ${res.status}`);
  return res.json();
}

/** PUT /api/energy-feed/mapping — save device→snid mapping */
export async function saveDeviceMapping(mapping) {
  const apiBase = (await import('./apiBase')).getApiBase();
  const res = await fetch(`${apiBase}/energy-feed/mapping`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapping),
  });
  if (!res.ok) throw new Error(`Save mapping failed: HTTP ${res.status}`);
  return res.json();
}

/** PUT /api/energy-feed/building-map — save building code→name mapping */
export async function saveBuildingMap(buildingMap) {
  const apiBase = (await import('./apiBase')).getApiBase();
  const res = await fetch(`${apiBase}/energy-feed/building-map`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildingMap),
  });
  if (!res.ok) throw new Error(`Save building map failed: HTTP ${res.status}`);
  return res.json();
}
