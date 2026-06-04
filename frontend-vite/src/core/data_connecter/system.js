import axios from 'axios';
import { getApiBase } from './apiBase';

const getBaseApi = () => getApiBase();

export async function resetDatabase(payload = {}) {
    const res = await axios.post(`${getBaseApi()}/system/reset-database`, payload);
    return res.data;
}

export default { resetDatabase };
