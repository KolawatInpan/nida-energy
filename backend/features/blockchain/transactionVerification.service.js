const TransactionModel = require('../transactions/transaction.model');
const BlockTransactionModel = require('./blockTransaction.model');
const EthereumVerificationService = require('./ethereumVerification.service');

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
    const updatedTransaction = await TransactionModel.updateVerification(transaction.txid, verification);
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
  const currentTransaction = await TransactionModel.getTransactionById(transaction.txid) || transaction;

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
  const transaction = await TransactionModel.getTransactionById(txid);
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


