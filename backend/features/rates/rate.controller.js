const { prisma } = require('../../utils/prisma');
const { DEFAULT_ENERGY_RATE, DEFAULT_TOKEN_RATE, getDefaultRateConfig, normalizeRate } = require('./rate.helpers');

const ENERGY_TABLE_NAME = '"EnergyRateRule"';
const TOKEN_TABLE_NAME = '"TokenRateRule"';

async function ensureRateTable(tableName) {
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
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

async function ensureDefaultRateExists(tableName) {
    await ensureRateTable(tableName);

    const existingRows = await prisma.$queryRawUnsafe(`
        SELECT id
        FROM ${tableName}
        ORDER BY effective_start DESC, id DESC
        LIMIT 1
    `);

    if (Array.isArray(existingRows) && existingRows.length > 0) {
        return;
    }

    const defaultConfig = getDefaultRateConfig(tableName, TOKEN_TABLE_NAME);
    const today = new Date();
    const effectiveStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    await prisma.$transaction(async (tx) => {
        const nextRows = await tx.$queryRawUnsafe(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ${tableName}`);
        const nextId = Number(nextRows?.[0]?.next_id || 1);
        const displayId = `RATE-${String(nextId).padStart(3, '0')}`;

        await tx.$queryRawUnsafe(`
            INSERT INTO ${tableName} (
                id, display_id, rate_type, price, effective_start, effective_end, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5::date, NULL, NOW(), NOW()
            )
        `, nextId, displayId, defaultConfig.rateType, defaultConfig.price, effectiveStart);
    });
}

async function listRatesFromTable(tableName, req, res) {
    try {
        await ensureDefaultRateExists(tableName);
        const rows = await prisma.$queryRawUnsafe(`
            SELECT id, display_id, rate_type, price, effective_start, effective_end, created_at, updated_at
            FROM ${tableName}
            ORDER BY effective_start DESC, id DESC
        `);

        res.json(rows.map(normalizeRate));
    } catch (err) {
        console.error(`listRatesFromTable(${tableName}) error:`, err);
        res.status(500).json({ error: err.message });
    }
}

async function createRateInTable(tableName, req, res) {
    try {
        await ensureRateTable(tableName);
        const { rateType, price, effectiveStart, effectiveEnd } = req.body || {};

        if (!rateType || price == null || !effectiveStart) {
            return res.status(400).json({ error: 'rateType, price and effectiveStart are required' });
        }

        const numericPrice = Number(price);
        if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
            return res.status(400).json({ error: 'price must be a positive number' });
        }

        if (effectiveEnd && new Date(effectiveEnd) < new Date(effectiveStart)) {
            return res.status(400).json({ error: 'effectiveEnd must be greater than or equal to effectiveStart' });
        }

        const created = await prisma.$transaction(async (tx) => {
            const nextRows = await tx.$queryRawUnsafe(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ${tableName}`);
            const nextId = Number(nextRows?.[0]?.next_id || 1);
            const displayId = `RATE-${String(nextId).padStart(3, '0')}`;

            const rows = await tx.$queryRawUnsafe(`
                INSERT INTO ${tableName} (
                    id, display_id, rate_type, price, effective_start, effective_end, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5::date, $6::date, NOW(), NOW()
                )
                RETURNING id, display_id, rate_type, price, effective_start, effective_end, created_at, updated_at
            `, nextId, displayId, String(rateType), numericPrice, effectiveStart, effectiveEnd || null);

            return rows?.[0];
        });

        res.status(201).json(normalizeRate(created));
    } catch (err) {
        console.error(`createRateInTable(${tableName}) error:`, err);
        res.status(500).json({ error: err.message });
    }
}

async function listEnergyRates(req, res) {
    return listRatesFromTable(ENERGY_TABLE_NAME, req, res);
}

async function createEnergyRate(req, res) {
    return createRateInTable(ENERGY_TABLE_NAME, req, res);
}

async function listTokenRates(req, res) {
    return listRatesFromTable(TOKEN_TABLE_NAME, req, res);
}

async function createTokenRate(req, res) {
    return createRateInTable(TOKEN_TABLE_NAME, req, res);
}

module.exports = {
    createTokenRate,
    listTokenRates,
    createEnergyRate,
    listEnergyRates,
};


