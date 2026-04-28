// แจ้งเตือน invoice ใหม่
async function notifyInvoice({ userId, invoiceId, amount, buildingId }) {
    try {
        const { createNotification } = require('../notification/notification.service');
        await createNotification({
            type: 'invoice',
            message: `มีใบแจ้งหนี้ใหม่ จำนวน ${amount} บาท (Invoice: ${invoiceId})`,
            userId,
            buildingId
        });
    } catch (e) { console.error('Notification error:', e.message); }
}
const { prisma } = require('../../utils/prisma');
const { randomUUID } = require('crypto');

const TOKEN_RATE_PER_KWH = 1;
const SYSTEM_WALLET_ID = 'SYSTEM';

function toNumber(value) {
    if (value == null) return 0;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function toStartOfMonth(year, month) {
    return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
}

function getRecentPeriods(lookbackMonths = 3, now = new Date()) {
    const count = Math.max(1, Number(lookbackMonths) || 3);
    const periods = [];

    for (let offset = 0; offset < count; offset += 1) {
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
        periods.push({
            year: date.getUTCFullYear(),
            month: date.getUTCMonth() + 1,
        });
    }

    return periods;
}

function extractDayValue(row, day) {
    return toNumber(row[`d${day}`]);
}

function normalizeInvoice(invoice) {
    if (!invoice) return invoice;

    return {
        ...invoice,
        kWH: toNumber(invoice.kWH),
        tokenAmount: toNumber(invoice.tokenAmount),
        dailyAvg: toNumber(invoice.dailyAvg),
        peakkWH: toNumber(invoice.peakkWH),
        receipt: invoice.receipt || null,
    };
}

async function getMarketplacePurchaseSnapshot({ year, month, buildingName }) {
    const selectedYear = Number(year);
    const selectedMonth = Number(month);

    const purchaseInvoices = await prisma.invoice.findMany({
        where: {
            year: selectedYear,
            month: selectedMonth,
            fromWId: {
                not: SYSTEM_WALLET_ID,
            },
            ...(buildingName ? { buildingName: String(buildingName) } : {}),
        },
        select: {
            buildingName: true,
            kWH: true,
        },
    });

    const purchasedByBuilding = new Map();

    purchaseInvoices.forEach((invoice) => {
        const key = String(invoice.buildingName || '').trim();
        if (!key) return;

        const current = purchasedByBuilding.get(key) || 0;
        purchasedByBuilding.set(key, current + toNumber(invoice.kWH));
    });

    return purchasedByBuilding;
}

async function getInvoices(filter = {}) {
    const where = {};

    if (filter.year) where.year = Number(filter.year);
    if (filter.month) where.month = Number(filter.month);
    if (filter.status) where.status = String(filter.status).toLowerCase();
    if (filter.buildingName) where.buildingName = String(filter.buildingName);

    const invoices = await prisma.invoice.findMany({
        where,
        include: {
            receipt: true,
        },
        orderBy: [
            { year: 'desc' },
            { month: 'desc' },
            { timestamp: 'desc' },
            { buildingName: 'asc' },
        ],
    });

    return invoices.map(normalizeInvoice);
}

async function getInvoiceById(id) {
    const invoice = await prisma.invoice.findUnique({
        where: { id: String(id) },
        include: {
            receipt: true,
        },
    });

    return normalizeInvoice(invoice);
}

async function getInvoiceConsumptionSnapshot({ year, month, buildingName }) {
    const selectedYear = Number(year);
    const selectedMonth = Number(month);
    const marketPurchasedByBuilding = await getMarketplacePurchaseSnapshot({
        year: selectedYear,
        month: selectedMonth,
        buildingName,
    });

    const dailyRows = await prisma.dailyEnergy.findMany({
        where: {
            year: selectedYear,
            month: selectedMonth,
            meter: {
                type: {
                    contains: 'consume',
                    mode: 'insensitive',
                },
                ...(buildingName ? { buildingName: String(buildingName) } : {}),
            },
        },
        include: {
            meter: true,
        },
    });

    const buildingStats = new Map();

    for (const row of dailyRows) {
        const buildingName = row?.meter?.buildingName;
        if (!buildingName) continue;

        const current = buildingStats.get(buildingName) || {
            buildingName,
            totalKwh: 0,
            peakDate: null,
            peakKwh: 0,
            activeDays: new Set(),
        };

        current.totalKwh += toNumber(row.kWH);
        for (let day = 1; day <= 31; day += 1) {
            const dayValue = extractDayValue(row, day);
            if (dayValue <= 0) continue;

            current.activeDays.add(day);
            current.peakKwh = Math.max(current.peakKwh, dayValue);

            if (current.peakKwh === dayValue) {
                current.peakDate = new Date(Date.UTC(selectedYear, selectedMonth - 1, day));
            }
        }

        buildingStats.set(buildingName, current);
    }

    return Array.from(buildingStats.values())
        .filter((item) => item.totalKwh > 0)
        .map((item) => {
            const marketPurchasedKwh = toNumber(marketPurchasedByBuilding.get(item.buildingName));
            const billableKwh = Math.max(item.totalKwh - marketPurchasedKwh, 0);

            return {
                buildingName: item.buildingName,
                totalKwh: Number(item.totalKwh.toFixed(4)),
                consumedKwh: Number(item.totalKwh.toFixed(4)),
                marketPurchasedKwh: Number(marketPurchasedKwh.toFixed(4)),
                billableKwh: Number(billableKwh.toFixed(4)),
                dailyAvg: Number((item.activeDays.size > 0 ? item.totalKwh / item.activeDays.size : item.totalKwh).toFixed(4)),
                peakDate: item.peakDate,
                peakKwh: Number(item.peakKwh.toFixed(4)),
                tokenAmount: Number((billableKwh * TOKEN_RATE_PER_KWH).toFixed(4)),
            };
        })
        .sort((a, b) => a.buildingName.localeCompare(b.buildingName));
}

async function attachInvoiceEnergyBreakdown(invoices = []) {
    if (!Array.isArray(invoices) || !invoices.length) {
        return [];
    }

    const periods = new Map();
    invoices.forEach((invoice) => {
        const year = Number(invoice.year);
        const month = Number(invoice.month);
        if (!year || !month) return;

        const key = `${year}-${month}`;
        if (!periods.has(key)) {
            periods.set(key, { year, month });
        }
    });

    const snapshotMaps = new Map();

    for (const [key, period] of periods.entries()) {
        const snapshot = await getInvoiceConsumptionSnapshot(period);
        snapshotMaps.set(
            key,
            new Map(snapshot.map((item) => [item.buildingName, item])),
        );
    }

    return invoices.map((invoice) => {
        const key = `${Number(invoice.year)}-${Number(invoice.month)}`;
        const snapshotByBuilding = snapshotMaps.get(key) || new Map();
        const snapshot = snapshotByBuilding.get(invoice.buildingName);

        const consumedKwh = toNumber(snapshot?.consumedKwh || invoice.kWH);
        const marketPurchasedKwh = toNumber(snapshot?.marketPurchasedKwh);
        const billableKwh = snapshot
            ? toNumber(snapshot.billableKwh)
            : Math.max(consumedKwh - marketPurchasedKwh, 0);

        return {
            ...invoice,
            consumedKwh: Number(consumedKwh.toFixed(4)),
            marketPurchasedKwh: Number(marketPurchasedKwh.toFixed(4)),
            billableKwh: Number(billableKwh.toFixed(4)),
        };
    });
}

async function createMonthlyInvoices({ year, month, buildingName }) {
    const selectedYear = Number(year);
    const selectedMonth = Number(month);
    const consumptionRows = await getInvoiceConsumptionSnapshot({
        year: selectedYear,
        month: selectedMonth,
        buildingName,
    });

    if (!consumptionRows.length) {
        return {
            created: [],
            existing: [],
            skipped: [],
        };
    }

    const buildings = await prisma.building.findMany({
        where: {
            name: {
                in: consumptionRows.map((item) => item.buildingName),
            },
        },
    });

    const wallets = await prisma.wallet.findMany({
        where: {
            id: {
                in: buildings.map((building) => String(building.id)),
            },
        },
    });

    const buildingByName = new Map(buildings.map((building) => [building.name, building]));
    const walletByBuildingId = new Map(wallets.map((wallet) => [String(wallet.id), wallet]));

    const existingInvoices = await prisma.invoice.findMany({
        where: {
            year: selectedYear,
            month: selectedMonth,
            fromWId: SYSTEM_WALLET_ID,
            buildingName: {
                in: consumptionRows.map((item) => item.buildingName),
            },
        },
        include: {
            receipt: true,
        },
    });

    const existingByBuilding = new Map(existingInvoices.map((invoice) => [invoice.buildingName, invoice]));
    const created = [];
    const updated = [];
    const existing = [];
    const skipped = [];

    for (const item of consumptionRows) {
        const building = buildingByName.get(item.buildingName);
        const wallet = building ? walletByBuildingId.get(String(building.id)) : null;

        if (!building || !wallet) {
            skipped.push({
                buildingName: item.buildingName,
                reason: 'Wallet not found for building',
            });
            continue;
        }

        const invoiceData = {
            buildingName: item.buildingName,
            fromWId: SYSTEM_WALLET_ID,
            toWId: String(wallet.id),
            timestamp: toStartOfMonth(selectedYear, selectedMonth),
            kWH: item.billableKwh,
            tokenAmount: item.tokenAmount,
            month: selectedMonth,
            year: selectedYear,
            dailyAvg: item.dailyAvg,
            peakDate: item.peakDate,
            peakkWH: item.peakKwh,
        };

        const existingInvoice = existingByBuilding.get(item.buildingName);

        if (existingInvoice) {
            const existingStatus = String(existingInvoice.status || '').toLowerCase();

            if (existingStatus === 'paid') {
                existing.push(normalizeInvoice(existingInvoice));
                continue;
            }

            const invoice = await prisma.invoice.update({
                where: { id: String(existingInvoice.id) },
                data: {
                    ...invoiceData,
                    status: existingInvoice.status || 'unpaid',
                },
                include: {
                    receipt: true,
                },
            });

            updated.push(normalizeInvoice(invoice));
            continue;
        }

        const invoice = await prisma.invoice.create({
            data: {
                id: randomUUID(),
                ...invoiceData,
                status: 'unpaid',
            },
            include: {
                receipt: true,
            },
        });

        created.push(normalizeInvoice(invoice));
    }

    return {
        created,
        updated,
        existing,
        skipped,
    };
}

async function markInvoicePaid({ invoiceId }) {
    const invoice = await prisma.invoice.update({
        where: { id: String(invoiceId) },
        data: {
            status: 'paid',
        },
        include: {
            receipt: true,
        },
    });

    return normalizeInvoice(invoice);
}

async function getQuotaWarnings({ lookbackMonths = 3 } = {}) {
    const buildings = await prisma.building.findMany({
        orderBy: { name: 'asc' },
    });

    if (!buildings.length) {
        return {
            periods: getRecentPeriods(lookbackMonths),
            summary: {
                totalBuildings: 0,
                totalWarnings: 0,
                criticalCount: 0,
                warningCount: 0,
                healthyCount: 0,
            },
            items: [],
        };
    }

    const periods = getRecentPeriods(lookbackMonths);
    const snapshots = await Promise.all(
        periods.map((period) => getInvoiceConsumptionSnapshot(period)),
    );

    const monthlyUsageByBuilding = new Map();
    snapshots.forEach((rows) => {
        rows.forEach((row) => {
            const current = monthlyUsageByBuilding.get(row.buildingName) || [];
            current.push(toNumber(row.totalKwh));
            monthlyUsageByBuilding.set(row.buildingName, current);
        });
    });

    const wallets = await prisma.wallet.findMany({
        where: {
            OR: [
                { id: { in: buildings.map((building) => String(building.id)) } },
                { email: { in: buildings.map((building) => String(building.email || '')).filter(Boolean) } },
            ],
        },
    });

    const walletById = new Map(wallets.map((wallet) => [String(wallet.id), wallet]));
    const walletByEmail = new Map(wallets.map((wallet) => [String(wallet.email || ''), wallet]));

    const lastInvoices = await prisma.invoice.findMany({
        where: {
            buildingName: {
                in: buildings.map((building) => building.name),
            },
        },
        orderBy: [
            { year: 'desc' },
            { month: 'desc' },
            { timestamp: 'desc' },
        ],
    });

    const latestInvoiceByBuilding = new Map();
    lastInvoices.forEach((invoice) => {
        if (!latestInvoiceByBuilding.has(invoice.buildingName)) {
            latestInvoiceByBuilding.set(invoice.buildingName, invoice);
        }
    });

    const items = buildings.map((building) => {
        const usageHistory = monthlyUsageByBuilding.get(building.name) || [];
        const avgMonthlyUsage = usageHistory.length
            ? usageHistory.reduce((sum, value) => sum + toNumber(value), 0) / usageHistory.length
            : 0;
        const expectedTokenCost = avgMonthlyUsage * TOKEN_RATE_PER_KWH;
        const wallet = walletById.get(String(building.id)) || walletByEmail.get(String(building.email || '')) || null;
        const walletBalance = toNumber(wallet?.tokenBalance);
        const lastInvoice = latestInvoiceByBuilding.get(building.name) || null;
        const coverageRatio = expectedTokenCost > 0 ? walletBalance / expectedTokenCost : 1;
        const coveragePercent = expectedTokenCost > 0 ? Math.min(999, coverageRatio * 100) : 100;
        const estimatedDailyUsage = avgMonthlyUsage > 0 ? avgMonthlyUsage / 30 : 0;
        const rawDaysUntilEmpty = estimatedDailyUsage > 0 ? walletBalance / estimatedDailyUsage : null;
        const daysUntilEmpty = rawDaysUntilEmpty == null ? null : Math.max(0, Math.floor(rawDaysUntilEmpty));

        let level = 'healthy';
        if (expectedTokenCost > 0 && coverageRatio < 0.2) level = 'critical';
        else if (expectedTokenCost > 0 && coverageRatio < 0.5) level = 'warning';
        else if (expectedTokenCost > 0 && coverageRatio < 1) level = 'moderate';

        return {
            buildingId: building.id,
            buildingName: building.name,
            address: building.address,
            province: building.province,
            postal: building.postal,
            contact: building.email,
            walletId: wallet?.id || null,
            walletBalance: Number(walletBalance.toFixed(4)),
            avgMonthlyUsage: Number(avgMonthlyUsage.toFixed(4)),
            expectedTokenCost: Number(expectedTokenCost.toFixed(4)),
            requiredToken: Number(expectedTokenCost.toFixed(4)),
            shortfallToken: Number(Math.max(expectedTokenCost - walletBalance, 0).toFixed(4)),
            coveragePercent: Number(coveragePercent.toFixed(2)),
            daysUntilEmpty,
            level,
            status: walletBalance < expectedTokenCost ? 'warning' : 'ok',
            lastInvoice: lastInvoice ? normalizeInvoice(lastInvoice) : null,
            usageHistory: usageHistory.map((value) => Number(toNumber(value).toFixed(4))),
        };
    });

    const summary = items.reduce((acc, item) => {
        acc.totalBuildings += 1;
        if (item.level === 'critical') acc.criticalCount += 1;
        if (item.level === 'warning') acc.warningCount += 1;
        if (item.level === 'healthy') acc.healthyCount += 1;
        if (item.status === 'warning') acc.totalWarnings += 1;
        return acc;
    }, {
        totalBuildings: 0,
        totalWarnings: 0,
        criticalCount: 0,
        warningCount: 0,
        healthyCount: 0,
    });

    return {
        periods,
        summary,
        items,
    };
}

module.exports = {
    TOKEN_RATE_PER_KWH,
    SYSTEM_WALLET_ID,
    getInvoices,
    getInvoiceById,
    getMarketplacePurchaseSnapshot,
    getInvoiceConsumptionSnapshot,
    attachInvoiceEnergyBreakdown,
    createMonthlyInvoices,
    markInvoicePaid,
    getQuotaWarnings,
};


