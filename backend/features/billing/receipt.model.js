const { prisma } = require('../../utils/prisma');
const { randomUUID } = require('crypto');

async function getReceipts() {
    return await prisma.receipt.findMany({
        include: {
            invoice: true
        },
        orderBy: {
            timestamp: 'desc'
        }
    });
}

async function getReceiptByBuilding(buildingId) {
    // Implement if needed
}

async function createReceipt({ invoiceId, walletTxId }) {
    const receiptId = randomUUID();
    const receipt = await prisma.receipt.create({
        data: {
            id: receiptId,
            invoiceId: String(invoiceId),
            timestamp: new Date(),
            walletTxId: String(walletTxId)
        }
    });
    // แจ้งเตือนชำระเงินสำเร็จ (user)
    try {
        const { createNotification } = require('../notification/notification.service');
        await createNotification({
            type: 'payment_success',
            message: `ชำระเงินสำหรับ Invoice ${invoiceId} สำเร็จ`,
        });
    } catch (e) { console.error('Notification error:', e.message); }
    return receipt;
}

module.exports = {
    getReceipts,
    createReceipt
};


