import axios from 'axios';

const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');

export function getRecentBlockchainTransactions(limit = 50) {
    return axios.get(`${base}/transactions/blockchain/recent`, {
        params: { limit },
    })
        .then((res) => ({ success: true, data: res.data }))
        .catch((err) => {
            console.error('getRecentBlockchainTransactions error', err);
            return {
                success: false,
                error: err.response?.data?.error || err.message || 'Failed to load blockchain transactions',
                data: null,
            };
        });
}

export function getBlockchainTransactionByHash(txHash) {
    return axios.get(`${base}/transactions/blockchain/tx/${encodeURIComponent(txHash)}`)
        .then((res) => ({ success: true, data: res.data }))
        .catch((err) => {
            console.error('getBlockchainTransactionByHash error', err);
            return {
                success: false,
                error: err.response?.data?.error || err.message || 'Failed to load blockchain transaction',
                data: null,
            };
        });
}
