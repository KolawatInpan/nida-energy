const assert = require('node:assert/strict');

const {
  DEFAULT_ENERGY_RATE,
  DEFAULT_TOKEN_RATE,
  getDefaultRateConfig,
  normalizeRate,
} = require('../features/rates/rate.helpers');

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

run('getDefaultRateConfig returns token defaults for token table', () => {
  assert.deepEqual(getDefaultRateConfig('"TokenRateRule"', '"TokenRateRule"'), {
    rateType: 'token',
    price: DEFAULT_TOKEN_RATE,
  });
});

run('getDefaultRateConfig returns energy defaults for non-token table', () => {
  assert.deepEqual(getDefaultRateConfig('"EnergyRateRule"', '"TokenRateRule"'), {
    rateType: 'energy',
    price: DEFAULT_ENERGY_RATE,
  });
});

run('normalizeRate marks future rows as upcoming', () => {
  const future = new Date();
  future.setDate(future.getDate() + 7);

  const normalized = normalizeRate({
    id: 1,
    display_id: 'RATE-001',
    rate_type: 'energy',
    price: '3.8500',
    effective_start: future.toISOString(),
    effective_end: null,
    created_at: '2026-03-31T00:00:00.000Z',
    updated_at: '2026-03-31T00:00:00.000Z',
  });

  assert.equal(normalized.rateId, 'RATE-001');
  assert.equal(normalized.price, 3.85);
  assert.equal(normalized.status, 'upcoming');
});

run('normalizeRate marks ended rows as archived', () => {
  const pastStart = new Date();
  pastStart.setMonth(pastStart.getMonth() - 2);
  const pastEnd = new Date();
  pastEnd.setDate(pastEnd.getDate() - 1);

  const normalized = normalizeRate({
    id: 2,
    display_id: 'RATE-002',
    rate_type: 'token',
    price: '1.2500',
    effective_start: pastStart.toISOString(),
    effective_end: pastEnd.toISOString(),
    created_at: '2026-03-31T00:00:00.000Z',
    updated_at: '2026-03-31T00:00:00.000Z',
  });

  assert.equal(normalized.status, 'archived');
  assert.equal(normalized.rateType, 'token');
});

if (!process.exitCode) {
  console.log('All rate helper unit tests passed');
}
