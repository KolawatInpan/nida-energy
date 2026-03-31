const assert = require('node:assert/strict');

const {
  toNumber,
  resolvePeriod,
  resolveBuildingFilter,
  getBangkokDateParts,
  buildUniquePeriodsFromLogs,
  getPreviousMonthPeriodIfDue,
} = require('../features/billing/invoice.helpers');

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

run('toNumber returns 0 for invalid inputs', () => {
  assert.equal(toNumber('12.5'), 12.5);
  assert.equal(toNumber(undefined), 0);
  assert.equal(toNumber('bad'), 0);
});

run('resolveBuildingFilter normalizes empty and all values', () => {
  assert.equal(resolveBuildingFilter({ buildingName: '' }), null);
  assert.equal(resolveBuildingFilter({ buildingName: 'all' }), null);
  assert.equal(resolveBuildingFilter({ buildingName: ' Malai ' }), 'Malai');
});

run('getBangkokDateParts converts UTC date into Bangkok date parts', () => {
  const parts = getBangkokDateParts('2026-03-31T20:00:00.000Z');
  assert.deepEqual(parts, { year: 2026, month: 4, day: 1 });
});

run('buildUniquePeriodsFromLogs returns unique month-year periods', () => {
  const periods = buildUniquePeriodsFromLogs([
    { timestamp: '2026-01-15T10:00:00.000Z' },
    { timestamp: '2026-01-20T12:00:00.000Z' },
    { timestamp: '2026-02-01T00:30:00.000Z' },
  ]);

  assert.deepEqual(periods, [
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
  ]);
});

run('getPreviousMonthPeriodIfDue returns previous month only on Bangkok day 1', () => {
  assert.deepEqual(
    getPreviousMonthPeriodIfDue('2026-04-01T00:30:00.000+07:00'),
    { year: 2026, month: 3 }
  );

  assert.equal(getPreviousMonthPeriodIfDue('2026-04-02T00:30:00.000+07:00'), null);
});

run('resolvePeriod falls back to current date when no period provided', () => {
  const period = resolvePeriod({});
  assert.ok(period.month >= 1 && period.month <= 12);
  assert.ok(period.year >= 2026);
});

if (!process.exitCode) {
  console.log('All backend unit tests passed');
}
