const { prisma } = require('../../utils/prisma');
const Receipt = require('./receipt.model');
const InvoiceModel = require('./invoice.model');

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
		const receipt = await prisma.receipt.findUnique({
			where: { id: String(req.params.id) },
			include: { invoice: true }
		});
		if (!receipt) {
			return res.status(404).json({ error: 'Receipt not found' });
		}

		const [enrichedInvoice] = await InvoiceModel.attachInvoiceEnergyBreakdown(
			receipt.invoice ? [receipt.invoice] : [],
		);

		const building = receipt.invoice?.buildingName
			? await prisma.building.findUnique({
				where: { name: String(receipt.invoice.buildingName) },
			})
			: null;

		const owner = building?.email
			? await prisma.user.findUnique({
				where: { email: String(building.email) },
				include: { wallets: true },
			})
			: null;

		const walletTx = receipt.walletTxId
			? await prisma.walletTx.findUnique({
				where: { id: String(receipt.walletTxId) },
			})
			: null;

		res.json({
			...receipt,
			invoice: enrichedInvoice || receipt.invoice,
			building,
			owner,
			walletTx,
		});
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
		await prisma.receipt.delete({ where: { id: String(req.params.id) } });
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
	deleteReceipt
};


