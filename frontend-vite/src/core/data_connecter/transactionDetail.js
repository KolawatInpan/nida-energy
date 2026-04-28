import axios from 'axios';

const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');

export function getTransactionById(txid) {
    return axios.get(`${base}/transactions/${txid}`)
        .then(res => {
            return { status: 200, data: res.data, success: true };
        })
        .catch(err => {
            console.error('getTransactionById error', err);
            const status = err.response?.status || 500;
            const message = err.response?.data?.error || err.message || 'Unknown error';
            return { status, data: null, error: message, success: false };
        });
}

export function verifyTransaction(txid, options = {}) {
    const params = options.force ? { force: true } : undefined;
    return axios.post(`${base}/transactions/${txid}/verify`, {}, { params })
        .then(res => {
            return { status: res.status, data: res.data, success: true };
        })
        .catch(err => {
            console.error('verifyTransaction error', err);
            const status = err.response?.status || 500;
            const message = err.response?.data?.error || err.message || 'Unknown error';
            return { status, data: null, error: message, success: false };
        });
}

export function getTransactionVerificationPreview(txid) {
    return axios.get(`${base}/transactions/${txid}/verification-preview`)
        .then(res => {
            return { status: res.status, data: res.data, success: true };
        })
        .catch(err => {
            console.error('getTransactionVerificationPreview error', err);
            const status = err.response?.status || 500;
            const message = err.response?.data?.error || err.message || 'Unknown error';
            return { status, data: null, error: message, success: false };
        });
}
