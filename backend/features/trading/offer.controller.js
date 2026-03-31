const Offer = require('./offer.model');

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
            return res.status(404).json({ error: 'Building not found for this wallet' });
        }
        res.json(building);
    } catch (err) {
        console.error('getBuildingByWalletId error', err);
        res.status(500).json({ error: err.message });
    }
}

async function createOffer(req, res) {
    try {
        const { sellerWalletId, kwh, ratePerKwh, sourceType } = req.body;
        if (!sellerWalletId || kwh == null || ratePerKwh == null) {
            return res.status(400).json({ error: 'sellerWalletId, kwh and ratePerKwh are required' });
        }
        const created = await Offer.createOffer({ sellerWalletId, kwh, ratePerKwh, sourceType });
        res.status(201).json(created);
    } catch (err) {
        console.error('createOffer error', err);
        if (
            err.message?.includes('meter not found') ||
            err.message?.includes('Cannot create offer exceeding')
        ) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    getOffers,
    getOfferById,
    getBuildingByWalletId
    ,
    createOffer
}


