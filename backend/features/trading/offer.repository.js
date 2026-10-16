const { randomUUID } = require('crypto');
// Lazy require avoids a top-level circular dependency (billing ↔ trading).
function refreshBuyerMonthlyBill(tx, opts) {
    const { upsertMonthlyBillInTx } = require('../billing/invoice.service');
    return upsertMonthlyBillInTx(tx, opts);
}

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

// Reserve-on-create model: offers/bids only RESERVE energy/tokens.
// Nothing physical moves until a purchase/sale executes, so cancellation
// releases the reservation only in the order tables — no meter/wallet changes.
async function cancelOffer(id) {
    const offer = await prisma.energyOffer.findUnique({ where: { id: parseInt(id) } });
    if (!offer) throw new Error('Offer not found');

    return await prisma.energyOffer.update({
        where: { id: parseInt(id) },
        data: { status: 'CANCELLED' },
    });
}

// ---- Building / Wallet lookup ----

async function getBuildingByWalletId(walletId) {
    const wallet = await WalletModel.getWalletById(walletId);
    if (!wallet?.buildingId) return null;
    return await prisma.building.findUnique({ where: { id: wallet.buildingId } }).catch(() => null);
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
        if (wallet?.buildingId) {
            const building = await prisma.building.findUnique({ where: { id: wallet.buildingId } });
            if (building) {

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

                // Subtract existing AVAILABLE offers from the same wallet, EXCLUDING
                // the offer just created in this transaction — counting it against
                // itself made netAvailable go negative and triggered the old
                // "cancel stale offers" mass-cancellation bug.
                const existingOffers = await tx.energyOffer.findMany({
                    where: { sellerWalletId: String(sellerWalletId), status: 'AVAILABLE', id: { not: created.id } },
                    select: { kWH: true, kWHSold: true },
                });
                const alreadyOfferedKwh = existingOffers.reduce(
                    (sum, o) => sum + Math.max(0, Number(o.kWH || 0) - Number(o.kWHSold || 0)),
                    0,
                );
                const netAvailable = availableEnergy - alreadyOfferedKwh;

                // Round both to 2 decimals to match display precision
                const netRounded = Math.round(netAvailable * 100) / 100;
                if (Math.round(sellAmount * 100) / 100 > netRounded) {
                    // Reserve-on-create: reject clearly instead of silently capping —
                    // throwing rolls the whole transaction back, so no offer row or
                    // MarketOrder mirror is ever left behind.
                    const e = new Error(`Insufficient energy to offer (requested: ${sellAmount}, available net of open offers: ${Math.max(0, netRounded)})`);
                    e.status = 400;
                    throw e;
                }

                // Reserve-on-create: the meter is NOT deducted here. Availability was
                // already checked net of other open offers above. Energy physically
                // leaves the seller's meter when a purchase/sale executes.
                } // end if (!isDayAhead) — Day-Ahead skips the energy availability check

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

    // Reserve-on-create: a priced bid locks tokens in the buyer's wallet
    // (mirrors how offers reserve energy). Enforced by checking balance minus
    // active reservations — the balance itself only moves at execution time.
    if (ratePerKwh == null) {
        // Market-price bids have no price to reserve against
        return await prisma.energyBid.create({
            data: {
                buyerWalletId: String(buyerWalletId),
                kWH: Number(kwh),
                ratePerkWH: null,
                marketType: marketType,
                targetDate: date,
                status: 'OPEN',
            },
        });
    }

    return await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { id: String(buyerWalletId) }, select: { id: true, tokenBalance: true } });
        if (!wallet) { const e = new Error('Buyer wallet not found'); e.status = 404; throw e; }

        const price = Number(ratePerKwh);
        const bidCost = Number(kwh) * price;
        const alreadyReserved = await getActiveBidReserveExcluding(buyerWalletId, null);
        const freeBalance = Number(wallet.tokenBalance) - alreadyReserved;
        if (bidCost > freeBalance) {
            const e = new Error(`Insufficient free balance for bid reservation (required: ${bidCost.toFixed(2)}, free: ${freeBalance.toFixed(2)} after ${alreadyReserved.toFixed(2)} already reserved)`);
            e.status = 400;
            throw e;
        }

        return await tx.energyBid.create({
            data: {
                buyerWalletId: String(buyerWalletId),
                kWH: Number(kwh),
                ratePerkWH: price,
                marketType: marketType,
                targetDate: date,
                status: 'OPEN',
            },
        });
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

