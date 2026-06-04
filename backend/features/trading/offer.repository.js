const { randomUUID } = require('crypto');
const { prisma } = require('../../utils/prisma');
const WalletModel = require('../wallets/wallet.model');
const BuildingModel = require('../building/building.model');
const {
    toNumber, matchesSourceType, normalizeTradeMode,
    assertDayAheadMarketOpen, assertIntradayRate, getLatestEnergyRatePrice,
    TRADE_MODES,
} = require('./market.utils');

// ---- Offer CRUD ----

async function getOffers() {
    return await prisma.energyOffer.findMany();
}

async function getAvailableOffers() {
    return await prisma.energyOffer.findMany({ where: { status: 'AVAILABLE' } });
}

async function getSoldOffers() {
    return await prisma.energyOffer.findMany({ where: { status: 'SOLD' } });
}

async function getOfferById(id) {
    if (id == null || id === '') {
        const err = new Error('Invalid offer ID');
        err.status = 400;
        throw err;
    }
    const idStr = String(id);
    // UUIDs contain dashes — skip parseInt fallback (parseInt("06dec4f7-...")=6 would match wrong record)
    const isUuid = idStr.includes('-');
    if (!isUuid) {
        const numericId = parseInt(idStr, 10);
        if (Number.isFinite(numericId) && numericId > 0) {
            const offer = await prisma.energyOffer.findUnique({ where: { id: numericId } });
            if (offer) return offer;
        }
    }
    // Try as string (UUID) using raw query — may be energyOffer.id or MarketOrder.id
    let offers = await prisma.$queryRawUnsafe(
        `SELECT * FROM "EnergyOffer" WHERE "id"::text = $1 LIMIT 1`,
        idStr
    );
    if (offers?.[0]) return offers[0];

    // ID might be a MarketOrder UUID — cross-reference via metadata.energyOfferId
    if (isUuid) {
        const mo = await prisma.marketOrder.findUnique({ where: { id: idStr }, select: { metadata: true, walletId: true, quantity: true, price: true, status: true, marketType: true, side: true, buildingName: true } });
        const linkedOfferId = mo?.metadata?.energyOfferId;
        if (linkedOfferId) {
            offers = await prisma.$queryRawUnsafe(
                `SELECT * FROM "EnergyOffer" WHERE "id"::text = $1 LIMIT 1`,
                String(linkedOfferId)
            );
            if (offers?.[0]) return offers[0];
        }
        // Fallback: if no linked EnergyOffer but MarketOrder exists, return virtual offer
        if (mo && mo.side === 'OFFER') {
            return {
                id: idStr,
                sellerWalletId: mo.walletId,
                kWH: Number(mo.quantity || 0),
                ratePerkWH: mo.price != null ? Number(mo.price) : 0,
                status: mo.status === 'OPEN' || mo.status === 'PARTIAL' ? 'AVAILABLE' : mo.status,
                marketType: mo.marketType,
                sourceType: mo.metadata?.sourceType || 'produce',
                buildingName: mo.buildingName,
            };
        }
    }

    return null;
}

async function cancelOffer(id) {
    return await prisma.energyOffer.update({
        where: { id: parseInt(id) },
        data: { status: 'CANCELLED' },
    });
}

// ---- Building / Wallet lookup ----

async function getBuildingByWalletId(walletId) {
    const wallet = await WalletModel.getWalletById(walletId);
    if (!wallet) return null;
    const buildings = await BuildingModel.getBuildingByEmail(wallet.email).catch(() => null);
    if (!buildings || buildings.length === 0) return null;
    return buildings[0];
}

// ---- Create Offer (DB transaction + validation) ----

