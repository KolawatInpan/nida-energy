function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

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
