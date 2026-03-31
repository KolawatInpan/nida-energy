const DEFAULT_TOKEN_RATE = 1.0;
const DEFAULT_ENERGY_RATE = 3.85;

function getDefaultRateConfig(tableName, tokenTableName) {
  if (tableName === tokenTableName) {
    return {
      rateType: 'token',
      price: DEFAULT_TOKEN_RATE,
    };
  }

  return {
    rateType: 'energy',
    price: DEFAULT_ENERGY_RATE,
  };
}

function normalizeRate(row) {
  const today = new Date();
  const start = row.effective_start ? new Date(row.effective_start) : null;
  const end = row.effective_end ? new Date(row.effective_end) : null;
  let status = 'active';

  if (start && start > today) status = 'upcoming';
  if (end && end < today) status = 'archived';

  return {
    id: row.id,
    rateId: row.display_id,
    rateType: row.rate_type,
    price: Number(row.price || 0),
    effectiveStart: row.effective_start,
    effectiveEnd: row.effective_end,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  DEFAULT_TOKEN_RATE,
  DEFAULT_ENERGY_RATE,
  getDefaultRateConfig,
  normalizeRate,
};
