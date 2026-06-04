import axios from 'axios';
import { getApiBase } from './apiBase';

export async function getMeters() {
    const base = getApiBase();
    const res = await axios.get(`${base}/meters`);
    return res.data;
}

export const getPendingMeters = async () => {
    const base = getApiBase();
    const res = await axios.get(`${base}/meters/pending`);
    return res.data;
}

export const getUserFromBuilding = async (buildingId) => {
    const base = getApiBase();
    const res = await axios.get(`${base}/users/building/id/${buildingId}`);
    return res.data;
}

export const updateMeter = async (snid, payload) => {
    const base = getApiBase();
    const res = await axios.put(`${base}/meters/snid/${encodeURIComponent(snid)}`, payload);
    return res.data;
}

export const deleteMeter = async (snid, force = false) => {
    const base = getApiBase();
    const params = force ? '?force=true' : '';
    const res = await axios.delete(`${base}/meters/snid/${encodeURIComponent(snid)}${params}`);
    return res.data;
}