// ---- Bid token reservation (reserve-on-create, mirrors offers) ----
// Creating a bid locks tokens in the buyer's wallet; tokens only move to the
// seller when a sale executes. Cancelling refunds the unfilled reservation.

function getBidReservedAmount(bidLike) {
    const total = Number(bidLike.kWH ?? bidLike.kwh ?? 0);
    const bought = Number(bidLike.kWHBought ?? bidLike.kwhBought ?? 0);
    const price = bidLike.ratePerkWH != null ? Number(bidLike.ratePerkWH) : 0;
    return Math.max(0, (total - bought)) * price;
}

// Sum of active (OPEN) reservations across the buyer's other bids
async function getActiveBidReserveExcluding(buyerWalletId, excludeBidId) {
    const activeBids = await prisma.energyBid.findMany({
        where: { buyerWalletId: String(buyerWalletId), status: 'OPEN', ...(excludeBidId != null ? { id: { not: Number(excludeBidId) } } : {}) },
        select: { id: true, kWH: true, kWHBought: true, ratePerkWH: true },
    });
    return activeBids.reduce((sum, b) => sum + getBidReservedAmount(b), 0);
}

async function cancelBid(id) {
    const bid = await prisma.energyBid.findUnique({ where: { id: parseInt(id) } });
    if (!bid) throw new Error('Bid not found');

    // Reserve-on-create: tokens never left the wallet (only checked, not held),
    // so cancelling releases the reservation without any refund — refunding
    // would mint balance out of thin air.
    return await prisma.$transaction(async (tx) => {
        await tx.energyBid.update({ where: { id: parseInt(id) }, data: { status: 'CANCELLED' } });
        // Keep the MarketOrder mirror in sync
        await tx.marketOrder.updateMany({
            where: { side: 'BID', walletId: String(bid.buyerWalletId), status: { in: ['OPEN', 'PARTIAL'] }, quantity: Number(bid.kWH || 0) },
            data: { status: 'CANCELLED' },
        }).catch(() => {});
        return { id: parseInt(id), status: 'CANCELLED', released: getBidReservedAmount(bid) };
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

    // Reservation-aware affordability: the buyer's balance is shared with the
    // outstanding reservations of their other open bids. This sale consumes
    // part of THIS bid's reservation (at the bid's own rate), so only other
    // bids' reservations must stay untouched.
    const otherReserve = await getActiveBidReserveExcluding(String(bid.buyerWalletId), bid.id);
    if (Number(buyerWallet.tokenBalance) < totalPrice + otherReserve) {
        const err = new Error(`Buyer has insufficient free balance (required: ${totalPrice.toFixed(2)}, free: ${(Number(buyerWallet.tokenBalance) - otherReserve).toFixed(2)} after ${otherReserve.toFixed(2)} reserved by other bids)`);
        err.status = 400; err.required = totalPrice; err.available = Number(buyerWallet.tokenBalance); throw err;
    }

    const sellerWallet = await WalletModel.getWalletById(String(sellerWalletId));
    if (!sellerWallet) { const e = new Error('Seller wallet not found'); e.status = 404; throw e; }

    // NOTE: Reserve-on-create — nothing was deducted when any offer/bid was
    // created. Execution below physically moves energy and tokens.
    const sellerBuilding = await getBuildingByWalletId(String(sellerWallet.id)).catch(() => null);
    let sellerBuildingRow = sellerBuilding ? await prisma.building.findUnique({ where: { id: Number(sellerBuilding.id) } }) : null;
    // Fallback: find building by wallet buildingId
    if (!sellerBuildingRow && sellerWallet.buildingId) {
        sellerBuildingRow = await prisma.building.findUnique({ where: { id: sellerWallet.buildingId }, select: { id: true, name: true } }).catch(() => null);
    }

    // Source meter resolved for execution-time deduction + SOLD bookkeeping.
    // Use the shared matcher (produce/producer/solar/pv all count as solar-type sources)
    let sellerSourceMeter = null;
    if (sellerBuildingRow?.name) {
        const candidateMeters = await prisma.meterInfo.findMany({ where: { buildingName: sellerBuildingRow.name } });
        sellerSourceMeter = candidateMeters.find((m) => matchesSourceType(m.type, sourceType)) || null;
    }
    const sellerBuildingName = sellerBuildingRow?.name || sellerSourceMeter?.buildingName || sellerWallet.buildingName || (sellerSourceMeter ? `Battery-${sellerSourceMeter.snid.slice(0,6)}` : String(sellerWallet.id).slice(0, 8));
    // ----

    const building = await getBuildingByWalletId(String(buyerWallet.id)).catch(() => null);
    let buildingRow = building ? await prisma.building.findUnique({ where: { id: Number(building.id) } }) : null;
    if (!buildingRow && buyerWallet.buildingId) {
        buildingRow = await prisma.building.findUnique({ where: { id: buyerWallet.buildingId }, select: { id: true, name: true } }).catch(() => null);
    }
    const buyerBuildingName = buildingRow?.name || String(buyerWallet.id).slice(0, 8);

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
        // Re-check reservation-aware affordability inside the transaction
        const bal = await tx.wallet.findUnique({ where: { id: String(buyerWallet.id) }, select: { tokenBalance: true } });
        if (Number(bal?.tokenBalance || 0) < totalPrice + otherReserve) {
            const e = new Error('Buyer balance changed during sale (reservation check failed)'); e.status = 400; throw e;
        }

        await tx.wallet.update({ where: { id: String(buyerWallet.id) }, data: { tokenBalance: { decrement: totalPrice } } });
        await tx.wallet.update({ where: { id: String(sellerWallet.id) }, data: { tokenBalance: { increment: totalPrice } } });

        // Reserve-on-create: energy only physically leaves the seller's meter at
        // execution time (bid sales bypass offers, so no reservation moved it yet).
        if (sellerSourceMeter) {
            const sellerMeterRow = await tx.meterInfo.findUnique({ where: { snid: sellerSourceMeter.snid }, select: { kWH: true, value: true } });
            const sellerKwhNow = Math.max(0, Number(sellerMeterRow?.kWH ?? sellerMeterRow?.value ?? 0));
            const sellerNextKwh = Math.max(0, sellerKwhNow - purchaseAmount);
            await tx.meterInfo.update({ where: { snid: sellerSourceMeter.snid }, data: { kWH: sellerNextKwh, value: sellerNextKwh, timestamp: new Date() } });
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

        // One bill per month: refresh the buyer's monthly statement instead of creating a trade invoice
        const invoice = await refreshBuyerMonthlyBill(tx, {
            buildingName: buyerBuildingName,
            toWalletId: String(buyerWallet.id),
            at: new Date(),
        });

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

        return { invoice, monthlyBill: invoice, destinationMeter: { snid: destinationMeter.snid, value: nextValue, kWH: nextKwh, type: isBatteryTarget ? 'battery' : 'consumer' }, buyerTransaction, sellerTransaction };
    });

    const buyerVerification = await verifyTransaction({ ...result.buyerTransaction, kwh: purchaseAmount, fromBuilding: sellerBuildingName, toBuilding: buyerBuildingName, buildingName: buyerBuildingName });
    const sellerVerification = await verifyTransaction({ ...result.sellerTransaction, kwh: purchaseAmount, fromBuilding: sellerBuildingName, toBuilding: buyerBuildingName, buildingName: sellerBuildingName });

    // Log energy receipt to RunningMeter (outside transaction — safe after commit)
    try {
        const { insertRunningMeter } = require('../energy/energyAggregation');
        await insertRunningMeter({ snid: destinationMeter.snid, timestamp: new Date(), kW: purchaseAmount, kWH: Number(destinationMeter.kWH || destinationMeter.kwh || 0) + purchaseAmount, source: 'MARKET' });
    } catch (e) { console.warn('[sellToBid] RunningMeter log failed:', e.message); }

    // SOLD bookkeeping: log the sold energy without touching the meter snapshot
    // (kW: 0 keeps syncMeterSnapshot from writing a negative value), and clamp
    // the running kWH to the meter's current state — never below zero.
    if (sellerSourceMeter) {
        try {
            const { insertRunningMeter } = require('../energy/energyAggregation');
            const freshSellerMeter = await prisma.meterInfo.findUnique({ where: { snid: sellerSourceMeter.snid }, select: { kWH: true, value: true } });
            const sellerKwhNow = Math.max(0, Number(freshSellerMeter?.kWH ?? freshSellerMeter?.value ?? 0));
            await insertRunningMeter({ snid: sellerSourceMeter.snid, timestamp: new Date(), kW: 0, kWH: sellerKwhNow, source: 'SOLD' });
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
