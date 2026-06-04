import axios from 'axios';
import { getApiBase } from './apiBase';

export async function getBuildings() {
    const base = getApiBase();
    const res = await axios.get(`${base}/buildings`);
    return res.data;
}
 
export async function getTotalMeters(buildingId) {
    const base = getApiBase();
    const res = await axios.get(`${base}/buildings/${buildingId}/meters/count`);
    return res.data?.totalMeters ?? 0;
}

export async function updateBuilding(buildingId, payload) {
    const base = getApiBase();
    const res = await axios.put(`${base}/buildings/${buildingId}`, payload);
    return res.data;
}

export async function deleteBuilding(buildingId, force = false) {
    const base = getApiBase();
    const params = force ? '?force=true' : '';
    const res = await axios.delete(`${base}/buildings/${buildingId}${params}`);
    return res.data;
}

export default { getBuildings, getTotalMeters, updateBuilding, deleteBuilding };

