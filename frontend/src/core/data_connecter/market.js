import axios from 'axios';

export function getOffers() {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    return axios.get(`${base}/offers`).then(res => res.data);
}

export function getBuildingByWalletId(walletId) {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    return axios.get(`${base}/offers/building/${walletId}`).then(res => res.data);
}