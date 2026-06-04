const { prisma } = require('../../utils/prisma');
const { randomUUID } = require('crypto');

// Helper: create MarketOrder mapping for an existing energyBid or energyOffer
async function ensureMarketOrderForBid(txOrClient, bid) {
    // bid: energyBid row
    const key = `energyBid:${bid.id}`;
    // create a MarketOrder with metadata referencing energyBid
    const created = await txOrClient.marketOrder.create({
        data: {
            side: 'BID',
            marketType: bid.marketType || 'DAY_AHEAD',
            walletId: String(bid.buyerWalletId),
            quantity: Number(bid.kWH),
            filled: Number(bid.kWHBought || 0),
            price: bid.ratePerkWH != null ? Number(bid.ratePerkWH) : null,
            status: 'OPEN',
            targetDate: bid.targetDate,
            metadata: { energyBidId: bid.id }
        }
    });
    return created;
}

async function ensureMarketOrderForOffer(txOrClient, offer) {
    const created = await txOrClient.marketOrder.create({
        data: {
            side: 'OFFER',
            marketType: offer.marketType || 'DAY_AHEAD',
            walletId: String(offer.sellerWalletId),
            quantity: Number(offer.kWH),
            filled: Number(offer.kWHSold || 0),
            price: Number(offer.ratePerkWH),
            status: 'OPEN',
            targetDate: offer.targetDate,
            metadata: { energyOfferId: offer.id }
        }
    });
    return created;
}

/**
 * 1. Intra-building Matching (จับคู่ภายในตึกเดียวกันก่อน)
 */
async function processIntraBuildingMatching(targetDate) {
    console.log(`[Market] Starting Intra-building matching for ${targetDate.toISOString()}`);
    
    // หา Bids และ Offers ของ Day Ahead ที่ยังเปิดอยู่
    const bids = await prisma.energyBid.findMany({
        where: { marketType: 'DAY_AHEAD', targetDate, status: 'OPEN' }
    });
    
    const offers = await prisma.energyOffer.findMany({
        where: { marketType: 'DAY_AHEAD', targetDate, status: 'AVAILABLE' }
    });

    let matchedKwh = 0;
    // create a run placeholder map so that matches can be linked later
    const createdMatches = [];

    // วนลูปจับคู่ทีละคำสั่งซื้อ
    for (const bid of bids) {
        let remainingBidKwh = Number(bid.kWH) - Number(bid.kWHBought);
        if (remainingBidKwh <= 0) continue;

        // หา Offer ที่เป็นของตึกตัวเอง (walletId เดียวกัน)
        const ownOffers = offers.filter(o => 
            o.sellerWalletId === bid.buyerWalletId && 
            Number(o.kWH) - Number(o.kWHSold || 0) > 0 && 
            o.status === 'AVAILABLE'
        );

        for (const ownOffer of ownOffers) {
            const remainingOfferKwh = Number(ownOffer.kWH) - Number(ownOffer.kWHSold || 0);
            const matchAmount = Math.min(remainingBidKwh, remainingOfferKwh);

            // อัปเดต Database (ไม่มีการหักเงินเพราะตึกเดียวกัน)
            await prisma.$transaction(async (tx) => {
                await tx.energyBid.update({
                    where: { id: bid.id },
                    data: { 
                        kWHBought: { increment: matchAmount },
                        status: (remainingBidKwh - matchAmount) <= 0.001 ? 'FULFILLED' : 'OPEN'
                    }
                });
                await tx.energyOffer.update({
                    where: { id: ownOffer.id },
                    data: { 
                        kWHSold: { increment: matchAmount },
                        status: (remainingOfferKwh - matchAmount) <= 0.001 ? 'SOLD' : 'AVAILABLE'
                    }
                });
                
                // บันทึกประวัติการใช้ไฟภายในตึก (Self-consumption)
                await tx.transaction.create({
                    data: {
                        walletId: bid.buyerWalletId,
                        type: 'SELF_CONSUMPTION',
                        tokenAmount: 0, // ไม่หักเงิน
                        status: 'CONFIRMED'
                    }
                });
                // Create MarketOrder rows for buyer/seller and a MarketMatch referencing them
                try {
                    const buyerOrder = await ensureMarketOrderForBid(tx, bid);
                    const sellerOrder = await ensureMarketOrderForOffer(tx, ownOffer);
                    // create match
                    const mm = await tx.marketMatch.create({
                        data: {
                            buyerOrderId: buyerOrder.id,
                            sellerOrderId: sellerOrder.id,
                            quantity: matchAmount,
                            price: 0
                        }
                    });
                    createdMatches.push(mm);
                    // update filled quantities
                    await tx.marketOrder.update({ where: { id: buyerOrder.id }, data: { filled: { increment: matchAmount }, status: (Number(buyerOrder.filled) + matchAmount) >= Number(buyerOrder.quantity) ? 'FILLED' : 'PARTIAL' } });
                    await tx.marketOrder.update({ where: { id: sellerOrder.id }, data: { filled: { increment: matchAmount }, status: (Number(sellerOrder.filled) + matchAmount) >= Number(sellerOrder.quantity) ? 'FILLED' : 'PARTIAL' } });
                } catch (e) {
                    console.warn('MarketOrder/MarketMatch creation failed in intra-building match', e.message || e);
                }
            });
            
            matchedKwh += matchAmount;
            remainingBidKwh -= matchAmount;
            ownOffer.kWHSold = Number(ownOffer.kWHSold || 0) + matchAmount; 
            if (Number(ownOffer.kWH) - ownOffer.kWHSold <= 0.001) ownOffer.status = 'SOLD';
            
            if (remainingBidKwh <= 0.001) break; // ถ้าคำสั่งซื้อนี้เต็มแล้ว ให้หยุดลูปไป Bid ถัดไป
        }
    }
    console.log(`[Market] Matched ${matchedKwh} kWh internally (Self-consumption).`);
    return matchedKwh;
}

