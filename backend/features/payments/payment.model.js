const { prisma } = require('../../utils/prisma');

/**
 * Record a payment intent as an Invoice (pending status).
 * The Invoice model is used since there is no standalone Payment model.
 */
async function createPaymentRecord({ email, amount, status = 'pending' }) {
    const id = require('crypto').randomUUID();
    const now = new Date();
    return await prisma.invoice.create({
        data: {
            id,
            buildingName: 'Payment Intent',
            fromWId: '',
            toWId: '',
            timestamp: now,
            kWH: 0,
            tokenAmount: Number(amount || 0),
            status,
            month: now.getMonth() + 1,
            year: now.getFullYear(),
        },
    });
}

async function getPaymentsByEmail(email) {
    return await prisma.invoice.findMany({
        where: { status: 'pending' },
        orderBy: { timestamp: 'desc' },
    });
}

module.exports = { createPaymentRecord, getPaymentsByEmail };
