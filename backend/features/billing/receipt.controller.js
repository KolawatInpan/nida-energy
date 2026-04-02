const Receipt = require('./receipt.service');

async function listReceipts(req, res) {
	try {
		const receipts = await Receipt.getReceipts();
		res.json(receipts);
	} catch (err) {
		console.error('listReceipts error:', err);
		res.status(500).json({ error: err.message });
	}
}

async function getReceipt(req, res) {
	try {
		const receipt = await Receipt.getReceiptDetails(req.params.id);
		if (!receipt) {
			return res.status(404).json({ error: 'Receipt not found' });
		}
		res.json(receipt);
	} catch (err) {
		console.error('getReceipt error:', err);
		res.status(500).json({ error: err.message });
	}
}

async function createReceipt(req, res) {
	try {
		const { invoiceId, walletTxId } = req.body;
		if (!invoiceId || !walletTxId) {
			return res.status(400).json({ error: 'invoiceId and walletTxId are required' });
		}
		const created = await Receipt.createReceipt({ invoiceId, walletTxId });
		res.status(201).json(created);
	} catch (err) {
		console.error('createReceipt error:', err);
		res.status(500).json({ error: err.message });
	}
}

async function deleteReceipt(req, res) {
	try {
		await Receipt.deleteReceipt(req.params.id);
		res.status(204).send();
	} catch (err) {
		console.error('deleteReceipt error:', err);
		res.status(500).json({ error: err.message });
	}
}

module.exports = {
	listReceipts,
	getReceipt,
	createReceipt,
	deleteReceipt,
};
