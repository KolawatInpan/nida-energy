import axios from 'axios';
import { getApiBase } from './apiBase';

export async function getPolicy() {
    const base = getApiBase();
    const res = await axios.get(`${base}/settings/policy`);
    return res.data;
}

export async function updatePolicy(payload) {
    const base = getApiBase();
    const res = await axios.put(`${base}/settings/policy`, payload);
    return res.data;
}
