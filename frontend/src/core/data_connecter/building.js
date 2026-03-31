import axios from 'axios';

export async function getBuildings() {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    const res = await axios.get(`${base}/buildings`);
    return res.data;
}
 
export async function getTotalMeters(buildingId) {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    const res = await axios.get(`${base}/buildings/${buildingId}/meters/count`);
    return res.data?.totalMeters ?? 0;
}

export async function updateBuilding(buildingId, payload) {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    const res = await axios.put(`${base}/buildings/${buildingId}`, payload);
    return res.data;
}

export async function deleteBuilding(buildingId) {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    const res = await axios.delete(`${base}/buildings/${buildingId}`);
    return res.data;
}

export default { getBuildings, getTotalMeters, updateBuilding, deleteBuilding };

