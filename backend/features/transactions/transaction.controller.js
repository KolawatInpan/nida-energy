const TransactionModel = require('./transaction.model');
const EthereumVerificationService = require('../blockchain/ethereumVerification.service');
const TransactionVerificationService = require('../blockchain/transactionVerification.service');

async function getTransactions(req, res) {
	try {
		const transactions = await TransactionModel.getTransactions();
		res.json(transactions);
	} catch (err) {
		console.error('getTransactions error', err);
		res.status(500).json({ error: err.message });
	}
}

async function getTransactionById(req, res) {
	try {
		const id = req.params.id;
		const transaction = await TransactionModel.getTransactionById(id);
		if (!transaction) return res.status(404).json({ error: 'transaction not found' });
		res.json(transaction);
	} catch (err) {
		console.error('getTransactionById error', err);
		res.status(500).json({ error: err.message });
	}
}

async function getTransactionsByBuilding(req, res) {
	try {
		const buildingName = req.params.buildingName;
		const transactions = await TransactionModel.getTransactionsByBuilding(buildingName);
		res.json(transactions);
	} catch (err) {
		console.error('getTransactionsByBuilding error', err);
		res.status(500).json({ error: err.message });
	}
}

async function getTransactionsByWallet(req, res) {
	try {
		const walletId = req.params.walletId;
		const transactions = await TransactionModel.getTransactionsByWallet(walletId);
		res.json(transactions);
	} catch (err) {
		console.error('getTransactionsByWallet error', err);
		res.status(500).json({ error: err.message });
	}
}

async function createTransaction(req, res) {
	try {
		const { walletId, buildingName, snid, type, tokenAmount, status } = req.body;
		if (!walletId || tokenAmount == null) {
			return res.status(400).json({ error: 'walletId and tokenAmount are required' });
		}
		const created = await TransactionModel.createTransaction({ walletId, buildingName, snid, type, tokenAmount, status });
		const { transaction, verification } = await TransactionVerificationService.verifyTransaction(created);
		res.status(201).json({
			transaction,
			verification,
		});
	} catch (err) {
		console.error('createTransaction error', err);
		res.status(500).json({ error: err.message });
	}
}

async function getRecentBlockchainTransactions(req, res) {
	try {
		const limit = Number(req.query.limit || 50);
		const transactions = await TransactionModel.getRecentBlockchainTransactions(limit);
		res.json({
			items: transactions,
			count: transactions.length,
		});
	} catch (err) {
		console.error('getRecentBlockchainTransactions error', err);
		res.status(500).json({ error: err.message });
	}
}

async function getBlockchainTransactionByHash(req, res) {
	try {
		const txHash = req.params.txHash;
		const transaction = await TransactionModel.getBlockchainTransactionByHash(txHash);
		if (!transaction) {
			return res.status(404).json({ error: 'blockchain transaction not found' });
		}
		res.json(transaction);
	} catch (err) {
		console.error('getBlockchainTransactionByHash error', err);
		res.status(500).json({ error: err.message });
	}
}

async function getTransactionVerificationPreview(req, res) {
	try {
		const id = req.params.id;
		const transaction = await TransactionModel.getTransactionById(id);
		if (!transaction) {
			return res.status(404).json({ error: 'transaction not found' });
		}

		const preview = EthereumVerificationService.getVerificationPreview(transaction);
		res.json({
			transactionId: transaction.txid,
			...preview,
		});
	} catch (err) {
		console.error('getTransactionVerificationPreview error', err);
		res.status(500).json({ error: err.message });
	}
}

async function publishTransactionVerification(req, res) {
	try {
		const id = req.params.id;
		const { transaction, verification } = await TransactionVerificationService.verifyTransactionById(id, {
			force: req.query.force === 'true' || req.body?.force === true,
		});
		res.status(verification.published ? 201 : 200).json({
			transactionId: transaction.txid,
			transaction,
			...verification,
		});
	} catch (err) {
		console.error('publishTransactionVerification error', err);
		res.status(err.status || 500).json({ error: err.message });
	}
}


module.exports = {
	getTransactions,
	getRecentBlockchainTransactions,
	getBlockchainTransactionByHash,
	getTransactionById,
	getTransactionsByBuilding,
	getTransactionsByWallet,
	createTransaction,
	getTransactionVerificationPreview,
	publishTransactionVerification,
}



