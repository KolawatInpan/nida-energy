const { prisma } = require('../../utils/prisma');
const { randomUUID } = require('crypto');
const InvoiceModel = require('./invoice.service');

async function getReceipts() {
	return await prisma.receipt.findMany({
		include: { invoice: true },
		orderBy: { timestamp: 'desc' },
	});
}

async function getReceiptById(id) {
	return await prisma.receipt.findUnique({
		where: { id: String(id) },
		include: { invoice: true },
	});
}

async function getReceiptDetails(id) {
	const receipt = await getReceiptById(id);
	if (!receipt) return null;

	const [enrichedInvoice] = await InvoiceModel.attachInvoiceEnergyBreakdown(
		receipt.invoice ? [receipt.invoice] : [],
	);

	const building = receipt.invoice?.buildingName
		? await (async () => {
			let bname = String(receipt.invoice.buildingName);
			// Normalize known name variants
			const normalized = bname.toLowerCase().replace(/\s+/g, '');
			if (normalized === 'nidasumpan') bname = 'nidasumpun';
			if (normalized === 'narathip') bname = 'naradhip';
			return prisma.building.findUnique({ where: { name: bname } });
		})()
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

	return {
		...receipt,
		invoice: enrichedInvoice || receipt.invoice,
		building,
		owner,
		walletTx,
	};
}

async function getReceiptByBuilding(buildingId) {
	// Implement if needed
}

async function createReceipt({ invoiceId, walletTxId }) {
	const receiptId = randomUUID();

	return await prisma.receipt.create({
		data: {
			id: receiptId,
			invoiceId: String(invoiceId),
			timestamp: new Date(),
			walletTxId: String(walletTxId),
		},
	});
}

async function deleteReceipt(id) {
	return await prisma.receipt.delete({ where: { id: String(id) } });
}

module.exports = {
	getReceipts,
	getReceiptById,
	getReceiptDetails,
	getReceiptByBuilding,
	createReceipt,
	deleteReceipt,
};
