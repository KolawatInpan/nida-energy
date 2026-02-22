const TransactionModel = require('../models/transaction.model');

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
		const buildingId = req.params.buildingId;
		const transactions = await TransactionModel.getTransactionsByBuilding(buildingId);
		res.json(transactions);
	} catch (err) {
		console.error('getTransactionsByBuilding error', err);
		res.status(500).json({ error: err.message });
	}
}


module.exports = {
	getTransactions,
	getTransactionById,
	getTransactionsByBuilding,
}

