import axios from 'axios';

export async function getMeters() {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    const res = await axios.get(`${base}/meters`);
    return res.data;
}

export const getPendingMeters = async () => {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    const res = await axios.get(`${base}/meters/pending`);
    return res.data;
}

export const getUserFromBuilding = async (buildingId) => {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    const res = await axios.get(`${base}/users/building/id/${buildingId}`);
    return res.data;
}

export const updateMeter = async (snid, payload) => {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    const res = await axios.put(`${base}/meters/snid/${encodeURIComponent(snid)}`, payload);
    return res.data;
}

export const deleteMeter = async (snid) => {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    const res = await axios.delete(`${base}/meters/snid/${encodeURIComponent(snid)}`);
    return res.data;
}
