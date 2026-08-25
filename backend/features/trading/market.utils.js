const { prisma } = require('../../utils/prisma');
const { DEFAULT_ENERGY_RATE } = require('../rates/rate.helpers');

const TRADE_MODES = {
    SELF_CONSUME: 'SELF_CONSUME',
    MANUAL: 'MANUAL',
    AUTO_BATTERY_THRESHOLD: 'AUTO_BATTERY_THRESHOLD',
};

// Market timing and pricing constants
const DAY_AHEAD_LOCK_HOUR = 18;          // 18:00 — Day-Ahead submissions locked
const DAY_AHEAD_BASELINE = 3.5;          // baseline price for Day-Ahead
const DAY_AHEAD_BID_MIN = 3.50;          // minimum bid for Day-Ahead (≥ baseline)
const DAY_AHEAD_OFFER_MAX = 4.0;         // maximum offer for Day-Ahead (< grid price)
const INTRADAY_MIN_RATE = 3.85;          // IntraDay minimum (premium tier, below grid)
const INTRADAY_MAX_RATE = 4.0;           // IntraDay maximum (cannot exceed grid price)

// ---- Math helpers ----

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function roundTo4(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 10000) / 10000;
}

// ---- Trade mode helpers ----

function normalizeTradeMode(value) {
    const normalized = String(value || TRADE_MODES.AUTO_BATTERY_THRESHOLD).trim().toUpperCase();
    if (Object.values(TRADE_MODES).includes(normalized)) return normalized;
    return TRADE_MODES.AUTO_BATTERY_THRESHOLD;
}

// ---- Meter type detection ----

function isProduceMeter(type = '') {
    const normalized = String(type || '').toLowerCase();
    return normalized.includes('produce') || normalized.includes('producer') || normalized.includes('solar') || normalized.includes('pv');
}

function isConsumeMeter(type = '') {
    const normalized = String(type || '').toLowerCase();
    return normalized.includes('consume') || normalized.includes('consumer') || normalized.includes('smart meter') || normalized.includes('load');
}

function isBatteryMeter(type = '') {
    return String(type || '').toLowerCase().includes('battery');
}

function matchesSourceType(type = '', sourceType = 'produce') {
    const normalizedType = String(type || '').toLowerCase();
    const normalizedSourceType = String(sourceType || 'produce').toLowerCase();
    if (normalizedSourceType === 'battery') return normalizedType.includes('battery');
    if (normalizedSourceType === 'consume') return normalizedType.includes('consume') || normalizedType.includes('consumer') || normalizedType.includes('smart meter') || normalizedType.includes('load');
    return normalizedType.includes('produce') || normalizedType.includes('producer') || normalizedType.includes('solar') || normalizedType.includes('pv');
}

// ---- Market timing validators ----

function assertDayAheadMarketOpen(marketType, bypassKey) {
    const normalized = String(marketType || '').toUpperCase();
    if (normalized !== 'DAY_AHEAD') return;

    // Admin bypass: if bypassKey matches env var or default, skip lock check
    if (bypassKey) {
        const adminKey = process.env.ADMIN_BYPASS_KEY || 'admin123';
        if (String(bypassKey) === adminKey) return;
    }

    const now = new Date();
    if (now.getHours() >= DAY_AHEAD_LOCK_HOUR) {
        const e = new Error(`Day-Ahead market is locked after ${DAY_AHEAD_LOCK_HOUR}:00. Use IntraDay market or wait until 06:00 tomorrow.`);
        e.status = 400;
        throw e;
    }
}

function assertIntradayRate(marketType, ratePerKwh) {
    const normalized = String(marketType || '').toUpperCase();
    if (normalized !== 'INTRADAY') return;

    const rate = Number(ratePerKwh);
    if (!Number.isFinite(rate) || rate < INTRADAY_MIN_RATE) {
        const e = new Error(`IntraDay rate must be at least ฿${INTRADAY_MIN_RATE}/kWh. Day-Ahead is ฿${DAY_AHEAD_BASELINE}–฿${(DAY_AHEAD_OFFER_MAX - 0.01).toFixed(2)}/kWh.`);
        e.status = 400;
        throw e;
    }
    if (rate > INTRADAY_MAX_RATE) {
        const e = new Error(`IntraDay rate cannot exceed grid price (฿${INTRADAY_MAX_RATE}/kWh). Received: ${ratePerKwh}`);
        e.status = 400;
        throw e;
    }
}

function assertDayAheadBidMin(marketType, ratePerKwh) {
    const normalized = String(marketType || '').toUpperCase();
    if (normalized !== 'DAY_AHEAD') return;
    // null rate = market order (accept any), skip check
    if (ratePerKwh == null) return;

    const rate = Number(ratePerKwh);
    if (!Number.isFinite(rate) || rate < DAY_AHEAD_BID_MIN) {
        const e = new Error(`Day-Ahead bid must be at least ฿${DAY_AHEAD_BID_MIN}/kWh. Received: ${ratePerKwh}`);
        e.status = 400;
        throw e;
    }
}

function assertDayAheadOfferMax(marketType, ratePerKwh) {
    const normalized = String(marketType || '').toUpperCase();
    if (normalized !== 'DAY_AHEAD') return;
    if (ratePerKwh == null) return;

    const rate = Number(ratePerKwh);
    if (!Number.isFinite(rate) || rate >= DAY_AHEAD_OFFER_MAX) {
        const e = new Error(`Day-Ahead offer must be below ฿${DAY_AHEAD_OFFER_MAX}/kWh. Use IntraDay for higher rates (min ฿${INTRADAY_MIN_RATE}/kWh). Received: ${ratePerKwh}`);
        e.status = 400;
        throw e;
    }
}

// ---- Rate lookup ----

async function getLatestEnergyRatePrice() {
    try {
        // Check if table exists first to avoid pg_type duplicate key error
        const exists = await prisma.$queryRawUnsafe(`
            SELECT to_regclass('"EnergyRateRule"') IS NOT NULL AS exists
        `);
        if (!exists?.[0]?.exists) {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE "EnergyRateRule" (
                    id INTEGER PRIMARY KEY,
                    display_id TEXT UNIQUE NOT NULL,
                    rate_type TEXT NOT NULL,
                    price NUMERIC(12,4) NOT NULL,
                    effective_start DATE NOT NULL,
                    effective_end DATE NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            `);
        }
        const rows = await prisma.$queryRawUnsafe(`
            SELECT price FROM "EnergyRateRule"
            WHERE effective_end IS NULL OR effective_end >= CURRENT_DATE
            ORDER BY effective_start DESC, id DESC
            LIMIT 1
        `);
        const value = toNumber(rows?.[0]?.price);
        return value > 0 ? value : DEFAULT_ENERGY_RATE;
    } catch (err) {
        console.warn('getLatestEnergyRatePrice fallback to default:', err?.message || err);
        return DEFAULT_ENERGY_RATE;
    }
}

module.exports = {
    TRADE_MODES,
    DAY_AHEAD_LOCK_HOUR,
    DAY_AHEAD_BASELINE,
    DAY_AHEAD_BID_MIN,
    DAY_AHEAD_OFFER_MAX,
    INTRADAY_MIN_RATE,
    INTRADAY_MAX_RATE,
    toNumber,
    roundTo4,
    normalizeTradeMode,
    isProduceMeter,
    isConsumeMeter,
    isBatteryMeter,
    matchesSourceType,
    assertDayAheadMarketOpen,
    assertIntradayRate,
    assertDayAheadBidMin,
    assertDayAheadOfferMax,
    getLatestEnergyRatePrice,
};
