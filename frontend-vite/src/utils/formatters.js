export function toSafeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatToken(value, options = {}) {
  const numeric = toSafeNumber(value);
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });
}

export function formatCurrency(value, options = {}) {
  const numeric = toSafeNumber(value);
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });
}

export function formatEnergy(value, options = {}) {
  const numeric = toSafeNumber(value);
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    ...options,
  });
}

export function getTransactionDisplayType(transaction) {
  const type = String(transaction?.type || '').toUpperCase();

  if (type === 'CREDIT') return 'Top-up';
  if (type === 'INVOICE_PAYMENT') return 'Invoice Payment';
  if (type === 'MARKETPLACE_PURCHASE') return 'Marketplace Purchase';
  if (type === 'MARKETPLACE_SALE') return 'Marketplace Sale';

  return type ? type.replace(/_/g, ' ') : 'Transaction';
}

export function getSignedTokenAmount(transaction) {
  const type = String(transaction?.type || '').toUpperCase();
  const amount = toSafeNumber(transaction?.tokenAmount);
  const creditTypes = new Set(['CREDIT', 'MARKETPLACE_SALE']);

  return creditTypes.has(type) ? amount : -amount;
}

export function formatVerificationStatus(transaction) {
  const status = String(
    transaction?.verificationStatus ||
    (transaction?.txHash ? 'VERIFIED' : 'UNVERIFIED')
  ).toUpperCase();

  if (status === 'VERIFIED') {
    return { label: 'Verified', className: 'bg-green-100 text-green-700' };
  }
  if (status === 'FAILED') {
    return { label: 'Verify Failed', className: 'bg-red-100 text-red-700' };
  }
  if (status === 'PUBLISHED') {
    return { label: 'Published', className: 'bg-green-100 text-green-700' };
  }
  if (status === 'PREVIEW-ONLY') {
    return { label: 'Pending Verify', className: 'bg-yellow-100 text-yellow-700' };
  }
  return { label: 'Not Verified', className: 'bg-gray-100 text-gray-700' };
}

export function formatVerificationMethod(value) {
  const method = String(value || '').toLowerCase();

  if (method === 'contract-event') return 'Contract Event';
  if (method === 'self-transaction') return 'Self Transaction';
  return method ? method.replace(/-/g, ' ') : 'Unknown';
}

export function formatEntityId(prefix, value) {
  if (!value) return '-';
  const text = String(value).trim();
  if (!text) return '-';

  const normalized = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!normalized) return `${prefix}-`;

  if (normalized.length <= 8) {
    return `${prefix}-${normalized}`;
  }

  return `${prefix}-${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}
