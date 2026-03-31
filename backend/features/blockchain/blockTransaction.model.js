const { prisma } = require('../../utils/prisma');

function toNullableFloat(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFeeEth(gasUsed, effectiveGasPrice) {
  const gas = Number(gasUsed);
  const price = Number(effectiveGasPrice);
  if (!Number.isFinite(gas) || !Number.isFinite(price)) return null;
  return (gas * price) / 1e18;
}

async function upsertFromVerification(transaction, verification = {}) {
  if (!verification?.txHash) return null;

  return await prisma.blockTransaction.upsert({
    where: { txHash: String(verification.txHash) },
    create: {
      receiptId: String(transaction?.txid || verification.txHash),
      txHash: String(verification.txHash),
      appTxId: transaction?.txid ? String(transaction.txid) : null,
      payloadHash: verification?.payloadHash ? String(verification.payloadHash) : null,
      status: verification?.verified
        ? 'VERIFIED'
        : String(verification?.mode || 'UNVERIFIED').toUpperCase(),
      chainId: Number.isInteger(Number(verification?.chainId)) ? Number(verification.chainId) : null,
      explorerUrl: verification?.explorerUrl ? String(verification.explorerUrl) : null,
      verificationMethod: verification?.verificationMethod ? String(verification.verificationMethod) : null,
      contractAddress: verification?.contractAddress ? String(verification.contractAddress) : null,
      height: toNullableFloat(verification?.blockNumber),
      txAmount: toNullableFloat(transaction?.tokenAmount),
      blockHash: verification?.blockHash ? String(verification.blockHash) : null,
      parentHash: verification?.parentHash ? String(verification.parentHash) : null,
      validator: verification?.publisherAddress ? String(verification.publisherAddress) : null,
      gasUsed: toNullableFloat(verification?.gasUsed),
      txFee: toFeeEth(verification?.gasUsed, verification?.effectiveGasPrice),
      blockSize: toNullableFloat(verification?.blockSize),
      timestamp: verification?.blockTimestamp ? new Date(verification.blockTimestamp) : new Date(),
    },
    update: {
      receiptId: String(transaction?.txid || verification.txHash),
      appTxId: transaction?.txid ? String(transaction.txid) : null,
      payloadHash: verification?.payloadHash ? String(verification.payloadHash) : null,
      status: verification?.verified
        ? 'VERIFIED'
        : String(verification?.mode || 'UNVERIFIED').toUpperCase(),
      chainId: Number.isInteger(Number(verification?.chainId)) ? Number(verification.chainId) : null,
      explorerUrl: verification?.explorerUrl ? String(verification.explorerUrl) : null,
      verificationMethod: verification?.verificationMethod ? String(verification.verificationMethod) : null,
      contractAddress: verification?.contractAddress ? String(verification.contractAddress) : null,
      height: toNullableFloat(verification?.blockNumber),
      txAmount: toNullableFloat(transaction?.tokenAmount),
      blockHash: verification?.blockHash ? String(verification.blockHash) : null,
      parentHash: verification?.parentHash ? String(verification.parentHash) : null,
      validator: verification?.publisherAddress ? String(verification.publisherAddress) : null,
      gasUsed: toNullableFloat(verification?.gasUsed),
      txFee: toFeeEth(verification?.gasUsed, verification?.effectiveGasPrice),
      blockSize: toNullableFloat(verification?.blockSize),
      timestamp: verification?.blockTimestamp ? new Date(verification.blockTimestamp) : new Date(),
    },
  });
}

module.exports = {
  upsertFromVerification,
};


