const { prisma } = require('../../utils/prisma');

async function createPaymentRecord({ email, amount, status = 'pending' }) {
    return await prisma.payment.create({
        data: {
            email: String(email || ''),
            amount: Number(amount || 0),
            status: String(status),
            timestamp: new Date(),
        },
    });
}

async function getPaymentsByEmail(email) {
    return await prisma.payment.findMany({
        where: { email: String(email || '') },
        orderBy: { timestamp: 'desc' },
    });
}

module.exports = { createPaymentRecord, getPaymentsByEmail };
