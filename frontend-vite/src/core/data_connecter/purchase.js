import axios from 'axios';
import { getApiBase } from './apiBase';

/**
 * Purchase energy from marketplace (POST /api/invoices/purchase)
 * Creates invoice and receipt
 * @param {Object} purchase - The purchase data { offerId, buyerWalletId, targetBuildingId, amount }
 * @returns {Promise} Axios promise
 */
export function purchaseEnergy(purchase) {
    const apiBase = getApiBase();
    const res = axios.post(apiBase + "/invoices/purchase", purchase)
        .then(ress => {
            console.log('purchaseEnergy response:', ress);
            return ress;
        })
        .catch(error => {
            console.error('purchaseEnergy error:', error);
            throw error;
        });
    return res;
}
