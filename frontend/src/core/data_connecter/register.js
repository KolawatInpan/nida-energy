import axios from 'axios';

export async function registerUser(name, email, password, telNum) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.post(`${base}/users/register`, { name, email, password, telNum });
        return response.data;
    } catch (error) {
        console.error('Error registering user:', error);
        throw error;
    }
}

export async function getUsers() {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.get(`${base}/users`);
        return response.data;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

export async function getBuildings() {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.get(`${base}/buildings`);
        return response.data;
    } catch (error) {
        console.error('Error fetching buildings:', error);
        throw error;
    }
}

export async function getMeters() {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.get(`${base}/meters`);
        return response.data;
    } catch (error) {
        console.error('Error fetching meters:', error);
        throw error;
    }
}

export async function getMetersByBuilding(buildingId) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.get(`${base}/meters/building/${buildingId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching meters by building:', error);
        throw error;
    }
}

export async function getMeterBySnid(snid) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.get(`${base}/meters/snid/${snid}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching meter by snid:', error);
        throw error;
    }
}

export async function generateHourlyRunningMeter(snid, start, end, options = {}) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const payload = { snid, start, end };
        if (options.intervalHours) payload.intervalHours = options.intervalHours;
        if (options.valueProfile) payload.valueProfile = options.valueProfile;
        if (options.profileParams) payload.profileParams = options.profileParams;
        const response = await axios.post(`${base}/runningMeters/generate-hourly`, payload);
        return response.data;
    } catch (error) {
        console.error('Error generating running meter data:', error);
        throw error;
    }
}

export async function getHourlyEnergyByMeter(snid, date) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.get(`${base}/dashboard/hourly`, {
            params: {
                meterId: snid,
                ...(date ? { date } : {}),
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching hourly energy by meter:', error);
        throw error;
    }
}

export async function getDailyEnergyByMeter(snid, monthId, year) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.get(`${base}/dashboard/daily`, {
            params: {
                meterId: snid,
                ...(monthId ? { monthId } : {}),
                ...(year ? { year } : {}),
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching daily energy by meter:', error);
        throw error;
    }
}

export async function getWeeklyEnergyByMeter(snid, weekId) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.get(`${base}/dashboard/weekly`, {
            params: {
                meterId: snid,
                ...(weekId ? { weekId } : {}),
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching weekly energy by meter:', error);
        throw error;
    }
}

export async function getMonthlyEnergyByMeter(snid, year) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.get(`${base}/dashboard/monthly`, {
            params: {
                meterId: snid,
                ...(year ? { year } : {}),
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching monthly energy by meter:', error);
        throw error;
    }
}
export async function insertRunningLog(snid, timestamp, kW, kWH, txid = null) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const payload = { snid, timestamp };
        if (typeof kW !== 'undefined') payload.kW = kW;
        if (typeof kWH !== 'undefined') payload.kWH = kWH;
        if (typeof txid !== 'undefined' && txid !== null) payload.txid = txid;
        const response = await axios.post(`${base}/runningMeters/insert-log`, payload);
        return response.data;
    } catch (error) {
        console.error('Error inserting running log:', error);
        throw error;
    }
}
export async function registerBuilding(name, mapURL, addr, province, postalCode, email) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.post(`${base}/buildings/register`, { name, mapURL, address: addr, province, postalCode, email });
        return response.data;
    } catch (error) {
        console.error('Error registering building:', error);
        throw error;
    }
}

export async function registerMeter(buildingId, meterType, meterNumber, capacity, dateInstalled) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const payload = { buildingId, meterType, meterNumber };
        if (typeof capacity !== 'undefined') payload.capacity = capacity;
        if (typeof dateInstalled !== 'undefined' && dateInstalled !== '') payload.dateInstalled = dateInstalled;
        const response = await axios.post(`${base}/meters/register`, payload);
        return response.data;
    } catch (error) {
        console.error('Error registering meter:', error);
        throw error;
    }
}

export async function registerWallet(userId, email) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.post(`${base}/wallets/register`, { userId, email });
        return response.data;
    } catch (error) {
        console.error('Error registering wallet:', error);
        throw error;
    }
} 
