import {
  formatEntityId,
  formatVerificationMethod,
  formatVerificationStatus,
  getSignedTokenAmount,
  getTransactionDisplayType,
} from './formatters';

export function normalizeCompareValue(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
}

export function compareValues(left, right) {
  const normalizedLeft = normalizeCompareValue(left);
  const normalizedRight = normalizeCompareValue(right);

  if (normalizedLeft === normalizedRight) return true;

  const leftNumber = Number(normalizedLeft);
  const rightNumber = Number(normalizedRight);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return Math.abs(leftNumber - rightNumber) < 0.000001;
  }

  return false;
}

export function buildTransactionDetailView(transaction, txid) {
  if (!transaction) return null;

  const signedAmount = getSignedTokenAmount(transaction);
  const amount = Math.abs(signedAmount);
  const type = getTransactionDisplayType(transaction);
  const verification = formatVerificationStatus(transaction);
  const createdAt = transaction.timestamp ? new Date(transaction.timestamp) : null;
  const verifiedAtDate = transaction.verifiedAt ? new Date(transaction.verifiedAt) : null;
  const timeDiffSeconds = createdAt && verifiedAtDate
    ? Math.max(0, Math.round((verifiedAtDate.getTime() - createdAt.getTime()) / 1000))
    : null;

  return {
    id: txid,
    amount,
    signedAmount,
    type,
    status: String(transaction.status || 'UNKNOWN').toUpperCase(),
    createdAtLabel: createdAt ? createdAt.toLocaleString() : 'N/A',
    createdDateLabel: createdAt ? createdAt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A',
    createdTimeLabel: createdAt ? createdAt.toLocaleTimeString() : 'N/A',
    buildingName: transaction.buildingName || 'N/A',
    snid: transaction.snid || 'N/A',
    walletId: transaction.walletId || 'N/A',
    verification,
    txHash: transaction.txHash || '',
    explorerUrl: transaction.explorerUrl || '',
    payloadHash: transaction.payloadHash || '',
    publisherAddress: transaction.publisherAddress || '',
    contractAddress: transaction.contractAddress || '',
    blockNumber: transaction.blockNumber ?? '-',
    verificationMethod: formatVerificationMethod(transaction.verificationMethod),
    verifiedAtLabel: verifiedAtDate ? verifiedAtDate.toLocaleString() : 'N/A',
    verifiedTimeLabel: verifiedAtDate ? verifiedAtDate.toLocaleTimeString() : 'Pending',
    confirmationSeconds: timeDiffSeconds,
    canVerify: !transaction.txHash || String(transaction.verificationStatus || '').toUpperCase() === 'FAILED',
    effectiveGasPrice: transaction.effectiveGasPrice || '-',
    gasUsed: transaction.gasUsed || '-',
  };
}

export function buildTransactionTimeline(view, preview) {
  if (!view) return [];

  const items = [
    {
      title: 'Transaction Recorded',
      description: `${view.type} recorded for ${view.buildingName}`,
      time: view.createdTimeLabel,
      complete: true,
    },
    {
      title: 'Verification Preview Prepared',
      description: preview?.enabled
        ? 'Receipt hash prepared for blockchain verification'
        : 'Blockchain verification is currently disabled',
      time: view.createdTimeLabel,
      complete: true,
      tags: preview?.payloadHash ? [`Hash: ${preview.payloadHash.slice(0, 10)}...`] : [],
    },
  ];

  if (view.txHash) {
    items.push({
      title: 'Blockchain Verified',
      description: 'Transaction hash was published and confirmed on the local blockchain',
      time: view.verifiedTimeLabel,
      complete: true,
      tags: [
        `Block: ${view.blockNumber}`,
        view.confirmationSeconds != null ? `${view.confirmationSeconds}s` : 'Confirmed',
      ],
    });
  } else {
    items.push({
      title: 'Awaiting Blockchain Verification',
      description: 'The transaction has not been published on-chain yet',
      time: 'Pending',
      complete: false,
    });
  }

  return items;
}

export function buildTransactionCompareRows(transaction, preview) {
  if (!transaction) return [];

  const payload = preview?.payloadSource === 'stored' ? (preview?.payload || {}) : null;
  const fields = [
    { label: 'Transaction ID', db: formatEntityId('TX', transaction.txid), chain: payload?.txid ? formatEntityId('TX', payload.txid) : '-' },
    { label: 'Wallet ID', db: transaction.walletId, chain: payload?.walletId ?? '-' },
    { label: 'Building', db: transaction.buildingName || '-', chain: payload?.buildingName ?? '-' },
    { label: 'SNID', db: transaction.snid || '-', chain: payload?.snid ?? '-' },
    { label: 'Type', db: transaction.type || '-', chain: payload?.type ?? '-' },
    { label: 'Token Amount', db: Number(transaction.tokenAmount || 0), chain: payload?.tokenAmount ?? '-' },
    { label: 'Status', db: transaction.status || '-', chain: payload?.status ?? '-' },
    { label: 'Timestamp', db: transaction.timestamp || '-', chain: payload?.timestamp ?? '-' },
  ];

  return fields.map((field) => ({
    ...field,
    available: payload !== null,
    match: payload !== null ? compareValues(field.db, field.chain) : false,
  }));
}

export function buildTransactionCompareSummary(compareRows, transaction, preview) {
  const total = compareRows.length;
  const comparable = compareRows.filter((row) => row.available).length;
  const matched = compareRows.filter((row) => row.available && row.match).length;
  const mismatched = compareRows.filter((row) => row.available && !row.match).length;
  const unavailable = total - comparable;

  return {
    total,
    comparable,
    matched,
    mismatched,
    unavailable,
    isVerified: Boolean(transaction?.txHash),
    verification: transaction ? formatVerificationStatus(transaction) : null,
    payloadSource: preview?.payloadSource || 'live',
  };
}
