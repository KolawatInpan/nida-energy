function toNumber(value) {
  if (value == null) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toStartOfMonth(year, month) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
}

function getRecentPeriods(lookbackMonths = 3, now = new Date()) {
  const count = Math.max(1, Number(lookbackMonths) || 3);
  const periods = [];
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    periods.push({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 });
  }
  return periods;
}

function extractDayValue(row, day) {
  return toNumber(row[`d${day}`]);
}

function normalizeInvoice(invoice) {
  if (!invoice) return invoice;
  return {
    ...invoice,
    kWH: toNumber(invoice.kWH),
    tokenAmount: toNumber(invoice.tokenAmount),
    dailyAvg: toNumber(invoice.dailyAvg),
    peakkWH: toNumber(invoice.peakkWH),
    receipt: invoice.receipt || null,
  };
}

module.exports = { toNumber, toStartOfMonth, getRecentPeriods, extractDayValue, normalizeInvoice };

function resolvePeriod({ month, year } = {}) {
  const now = new Date();
  const resolvedMonth = Number(month || now.getMonth() + 1);
  const resolvedYear = Number(year || now.getFullYear());
  return { month: resolvedMonth, year: resolvedYear };
}

function resolveBuildingFilter(source = {}) {
  if (!source.buildingName || String(source.buildingName).trim() === '' || source.buildingName === 'all') {
    return null;
  }

  return String(source.buildingName).trim();
}

function getBangkokDateParts(value) {
  const input = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(input.getTime())) return null;

  const bangkokOffsetMs = 7 * 60 * 60 * 1000;
  const bangkokDate = new Date(input.getTime() + bangkokOffsetMs);

  return {
    year: bangkokDate.getUTCFullYear(),
    month: bangkokDate.getUTCMonth() + 1,
    day: bangkokDate.getUTCDate(),
  };
}

function buildUniquePeriodsFromLogs(logs = []) {
  return [...new Map(
    (Array.isArray(logs) ? logs : [])
      .map((log) => getBangkokDateParts(log?.timestamp))
      .filter(Boolean)
      .map((period) => [`${period.year}-${period.month}`, { year: period.year, month: period.month }])
  ).values()];
}

function getPreviousMonthPeriodIfDue(referenceDate = new Date()) {
  const parts = getBangkokDateParts(referenceDate);
  if (!parts || parts.day !== 1) {
    return null;
  }

  const previousMonthDate = new Date(Date.UTC(parts.year, parts.month - 2, 1));
  return {
    year: previousMonthDate.getUTCFullYear(),
    month: previousMonthDate.getUTCMonth() + 1,
  };
}

module.exports = {
  toNumber,
  resolvePeriod,
  resolveBuildingFilter,
  getBangkokDateParts,
  buildUniquePeriodsFromLogs,
  getPreviousMonthPeriodIfDue,
};
