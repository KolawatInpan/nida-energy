const walletService = require('./wallet.service');
const { sendTelegramMessage } = require('../../utils/telegram');
const { createNotification, dispatchNotification } = require('../notification/notification.service');

async function getWallets(req, res) {
    try {
        const wallets = await walletService.getWallets();
        res.json(wallets);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to retrieve wallets' });
    }
}

async function getWalletById(req, res) {
    const { id } = req.params;
    try {
        const wallet = await walletService.getWalletById(id);
        if (!wallet) {
            res.status(404).json({ error: 'Wallet not found' });
        } else {
            res.json(wallet);
        }
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to retrieve wallet' });
    }
}

async function getBalance(req, res) {
    const { walletId } = req.params;
    try {
        const result = await walletService.resolveWalletBalance(walletId);
        res.json(result);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to retrieve wallet balance' });
    }
}

async function createWallet(req, res) {
    const { buildingId, email } = req.body;
    try {
        // ตรวจสอบว่ามีกระเป๋าเงินสำหรับ email นี้อยู่แล้วหรือไม่
        const existingWallet = await walletService.getWalletByEmail(email);
        if (existingWallet) {
            // ถ้ามีอยู่แล้ว ให้ตอบกลับเป็นกระเป๋าเดิมเลย ไม่ต้องสร้างใหม่ (ป้องกัน Error จาก Prisma)
            return res.status(200).json(existingWallet);
        }

        const newWallet = await walletService.createWallet({ buildingId, email });
        res.status(201).json(newWallet);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to create wallet' });
    }
}

async function getWalletByEmail(req, res) {
    const { email } = req.params;
    try {
        const wallet = await walletService.getWalletByEmail(email);
        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }
        res.json(wallet);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to retrieve wallet by email' });
    }
}

async function addBalance(req, res) {
    const { email } = req.params;
    const { amount, rate } = req.body;
    try {
        const updatedWallet = await walletService.addBalance(email, amount, rate);
        res.json(updatedWallet);

        // Notify via Telegram + Email (respects user notification prefs)
        (async () => {
            try {
                let buildingName = email;
                try {
                    const { prisma: p } = require('../../utils/prisma');
                    const b = await p.building.findFirst({ where: { email }, select: { name: true } });
                    if (b?.name) buildingName = b.name;
                } catch {}
                const tokenAmount = Number(amount || 0);
                const currentBalance = Number(updatedWallet?.tokenBalance ?? 0);
                const text = `✅ เติมเงินเข้าอาคาร ${buildingName}\n+${tokenAmount.toLocaleString('en-US')} Token\nยอดคงเหลือ: ${currentBalance.toLocaleString('en-US')} Token`;
                await dispatchNotification({
                    type: 'addBalance',
                    message: text,
                    email, // used to resolve the user (prefs) + email delivery
                    userId: null,
                });
            } catch (e) {
                console.error('Notification (addBalance) failed:', e?.message || e);
            }
        })();
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to add balance' });
    }
}

async function topupByEmail(req, res) {
    const { email } = req.params;
    const { amount, snid } = req.body;
    try {
        const result = await walletService.topupWalletByEmail(email, amount, snid);
                res.status(201).json(result);

                // Fire-and-forget: in-app + Telegram + Email (respects user prefs)
                (async () => {
                    try {
                        let buildingName = result?.transaction?.buildingName;
                        if (!buildingName || buildingName === 'Unknown building') {
                            try {
                                const { prisma: p } = require('../../utils/prisma');
                                const b = await p.building.findFirst({ where: { email }, select: { name: true } });
                                if (b?.name) buildingName = b.name;
                            } catch {}
                        }
                        if (!buildingName || buildingName === 'Unknown building') {
                            buildingName = email;
                        }
                    const tokenAmount = Number((result?.transaction?.tokenAmount ?? amount) || 0);
                    const currentBalance = Number(result?.wallet?.tokenBalance ?? 0);
                    const formattedAmount = tokenAmount.toLocaleString('en-US');
                    const formattedBalance = currentBalance.toLocaleString('en-US');
                    const text = `✅ เติมเงินเข้าอาคาร ${buildingName}\n+${formattedAmount} Token\nยอดคงเหลือ: ${formattedBalance} Token`;
                    await dispatchNotification({
                        type: 'topup',
                        message: text,
                        email, // resolve user prefs + email delivery
                        userId: null,
                    });
                    } catch (e) {
                        console.error('Notification (topup) failed:', e?.message || e);
                    }
                })();
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to top up wallet' });
    }
}

async function getWalletTransactions(req, res) {
    const { walletId } = req.params;
    try {
        const txs = await walletService.getWalletTransactions(walletId);
        res.json(txs);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to get wallet transactions' });
    }
}

async function recalculateWalletBalance(req, res) {
    const { walletId } = req.params;
    try {
        const result = await walletService.recalculateBalance(walletId);
        res.json(result);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to recalculate wallet balance' });
    }
}

module.exports = {
    getWallets,
    getWalletById,
    getWalletByEmail,
    getBalance,
    createWallet,
    addBalance,
    topupByEmail,
    getWalletTransactions,
    recalculateWalletBalance
};
