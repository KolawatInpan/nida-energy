import axios from 'axios';
import { getApiBase } from './apiBase';

export function getOffers() {
    const base = getApiBase();
    // New unified market API: fetch MarketOrder rows and convert to legacy offer shape
    return axios.get(`${base}/market/orders`).then(res => {
        const orders = res.data?.orders || [];
        const offers = orders.filter(o => o.side === 'OFFER').map(o => ({
            id: o.id,
            sellerWalletId: o.walletId,
            buildingName: o.buildingName || null,
            kWH: Number(o.quantity || 0),
            kWHSold: Number(o.filled || 0),
            ratePerkWH: o.price != null ? Number(o.price) : 0,
            status: o.status === 'OPEN' || o.status === 'PARTIAL' ? 'AVAILABLE' : o.status,
            marketType: o.marketType,
            createdAt: o.createdAt,
            targetDate: o.targetDate,
            raw: o
        }));
        return offers;
    });
}

export function getBuildingByWalletId(walletId) {
    const base = getApiBase();
    return axios.get(`${base}/offers/building/${walletId}`).then(res => res.data);
}

/**
 * Create a new energy offer (POST /api/offers)
 * @param {Object} offer - The offer data { sellerWalletId, kwh, ratePerKwh, marketType, targetDate }
 * @returns {Promise} Axios promise
 */
// legacy createOffer removed — use unified market API createOffer below

export function getBids() {
    const base = getApiBase();
    return axios.get(`${base}/market/orders`).then(res => {
        const orders = res.data?.orders || [];
        const bids = orders.filter(o => o.side === 'BID').map(o => ({
            id: o.id,
            buyerWalletId: o.walletId,
            buildingName: o.buildingName || null,
            kWH: Number(o.quantity || 0),
            kWHBought: Number(o.filled || 0),
            ratePerkWH: o.price != null ? Number(o.price) : null,
            status: o.status === 'OPEN' || o.status === 'PARTIAL' ? 'OPEN' : o.status,
            marketType: o.marketType,
            createdAt: o.createdAt,
            targetDate: o.targetDate,
            raw: o
        }));
        return bids;
    });
}

export function cancelOffer(id) {
    const base = getApiBase();
    return axios.put(`${base}/market/orders/${id}/cancel?side=OFFER`).then(res => res.data);
}

export function cancelBid(id) {
    const base = getApiBase();
    return axios.put(`${base}/market/orders/${id}/cancel?side=BID`).then(res => res.data);
}

export function triggerClearing() {
    const base = getApiBase();
    return axios.post(`${base}/market/trigger-clearing`).then(res => res.data);
}

/**
 * Create a new energy bid (POST /api/offers/bids)
 * @param {Object} bid - The bid data { buyerWalletId, kwh, ratePerKwh, marketType, targetDate }
 * @returns {Promise} Axios promise
 */
export function createBid(bid) {
    const base = getApiBase();
    return axios.post(`${base}/market/orders`, { side: 'BID', walletId: bid.buyerWalletId, kwh: bid.kwh, price: bid.ratePerKwh, marketType: bid.marketType, targetDate: bid.targetDate })
        .then(ress => ress)
        .catch(error => { console.error('createBid error:', error); throw error; });
}

export function sellToBid({ orderId, sellerWalletId, kwh, price } = {}) {
    const base = getApiBase();
    return axios.post(`${base}/market/sell-to-bid`, { orderId, sellerWalletId, kwh, price })
        .then(ress => ress)
        .catch(err => { console.error('sellToBid error:', err); throw err; });
}

function createOfferMarket(offer) {
    const base = getApiBase();
    return axios.post(`${base}/market/orders`, { side: 'OFFER', walletId: offer.sellerWalletId, kwh: offer.kwh, price: offer.ratePerKwh, marketType: offer.marketType, targetDate: offer.targetDate, sourceType: offer.sourceType, bypassLock: offer.bypassLock })
        .then(ress => ress)
        .catch(error => { console.error('createOffer error:', error); throw error; });
}

export { createOfferMarket as createOffer };