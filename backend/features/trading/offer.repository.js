const { randomUUID } = require('crypto');
const { prisma } = require('../../utils/prisma');
const WalletModel = require('../wallets/wallet.model');
const BuildingModel = require('../building/building.model');
const {
    toNumber, matchesSourceType, normalizeTradeMode,
    assertDayAheadMarketOpen, assertIntradayRate,
    assertDayAheadBidMin, assertDayAheadOfferMax,
    getLatestEnergyRatePrice,
    TRADE_MODES,
} = require('./market.utils');

// ---- Offer CRUD ----

async function getOffers() {
    const [energyOffers, marketOrders] = await Promise.all([
        prisma.energyOffer.findMany(),
        prisma.marketOrder.findMany({ where: { side: 'OFFER' } }),
    ]);
    // Merge MarketOrders not already covered by energyOffers
    const merged = [...energyOffers];
    for (const mo of marketOrders) {
        const existing = energyOffers.find(o => String(o.id) === String(mo.id));
        if (!existing) {
            merged.push({
                id: mo.id,
                sellerWalletId: mo.walletId,
                kWH: Number(mo.quantity),
                kWHSold: Number(mo.filled || 0),
                ratePerkWH: mo.price != null ? Number(mo.price) : 0,
                totalPrice: (Number(mo.quantity) * (mo.price != null ? Number(mo.price) : 0)),
                status: mo.status === 'FILLED' ? 'SOLD' : mo.status === 'PARTIAL' ? 'AVAILABLE' : mo.status,
                marketType: mo.marketType || 'INTRADAY',
                targetDate: mo.targetDate,
                createdAt: mo.createdAt,
                sourceType: mo.metadata?.sourceType || 'produce',
            });
        }
    }
    return merged;
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
    const offer = await prisma.energyOffer.findUnique({ where: { id: parseInt(id) } });
    if (!offer) throw new Error('Offer not found');

    const result = await prisma.energyOffer.update({
        where: { id: parseInt(id) },
        data: { status: 'CANCELLED' },
    });

    // Restore energy to the source meter
    try {
        const wallet = await WalletModel.getWalletById(offer.sellerWalletId);
        if (wallet) {
            const buildings = await BuildingModel.getBuildingByEmail(wallet.email);
            if (buildings?.length) {
                const building = buildings[0];
                const sourceType = String(offer.sourceType || 'produce').toLowerCase();
                const meterRows = await prisma.meterInfo.findMany({ where: { buildingName: building.name } });
                const selectedMeter = meterRows.find((m) => matchesSourceType(m.type, sourceType));
                if (!selectedMeter) {
                    console.warn(`[cancelOffer] No ${sourceType} meter found for ${building.name}; energy NOT restored`);
                } else {
                    const currentValue = Number(selectedMeter.value || 0);
                    const currentKwh = Number(selectedMeter.kWH || 0);
                    const restoreAmount = Number(offer.kWH || 0) - Number(offer.kWHSold || 0);
                    if (restoreAmount > 0) {
                        await prisma.meterInfo.update({
                            where: { snid: selectedMeter.snid },
                            data: {
                                value: currentValue + restoreAmount,
                                kWH: currentKwh + restoreAmount,
                                timestamp: new Date(),
                            },
                        });
                        console.log(`[cancelOffer] Restored ${restoreAmount} kWh to meter ${selectedMeter.snid} (${sourceType})`);
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[cancelOffer] Failed to restore energy:', e.message);
    }

    return result;
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
    assertDayAheadOfferMax(marketType, ratePerKwh);

    const { syncBuildingEnergyForBuilding } = require('../energy/energyAggregation');

    // Default targetDate for DAY_AHEAD: tomorrow at midnight
    let date = targetDate ? new Date(targetDate) : (marketType === 'DAY_AHEAD' ? new Date() : null);
    if (!targetDate && marketType === 'DAY_AHEAD') {
        date.setDate(date.getDate() + 1);
    }
    if (date) date.setHours(0, 0, 0, 0);

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
                sourceType: String(sourceType || 'produce').toLowerCase(),
                targetDate: date,
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
                    // Manual sell in auto mode: allowed — mode only controls auto-posting behavior
                    console.log(`[createOffer] Manual sell in ${effectiveTradeMode} mode — allowed`);
                }

                const meterRows = await tx.meterInfo.findMany({ where: { buildingName: building.name } });
                const selectedMeter = meterRows.find((meter) => matchesSourceType(meter.type, sourceType));

                if (!selectedMeter) {
                    throw new Error(`${String(sourceType || 'produce')} meter not found for seller building`);
                }

                const currentValue = Number(selectedMeter.value || 0);
                const currentKwh = Number(selectedMeter.kWH || 0);
                let availableEnergy = Math.max(currentValue, currentKwh);
                let sellAmount = Number(kwh);
                const isDayAhead = String(marketType || '').toUpperCase() === 'DAY_AHEAD';

                // For Day-Ahead: skip energy availability check (energy is for tomorrow)
                if (!isDayAhead) {
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

                // Also subtract existing AVAILABLE offers from the same wallet
                // (safety net: prevent over-offering beyond meter + existing commitments)
                const existingOffers = await tx.energyOffer.findMany({
                    where: { sellerWalletId: String(sellerWalletId), status: 'AVAILABLE' },
                    select: { kWH: true, kWHSold: true },
                });
                const alreadyOfferedKwh = existingOffers.reduce(
                    (sum, o) => sum + Math.max(0, Number(o.kWH || 0) - Number(o.kWHSold || 0)),
                    0,
                );
                const netAvailable = availableEnergy - alreadyOfferedKwh;

                // Round both to 2 decimals to match display precision
                const netRounded = Math.round(netAvailable * 100) / 100;
                let sellRounded = Math.round(sellAmount * 100) / 100;
                if (sellRounded > netRounded) {
                    if (netRounded <= 0) {
                        // Over-offered: cancel stale offers, then cap to 0
                        console.warn(`[createOffer] Over-offered (${netAvailable} kWh). Cancelling ${alreadyOfferedKwh} kWh stale offers.`);
                        await tx.energyOffer.updateMany({
                            where: { sellerWalletId: String(sellerWalletId), status: 'AVAILABLE' },
                            data: { status: 'CANCELLED' },
                        });
                        await tx.marketOrder.updateMany({
                            where: { walletId: String(sellerWalletId), side: 'OFFER', status: 'OPEN' },
                            data: { status: 'CANCELLED' },
                        });
                        sellAmount = 0;
                        sellRounded = 0;
                    } else {
                        console.warn(`[createOffer] Capping offer from ${sellAmount} → ${netRounded} kWh`);
                        sellAmount = netRounded;
                        sellRounded = netRounded;
                    }
                }

                if (sellAmount <= 0) {
                    return { created: null, reason: 'over-offered-cancelled', debug: { cancelledKwh: alreadyOfferedKwh } };
                }

                // Always decrease meter at offer creation (both manual and auto)
                // Energy is committed immediately; meter reflects remaining available energy
                await tx.meterInfo.update({
                    where: { snid: selectedMeter.snid },
                    data: {
                        value: Math.max(0, currentValue - sellAmount),
                        kWH: Math.max(0, currentKwh - sellAmount),
                        timestamp: new Date(),
                    },
                });
                } // end if (!isDayAhead) — Day-Ahead skips energy check & meter deduction

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
        assertDayAheadBidMin(marketType, ratePerKwh);
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
    const [energyBids, marketOrders] = await Promise.all([
        prisma.energyBid.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.marketOrder.findMany({ where: { side: 'BID' }, orderBy: { createdAt: 'desc' } }),
    ]);
    const merged = [...energyBids];
    for (const mo of marketOrders) {
        const existing = energyBids.find(b => String(b.id) === String(mo.id));
        if (!existing) {
            merged.push({
                id: mo.id,
                buyerWalletId: mo.walletId,
                kWH: Number(mo.quantity),
                kWHBought: Number(mo.filled || 0),
                ratePerkWH: mo.price != null ? Number(mo.price) : null,
                status: mo.status === 'FILLED' ? 'FULFILLED' : mo.status,
                marketType: mo.marketType || 'INTRADAY',
                targetDate: mo.targetDate,
                createdAt: mo.createdAt,
                buildingName: mo.buildingName,
            });
        }
    }
    // Sort by createdAt desc
    merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return merged;
}

async function cancelBid(id) {
    return await prisma.energyBid.update({
        where: { id: parseInt(id) },
        data: { status: 'CANCELLED' },
    });
}

// ---- Sell to Bid (cross-trade execution) ----

async function sellToBid({ bidId, sellerWalletId, kwh, price = null, sourceType = 'solar', marketOrderId = null }) {
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

    // ---- Find seller's source meter to deduct energy ----
    const sellerBuilding = await getBuildingByWalletId(String(sellerWallet.id)).catch(() => null);
    let sellerBuildingRow = sellerBuilding ? await prisma.building.findUnique({ where: { id: Number(sellerBuilding.id) } }) : null;
    // Fallback: find building by wallet email
    if (!sellerBuildingRow) {
        sellerBuildingRow = await prisma.building.findFirst({ where: { email: sellerWallet.email }, select: { id: true, name: true } }).catch(() => null);
    }

    const sourceTypeFilter = sourceType === 'battery' ? 'battery' : 'solar';
    const sellerSourceMeter = sellerBuildingRow?.name ? await prisma.meterInfo.findFirst({
        where: { buildingName: sellerBuildingRow.name, type: { contains: sourceTypeFilter, mode: 'insensitive' } },
    }) : null;
    const sellerBuildingName = sellerBuildingRow?.name || sellerSourceMeter?.buildingName || sellerWallet.email || sellerWallet.buildingName || (sellerSourceMeter ? `Battery-${sellerSourceMeter.snid.slice(0,6)}` : String(sellerWallet.id).slice(0, 8));
    // ----

    const building = await getBuildingByWalletId(String(buyerWallet.id)).catch(() => null);
    let buildingRow = building ? await prisma.building.findUnique({ where: { id: Number(building.id) } }) : null;
    if (!buildingRow) {
        buildingRow = await prisma.building.findFirst({ where: { email: buyerWallet.email }, select: { id: true, name: true } }).catch(() => null);
    }
    const buyerBuildingName = buildingRow?.name || buyerWallet.email || String(buyerWallet.id).slice(0, 8);

    const destinationBatteryMeter = buildingRow?.name ? await prisma.meterInfo.findFirst({
        where: { buildingName: buildingRow.name, type: { contains: 'battery', mode: 'insensitive' } },
    }) : null;

    // Fallback: if no battery, energy goes to consumer meter (increases consumption)
    const destinationMeter = destinationBatteryMeter || (buildingRow?.name ? await prisma.meterInfo.findFirst({
        where: { buildingName: buildingRow.name, type: { contains: 'consume', mode: 'insensitive' } },
    }) : null);

    if (!destinationMeter) {
        const err = new Error('Target building must have a battery or consumer meter to receive purchased energy'); err.status = 400; throw err;
    }
    const isBatteryTarget = !!destinationBatteryMeter;

    let verifyTransaction;
    try {
        const txVer = require('../transactions/transactionVerification.service');
        verifyTransaction = txVer.verifyTransaction;
    } catch {
        verifyTransaction = async (tx) => ({ transaction: tx, verification: { status: 'skipped' } });
    }

    const result = await prisma.$transaction(async (tx) => {
        await tx.wallet.update({ where: { id: String(buyerWallet.id) }, data: { tokenBalance: { decrement: totalPrice } } });
        await tx.wallet.update({ where: { id: String(sellerWallet.id) }, data: { tokenBalance: { increment: totalPrice } } });

        // Deduct energy from seller's source meter
        if (sellerSourceMeter) {
            const sellerNextValue = Math.max(0, Number(sellerSourceMeter.value || 0) - purchaseAmount);
            const sellerNextKwh = Math.max(0, Number(sellerSourceMeter.kWH || sellerSourceMeter.kwh || 0) - purchaseAmount);
            await tx.meterInfo.update({ where: { snid: sellerSourceMeter.snid }, data: { value: sellerNextValue, kWH: sellerNextKwh, timestamp: new Date() } });
        }

        const nextValue = Number(destinationMeter.value || 0) + purchaseAmount;
        const nextKwh = Number(destinationMeter.kWH || destinationMeter.kwh || 0) + purchaseAmount;
        await tx.meterInfo.update({ where: { snid: destinationMeter.snid }, data: { value: nextValue, kWH: nextKwh, timestamp: new Date() } });

        const buyerWalletTxId = randomUUID();
        await tx.walletTx.create({ data: { id: buyerWalletTxId, walletId: String(buyerWallet.id), timestamp: new Date(), tokenInOut: -totalPrice } });
        await tx.walletTx.create({ data: { id: randomUUID(), walletId: String(sellerWallet.id), timestamp: new Date(), tokenInOut: totalPrice } });

        const buyerTransaction = await tx.transaction.create({ data: { txid: randomUUID(), timestamp: new Date(), buildingName: buildingRow?.name || null, walletId: String(buyerWallet.id), type: 'MARKETPLACE_PURCHASE', tokenAmount: totalPrice, status: 'CONFIRMED' } });
        const sellerBuildingName = sellerBuildingRow?.name || sellerSourceMeter?.buildingName || null;
        const sellerTransaction = await tx.transaction.create({ data: { txid: randomUUID(), timestamp: new Date(), buildingName: sellerBuildingName, walletId: String(sellerWallet.id), type: 'MARKETPLACE_SALE', tokenAmount: totalPrice, status: 'CONFIRMED' } });

        const now = new Date();
        const invoice = await tx.invoice.create({ data: { id: randomUUID(), buildingName: String(buildingRow?.name || `Building-${buyerWallet.id}`), fromWId: String(sellerWallet.id), toWId: String(buyerWallet.id), timestamp: now, kWH: purchaseAmount, tokenAmount: totalPrice, status: 'paid', month: now.getMonth() + 1, year: now.getFullYear(), dailyAvg: purchaseAmount, peakDate: now, peakkWH: purchaseAmount } });
        const receipt = await tx.receipt.create({ data: { id: randomUUID(), invoiceId: String(invoice.id), timestamp: new Date(), walletTxId: String(buyerWalletTxId) } });

        const newBought = Number(bid.kWHBought || bid.kwhBought || 0) + purchaseAmount;
        const totalKwh = Number(bid.kWH || bid.kwh || 0);
        const newStatus = newBought >= totalKwh ? 'FULFILLED' : 'OPEN';
        await tx.energyBid.update({ where: { id: parseInt(bidId, 10) }, data: { kWHBought: newBought, status: newStatus } });

        // Sync marketOrder (frontend reads from marketOrder, not energyBid directly)
        if (marketOrderId) {
          try {
            const moStatus = newBought >= totalKwh ? 'FILLED' : 'PARTIAL';
            await tx.marketOrder.update({
              where: { id: marketOrderId },
              data: { filled: newBought, status: moStatus },
            });
          } catch (moErr) { console.warn('[sellToBid] marketOrder sync failed:', moErr.message); }
        }

        return { invoice, receipt, destinationMeter: { snid: destinationMeter.snid, value: nextValue, kWH: nextKwh, type: isBatteryTarget ? 'battery' : 'consumer' }, buyerTransaction, sellerTransaction };
    });

    const buyerVerification = await verifyTransaction({ ...result.buyerTransaction, kwh: purchaseAmount, fromBuilding: sellerBuildingName, toBuilding: buyerBuildingName, buildingName: buyerBuildingName });
    const sellerVerification = await verifyTransaction({ ...result.sellerTransaction, kwh: purchaseAmount, fromBuilding: sellerBuildingName, toBuilding: buyerBuildingName, buildingName: sellerBuildingName });

    // Log energy receipt to RunningMeter (outside transaction — safe after commit)
    try {
        const { insertRunningMeter } = require('../energy/energyAggregation');
        await insertRunningMeter({ snid: destinationMeter.snid, timestamp: new Date(), kW: purchaseAmount, kWH: Number(destinationMeter.kWH || destinationMeter.kwh || 0) + purchaseAmount, source: 'MARKET' });
    } catch (e) { console.warn('[sellToBid] RunningMeter log failed:', e.message); }

    // Log energy deduction from seller's source meter
    if (sellerSourceMeter) {
        try {
            const { insertRunningMeter } = require('../energy/energyAggregation');
            const sellerNextKwh = Math.max(0, Number(sellerSourceMeter.kWH || sellerSourceMeter.kwh || 0) - purchaseAmount);
            await insertRunningMeter({ snid: sellerSourceMeter.snid, timestamp: new Date(), kW: -purchaseAmount, kWH: sellerNextKwh, source: 'SOLD' });
        } catch (e) { console.warn('[sellToBid] Seller RunningMeter log failed:', e.message); }
    }

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