/**
 * 2. Cross-building Matching & Fallback to Intraday
 */
async function processDayAheadClearing(targetDate) {
    console.log(`[Market] Clearing Day-Ahead market for ${targetDate.toISOString()}`);

    // Pricing baseline rules (configurable via env)
    const BASELINE_PRICE = Number(process.env.MARKET_BASELINE_PRICE || 3.5);
    const BID_MIN_PRICE = Number(process.env.MARKET_BID_MIN_PRICE || 3.5); // bids below this are ignored (unless null = market order)
    const OFFER_MAX_PRICE = Number(process.env.MARKET_OFFER_MAX_PRICE || 4.0); // offers priced above this are out of Day-Ahead
    const PENALTY_PRICE = Number(process.env.MARKET_PENALTY_PRICE || 3.5);
    const FORCE_DISTRIBUTION_ENABLED = (process.env.MARKET_FORCE_DISTRIBUTE || 'true') === 'true';

    // ดึง Bid/Offer ที่ยังเปิดอยู่ — จากทั้ง energyBid/energyOffer และ MarketOrder
    let bidsRaw = await prisma.energyBid.findMany({ where: { marketType: 'DAY_AHEAD', targetDate, status: 'OPEN' } });
    let offersRaw = await prisma.energyOffer.findMany({ where: { marketType: 'DAY_AHEAD', targetDate, status: 'AVAILABLE' } });

    // Also fetch MarketOrder records that aren't already in energyBid/energyOffer
    const marketOrders = await prisma.marketOrder.findMany({
        where: { marketType: 'DAY_AHEAD', status: { in: ['OPEN', 'PARTIAL'] } },
    });
    console.log(`[Market] Found ${marketOrders.length} MarketOrders, ${bidsRaw.length} energyBids, ${offersRaw.length} energyOffers`);
    for (const mo of marketOrders) {
        if (mo.side === 'BID') {
            const exists = bidsRaw.find(b => String(b.id) === String(mo.id));
            if (!exists) {
                bidsRaw.push({
                    id: mo.id,
                    buyerWalletId: mo.walletId,
                    kWH: Number(mo.quantity),
                    kWHBought: Number(mo.filled || 0),
                    ratePerkWH: mo.price != null ? Number(mo.price) : null,
                    status: 'OPEN',
                    marketType: 'DAY_AHEAD',
                    targetDate: mo.targetDate,
                });
            }
        } else {
            const exists = offersRaw.find(o => String(o.id) === String(mo.id));
            if (!exists) {
                offersRaw.push({
                    id: mo.id,
                    sellerWalletId: mo.walletId,
                    kWH: Number(mo.quantity),
                    kWHSold: Number(mo.filled || 0),
                    ratePerkWH: mo.price != null ? Number(mo.price) : 0,
                    status: 'AVAILABLE',
                    marketType: 'DAY_AHEAD',
                    targetDate: mo.targetDate,
                });
            }
        }
    }

    // Helper: map walletId -> building
    async function getBuildingForWallet(walletId) {
        if (!walletId) return null;
        const wallet = await prisma.wallet.findUnique({ where: { id: String(walletId) }, select: { email: true } });
        if (!wallet?.email) return null;
        const b = await prisma.building.findFirst({ where: { email: wallet.email } });
        return b || null;
    }

    async function getBatteryKwhForBuilding(building) {
        if (!building) return 0;
        // Prefer Battery table if exists
        const bat = await prisma.battery.findFirst({ where: { buildingId: Number(building.id) }, select: { currentkWH: true } });
        if (bat && bat.currentkWH != null) return Number(bat.currentkWH);
        // Fallback: meterInfo battery kWH
        const meter = await prisma.meterInfo.findFirst({ where: { buildingName: building.name, type: { contains: 'battery', mode: 'insensitive' } }, select: { kWH: true } });
        return meter && meter.kWH != null ? Number(meter.kWH) : 0;
    }

    // Enrich offers with priority flag (co-located solar+battery) and filter by OFFER_MAX_PRICE
    const offers = [];
    for (const o of offersRaw) {
        if (o.ratePerkWH != null && Number(o.ratePerkWH) > OFFER_MAX_PRICE) continue; // skip overpriced offers
        const sellerBuilding = await getBuildingForWallet(o.sellerWalletId);
        const hasSolar = !!(sellerBuilding && sellerBuilding.produceSN);
        const hasBattery = !!(sellerBuilding && sellerBuilding.batSN);
        const priority = hasSolar && hasBattery; // co-located
        offers.push({ ...o, priority, sellerBuilding });
    }

    // Filter bids by BID_MIN_PRICE (allow null as market order -> accept)
    const bids = [];
    for (const b of bidsRaw) {
        if (b.ratePerkWH != null && Number(b.ratePerkWH) < BID_MIN_PRICE) continue; // skip low bids
        const buyerBuilding = await getBuildingForWallet(b.buyerWalletId);
        const buyerBatteryKwh = await getBatteryKwhForBuilding(buyerBuilding);
        bids.push({ ...b, buyerBuilding, buyerBatteryKwh });
    }

    // Sort bids: price desc, tie-breaker: buyerBatteryKwh asc (lower battery gets priority)
    bids.sort((a, b) => {
        const aPrice = a.ratePerkWH == null ? Infinity : Number(a.ratePerkWH);
        const bPrice = b.ratePerkWH == null ? Infinity : Number(b.ratePerkWH);
        if (aPrice !== bPrice) return bPrice - aPrice;
        return a.buyerBatteryKwh - b.buyerBatteryKwh;
    });

    // Sort offers: priority first (co-located solar+battery), then price asc
    offers.sort((a, b) => {
        if (a.priority && !b.priority) return -1;
        if (!a.priority && b.priority) return 1;
        const aPrice = a.ratePerkWH == null ? 0 : Number(a.ratePerkWH);
        const bPrice = b.ratePerkWH == null ? 0 : Number(b.ratePerkWH);
        return aPrice - bPrice;
    });

    // Force-distribution: if enabled and there are offers but no bids, distribute unsold offers
    async function forceDistributeOffers(offersList) {
        if (!FORCE_DISTRIBUTION_ENABLED) return { distributed: 0, priorityTable: [] };
        if (!offersList || offersList.length === 0) return { distributed: 0, priorityTable: [] };

        // --- Phase A: Compute scores for ALL buildings ---
        const now = new Date();
        const year = now.getFullYear();

        const buildings = await prisma.building.findMany();
        const buildingScores = [];
        for (const b of buildings) {
            // Battery: MeterInfo type=battery, fallback Battery table
            let batteryKwh = 0;
            let batteryCapacity = 0;
            const batteryMeter = await prisma.meterInfo.findFirst({
                where: { buildingName: b.name, type: { contains: 'battery', mode: 'insensitive' } },
                select: { kWH: true, capacity: true },
            });
            if (batteryMeter) {
                batteryKwh = Number(batteryMeter.kWH || 0);
                batteryCapacity = Number(batteryMeter.capacity || 0);
            } else {
                const bat = await prisma.battery.findFirst({
                    where: { buildingId: Number(b.id) },
                    select: { currentkWH: true, capacitykWH: true },
                });
                if (bat) {
                    batteryKwh = Number(bat.currentkWH || 0);
                    batteryCapacity = Number(bat.capacitykWH || 0);
                }
            }

            // Monthly energy: sum all meters' MonthlyEnergy.kwh
            const meters = await prisma.meterInfo.findMany({
                where: { buildingName: b.name },
                select: { snid: true },
            });
            let monthlySum = 0;
            for (const m of meters) {
                const me = await prisma.monthlyEnergy.findUnique({
                    where: { meterSnid_year: { meterSnid: m.snid, year } },
                }).catch(() => null);
                if (me && me.kwh != null) monthlySum += Number(me.kwh);
            }

            // Score = monthly_consumption + available_capacity → higher = more priority (low battery = urgent need)
            const score = monthlySum + Math.max(0, batteryCapacity - batteryKwh);
            buildingScores.push({
                building: b,
                score,
                batteryKwh,
                batteryCapacity,
                monthlySum,
                batteryMode: (b.batteryTradeMode || b.tradeMode || 'MANUAL').toUpperCase(),
                batteryThresholdPct: Number(b.batterySellThreshold != null ? b.batterySellThreshold : 80),
            });
        }

        // Sort for cross-building priority (higher score first)
        buildingScores.sort((x, y) => y.score - x.score);

        // --- Phase B: Build priority table (cross-building only, self-charge added per-offer) ---
        const crossPriorityTable = buildingScores.map((bs, idx) => ({
            rank: idx + 1,
            building: bs.building.name,
            batteryKwh: Math.round(bs.batteryKwh * 100) / 100,
            batteryCapacity: Math.round(bs.batteryCapacity * 100) / 100,
            monthlyConsumptionKwh: Math.round((bs.monthlySum || 0) * 100) / 100,
            score: Math.round(bs.score * 100) / 100,
            allocatedKwh: 0,
            walletBalance: 0,
            status: 'skipped',
            note: '',
        }));

        // --- Phase C: Distribute each offer ---
        let distributedTotal = 0;
        const distributionLog = []; // per-offer distribution details

        for (const offer of offersList) {
            let remaining = Number(offer.kWH || offer.quantity || 0) - Number(offer.kWHSold || offer.filled || 0);
            if (remaining <= 0) continue;

            const pricePerKwh = offer.ratePerkWH != null ? Number(offer.ratePerkWH) : PENALTY_PRICE;

            // Find seller's building
            const sellerWallet = await prisma.wallet.findUnique({
                where: { id: String(offer.sellerWalletId) },
                select: { email: true },
            });
            const sellerBuilding = sellerWallet
                ? await prisma.building.findFirst({ where: { email: sellerWallet.email } })
                : null;

            const offerLog = {
                offerId: offer.id,
                sellerBuilding: sellerBuilding?.name || 'Unknown',
                sellerWalletId: offer.sellerWalletId,
                totalKwh: remaining,
                selfChargedKwh: 0,
                crossDistributedKwh: 0,
                recipients: [],
            };

            // ── Step C1: Self-charge (seller's own battery) ──
            if (sellerBuilding && remaining > 0) {
                const sellerBatteryMeter = await prisma.meterInfo.findFirst({
                    where: {
                        buildingName: sellerBuilding.name,
                        type: { contains: 'battery', mode: 'insensitive' },
                    },
                    select: { kWH: true, capacity: true, snid: true },
                });

                if (sellerBatteryMeter && sellerBatteryMeter.capacity) {
                    const currentKwh = Number(sellerBatteryMeter.kWH || 0);
                    const capacity = Number(sellerBatteryMeter.capacity || 0);
                    const batteryMode = (sellerBuilding.batteryTradeMode || sellerBuilding.tradeMode || 'MANUAL').toUpperCase();
                    const thresholdPct = Number(sellerBuilding.batterySellThreshold != null ? sellerBuilding.batterySellThreshold : 80);

                    let maxSelfCharge = 0;
                    let selfChargeReason = '';

                    if (batteryMode === 'SELF_CONSUME') {
                        // Charge up to 100% capacity
                        maxSelfCharge = Math.max(0, capacity - currentKwh);
                        selfChargeReason = `SELF_CONSUME → charge to 100% (${currentKwh.toFixed(1)}/${capacity.toFixed(1)} kWh)`;
                    } else if (batteryMode === 'AUTO_BATTERY_THRESHOLD') {
                        // Charge up to threshold% of capacity
                        const thresholdKwh = capacity * (thresholdPct / 100);
                        maxSelfCharge = Math.max(0, thresholdKwh - currentKwh);
                        selfChargeReason = `AUTO → charge to ${thresholdPct}% (${currentKwh.toFixed(1)}/${capacity.toFixed(1)} kWh, target ${thresholdKwh.toFixed(1)})`;
                    }

                    if (maxSelfCharge > 0 && remaining > 0) {
                        const selfTake = Math.min(remaining, maxSelfCharge);
                        if (selfTake > 0) {
                            // Free transfer: update battery meter, no token cost
                            await prisma.$transaction(async (tx) => {
                                await tx.meterInfo.update({
                                    where: { snid: sellerBatteryMeter.snid },
                                    data: { kWH: { increment: selfTake } },
                                });
                                // Mark offer as partially/fully used
                                try {
                                    const fOfferId = String(offer.id);
                                    const fOfferIsInt = !fOfferId.includes('-');
                                    if (fOfferIsInt) {
                                        await tx.energyOffer.update({
                                            where: { id: parseInt(fOfferId, 10) },
                                            data: {
                                                kWHSold: { increment: selfTake },
                                                status: (Number(offer.kWH || 0) - selfTake - Number(offer.kWHSold || 0)) <= 0.001 ? 'SOLD' : 'AVAILABLE',
                                            },
                                        });
                                    } else {
                                        await tx.$executeRawUnsafe(
                                            `UPDATE "EnergyOffer" SET "kWHSold" = COALESCE("kWHSold",0) + $1, "status" = $2::text::"EnergyOfferStatus" WHERE "id"::text = $3`,
                                            selfTake, (Number(offer.kWH || 0) - selfTake - Number(offer.kWHSold || 0)) <= 0.001 ? 'SOLD' : 'AVAILABLE', fOfferId
                                        );
                                    }
                                } catch {
                                    await tx.marketOrder.update({
                                        where: { id: offer.id },
                                        data: {
                                            filled: { increment: selfTake },
                                            status: (Number(offer.kWH || offer.quantity || 0) - selfTake - Number(offer.kWHSold || offer.filled || 0)) <= 0.001 ? 'FILLED' : 'PARTIAL',
                                        },
                                    }).catch(() => {});
                                }
                            });

                            remaining -= selfTake;
                            offerLog.selfChargedKwh = Math.round(selfTake * 100) / 100;
                            offerLog.selfChargeReason = selfChargeReason;

                            // Update cross-priority table: seller's own row
                            const sellerEntry = crossPriorityTable.find(p => p.building === sellerBuilding.name);
                            if (sellerEntry) {
                                sellerEntry.allocatedKwh = Math.round((sellerEntry.allocatedKwh + selfTake) * 100) / 100;
                                sellerEntry.status = 'self_charged';
                                sellerEntry.note = selfChargeReason;
                            }
                        }
                    }
                }
            }

            // ── Step C2: Cross-building distribution (remaining energy) ──
            if (remaining > 0) {
                for (const bs of buildingScores) {
                    if (remaining <= 0) break;

                    // Skip seller's own building (already handled in self-charge)
                    if (sellerBuilding && bs.building.name === sellerBuilding.name) continue;

                    const buyerWallet = await prisma.wallet.findFirst({
                        where: { email: bs.building.email },
                        select: { id: true, tokenBalance: true },
                    });
                    if (!buyerWallet) continue;

                    const buyerBalance = Number(buyerWallet.tokenBalance || 0);
                    const maxAffordable = Math.floor((buyerBalance / pricePerKwh) * 10000) / 10000;
                    if (maxAffordable <= 0) continue;

                    const take = Math.min(remaining, maxAffordable);
                    if (take <= 0) continue;

                    const totalCost = take * pricePerKwh;
                    const adminFee = totalCost * 0.05;
                    const sellerRevenue = totalCost - adminFee;

                    await prisma.$transaction(async (tx) => {
                        try {
                            const fOfferId = String(offer.id);
                            const fOfferIsInt = !fOfferId.includes('-');
                            if (fOfferIsInt) {
                                await tx.energyOffer.update({
                                    where: { id: parseInt(fOfferId, 10) },
                                    data: {
                                        kWHSold: { increment: take },
                                        status: (Number(offer.kWH || 0) - take - Number(offer.kWHSold || 0)) <= 0.001 ? 'SOLD' : 'AVAILABLE',
                                    },
                                });
                            } else {
                                await tx.$executeRawUnsafe(
                                    `UPDATE "EnergyOffer" SET "kWHSold" = COALESCE("kWHSold",0) + $1, "status" = $2::text::"EnergyOfferStatus" WHERE "id"::text = $3`,
                                    take, (Number(offer.kWH || 0) - take - Number(offer.kWHSold || 0)) <= 0.001 ? 'SOLD' : 'AVAILABLE', fOfferId
                                );
                            }
                        } catch {
                            await tx.marketOrder.update({
                                where: { id: offer.id },
                                data: {
                                    filled: { increment: take },
                                    status: (Number(offer.kWH || offer.quantity || 0) - take - Number(offer.kWHSold || offer.filled || 0)) <= 0.001 ? 'FILLED' : 'PARTIAL',
                                },
                            }).catch(() => {});
                        }
                        await tx.wallet.update({ where: { id: buyerWallet.id }, data: { tokenBalance: { decrement: totalCost } } });
                        await tx.wallet.update({ where: { id: offer.sellerWalletId }, data: { tokenBalance: { increment: sellerRevenue } } });
                        const fdBuyerTx = await tx.transaction.create({ data: { walletId: buyerWallet.id, buildingName: bs.building.name, type: 'FORCED_DISTRIBUTION_PURCHASE', tokenAmount: totalCost, status: 'CONFIRMED' } });
                        const fdSellerTx = await tx.transaction.create({ data: { walletId: offer.sellerWalletId, buildingName: sellerBuilding?.name || null, type: 'FORCED_DISTRIBUTION_SALE', tokenAmount: sellerRevenue, status: 'CONFIRMED' } });
                        // Create invoice & receipt for forced distribution
                        try {
                            const now = new Date();
                            const fdInvoice = await tx.invoice.create({
                                data: { id: randomUUID(), buildingName: String(bs.building.name), fromWId: String(offer.sellerWalletId), toWId: String(buyerWallet.id), timestamp: now, kWH: take, tokenAmount: totalCost, status: 'paid', month: now.getMonth() + 1, year: now.getFullYear(), dailyAvg: take, peakDate: now, peakkWH: take }
                            });
                            await tx.receipt.create({ data: { id: randomUUID(), invoiceId: String(fdInvoice.id), timestamp: new Date(), walletTxId: String(fdBuyerTx.txid) } });
                        } catch (invErr) { console.warn('[Market] FD invoice/receipt creation failed:', invErr.message || invErr); }
                        if (typeof createdTxIds !== 'undefined') {
                            createdTxIds.push(fdBuyerTx.txid, fdSellerTx.txid);
                        }
                        const buyerOrder = await tx.marketOrder.create({ data: { side: 'BID', marketType: 'DAY_AHEAD', walletId: buyerWallet.id, quantity: take, filled: take, price: pricePerKwh, status: 'FILLED', targetDate: offer.targetDate, metadata: { forced: true, building: bs.building.name } } });
                        const sellerOrder = await ensureMarketOrderForOffer(tx, offer);
                        await tx.marketMatch.create({ data: { runId: null, buyerOrderId: buyerOrder.id, sellerOrderId: sellerOrder.id, quantity: take, price: pricePerKwh } });
                    });

                    remaining -= take;
                    offerLog.crossDistributedKwh += take;
                    offerLog.recipients.push({ building: bs.building.name, kwh: Math.round(take * 100) / 100, cost: Math.round(totalCost * 100) / 100 });

                    const entry = crossPriorityTable.find(p => p.building === bs.building.name);
                    if (entry) {
                        entry.allocatedKwh = Math.round((entry.allocatedKwh + take) * 100) / 100;
                        entry.walletBalance = Math.round(buyerBalance * 100) / 100;
                        entry.status = 'received';
                    }
                }
            }

            distributedTotal += (offerLog.selfChargedKwh + offerLog.crossDistributedKwh);
            distributionLog.push(offerLog);
        }

        return { distributed: Math.round(distributedTotal * 100) / 100, priorityTable: crossPriorityTable, distributionLog };
    }

    const ADMIN_FEE_RATE = 0.05; // ค่าธรรมเนียมแพลตฟอร์ม 5%
    let totalMatchedKwh = 0;
    const createdMatches = [];
    const matchLog = []; // simple match info for frontend (fallback)
    // cache for marketOrders to avoid re-creating duplicates
    const orderCache = new Map();
    // Collect transaction IDs created during matching for blockchain verification
    const createdTxIds = [];

    for (const bid of bids) {
        let remainingBidKwh = Number(bid.kWH) - Number(bid.kWHBought);
        if (remainingBidKwh <= 0) continue;

        for (const offer of offers) {
            if (offer.status !== 'AVAILABLE') continue;
            // ข้ามตึกตัวเอง (ถูกจับคู่ไปแล้วในเฟส 1)
            if (offer.sellerWalletId === bid.buyerWalletId) continue;

            const offerRate = Number(offer.ratePerkWH);
            // ถ้ายอมรับราคาตลาด (null) ให้ถือว่ายินดีสู้ไม่อั้น (Infinity)
            const bidRate = bid.ratePerkWH !== null ? Number(bid.ratePerkWH) : Infinity; 
            
            // ถ้าราคาขาย แพงกว่า ราคาที่รับซื้อไหว -> ข้าม (Matching failed)
            if (offerRate > bidRate) continue;

            let remainingOfferKwh = Number(offer.kWH) - Number(offer.kWHSold);
            if (remainingOfferKwh <= 0) continue;

            const matchAmount = Math.min(remainingBidKwh, remainingOfferKwh);
            const clearingPrice = offerRate; // ใช้ราคาเสนอขาย (Pay-as-bid)
            const totalCost = matchAmount * clearingPrice;
            const adminFee = totalCost * ADMIN_FEE_RATE;
            const sellerRevenue = totalCost - adminFee;

            // เริ่มการตัดเงินและโอนพลังงานแบบข้ามตึก
            await prisma.$transaction(async (tx) => {
                // 1. อัปเดตยอดของคนซื้อ และ คนขาย
                const bidIdStr = String(bid.id);
                const bidIsInt = !bidIdStr.includes('-');
                if (bidIsInt) {
                    await tx.energyBid.update({
                        where: { id: parseInt(bidIdStr, 10) },
                        data: {
                            kWHBought: { increment: matchAmount },
                            status: (remainingBidKwh - matchAmount) <= 0.001 ? 'FULFILLED' : 'OPEN'
                        }
                    });
                } else {
                    await tx.$executeRawUnsafe(
                        `UPDATE "EnergyBid" SET "kWHBought" = COALESCE("kWHBought",0) + $1, "status" = $2::text::"EnergyBidStatus" WHERE "id"::text = $3`,
                        matchAmount, (remainingBidKwh - matchAmount) <= 0.001 ? 'FULFILLED' : 'OPEN', bidIdStr
                    );
                }

                const offerIdStr = String(offer.id);
                const offerIsInt = !offerIdStr.includes('-');
                if (offerIsInt) {
                    await tx.energyOffer.update({
                        where: { id: parseInt(offerIdStr, 10) },
                        data: {
                            kWHSold: { increment: matchAmount },
                            status: (remainingOfferKwh - matchAmount) <= 0.001 ? 'SOLD' : 'AVAILABLE'
                        }
                    });
                } else {
                    await tx.$executeRawUnsafe(
                        `UPDATE "EnergyOffer" SET "kWHSold" = COALESCE("kWHSold",0) + $1, "status" = $2::text::"EnergyOfferStatus" WHERE "id"::text = $3`,
                        matchAmount, (remainingOfferKwh - matchAmount) <= 0.001 ? 'SOLD' : 'AVAILABLE', offerIdStr
                    );
                }

                // 2. หักเงินผู้ซื้อ
                await tx.wallet.update({
                    where: { id: bid.buyerWalletId },
                    data: { tokenBalance: { decrement: totalCost } }
                });

                // 3. จ่ายเงินผู้ขาย (หลังหักค่าธรรมเนียม)
                await tx.wallet.update({
                    where: { id: offer.sellerWalletId },
                    data: { tokenBalance: { increment: sellerRevenue } }
                });

                // 4. บันทึกประวัติ (ผู้ขาย)
                // tokenAmount stored as positive; sign determined by type in frontend
                const sellerTx = await tx.transaction.create({
                    data: {
                        walletId: offer.sellerWalletId,
                        buildingName: offer.sellerBuilding?.name || null,
                        type: 'MARKETPLACE_SALE',
                        tokenAmount: sellerRevenue,
                        status: 'CONFIRMED'
                    }
                });
                createdTxIds.push(sellerTx.txid);
                
                // 5. บันทึกประวัติ (ผู้ซื้อ)
                // tokenAmount stored as positive; sign determined by type in frontend
                const buyerTx = await tx.transaction.create({
                    data: {
                        walletId: bid.buyerWalletId,
                        buildingName: bid.buyerBuilding?.name || null,
                        type: 'MARKETPLACE_PURCHASE',
                        tokenAmount: totalCost,
                        status: 'CONFIRMED'
                    }
                });
                createdTxIds.push(buyerTx.txid);
                // Create invoice & receipt for this match
                try {
                    const now = new Date();
                    const buyerBuildingName = bid.buyerBuilding?.name || `Building-${bid.buyerWalletId}`;
                    const matchInvoice = await tx.invoice.create({
                        data: { id: randomUUID(), buildingName: String(buyerBuildingName), fromWId: String(offer.sellerWalletId), toWId: String(bid.buyerWalletId), timestamp: now, kWH: take, tokenAmount: totalCost, status: 'paid', month: now.getMonth() + 1, year: now.getFullYear(), dailyAvg: take, peakDate: now, peakkWH: take }
                    });
                    await tx.receipt.create({ data: { id: randomUUID(), invoiceId: String(matchInvoice.id), timestamp: new Date(), walletTxId: String(buyerTx.txid) } });
                } catch (invErr) { console.warn('[Market] Match invoice/receipt creation failed:', invErr.message || invErr); }
                // Create or fetch MarketOrder records and a MarketMatch
                try {
                    let buyerOrder = orderCache.get(`bid:${bid.id}`);
                    if (!buyerOrder) {
                        buyerOrder = await ensureMarketOrderForBid(tx, bid);
                        orderCache.set(`bid:${bid.id}`, buyerOrder);
                    }
                    let sellerOrder = orderCache.get(`offer:${offer.id}`);
                    if (!sellerOrder) {
                        sellerOrder = await ensureMarketOrderForOffer(tx, offer);
                        orderCache.set(`offer:${offer.id}`, sellerOrder);
                    }

                    const mm = await tx.marketMatch.create({
                        data: {
                            runId: null,
                            buyerOrderId: buyerOrder.id,
                            sellerOrderId: sellerOrder.id,
                            quantity: matchAmount,
                            price: clearingPrice
                        }
                    });
                    createdMatches.push(mm);
                    matchLog.push({ buyerWalletId: bid.buyerWalletId, sellerWalletId: offer.sellerWalletId, quantity: matchAmount, price: clearingPrice });

                    // update MarketOrder filled counts
                    await tx.marketOrder.update({ where: { id: buyerOrder.id }, data: { filled: { increment: matchAmount }, status: (Number(buyerOrder.filled) + matchAmount) >= Number(buyerOrder.quantity) ? 'FILLED' : 'PARTIAL' } });
                    await tx.marketOrder.update({ where: { id: sellerOrder.id }, data: { filled: { increment: matchAmount }, status: (Number(sellerOrder.filled) + matchAmount) >= Number(sellerOrder.quantity) ? 'FILLED' : 'PARTIAL' } });
                } catch (e) {
                    console.warn('MarketMatch creation failed in cross-building match', e.message || e);
                }
            });

            // อัปเดตค่าในหน่วยความจำเพื่อคำนวณลูปต่อไป
            remainingBidKwh -= matchAmount;
            offer.kWHSold = Number(offer.kWHSold) + matchAmount;
            if (Number(offer.kWH) - offer.kWHSold <= 0.001) offer.status = 'SOLD';
            totalMatchedKwh += matchAmount;

            if (remainingBidKwh <= 0.001) break; // ซื้อครบตามต้องการแล้ว
        }
    }

    // 3. If no bids exist at all, attempt force-distribution to high-priority buildings
    let forceDistributeResult = null;
    console.log(`[Market] Force check: bids=${bids.length} offers=${offers.length} FORCE_ENABLED=${FORCE_DISTRIBUTION_ENABLED}`);
    if (bids.length === 0 && offers.length > 0 && FORCE_DISTRIBUTION_ENABLED) {
        console.log(`[Market] Triggering force distribution for ${offers.length} offers`);
        try {
            forceDistributeResult = await forceDistributeOffers(offers);
            console.log('[Market] Force distribution result:', JSON.stringify(forceDistributeResult));
        } catch (e) {
            console.warn('forceDistributeOffers failed', e.message || e, e.stack);
        }
    }

    // 4. Fallback: move any remaining unsold offers into Intraday at penalty price
    const updatedOffers = await prisma.energyOffer.updateMany({
        where: {
            marketType: 'DAY_AHEAD',
            targetDate,
            status: 'AVAILABLE'
        },
        data: {
            marketType: 'INTRADAY',
            ratePerkWH: PENALTY_PRICE
        }
    });

    console.log(`[Market] Matched ${totalMatchedKwh} kWh across buildings. Moved ${updatedOffers.count} unsold offers to INTRADAY at ฿${PENALTY_PRICE}`);
    
    // 5. Blockchain verification for all created transactions
    if (createdTxIds.length > 0) {
        try {
            const { verifyTransactionById } = require('../blockchain/transactionVerification.service');
            for (const txid of createdTxIds) {
                try {
                    await verifyTransactionById(txid).catch(e => console.warn(`[Market] verify tx ${txid} failed`, e.message || e));
                } catch (e) {
                    console.warn(`[Market] Skipped verification for tx ${txid}:`, e.message || e);
                }
            }
            console.log(`[Market] Verified ${createdTxIds.length} transactions`);
        } catch (e) {
            console.warn('[Market] Blockchain verification failed:', e.message || e);
        }
    }

    return {
        matched: totalMatchedKwh,
        matches: createdMatches,
        matchLog,
        forceDistribution: forceDistributeResult,
    };
}

