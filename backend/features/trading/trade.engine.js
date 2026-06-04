const { prisma } = require('../../utils/prisma');
const {
    toNumber, roundTo4, normalizeTradeMode,
    isProduceMeter, isConsumeMeter, isBatteryMeter,
    getLatestEnergyRatePrice, TRADE_MODES,
} = require('./market.utils');
const { createOffer, createBid } = require('./offer.repository');

/**
 * Auto-post surplus offer for a building (called by scheduler).
 * Handles both Solar surplus (split by solarSelfPercent) and Battery surplus (above threshold).
 */
async function autoPostBatterySurplusOffer(buildingName) {
    if (!buildingName) return { created: null, reason: 'missing-building' };

    const building = await prisma.building.findUnique({
        where: { name: String(buildingName) },
        select: {
            name: true, email: true, tradeMode: true,
            solarTradeMode: true, batteryTradeMode: true,
            solarSelfPercent: true, batterySellThreshold: true,
            solarOfferPrice: true, batteryOfferPrice: true, batteryBidPrice: true,
        },
    });
    if (!building) return { created: null, reason: 'building-not-found' };

    const solarMode = normalizeTradeMode(building.solarTradeMode || building.tradeMode);
    const batteryMode = normalizeTradeMode(building.batteryTradeMode || building.tradeMode);

    const meterRows = await prisma.meterInfo.findMany({
        where: { buildingName: building.name },
        select: { snid: true, type: true, value: true, kWH: true, capacity: true },
    });

    const produceMeters = meterRows.filter((m) => isProduceMeter(m.type));
    const batteryMeter = meterRows.find((m) => isBatteryMeter(m.type));
    const produced = produceMeters.reduce((sum, m) => sum + Math.max(toNumber(m.value), toNumber(m.kWH)), 0);
    const batteryCurrent = batteryMeter ? Math.max(toNumber(batteryMeter.value), toNumber(batteryMeter.kWH)) : 0;
    const batteryCapacity = batteryMeter ? toNumber(batteryMeter.capacity) : 0;

    const wallet = await prisma.wallet.findFirst({ where: { email: String(building.email || '') }, select: { id: true } });
    if (!wallet?.id) return { created: null, reason: 'seller-wallet-not-found' };

    // ---- Track results from both solar and battery checks ----
    let createdOffer = null;
    let batteryOffersCreated = 0;
    let solarAutoApplicable = (produceMeters.length > 0 && solarMode === TRADE_MODES.AUTO_BATTERY_THRESHOLD);
    let batteryAutoApplicable = (batteryMeter && batteryCapacity > 0 && batteryMode === TRADE_MODES.AUTO_BATTERY_THRESHOLD);

    // ---- Solar auto-sell ----
    if (solarAutoApplicable && produced > 0) {
        const pct = Number(building.solarSelfPercent != null ? building.solarSelfPercent : 80);
        let sellableKwh = roundTo4(produced * ((100 - pct) / 100));

        if (batteryMeter && batteryMode === TRADE_MODES.SELF_CONSUME && sellableKwh > 0 && batteryCapacity > 0) {
            const free = Math.max(0, batteryCapacity - batteryCurrent);
            const charge = Math.min(sellableKwh, free);
            if (charge > 0) {
                await prisma.meterInfo.update({ where: { snid: batteryMeter.snid }, data: { value: batteryCurrent + charge, kWH: batteryCurrent + charge, timestamp: new Date() } });
                sellableKwh = roundTo4(sellableKwh - charge);
            }
        }

        if (sellableKwh >= 0.01) {
            const rate = toNumber(building.solarOfferPrice) > 0 ? toNumber(building.solarOfferPrice) : await getLatestEnergyRatePrice();
            createdOffer = await createOffer({ sellerWalletId: wallet.id, kwh: sellableKwh, ratePerKwh: rate, sourceType: 'produce', trigger: 'auto', marketType: 'INTRADAY' });
            try {
                await prisma.marketOrder.create({ data: { side: 'OFFER', marketType: 'INTRADAY', walletId: String(wallet.id), buildingName: building.name, quantity: Number(sellableKwh), price: Number(rate), status: 'OPEN', metadata: { sourceType: 'produce', trigger: 'auto', energyOfferId: createdOffer?.id } } });
            } catch (moErr) { console.warn('autoPostBatterySurplusOffer: failed to create MarketOrder for solar', moErr.message || moErr); }
        }
    }

    // ---- Battery auto-sell ----
    if (batteryAutoApplicable) {
        const thresholdPct = Math.min(100, Math.max(0, toNumber(building.batterySellThreshold != null ? building.batterySellThreshold : 80)));
        const thresholdKwh = (batteryCapacity * thresholdPct) / 100;
        let sellableKwh = roundTo4(Math.max(0, batteryCurrent - thresholdKwh));

        // Dedup: skip if there's already an active battery offer from this wallet
        if (sellableKwh >= 0.01) {
            const existingOffer = await prisma.marketOrder.findFirst({
                where: { side: 'OFFER', walletId: String(wallet.id), status: 'OPEN', metadata: { path: ['sourceType'], equals: 'battery' } },
            });
            if (existingOffer) {
                return { created: null, reason: 'battery-offer-already-exists', debug: { existingOfferId: existingOffer.id } };
            }
        }

        // Calculate average daily consumption to use as batch size for splitting offers
        let batchSize = 0;
        if (sellableKwh >= 0.01) {
            try {
                const consumeSnids = meterRows.filter((m) => isConsumeMeter(m.type)).map((m) => m.snid);
                if (consumeSnids.length > 0) {
                    const now = new Date();
                    const monthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1); // 3 months back
                    const rows = await prisma.$queryRawUnsafe(`
                        SELECT COALESCE(SUM(de."kwh"), 0) as total_kwh
                        FROM "DailyEnergy" de
                        WHERE de."meterSnid" = ANY($1)
                          AND (de."year" > $2 OR (de."year" = $2 AND de."month" >= $3))
                    `, consumeSnids, monthStart.getFullYear(), monthStart.getMonth() + 1);
                    const totalConsumed = Number(rows?.[0]?.total_kwh || 0);
                    const daysRange = Math.max(1, Math.round((now.getTime() - monthStart.getTime()) / 86400000));
                    batchSize = roundTo4(totalConsumed / daysRange);
                }
            } catch (e) {
                console.warn('autoPostBatterySurplusOffer: failed to calc avg consumption', e.message || e);
            }
        }

        // Split surplus into multiple offers, each capped at batchSize (avg daily consumption)
        if (sellableKwh >= 0.01) {
            const rate = toNumber(building.batteryOfferPrice) > 0 ? toNumber(building.batteryOfferPrice) : await getLatestEnergyRatePrice();
            const effectiveBatchSize = Math.max(1, batchSize >= 0.01 ? batchSize : sellableKwh);
            let remaining = sellableKwh;
            batteryOffersCreated = 0;
            const maxOffers = 10;

            while (remaining >= 0.01 && batteryOffersCreated < maxOffers) {
                const offerKwh = roundTo4(Math.min(remaining, effectiveBatchSize));
                if (offerKwh < 0.01) break;
                const created = await createOffer({ sellerWalletId: wallet.id, kwh: offerKwh, ratePerKwh: rate, sourceType: 'battery', trigger: 'auto', marketType: 'INTRADAY' });
                try {
                    await prisma.marketOrder.create({ data: { side: 'OFFER', marketType: 'INTRADAY', walletId: String(wallet.id), buildingName: building.name, quantity: Number(offerKwh), price: Number(rate), status: 'OPEN', metadata: { sourceType: 'battery', trigger: 'auto', energyOfferId: created?.id } } });
                } catch (moErr) { console.warn('autoPostBatterySurplusOffer: MarketOrder failed', moErr.message || moErr); }
                remaining = roundTo4(remaining - offerKwh);
                batteryOffersCreated++;
                createdOffer = created;
            }
        }
    }

    // ---- Return result ----
    if (createdOffer) {
        const type = createdOffer.sourceType === 'produce' ? 'solar' : 'battery';
        const extras = type === 'battery' ? { offersCount: batteryOffersCreated, batchSize: Math.round(batchSize || 0) } : {};
        return { created: createdOffer, reason: `${type}-surplus-sold`, ...extras };
    }

    if (batteryAutoApplicable) {
        const debugThresholdPct = Math.min(100, Math.max(0, toNumber(building.batterySellThreshold != null ? building.batterySellThreshold : 80)));
        const debugThresholdKwh = (batteryCapacity * debugThresholdPct) / 100;
        const debugSellableKwh = roundTo4(Math.max(0, batteryCurrent - debugThresholdKwh));
        return {
            created: null, reason: 'battery-threshold-not-met',
            debug: {
                batteryCurrent,
                batteryCapacity,
                batterySellThreshold: building.batterySellThreshold,
                thresholdPct: debugThresholdPct,
                thresholdKwh: debugThresholdKwh,
                sellableKwh: debugSellableKwh,
                batteryMode,
                batchSize,
            },
        };
    }
    if (solarAutoApplicable) return { created: null, reason: 'solar-no-surplus' };
    return { created: null, reason: 'no-auto-mode-active' };
}

