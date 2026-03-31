import axios from 'axios';

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
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        return axios.get(`${base}/wallets/${walletId}/balance`)
            .then(ress => ress)
            .catch(err => { console.error('getWalletBalance error', err); return err; });
    }
}

export function getWalletByEmail(email) {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    return axios.get(`${base}/wallets/by-email/${encodeURIComponent(email)}`)
        .then(ress => ress)
        .catch(err => { console.error('getWalletByEmail error', err); throw err; });
}

export function topupWalletByEmail(email, amount, snid) {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    return axios.post(`${base}/wallets/by-email/${encodeURIComponent(email)}/topup`, { amount, snid })
        .then(ress => ress)
        .catch(err => { console.error('topupWalletByEmail error', err); throw err; });
}

export function getWalletTransactions(walletId) {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    return axios.get(`${base}/wallets/${encodeURIComponent(walletId)}/transactions`)
        .then(ress => ress)
        .catch(err => { console.error('getWalletTransactions error', err); return err; });
}

export function recalculateWalletBalance(walletId) {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    return axios.post(`${base}/wallets/${encodeURIComponent(walletId)}/recalculate-balance`)
        .then(ress => ress)
        .catch(err => { console.error('recalculateWalletBalance error', err); throw err; });
}