/**
 * Clean up: cancel/close all remaining Day-Ahead orders after clearing is done.
 * Any unmatched or partially matched orders are cancelled so they disappear from the UI.
 */
async function cleanupDayAheadOrders(targetDate) {
    console.log(`[Market] Cleaning up remaining Day-Ahead orders for ${targetDate.toISOString()}`);

    // 1. Cancel remaining OPEN/PARTIAL MarketOrder records
    try {
        const remainingOrders = await prisma.marketOrder.findMany({
            where: { marketType: 'DAY_AHEAD', status: { in: ['OPEN', 'PARTIAL'] } },
            select: { id: true, status: true, filled: true, quantity: true },
        });
        for (const o of remainingOrders) {
            const qty = Number(o.quantity || 0);
            const filled = Number(o.filled || 0);
            const newStatus = filled >= qty ? 'FILLED' : 'CANCELLED';
            await prisma.marketOrder.update({ where: { id: o.id }, data: { status: newStatus } });
        }
        console.log(`[Market] Updated ${remainingOrders.length} remaining MarketOrders`);
    } catch (e) {
        console.warn('[Market] cleanupDayAheadOrders MarketOrder step failed', e.message || e);
    }

    // 2. Cancel remaining OPEN energyBid records
    try {
        const remainingBids = await prisma.energyBid.findMany({
            where: { marketType: 'DAY_AHEAD', targetDate, status: 'OPEN' },
            select: { id: true, kWH: true, kWHBought: true },
        });
        for (const b of remainingBids) {
            const totalKwh = Number(b.kWH || 0);
            const bought = Number(b.kWHBought || 0);
            const newStatus = bought >= totalKwh ? 'FULFILLED' : 'CANCELLED';
            const bidIdStr = String(b.id);
            const bidIsInt = !bidIdStr.includes('-');
            if (bidIsInt) {
                await prisma.energyBid.update({ where: { id: parseInt(bidIdStr, 10) }, data: { status: newStatus } });
            } else {
                await prisma.$executeRawUnsafe(
                    `UPDATE "EnergyBid" SET "status" = $1::text::"EnergyBidStatus" WHERE "id"::text = $2`,
                    newStatus, bidIdStr
                );
            }
        }
        console.log(`[Market] Updated ${remainingBids.length} remaining energyBids`);
    } catch (e) {
        console.warn('[Market] cleanupDayAheadOrders energyBid step failed', e.message || e);
    }

    // 3. Cancel remaining AVAILABLE energyOffer records
    try {
        const remainingOffers = await prisma.energyOffer.findMany({
            where: { marketType: 'DAY_AHEAD', targetDate, status: 'AVAILABLE' },
            select: { id: true, kWH: true, kWHSold: true },
        });
        for (const o of remainingOffers) {
            const totalKwh = Number(o.kWH || 0);
            const sold = Number(o.kWHSold || 0);
            const newStatus = sold >= totalKwh ? 'SOLD' : 'CANCELLED';
            const offerIdStr = String(o.id);
            const offerIsInt = !offerIdStr.includes('-');
            if (offerIsInt) {
                await prisma.energyOffer.update({ where: { id: parseInt(offerIdStr, 10) }, data: { status: newStatus } });
            } else {
                await prisma.$executeRawUnsafe(
                    `UPDATE "EnergyOffer" SET "status" = $1::text::"EnergyOfferStatus" WHERE "id"::text = $2`,
                    newStatus, offerIdStr
                );
            }
        }
        console.log(`[Market] Updated ${remainingOffers.length} remaining energyOffers`);
    } catch (e) {
        console.warn('[Market] cleanupDayAheadOrders energyOffer step failed', e.message || e);
    }
}