async function createOffer({ sellerWalletId, kwh, ratePerKwh, sourceType = 'produce', trigger = 'manual', marketType = 'MANUAL', targetDate, bypassLock }) {
    if (!sellerWalletId || kwh == null || ratePerKwh == null) {
        throw new Error('Missing required fields for createOffer');
    }

    assertDayAheadMarketOpen(marketType, bypassLock);
    assertIntradayRate(marketType, ratePerKwh);

    const { syncBuildingEnergyForBuilding } = require('../energy/energyAggregation');

    const result = await prisma.$transaction(async (tx) => {
        const totalPrice = Number(kwh) * Number(ratePerKwh);

        const created = await tx.energyOffer.create({
            data: {
                sellerWalletId: String(sellerWalletId),
                kWH: Number(kwh),
                ratePerkWH: Number(ratePerKwh),
                totalPrice: Number(totalPrice),
                status: 'AVAILABLE',
                marketType: marketType || 'MANUAL',
                targetDate: targetDate ? new Date(targetDate) : null,
            },
        });

        const wallet = await WalletModel.getWalletById(sellerWalletId);
        if (wallet) {
            const buildings = await BuildingModel.getBuildingByEmail(wallet.email);
            if (buildings && buildings.length > 0) {
                const building = buildings[0];

                const isSolarSource = matchesSourceType('solar', sourceType) || matchesSourceType('produce', sourceType);
                const isBatterySource = matchesSourceType('battery', sourceType);
                let effectiveTradeMode;
                if (isBatterySource && building.batteryTradeMode) {
                    effectiveTradeMode = normalizeTradeMode(building.batteryTradeMode);
                } else if (isSolarSource && building.solarTradeMode) {
                    effectiveTradeMode = normalizeTradeMode(building.solarTradeMode);
                } else {
                    effectiveTradeMode = normalizeTradeMode(building?.tradeMode);
                }

                if (String(trigger || 'manual').toLowerCase() === 'manual' && effectiveTradeMode !== TRADE_MODES.MANUAL) {
                    throw new Error(`Manual sell is disabled for mode ${effectiveTradeMode}. Please switch mode to MANUAL to post offers manually.`);
                }

                const meterRows = await tx.meterInfo.findMany({ where: { buildingName: building.name } });
                const selectedMeter = meterRows.find((meter) => matchesSourceType(meter.type, sourceType));

                if (!selectedMeter) {
                    throw new Error(`${String(sourceType || 'produce')} meter not found for seller building`);
                }

                const currentValue = Number(selectedMeter.value || 0);
                const currentKwh = Number(selectedMeter.kWH || 0);
                let availableEnergy = Math.max(currentValue, currentKwh);
                const sellAmount = Number(kwh);

                // For produce/solar source, also check against total generation from DailyEnergy
                if (isSolarSource && sellAmount > availableEnergy) {
                    try {
                        const now = new Date();
                        const monthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                        const rows = await tx.$queryRawUnsafe(`
                            SELECT COALESCE(SUM(de."kwh"), 0) as total_kwh
                            FROM "DailyEnergy" de
                            WHERE de."meterSnid" = $1
                              AND (de."year" > $2 OR (de."year" = $2 AND de."month" >= $3))
                        `, selectedMeter.snid, monthStart.getFullYear(), monthStart.getMonth() + 1);
                        const totalProduce = Number(rows?.[0]?.total_kwh || 0);
                        if (totalProduce > availableEnergy) {
                            availableEnergy = totalProduce;
                        }
                    } catch (e) {
                        console.warn('createOffer: failed to query total produce, using meter value', e.message || e);
                    }
                }

                if (sellAmount > availableEnergy) {
                    throw new Error(`Cannot create offer exceeding ${String(sourceType || 'produce')} meter energy. Available: ${availableEnergy}`);
                }

                // Only decrease meter for manual offers; auto-offers decrease meter at purchase time
                if (String(trigger || '').toLowerCase() !== 'auto') {
                    await tx.meterInfo.update({
                        where: { snid: selectedMeter.snid },
                        data: {
                            value: Math.max(0, currentValue - sellAmount),
                            kWH: Math.max(0, currentKwh - sellAmount),
                            timestamp: new Date(),
                        },
                    });
                }

                await syncBuildingEnergyForBuilding(building.name, tx);
            }
        }

        return created;
    });

    return result;
}

