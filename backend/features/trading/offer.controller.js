const Offer = require('./offer.service');
const { dispatchNotification } = require('../notification/notification.service');
const auth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

/** Resolve a wallet's owner email (to route notification prefs/delivery). */
async function resolveWalletEmail(walletId) {
  try {
    const { prisma } = require('../../utils/prisma');
    const w = await prisma.wallet.findUnique({ where: { id: String(walletId) }, select: { email: true } });
    return w?.email || null;
  } catch (_) {
    return null;
  }
}

async function getOffers(req, res) {
    try {
        const offers = await Offer.getOffers();
        res.json(offers);
    } catch (err) {
        console.error('getOffers error', err);
        res.status(500).json({ error: err.message });
    }
}

async function getOfferById(req, res) {
    try {
        const offer = await Offer.getOfferById(req.params.id);
        if (!offer) {
            return res.status(404).json({ error: 'Offer not found' });
        }
        res.json(offer);
    } catch (err) {
        console.error('getOfferById error', err);
        res.status(500).json({ error: err.message });
    }
}


async function getBuildingByWalletId(req, res) {
    try {
        const building = await Offer.getBuildingByWalletId(req.params.walletId);
        if (!building) {
            return res.json(null);  // 200 with null — caller handles gracefully
        }
        res.json(building);
    } catch (err) {
        console.error('getBuildingByWalletId error', err);
        res.status(500).json({ error: err.message });
    }
}

async function createOffer(req, res) {
    try {
        const { sellerWalletId, kwh, ratePerKwh, sourceType, marketType, targetDate } = req.body;
        if (!sellerWalletId || kwh == null || ratePerKwh == null) {
            return res.status(400).json({ error: 'sellerWalletId, kwh and ratePerKwh are required' });
        }
                const created = await Offer.createOffer({ sellerWalletId, kwh, ratePerKwh, sourceType, marketType, targetDate });
                res.status(201).json(created);

                // Notify via Telegram + Email (respects user prefs)
                (async () => {
                    try {
                        const text = `✅ New Offer Created\nBuilding: ${created.sellerWalletId || sellerWalletId}\nAmount: ${kwh} kWh\nRate: ${ratePerKwh} Token/kWh`;
                        const email = await resolveWalletEmail(created?.sellerWalletId || sellerWalletId);
                        await dispatchNotification({ type: 'offer', message: text, email, userId: null });
                    } catch (e) {
                        console.error('Notification (offer) failed:', e?.message || e);
                    }
                })();
    } catch (err) {
        console.error('createOffer error', err);
        if (
            err.message?.includes('meter not found') ||
            err.message?.includes('Cannot create offer exceeding') ||
            err.message?.includes('Manual sell is disabled')
        ) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
}

async function createBid(req, res) {
    try {
        const { buyerWalletId, kwh, ratePerKwh, marketType, targetDate, bypassLock } = req.body;
        if (!buyerWalletId || kwh == null) {
            return res.status(400).json({ error: 'buyerWalletId and kwh are required' });
        }
                const created = await Offer.createBid({ buyerWalletId, kwh, ratePerKwh, marketType, targetDate, bypassLock });
                res.status(201).json(created);

                // Notify via Telegram + Email (respects user prefs)
                (async () => {
                    try {
                        const text = `🛒 New Bid Placed\nBuilding(wallet): ${created.buyerWalletId || buyerWalletId}\nAmount: ${kwh} kWh\nMax Price: ${ratePerKwh != null ? ratePerKwh : 'Market'}`;
                        const email = await resolveWalletEmail(created?.buyerWalletId || buyerWalletId);
                        await dispatchNotification({ type: 'bid', message: text, email, userId: null });
                    } catch (e) {
                        console.error('Notification (bid) failed:', e?.message || e);
                    }
                })();
    } catch (err) {
        console.error('createBid error', err);
        res.status(500).json({ error: err.message });
    }
}

async function getBids(req, res) {
    try {
        const bids = await Offer.getBids();
        res.json(bids);
    } catch (err) {
        console.error('getBids error', err);
        res.status(500).json({ error: err.message });
    }
}

async function triggerClearing(req, res) {
    try {
        const marketService = require('./market.service');
        await marketService.executeMarketClearing();
        res.json({ success: true, message: 'Market clearing executed successfully' });
    } catch (err) {
        console.error('triggerClearing error', err);
        res.status(500).json({ error: err.message });
    }
}

async function cancelOffer(req, res) {
    try {
        const canceled = await Offer.cancelOffer(req.params.id);
        res.json(canceled);
    } catch (err) {
        console.error('cancelOffer error', err);
        res.status(500).json({ error: err.message });
    }
}

async function cancelBid(req, res) {
    try {
        const canceled = await Offer.cancelBid(req.params.id);
        res.json(canceled);
    } catch (err) {
        console.error('cancelBid error', err);
        res.status(500).json({ error: err.message });
    }
}

async function runAutoForBuilding(req, res) {
    try {
        const buildingName = req.body?.buildingName || req.query?.buildingName;
        if (!buildingName) return res.status(400).json({ error: 'buildingName required' });
        const result = await Offer.autoExecuteTradingForBuilding(buildingName);
        res.json({ success: true, result });
    } catch (err) {
        console.error('runAutoForBuilding error', err);
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    getOffers,
    getOfferById,
    getBuildingByWalletId,
    createOffer,
    createBid,
    getBids,
    triggerClearing,
    cancelOffer,
    cancelBid
    , runAutoForBuilding
}