/**
 * ฟังก์ชันหลักที่เรียกใช้งานจาก Cron Job
 */
async function executeMarketClearing(targetDate) {
    // Default to tomorrow for cron, but accept explicit date from API
    const clearingDate = targetDate ? new Date(targetDate) : new Date();
    if (!targetDate) {
        clearingDate.setDate(clearingDate.getDate() + 1);
    }
    clearingDate.setHours(0, 0, 0, 0);

    console.log(`--- STARTING DAY-AHEAD MARKET CLEARING for ${clearingDate.toISOString()} ---`);
    // create a MarketRun record to group matches
    const run = await prisma.marketRun.create({ data: { marketType: 'DAY_AHEAD', runTime: new Date(), status: 'running', startAt: new Date() } });
    try {
        await processIntraBuildingMatching(clearingDate);
        const result = await processDayAheadClearing(clearingDate);
        // attach any created matches to this run
        if (result && Array.isArray(result.matches)) {
            for (const m of result.matches) {
                try {
                    await prisma.marketMatch.update({ where: { id: m.id }, data: { runId: run.id } });
                } catch (e) { console.warn('Failed to attach match to run', e.message || e); }
            }
        }
        // Clean up: cancel all remaining Day-Ahead orders (they've been processed)
        await cleanupDayAheadOrders(clearingDate);
        await prisma.marketRun.update({ where: { id: run.id }, data: { status: 'completed', endAt: new Date(), clearedAt: new Date() } });
        console.log('--- FINISHED DAY-AHEAD MARKET CLEARING ---');
        return { ...run, matched: result?.matched || 0, matches: result?.matches || [], matchLog: result?.matchLog || [], forceDistribution: result?.forceDistribution || null };
    } catch (err) {
        await prisma.marketRun.update({ where: { id: run.id }, data: { status: 'failed', endAt: new Date() } });
        console.error('Market clearing failed:', err.message || err);
        throw err;
    }
}

// Lifecycle helpers for cron jobs
async function preMatchLock(targetDate) {
    // create a MarketRun in locked state to prevent late submissions (informational)
    const run = await prisma.marketRun.create({ data: { marketType: 'DAY_AHEAD', runTime: new Date(), status: 'locked', startAt: new Date() } });
    console.log('[Market] Created locked MarketRun', run.id);
    return run;
}

async function finalizeRun(runId) {
    try {
        await prisma.marketRun.update({ where: { id: runId }, data: { status: 'cleared', clearedAt: new Date(), endAt: new Date() } });
        console.log('[Market] Finalized MarketRun', runId);
    } catch (e) {
        console.warn('[Market] finalizeRun failed', e.message || e);
    }
}

async function openMarketForDay(targetDate) {
    // create an open run marker
    const run = await prisma.marketRun.create({ data: { marketType: 'DAY_AHEAD', runTime: new Date(), status: 'open', startAt: new Date() } });
    console.log('[Market] Market opened for Day-Ahead', run.id);
    return run;
}

module.exports = {
    processIntraBuildingMatching,
    processDayAheadClearing,
    executeMarketClearing
};