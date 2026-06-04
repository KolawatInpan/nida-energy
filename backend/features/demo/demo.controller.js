const { prisma } = require('../../utils/prisma');
const { autoExecuteTradingForBuilding } = require('../trading/trade.engine');
const { executeMarketClearing } = require('../trading/market.service');
const { syncBuildingEnergyForBuilding } = require('../energy/energyAggregation');

/**
 * DEMO: Run a full market cycle step-by-step and return results for visualization.
 * POST /api/demo/cycle
 */
async function runDemoCycle(req, res) {
    try {
        const steps = [];

        // Step 1: Generate mock energy for all buildings
        const buildings = await prisma.building.findMany({
            select: { name: true, email: true },
        });

        if (!buildings.length) {
            return res.json({ error: 'No buildings registered' });
        }

        steps.push({ step: 1, label: 'Generating mock energy', buildings: buildings.length });

        for (const b of buildings) {
            try {
                await syncBuildingEnergyForBuilding(b.name);
            } catch (e) {
                console.warn(`[demo cycle] syncEnergy failed for ${b.name}:`, e.message);
            }
        }

        // Step 2: Auto-trade for each building (creates offers/bids)
        steps.push({ step: 2, label: 'Running auto-trade engine', buildings: buildings.length });

        const tradeResults = [];
        for (const b of buildings) {
            try {
                const result = await autoExecuteTradingForBuilding(b.name);
                tradeResults.push({ building: b.name, ...result });
            } catch (e) {
                tradeResults.push({ building: b.name, acted: false, reason: e.message });
            }
        }
        steps.push({ step: 2.5, label: 'Auto-trade complete', trades: tradeResults });

        // Step 3: Run Day-Ahead clearing
        steps.push({ step: 3, label: 'Running market clearing' });

        let clearingResult = null;
        try {
            clearingResult = await executeMarketClearing(new Date());
            steps.push({ step: 4, label: 'Clearing complete', runId: clearingResult?.id });
        } catch (e) {
            steps.push({ step: 4, label: 'Clearing failed: ' + e.message });
        }

        // Step 5: Gather final state
        const offers = await prisma.marketOrder.findMany({
            where: { side: 'OFFER', status: { in: ['OPEN', 'PARTIAL', 'FILLED'] } },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        const bids = await prisma.marketOrder.findMany({
            where: { side: 'BID', status: { in: ['OPEN', 'PARTIAL', 'FILLED'] } },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        const matches = clearingResult?.id
            ? await prisma.marketMatch.findMany({ where: { runId: clearingResult.id }, take: 20 })
            : [];

        const recentTxns = await prisma.transaction.findMany({
            orderBy: { timestamp: 'desc' },
            take: 10,
        });

        const buildingStates = await Promise.all(buildings.map(async (b) => {
            const meters = await prisma.meterInfo.findMany({ where: { buildingName: b.name } });
            const wallet = await prisma.wallet.findUnique({ where: { email: b.email } });
            return {
                name: b.name,
                meters: meters.map(m => ({ snid: m.snid, type: m.type, value: Number(m.value || 0), kWH: Number(m.kWH || 0) })),
                wallet: wallet ? { balance: wallet.tokenBalance } : null,
            };
        }));

        res.json({
            success: true,
            cycle: steps,
            market: {
                offers: offers.map(o => ({ id: o.id, side: o.side, quantity: Number(o.quantity), price: Number(o.price || 0), status: o.status, building: o.buildingName })),
                bids: bids.map(o => ({ id: o.id, side: o.side, quantity: Number(o.quantity), price: Number(o.price || 0), status: o.status, building: o.buildingName })),
                matches: matches.map(m => ({ id: m.id, buyerId: m.buyerOrderId, sellerId: m.sellerOrderId, quantity: Number(m.quantity), price: Number(m.price) })),
                transactions: recentTxns.map(t => ({ txid: t.txid, type: t.type, amount: t.tokenAmount, building: t.buildingName })),
            },
            buildings: buildingStates,
            summary: {
                offersCreated: offers.length,
                bidsCreated: bids.length,
                matchesFound: matches.length,
                trades: tradeResults.filter(t => t.acted).length,
            },
        });
    } catch (err) {
        console.error('runDemoCycle error:', err);
        res.status(500).json({ error: err.message });
    }
}

module.exports = { runDemoCycle };
