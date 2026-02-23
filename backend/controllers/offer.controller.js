const Offer = require('../models/offer.model');

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

module.exports = {
    getOffers,
    getOfferById,
    getBuildingByWalletId
}