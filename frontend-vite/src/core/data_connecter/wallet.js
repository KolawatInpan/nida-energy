import axios from 'axios';
import { getApiBase } from './apiBase';

function isRuntimeMock() {
    try {
        const v = localStorage.getItem('USE_MOCKUP');
        if (v !== null) return v === 'true';
    } catch (e) {
        // localStorage not available
    }
    return process.env.REACT_APP_MOCKUPMODE === 'true';
}

export function getWalletBalance(walletId) {
    if (isRuntimeMock()) {
        return Promise.resolve({ data: { walletId, balance: 0 } });
    } else {
        const base = getApiBase();
        return axios.get(`${base}/wallets/${walletId}/balance`)
            .then(ress => ress)
            .catch(err => { console.error('getWalletBalance error', err); return err; });
    }
}

/**
 * Get wallet by building ID.
 * @param {number} buildingId - Building ID
 */
export function getWalletByBuildingId(buildingId) {
    const base = getApiBase();
    return axios.get(`${base}/wallets/by-building/${encodeURIComponent(buildingId)}`)
        .then(ress => ress)
        .catch(err => { console.error('getWalletByBuildingId error', err); throw err; });
}

export function getWalletById(walletId) {
    const base = getApiBase();
    return axios.get(`${base}/wallets/${encodeURIComponent(walletId)}`)
        .then(ress => ress)
        .catch(err => { console.error('getWalletById error', err); throw err; });
}

/**
 * Top-up wallet by building ID.
 * @param {number} buildingId - Building ID
 * @param {number} amount - Token amount
 * @param {string} snid - Meter serial number (optional)
 */
export function topupWalletByBuildingId(buildingId, amount, snid) {
    const base = getApiBase();
    return axios.post(`${base}/wallets/by-building/${encodeURIComponent(buildingId)}/topup`, { amount, snid })
        .then(ress => ress)
        .catch(err => { console.error('topupWalletByBuildingId error', err); throw err; });
}

/**
 * Register a new wallet for a building.
 * @param {Object} params
 * @param {number} params.buildingId - Building ID
 */
export function registerWallet({ buildingId } = {}) {
    const base = getApiBase();
    return axios.post(`${base}/wallets/register`, { buildingId })
        .then(ress => ress)
        .catch(err => { console.error('registerWallet error', err); throw err; });
}

/**
 * Create Stripe payment intent (for building-based wallet top-up).
 * @param {number} buildingId - Building ID
 * @param {number} amount - Amount
 */
export function createStripePaymentIntent(buildingId, amount) {
    const base = getApiBase();
    return axios.post(`${base}/payments/create-payment-intent`, { buildingId, amount })
        .then(ress => ress)
        .catch(err => { console.error('createStripePaymentIntent error', err); throw err; });
}

export function getWalletTransactions(walletId) {
    const base = getApiBase();
    return axios.get(`${base}/wallets/${encodeURIComponent(walletId)}/transactions`)
        .then(ress => ress)
        .catch(err => { console.error('getWalletTransactions error', err); return err; });
}

export function recalculateWalletBalance(walletId) {
    const base = getApiBase();
    return axios.post(`${base}/wallets/${encodeURIComponent(walletId)}/recalculate-balance`)
        .then(ress => ress)
        .catch(err => { console.error('recalculateWalletBalance error', err); throw err; });
}
