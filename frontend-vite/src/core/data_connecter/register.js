import axios from 'axios';
import { getApiBase } from './apiBase';

/**
 * Check if a user exists in real DB, demo DB, or both.
 * Returns { email, real: {name, role}|null, demo: {name, role}|null }
 */
export async function checkUser(email) {
    const base = getApiBase();
    const response = await axios.post(`${base}/users/check-user`, { email });
    return response.data;
}

export async function requestOtpEmail(email) {
    try {
        const base = getApiBase();
        const response = await axios.post(`${base}/users/request-otp`, { email });
        return response.data;
    } catch (error) {
        console.error('Error requesting OTP:', error);
        throw error;
    }
}

export async function registerUser(name, email, password, telNum, otp, dataMode, bypassOtp = false) {
    try {
        const base = getApiBase();
        const config = { headers: {} };
        if (dataMode) config.headers['x-data-mode'] = dataMode;
        if (bypassOtp) config.headers['x-admin-bypass-otp'] = 'true';
        const response = await axios.post(`${base}/users/register`, { name, email, password, telNum, otp }, config);
        return response.data;
    } catch (error) {
        console.error('Error registering user:', error);
        throw error;
    }
}

export async function getUsers() {
    try {
        const base = getApiBase();
        const response = await axios.get(`${base}/users`);
        return response.data;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

export async function getBuildings(includeAll = false) {
    try {
        const base = getApiBase();
        const params = includeAll ? '?all=true' : '';
        const response = await axios.get(`${base}/buildings${params}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching buildings:', error);
        throw error;
    }
}

export async function getMeters() {
    try {
        const base = getApiBase();
        const response = await axios.get(`${base}/meters`);
        return response.data;
    } catch (error) {
        console.error('Error fetching meters:', error);
        throw error;
    }
}

export async function getMetersByBuilding(buildingId) {
    try {
        const base = getApiBase();
        const response = await axios.get(`${base}/meters/building/${buildingId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching meters by building:', error);
        throw error;
    }
}

export async function getMeterBySnid(snid) {
    try {
        const base = getApiBase();
        const response = await axios.get(`${base}/meters/snid/${snid}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching meter by snid:', error);
        throw error;
    }
}

export async function generateHourlyRunningMeter(snid, start, end, options = {}) {
    try {
        const base = getApiBase();
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
        const base = getApiBase();
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
        const base = getApiBase();
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
        const base = getApiBase();
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
        const base = getApiBase();
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

export async function getGaps({ meterId, date, from, to } = {}) {
    try {
        const base = getApiBase();
        const response = await axios.get(`${base}/dashboard/gaps`, {
            params: { meterId, date, from, to },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching gaps:', error);
        return [];
    }
}

export async function insertRunningLog(snid, timestamp, kW, kWH, txid = null) {
    try {
        const base = getApiBase();
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
export async function registerBuilding(name, mapURL, addr, province, postalCode, email, dataMode) {
    try {
        const base = getApiBase();
        const config = dataMode ? { headers: { 'x-data-mode': dataMode } } : {};
        const response = await axios.post(`${base}/buildings/register`, { name, mapURL, address: addr, province, postalCode, email }, config);
        return response.data;
    } catch (error) {
        console.error('Error registering building:', error);
        throw error;
    }
}

export async function registerMeter(buildingId, meterType, meterNumber, capacity, dateInstalled, dataMode) {
    try {
        const base = getApiBase();
        const payload = { buildingId, meterType, meterNumber };
        if (typeof capacity !== 'undefined') payload.capacity = capacity;
        if (typeof dateInstalled !== 'undefined' && dateInstalled !== '') payload.dateInstalled = dateInstalled;
        const config = dataMode ? { headers: { 'x-data-mode': dataMode } } : {};
        const response = await axios.post(`${base}/meters/register`, payload, config);
        return response.data;
    } catch (error) {
        console.error('Error registering meter:', error);
        throw error;
    }
}

export async function registerWallet(userId, email, dataMode) {
    try {
        const base = getApiBase();
        const config = dataMode ? { headers: { 'x-data-mode': dataMode } } : {};
        const response = await axios.post(`${base}/wallets/register`, { userId, email }, config);
        return response.data;
    } catch (error) {
        console.error('Error registering wallet:', error);
        throw error;
    }
}

/**
 * Admin Quick Register: User + Building + 3 Meters + Wallet in one call.
 * Bypasses OTP — only for admin use (no auth check on this endpoint itself).
 * @param {Object} data - Registration payload
 * @param {string} [dataMode] - Optional 'real' or 'demo' to target a specific database
 */
export async function adminQuickRegister(data, dataMode) {
    const base = getApiBase();
    const config = dataMode ? { headers: { 'x-data-mode': dataMode } } : {};
    return axios.post(`${base}/users/admin-quick-register`, data, config);
}