/**
 * Execute automated trading rules for a single building.
 * - Solar SELF_CONSUME: charge battery first, rest consumed locally
 * - Solar AUTO: split by solarSelfPercent, sellable portion → market (battery SELF_CONSUME gets priority)
 * - Battery AUTO: create buy bid to reach threshold via market
 */
async function autoExecuteTradingForBuilding(buildingName) {
    if (!buildingName) return { acted: false, reason: 'missing-building' };

    const building = await prisma.building.findUnique({ where: { name: String(buildingName) } });
    if (!building) return { acted: false, reason: 'building-not-found' };

    const meterRows = await prisma.meterInfo.findMany({ where: { buildingName: building.name } });
    const produceMeters = meterRows.filter((m) => isProduceMeter(m.type));
    const consumeMeters = meterRows.filter((m) => isConsumeMeter(m.type));
    const batteryMeter = meterRows.find((m) => isBatteryMeter(m.type));

    const produced = produceMeters.reduce((s, m) => s + Math.max(toNumber(m.value), toNumber(m.kWH)), 0);
    const consumed = consumeMeters.reduce((s, m) => s + Math.max(toNumber(m.value), toNumber(m.kWH)), 0);
    const batteryCurrent = batteryMeter ? Math.max(toNumber(batteryMeter.value), toNumber(batteryMeter.kWH)) : 0;
    const batteryCapacity = batteryMeter ? toNumber(batteryMeter.capacity) : 0;

    const solarSelfPercent = Number(building.solarSelfPercent != null ? building.solarSelfPercent : 80);
    const batteryThresholdPct = Number(building.batterySellThreshold != null ? building.batterySellThreshold : 80);
    const solarMode = String(building.solarTradeMode || building.tradeMode || '').toUpperCase();
    const batteryMode = String(building.batteryTradeMode || building.tradeMode || '').toUpperCase();

    const wallet = await prisma.wallet.findFirst({ where: { email: String(building.email || '') }, select: { id: true } });
    if (!wallet?.id) return { acted: false, reason: 'wallet-not-found' };

    const actions = [];

    // 1) Solar handling
    if (produceMeters.length > 0 && produced > 0) {
        if (solarMode === 'SELF_CONSUME') {
            let remainingSolar = produced;
            if (batteryMeter && batteryMode === 'SELF_CONSUME') {
                const free = Math.max(0, batteryCapacity - batteryCurrent);
                const charge = Math.min(remainingSolar, free);
                if (charge > 0) {
                    await prisma.meterInfo.update({ where: { snid: batteryMeter.snid }, data: { value: batteryCurrent + charge, kWH: batteryCurrent + charge, timestamp: new Date() } });
                    actions.push({ type: 'battery_charge_from_solar', kwh: charge });
                    remainingSolar = roundTo4(remainingSolar - charge);
                }
            }
        } else {
            const selfConsumeKwh = roundTo4(produced * (solarSelfPercent / 100));
            let sellableKwh = roundTo4(produced - selfConsumeKwh);

            if (batteryMeter && batteryMode === 'SELF_CONSUME' && sellableKwh > 0) {
                const free = Math.max(0, batteryCapacity - batteryCurrent);
                const charge = Math.min(sellableKwh, free);
                if (charge > 0) {
                    await prisma.meterInfo.update({ where: { snid: batteryMeter.snid }, data: { value: batteryCurrent + charge, kWH: batteryCurrent + charge, timestamp: new Date() } });
                    actions.push({ type: 'battery_charge_from_solar_excess', kwh: charge });
                    sellableKwh = roundTo4(sellableKwh - charge);
                }
            }

            if (sellableKwh >= 0.01) {
                const rate = toNumber(building.solarOfferPrice) > 0 ? toNumber(building.solarOfferPrice) : await getLatestEnergyRatePrice();
                try {
                    const created = await createOffer({ sellerWalletId: wallet.id, kwh: sellableKwh, ratePerKwh: rate, sourceType: 'produce', trigger: 'auto', marketType: 'INTRADAY' });
                    actions.push({ type: 'auto_sell_solar', kwh: sellableKwh, offerId: created.id });
                    try {
                        await prisma.marketOrder.create({ data: { side: 'OFFER', marketType: 'INTRADAY', walletId: String(wallet.id), buildingName: building.name, quantity: Number(sellableKwh), price: Number(rate), status: 'OPEN', metadata: { sourceType: 'produce', trigger: 'auto', energyOfferId: created?.id } } });
                    } catch (moErr) { console.warn('autoExecuteTradingForBuilding: MarketOrder create failed', moErr.message || moErr); }
                } catch (e) { console.warn('autoExecuteTradingForBuilding createOffer failed', e.message || e); }
            }
        }
    }

    // 2) Battery auto-buy
    if (batteryMeter && batteryMode === 'AUTO_BATTERY_THRESHOLD' && batteryCapacity > 0) {
        const thresholdKwh = (batteryCapacity * Math.min(100, Math.max(0, batteryThresholdPct))) / 100;
        if (batteryCurrent < thresholdKwh - 0.001) {
            const buyAmount = roundTo4(thresholdKwh - batteryCurrent);
            if (buyAmount >= 0.01) {
                try {
                    const bidRate = toNumber(building.batteryBidPrice) > 0 ? toNumber(building.batteryBidPrice) : null;
                    const bid = await createBid({ buyerWalletId: wallet.id, kwh: buyAmount, ratePerKwh: bidRate, marketType: 'INTRADAY' });
                    actions.push({ type: 'auto_buy_battery', kwh: buyAmount, bidId: bid.id });
                } catch (e) { console.warn('autoExecuteTradingForBuilding createBid failed', e.message || e); }
            }
        }
    }

    return { acted: actions.length > 0, actions };
}

module.exports = { autoPostBatterySurplusOffer, autoExecuteTradingForBuilding };