// ---- Bid CRUD ----

async function createBid({ buyerWalletId, kwh, ratePerKwh, marketType = 'MANUAL', targetDate, bypassLock }) {
    if (!buyerWalletId || kwh == null) {
        throw new Error('Missing required fields for createBid');
    }

    assertDayAheadMarketOpen(marketType, bypassLock);
    if (ratePerKwh != null) {
        assertIntradayRate(marketType, ratePerKwh);
    }

    let date = targetDate ? new Date(targetDate) : new Date();
    if (!targetDate && marketType === 'DAY_AHEAD') {
        date.setDate(date.getDate() + 1);
    }
    date.setHours(0, 0, 0, 0);

    return await prisma.energyBid.create({
        data: {
            buyerWalletId: String(buyerWalletId),
            kWH: Number(kwh),
            ratePerkWH: ratePerKwh != null ? Number(ratePerKwh) : null,
            marketType: marketType,
            targetDate: date,
            status: 'OPEN',
        },
    });
}

async function getBids() {
    return await prisma.energyBid.findMany({ orderBy: { createdAt: 'desc' } });
}

async function cancelBid(id) {
    return await prisma.energyBid.update({
        where: { id: parseInt(id) },
        data: { status: 'CANCELLED' },
    });
}

// ---- Sell to Bid (cross-trade execution) ----

