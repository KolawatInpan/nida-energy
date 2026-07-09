const transactionRepo = require('../transactions/transaction.repository');
const BlockTransactionModel = require('./blockTransaction.model');
const EthereumVerificationService = require('./ethereumVerification.service');

function getTransactionById(id) {
  return transactionRepo.getTransactionByIdRaw(id);
}

function buildStoredVerification(transaction) {
  const preview = EthereumVerificationService.getVerificationPreview(transaction);
  const verified = String(transaction?.verificationStatus || '').toUpperCase() === 'VERIFIED' || Boolean(transaction?.txHash);
  const explorerUrl = transaction?.explorerUrl || EthereumVerificationService.buildExplorerUrl(transaction?.txHash);

  return {
    verified,
    mode: verified ? 'already-verified' : 'preview-only',
    ...preview,
    published: Boolean(transaction?.txHash),
    reused: true,
    txHash: transaction?.txHash || null,
    explorerUrl: explorerUrl || null,
    publisherAddress: transaction?.publisherAddress || null,
    contractAddress: transaction?.contractAddress || preview.contractAddress || null,
    verificationMethod: transaction?.verificationMethod || preview.verificationMethod,
    blockNumber: transaction?.blockNumber ?? null,
    gasUsed: transaction?.gasUsed || null,
    effectiveGasPrice: transaction?.effectiveGasPrice || null,
  };
}

async function persistVerificationResult(transaction, verification) {
  try {
    const updatedTransaction = await transactionRepo.updateVerification(transaction.txid, verification);
    if (verification?.txHash) {
      await BlockTransactionModel.upsertFromVerification(updatedTransaction || transaction, verification);
    }
    return updatedTransaction;
  } catch (error) {
    console.error('persistVerificationResult error', error);
    return transaction;
  }
}

async function verifyTransaction(transaction, options = {}) {
  const force = Boolean(options.force);
  const currentTransaction = await getTransactionById(transaction.txid) || transaction;
  // Preserve extra fields from caller (not stored in DB column)
  if (transaction.kwh != null && currentTransaction.kwh == null) currentTransaction.kwh = transaction.kwh;
  if (transaction.fromBuilding != null && !currentTransaction.fromBuilding) currentTransaction.fromBuilding = transaction.fromBuilding;
  if (transaction.toBuilding != null && !currentTransaction.toBuilding) currentTransaction.toBuilding = transaction.toBuilding;

  if (!force && currentTransaction?.txHash && String(currentTransaction?.verificationStatus || '').toUpperCase() === 'VERIFIED') {
    return {
      transaction: currentTransaction,
      verification: buildStoredVerification(currentTransaction),
    };
  }

  try {
    const result = await EthereumVerificationService.publishVerification(currentTransaction);
    const verification = {
      verified: Boolean(result.published),
      mode: result.published ? 'published' : 'preview-only',
      ...result,
    };
    const updatedTransaction = await persistVerificationResult(currentTransaction, verification);

    return {
      transaction: updatedTransaction,
      verification,
    };
  } catch (error) {
    console.error('verifyTransaction error', error);
    const preview = EthereumVerificationService.getVerificationPreview(currentTransaction);
    const verification = {
      verified: false,
      mode: 'failed',
      ...preview,
      published: false,
      reason: error.message || 'Failed to publish verification proof.',
    };
    const updatedTransaction = await persistVerificationResult(currentTransaction, verification);

    return {
      transaction: updatedTransaction,
      verification,
    };
  }
}

async function verifyTransactionById(txid, options = {}) {
  const transaction = await getTransactionById(txid);
  if (!transaction) {
    const error = new Error('transaction not found');
    error.status = 404;
    throw error;
  }

  return verifyTransaction(transaction, options);
}

module.exports = {
  verifyTransaction,
  verifyTransactionById,
};


