import axios from 'axios';

const getBaseApi = () => (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');

export async function resetDatabase(payload = {}) {
    const res = await axios.post(`${getBaseApi()}/system/reset-database`, payload);
    return res.data;
}

export default { resetDatabase };
