const { prisma } = require('../../utils/prisma');
const {
    toNumber, roundTo4, normalizeTradeMode,
    isProduceMeter, isConsumeMeter, isBatteryMeter,
    getLatestEnergyRatePrice, TRADE_MODES,
} = require('./market.utils');
const { createOffer, createBid } = require('./offer.repository');
const { insertRunningMeter } = require('../energy/energyAggregation');

/**
 * Log a battery charge/discharge event to RunningMeter so it appears in graphs.
 */
async function logBatteryChange(snid, kW, newKwh, source = 'SOLAR') {
    try {
        await insertRunningMeter({ snid, timestamp: new Date(), kW, kWH: newKwh, source });
    } catch (e) {
        console.warn('[trade.engine] Failed to log battery change to RunningMeter:', e.message);
    }
}

/**
 * Auto-post surplus offer for a building (called by scheduler).
 * Handles both Solar surplus (split by solarSelfPercent) and Battery surplus (above threshold).
 */
async function autoPostBatterySurplusOffer(buildingName) {
    if (!buildingName) return { created: null, reason: 'missing-building', debug: {} };

    const building = await prisma.building.findUnique({
        where: { name: String(buildingName) },
        select: {
            name: true, email: true, tradeMode: true,
            solarTradeMode: true, batteryTradeMode: true,
            solarSelfPercent: true, batterySellThreshold: true,
            solarOfferPrice: true, batteryOfferPrice: true, batteryBidPrice: true,
        },
    });
    if (!building) return { created: null, reason: 'building-not-found', debug: {} };

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
    if (!wallet?.id) return { created: null, reason: 'seller-wallet-not-found', debug: { buildingName: building.name } };

    // ---- Track results from both solar and battery checks ----
    let createdOffer = null;
    let batteryOffersCreated = 0;
    let batchSize = 0;
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
                await logBatteryChange(batteryMeter.snid, charge, batteryCurrent + charge);
                sellableKwh = roundTo4(sellableKwh - charge);
            }
            // If battery is full (free=0), sellableKwh stays → posted as offer below
        }

        if (sellableKwh >= 0.01) {
            const rate = toNumber(building.solarOfferPrice) > 0 ? toNumber(building.solarOfferPrice) : await getLatestEnergyRatePrice();
            createdOffer = await createOffer({ sellerWalletId: wallet.id, kwh: sellableKwh, ratePerKwh: rate, sourceType: 'produce', trigger: 'auto', marketType: 'INTRADAY' });
            try {
                await prisma.marketOrder.create({ data: { side: 'OFFER', marketType: 'INTRADAY', walletId: String(wallet.id), buildingName: building.name, sourceType: 'produce', quantity: Number(sellableKwh), price: Number(rate), status: 'OPEN', metadata: { sourceType: 'produce', trigger: 'auto', energyOfferId: createdOffer?.id } } });
            } catch (moErr) { console.warn('autoPostBatterySurplusOffer: failed to create MarketOrder for solar', moErr.message || moErr); }
        }
    }

    // ---- Battery auto-sell ----
    if (batteryAutoApplicable) {
        const thresholdPct = Math.min(100, Math.max(0, toNumber(building.batterySellThreshold != null ? building.batterySellThreshold : 80)));
        const thresholdKwh = (batteryCapacity * thresholdPct) / 100;
        let sellableKwh = roundTo4(Math.max(0, batteryCurrent - thresholdKwh));

        // Subtract already-offered energy (matches createOffer validation)
        if (sellableKwh >= 0.01) {
            const openOffers = await prisma.energyOffer.findMany({
                where: { sellerWalletId: String(wallet.id), status: 'AVAILABLE' },
                select: { kWH: true, kWHSold: true },
            });
            const alreadyOffered = openOffers.reduce((sum, o) => sum + Math.max(0, Number(o.kWH || 0) - Number(o.kWHSold || 0)), 0);
            sellableKwh = roundTo4(Math.max(0, sellableKwh - alreadyOffered));
        }

        // Dedup: if existing offer already matches surplus, skip; otherwise cancel old & recreate
        if (sellableKwh >= 0.01) {
            const existingOffer = await prisma.marketOrder.findFirst({
                where: { side: 'OFFER', walletId: String(wallet.id), status: 'OPEN', sourceType: 'battery' },
            });
            if (existingOffer) {
                const existingKwh = Number(existingOffer.quantity || 0);
                // If within 5% of current surplus, keep it
                if (Math.abs(existingKwh - sellableKwh) < Math.max(1, sellableKwh * 0.05)) {
                    return { created: null, reason: 'battery-offer-already-exists', debug: { existingOfferId: existingOffer.id, existingKwh, sellableKwh } };
                }
                // Surplus changed — cancel old, create new below
                await prisma.marketOrder.update({ where: { id: existingOffer.id }, data: { status: 'CANCELLED' } });
                try {
                    const eoId = existingOffer.metadata?.energyOfferId;
                    if (eoId) await prisma.energyOffer.update({ where: { id: parseInt(eoId, 10) }, data: { status: 'CANCELLED' } });
                } catch {}
            }
        }

        // Calculate average daily consumption to use as batch size for splitting offers
        batchSize = 0;
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
                    await prisma.marketOrder.create({ data: { side: 'OFFER', marketType: 'INTRADAY', walletId: String(wallet.id), buildingName: building.name, sourceType: 'battery', quantity: Number(offerKwh), price: Number(rate), status: 'OPEN', metadata: { sourceType: 'battery', trigger: 'auto', energyOfferId: created?.id } } });
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
            debug: { batteryCurrent, batteryCapacity, thresholdPct: debugThresholdPct, thresholdKwh: debugThresholdKwh, sellableKwh: debugSellableKwh, batteryMode },
        };
    }
    if (solarAutoApplicable) return { created: null, reason: 'solar-no-surplus', debug: { produced, batteryCurrent, batteryCapacity } };
    return { created: null, reason: 'no-auto-mode-active', debug: { batteryMode, solarMode, batteryCurrent, batteryCapacity } };
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
                    await logBatteryChange(batteryMeter.snid, charge, batteryCurrent + charge);
                    actions.push({ type: 'battery_charge_from_solar', kwh: charge });
                    remainingSolar = roundTo4(remainingSolar - charge);
                }
                // Battery full → auto-sell remaining solar to marketplace
                if (remainingSolar >= 0.01 && free <= 0) {
                    const rate = toNumber(building.solarOfferPrice) > 0 ? toNumber(building.solarOfferPrice) : await getLatestEnergyRatePrice();
                    try {
                        const created = await createOffer({ sellerWalletId: wallet.id, kwh: remainingSolar, ratePerKwh: rate, sourceType: 'produce', trigger: 'auto', marketType: 'INTRADAY' });
                        actions.push({ type: 'auto_sell_solar_battery_full', kwh: remainingSolar, offerId: created?.id });
                    } catch (e) { console.warn('autoExecuteTradingForBuilding: auto-sell (battery full) failed', e.message || e); }
                    remainingSolar = 0;
                }
            }
        } else if (solarMode === 'AUTO_BATTERY_THRESHOLD') {
            const selfConsumeKwh = roundTo4(produced * (solarSelfPercent / 100));
            let sellableKwh = roundTo4(produced - selfConsumeKwh);

            if (batteryMeter && batteryMode === 'SELF_CONSUME' && sellableKwh > 0) {
                const free = Math.max(0, batteryCapacity - batteryCurrent);
                const charge = Math.min(sellableKwh, free);
                if (charge > 0) {
                    await prisma.meterInfo.update({ where: { snid: batteryMeter.snid }, data: { value: batteryCurrent + charge, kWH: batteryCurrent + charge, timestamp: new Date() } });
                    await logBatteryChange(batteryMeter.snid, charge, batteryCurrent + charge);
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
