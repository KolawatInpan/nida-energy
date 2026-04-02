const invoiceService = require('./invoice.service');

function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function resolvePeriod({ month, year }) {
    const now = new Date();
    const resolvedMonth = Number(month || now.getMonth() + 1);
    const resolvedYear = Number(year || now.getFullYear());

    return { month: resolvedMonth, year: resolvedYear };
}

function resolveBuildingFilter(source = {}) {
    if (!source.buildingName || String(source.buildingName).trim() === '' || source.buildingName === 'all') {
        return null;
    }

    return String(source.buildingName).trim();
}

/**
 * Purchase energy from marketplace
 * Creates invoice and receipt after token transfer
 */
async function purchaseEnergy(req, res) {
    try {
        const result = await invoiceService.purchaseMarketplaceEnergy(req.body || {});
        res.status(201).json(result);
    } catch (err) {
        console.error('purchaseEnergy error:', err);
        res.status(err.status || 500).json({ error: err.message });
    }
}

async function generateInvoices(req, res) {
    try {
        const result = await invoiceService.generateMonthlyInvoices(req.body || {});
        res.status(201).json(result);
    } catch (err) {
        console.error('generateInvoices error:', err);
        res.status(500).json({ error: err.message });
    }
}

async function payInvoice(req, res) {
    try {
        const result = await invoiceService.payInvoiceById(req.params.id);
        res.json(result);
    } catch (err) {
        console.error('payInvoice error:', err);
        const payload = { error: err.message };
        if (err.invoice) payload.invoice = err.invoice;
        if (typeof err.required !== 'undefined') payload.required = err.required;
        if (typeof err.available !== 'undefined') payload.available = err.available;
        res.status(err.status || 500).json(payload);
    }
}

async function getInvoices(req, res) {
    try {
        await invoiceService.ensurePreviousMonthInvoiceIfDue();
        const { month, year, status } = req.query;
        const buildingName = resolveBuildingFilter(req.query);
        const invoices = await invoiceService.getInvoices({ month, year, status, buildingName });
        const enrichedInvoices = await invoiceService.attachInvoiceEnergyBreakdown(invoices);
        res.json(enrichedInvoices);
    } catch (err) {
        console.error('getInvoices error:', err);
        res.status(500).json({ error: err.message });
    }
}

async function getInvoiceById(req, res) {
    try {
        const invoice = await invoiceService.getInvoiceById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        const [enrichedInvoice] = await invoiceService.attachInvoiceEnergyBreakdown([invoice]);
        res.json(enrichedInvoice);
    } catch (err) {
        console.error('getInvoiceById error:', err);
        res.status(500).json({ error: err.message });
    }
}

async function getInvoiceSummary(req, res) {
    try {
        await invoiceService.ensurePreviousMonthInvoiceIfDue();
        const { month, year } = resolvePeriod(req.query);
        const buildingName = resolveBuildingFilter(req.query);
        const snapshot = await invoiceService.getInvoiceConsumptionSnapshot({ month, year, buildingName });
        const invoices = await invoiceService.getInvoices({ month, year, buildingName });

        const summary = invoices.reduce((acc, item) => {
            const amount = toNumber(item.tokenAmount);
            const consumedKwh = toNumber(item.consumedKwh ?? item.totalKwh);
            const marketPurchasedKwh = toNumber(item.marketPurchasedKwh);
            const billableKwh = toNumber(item.billableKwh ?? item.kWH);
            const status = (item.status || '').toLowerCase();

            acc.totalInvoices += 1;
            acc.totalConsumedKwh += consumedKwh;
            acc.totalMarketPurchasedKwh += marketPurchasedKwh;
            acc.totalBillableKwh += billableKwh;
            acc.totalAmount += amount;

            if (status === 'paid') acc.paidInvoices += 1;
            else acc.unpaidInvoices += 1;

            return acc;
        }, {
            totalInvoices: 0,
            paidInvoices: 0,
            unpaidInvoices: 0,
            totalConsumedKwh: 0,
            totalMarketPurchasedKwh: 0,
            totalBillableKwh: 0,
            totalAmount: 0,
        });

        res.json({
            month,
            year,
            buildingName,
            ratePerKwh: invoiceService.TOKEN_RATE_PER_KWH,
            snapshot,
            summary: {
                ...summary,
                totalConsumedKwh: Number(summary.totalConsumedKwh.toFixed(4)),
                totalMarketPurchasedKwh: Number(summary.totalMarketPurchasedKwh.toFixed(4)),
                totalBillableKwh: Number(summary.totalBillableKwh.toFixed(4)),
                totalAmount: Number(summary.totalAmount.toFixed(4)),
            },
        });
    } catch (err) {
        console.error('getInvoiceSummary error:', err);
        res.status(500).json({ error: err.message });
    }
}

async function getQuotaWarnings(req, res) {
    try {
        await invoiceService.ensurePreviousMonthInvoiceIfDue();
        const lookbackMonths = Number(req.query.lookbackMonths || 3);
        const result = await invoiceService.getQuotaWarnings({ lookbackMonths });
        res.json({
            lookbackMonths,
            ratePerKwh: invoiceService.TOKEN_RATE_PER_KWH,
            ...result,
        });
    } catch (err) {
        console.error('getQuotaWarnings error:', err);
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    purchaseEnergy,
    generateInvoices,
    payInvoice,
    getInvoices,
    getInvoiceById,
    getInvoiceSummary,
    getQuotaWarnings,
};