async function sellToBid({ bidId, sellerWalletId, kwh, price = null }) {
    if (!bidId || !sellerWalletId || kwh == null) {
        const e = new Error('Missing required fields for sellToBid'); e.status = 400; throw e;
    }

    const bid = await prisma.energyBid.findUnique({ where: { id: parseInt(bidId, 10) } });
    if (!bid) { const e = new Error('Bid not found'); e.status = 404; throw e; }
    if (bid.status !== 'OPEN') { const e = new Error('Bid is not open'); e.status = 400; throw e; }

    const remaining = Math.max(0, (Number(bid.kWH || bid.kwh || 0) - Number(bid.kWHBought || bid.kwhBought || 0)));
    const purchaseAmount = Math.min(Number(kwh), remaining);
    if (purchaseAmount <= 0) { const e = new Error('No remaining demand on bid'); e.status = 400; throw e; }

    const pricePerKwh = bid.ratePerkWH != null ? Number(bid.ratePerkWH) : (price != null ? Number(price) : await getLatestEnergyRatePrice());
    const totalPrice = purchaseAmount * pricePerKwh;

    const buyerWallet = await WalletModel.getWalletById(String(bid.buyerWalletId));
    if (!buyerWallet) { const e = new Error('Buyer wallet not found'); e.status = 404; throw e; }
    if (Number(buyerWallet.tokenBalance) < totalPrice) {
        const err = new Error('Buyer has insufficient balance'); err.status = 400; err.required = totalPrice; err.available = Number(buyerWallet.tokenBalance); throw err;
    }

    const sellerWallet = await WalletModel.getWalletById(String(sellerWalletId));
    if (!sellerWallet) { const e = new Error('Seller wallet not found'); e.status = 404; throw e; }

    const building = await getBuildingByWalletId(String(buyerWallet.id)).catch(() => null);
    const buildingRow = building ? await prisma.building.findUnique({ where: { id: Number(building.id) } }) : null;

    const destinationBatteryMeter = buildingRow?.name ? await prisma.meterInfo.findFirst({
        where: { buildingName: buildingRow.name, type: { contains: 'battery', mode: 'insensitive' } },
    }) : null;

    if (!destinationBatteryMeter) {
        const err = new Error('Target building must have a battery meter to receive purchased energy'); err.status = 400; throw err;
    }

    const { verifyTransaction } = require('../transactions/transactionVerification.service');

    const result = await prisma.$transaction(async (tx) => {
        await tx.wallet.update({ where: { id: String(buyerWallet.id) }, data: { tokenBalance: { decrement: totalPrice } } });
        await tx.wallet.update({ where: { id: String(sellerWallet.id) }, data: { tokenBalance: { increment: totalPrice } } });

        const nextValue = Number(destinationBatteryMeter.value || 0) + purchaseAmount;
        const nextKwh = Number(destinationBatteryMeter.kWH || destinationBatteryMeter.kwh || 0) + purchaseAmount;
        await tx.meterInfo.update({ where: { snid: destinationBatteryMeter.snid }, data: { value: nextValue, kWH: nextKwh, timestamp: new Date() } });

        const buyerWalletTxId = randomUUID();
        await tx.walletTx.create({ data: { id: buyerWalletTxId, walletId: String(buyerWallet.id), timestamp: new Date(), tokenInOut: -totalPrice } });
        await tx.walletTx.create({ data: { id: randomUUID(), walletId: String(sellerWallet.id), timestamp: new Date(), tokenInOut: totalPrice } });

        const buyerTransaction = await tx.transaction.create({ data: { txid: randomUUID(), timestamp: new Date(), buildingName: buildingRow?.name || null, walletId: String(buyerWallet.id), type: 'MARKETPLACE_PURCHASE', tokenAmount: totalPrice, status: 'CONFIRMED' } });
        const sellerTransaction = await tx.transaction.create({ data: { txid: randomUUID(), timestamp: new Date(), buildingName: sellerWallet.buildingName || null, walletId: String(sellerWallet.id), type: 'MARKETPLACE_SALE', tokenAmount: totalPrice, status: 'CONFIRMED' } });

        const now = new Date();
        const invoice = await tx.invoice.create({ data: { id: randomUUID(), buildingName: String(buildingRow?.name || `Building-${buyerWallet.id}`), fromWId: String(sellerWallet.id), toWId: String(buyerWallet.id), timestamp: now, kWH: purchaseAmount, tokenAmount: totalPrice, status: 'paid', month: now.getMonth() + 1, year: now.getFullYear(), dailyAvg: purchaseAmount, peakDate: now, peakkWH: purchaseAmount } });
        const receipt = await tx.receipt.create({ data: { id: randomUUID(), invoiceId: String(invoice.id), timestamp: new Date(), walletTxId: String(buyerWalletTxId) } });

        const newBought = Number(bid.kWHBought || bid.kwhBought || 0) + purchaseAmount;
        const totalKwh = Number(bid.kWH || bid.kwh || 0);
        const newStatus = newBought >= totalKwh ? 'CANCELLED' : 'OPEN';
        await tx.energyBid.update({ where: { id: parseInt(bidId, 10) }, data: { kWHBought: newBought, status: newStatus } });

        return { invoice, receipt, batteryStorage: { snid: destinationBatteryMeter.snid, value: nextValue, kWH: nextKwh, capacity: Number(destinationBatteryMeter.capacity) }, buyerTransaction, sellerTransaction };
    });

    const buyerVerification = await verifyTransaction(result.buyerTransaction);
    const sellerVerification = await verifyTransaction(result.sellerTransaction);

    return {
        message: 'Sell to bid successful', ...result,
        transaction: { from: String(sellerWalletId), to: String(bid.buyerWalletId), amount: totalPrice, kWH: purchaseAmount },
        blockchain: { buyer: { transaction: buyerVerification.transaction, verification: buyerVerification.verification }, seller: { transaction: sellerVerification.transaction, verification: sellerVerification.verification } },
    };
}

module.exports = {
    getOffers, getAvailableOffers, getSoldOffers, getOfferById, cancelOffer,
    getBuildingByWalletId,
    createOffer,
    createBid, getBids, cancelBid,
    sellToBid,
};
