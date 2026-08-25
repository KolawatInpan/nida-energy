const { prisma } = require('../../utils/prisma');
const { randomUUID } = require('crypto');

// Helper: create MarketOrder mapping for an existing energyBid or energyOffer
async function ensureMarketOrderForBid(txOrClient, bid) {
    const key = `energyBid:${bid.id}`;
    // Find existing MarketOrder that references this energyBid
    const existing = await txOrClient.marketOrder.findFirst({
        where: { side: 'BID', marketType: bid.marketType || 'DAY_AHEAD', walletId: String(bid.buyerWalletId) },
        orderBy: { createdAt: 'desc' },
    });
    if (existing) {
        return await txOrClient.marketOrder.update({
            where: { id: existing.id },
            data: {
                quantity: Number(bid.kWH),
                filled: Number(bid.kWHBought || 0),
                price: bid.ratePerkWH != null ? Number(bid.ratePerkWH) : null,
                metadata: { energyBidId: bid.id },
            },
        });
    }
    return await txOrClient.marketOrder.create({
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
}

async function ensureMarketOrderForOffer(txOrClient, offer) {
    const existing = await txOrClient.marketOrder.findFirst({
        where: { side: 'OFFER', marketType: offer.marketType || 'DAY_AHEAD', walletId: String(offer.sellerWalletId) },
        orderBy: { createdAt: 'desc' },
    });
    if (existing) {
        return await txOrClient.marketOrder.update({
            where: { id: existing.id },
            data: {
                quantity: Number(offer.kWH),
                filled: Number(offer.kWHSold || 0),
                price: Number(offer.ratePerkWH),
                metadata: { energyOfferId: offer.id },
            },
        });
    }
    return await txOrClient.marketOrder.create({
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
}

/**
 * 1. Intra-building Matching (จับคู่ภายในตึกเดียวกันก่อน)
 */
async function processIntraBuildingMatching(targetDate) {
    console.log(`[Market] Starting Intra-building matching for ${targetDate?.toISOString() || 'ALL dates'}`);
    
    // Handle null targetDate = match all DAY_AHEAD orders
    const bidWhere = targetDate
        ? { marketType: 'DAY_AHEAD', targetDate, status: 'OPEN' }
        : { marketType: 'DAY_AHEAD', status: 'OPEN' };
    const offerWhere = targetDate
        ? { marketType: 'DAY_AHEAD', targetDate, status: 'AVAILABLE' }
        : { marketType: 'DAY_AHEAD', status: 'AVAILABLE' };
    
    const bids = await prisma.energyBid.findMany({ where: bidWhere });
    const offers = await prisma.energyOffer.findMany({ where: offerWhere });

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
async function processDayAheadClearing(targetDate, requireBattery = true) {
    console.log(`[Market] Clearing Day-Ahead market targetDate=${targetDate?.toISOString() || 'ALL'} requireBattery=${requireBattery}`);

    // Pricing baseline rules
    const BASELINE_PRICE = Number(process.env.MARKET_BASELINE_PRICE || 3.5);
    const BID_MIN_PRICE = Number(process.env.MARKET_BID_MIN_PRICE || 3.85);
    const OFFER_MAX_PRICE = Number(process.env.MARKET_OFFER_MAX_PRICE || 4.0);
    const PENALTY_PRICE = Number(process.env.MARKET_PENALTY_PRICE || 3.5);
    const FORCE_DISTRIBUTION_ENABLED = (process.env.MARKET_FORCE_DISTRIBUTE || 'true') === 'true';

    // If targetDate is null → match ALL DAY_AHEAD orders (manual trigger)
    const dayAheadWhere = targetDate
        ? { marketType: 'DAY_AHEAD', targetDate, status: 'OPEN' }
        : { marketType: 'DAY_AHEAD', status: 'OPEN' };
    const dayAheadOfferWhere = targetDate
        ? { marketType: 'DAY_AHEAD', targetDate, status: 'AVAILABLE' }
        : { marketType: 'DAY_AHEAD', status: 'AVAILABLE' };

    let bidsRaw = await prisma.energyBid.findMany({ where: dayAheadWhere });
    let offersRaw = await prisma.energyOffer.findMany({ where: dayAheadOfferWhere });

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
                    _isMarketOrder: true,
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
                    _isMarketOrder: true,
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
        if (b.ratePerkWH != null && Number(b.ratePerkWH) < BID_MIN_PRICE) continue;
        const buyerBuilding = await getBuildingForWallet(b.buyerWalletId);
        // Battery meter check: skip only when requireBattery=true
        if (requireBattery) {
            const buyerBatteryMeter = buyerBuilding?.name ? await prisma.meterInfo.findFirst({
                where: { buildingName: buyerBuilding.name, type: { contains: 'battery', mode: 'insensitive' } },
            }) : null;
            if (!buyerBatteryMeter) {
                console.log(`[Market] Skip bid from ${buyerBuilding?.name || b.buyerWalletId} — no battery meter`);
                continue;
            }
            bids.push({ ...b, buyerBuilding, buyerBatteryKwh: Number(buyerBatteryMeter?.kWH || 0), buyerBatteryMeter });
        } else {
            bids.push({ ...b, buyerBuilding, buyerBatteryKwh: 0, buyerBatteryMeter: null });
        }
    }

    // Deduplicate by walletId
    const seenBidWallets = new Set();
    for (let i = bids.length - 1; i >= 0; i--) {
        if (seenBidWallets.has(bids[i].buyerWalletId)) bids.splice(i, 1);
        else seenBidWallets.add(bids[i].buyerWalletId);
    }
    const seenOfferWallets = new Set();
    for (let i = offers.length - 1; i >= 0; i--) {
        if (seenOfferWallets.has(offers[i].sellerWalletId)) offers.splice(i, 1);
        else seenOfferWallets.add(offers[i].sellerWalletId);
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

    // Force-distribution is handled by the module-level forceDistributeOffers()

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
            // Pay-as-bid: buyer pays their bid price, seller receives bid price minus fee
            const clearingPrice = bidRate === Infinity ? offerRate : bidRate;
            const totalCost = matchAmount * clearingPrice;
            const adminFee = totalCost * ADMIN_FEE_RATE;
            const sellerRevenue = totalCost - adminFee;

            // Check buyer has enough tokens before entering transaction
            const buyerWalletPre = await prisma.wallet.findUnique({
                where: { id: bid.buyerWalletId },
                select: { tokenBalance: true }
            });
            const buyerBalancePre = Number(buyerWalletPre?.tokenBalance || 0);
            if (buyerBalancePre < totalCost) {
                console.log(`[Market] Skip match: ${bid.buyerBuilding?.name || bid.buyerWalletId} insufficient tokens (${buyerBalancePre} < ${totalCost})`);
                continue;
            }

            // เริ่มการตัดเงินและโอนพลังงานแบบข้ามตึก
            await prisma.$transaction(async (tx) => {
                // Re-check buyer balance inside transaction (atomic consistency)
                const bal = await tx.wallet.findUnique({ where: { id: bid.buyerWalletId }, select: { tokenBalance: true } });
                if (Number(bal?.tokenBalance || 0) < totalCost) {
                    console.log(`[Market] TX skip: buyer balance changed (${bal?.tokenBalance} < ${totalCost})`);
                    return;
                }

                // 1. อัปเดตยอดของคนซื้อ และ คนขาย
                const bidIdStr = String(bid.id);
                const newBidStatus = (remainingBidKwh - matchAmount) <= 0.001 ? 'FULFILLED' : 'OPEN';
                const newOfferStatus = (remainingOfferKwh - matchAmount) <= 0.001 ? 'SOLD' : 'AVAILABLE';
                console.log(`[Market] Match: bid=${bidIdStr} status→${newBidStatus} kwhBought+=${matchAmount}, offer=${String(offer.id)} status→${newOfferStatus} kwhSold+=${matchAmount} isMO=${!!offer._isMarketOrder}`);

                // Update bid: if MarketOrder, update MarketOrder table; else update EnergyBid
                if (bid._isMarketOrder) {
                    await tx.marketOrder.update({
                        where: { id: bidIdStr },
                        data: {
                            filled: { increment: matchAmount },
                            status: newBidStatus === 'FULFILLED' ? 'FILLED' : 'PARTIAL',
                        },
                    });
                } else {
                    const bidIsInt = !bidIdStr.includes('-');
                    if (bidIsInt) {
                        await tx.energyBid.update({
                            where: { id: parseInt(bidIdStr, 10) },
                            data: { kWHBought: { increment: matchAmount }, status: newBidStatus }
                        });
                    } else {
                        await tx.$executeRawUnsafe(
                            `UPDATE "EnergyBid" SET "kWHBought" = COALESCE("kWHBought",0) + $1, "status" = $2::text::"EnergyBidStatus" WHERE "id"::text = $3`,
                            matchAmount, newBidStatus, bidIdStr
                        );
                    }
                }

                // Update offer: if MarketOrder, update MarketOrder table; else update EnergyOffer
                const offerIdStr = String(offer.id);
                if (offer._isMarketOrder) {
                    await tx.marketOrder.update({
                        where: { id: offerIdStr },
                        data: {
                            filled: { increment: matchAmount },
                            status: newOfferStatus === 'SOLD' ? 'FILLED' : 'PARTIAL',
                        },
                    });
                } else {
                    const offerIsInt = !offerIdStr.includes('-');
                    if (offerIsInt) {
                        await tx.energyOffer.update({
                            where: { id: parseInt(offerIdStr, 10) },
                            data: {
                                kWHSold: { increment: matchAmount },
                                status: newOfferStatus
                            }
                        });
                    } else {
                        await tx.$executeRawUnsafe(
                            `UPDATE "EnergyOffer" SET "kWHSold" = COALESCE("kWHSold",0) + $1, "status" = $2::text::"EnergyOfferStatus" WHERE "id"::text = $3`,
                            matchAmount, newOfferStatus, offerIdStr
                        );
                    }
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

                // 3.5 อัพเดต battery meter ผู้ซื้อ (รับพลังงานเข้า battery)
                if (bid.buyerBatteryMeter) {
                    const nextBatteryValue = Number(bid.buyerBatteryMeter.value || 0) + matchAmount;
                    const nextBatteryKwh = Number(bid.buyerBatteryMeter.kWH || 0) + matchAmount;
                    await tx.meterInfo.update({
                        where: { snid: bid.buyerBatteryMeter.snid },
                        data: { value: nextBatteryValue, kWH: nextBatteryKwh, timestamp: new Date() }
                    });
                }

                // 4. บันทึกประวัติ walletTx (ผู้ซื้อ และ ผู้ขาย)
                const buyerWalletTxId = randomUUID();
                await tx.walletTx.create({ data: { id: buyerWalletTxId, walletId: String(bid.buyerWalletId), timestamp: new Date(), tokenInOut: -totalCost } });
                await tx.walletTx.create({ data: { id: randomUUID(), walletId: String(offer.sellerWalletId), timestamp: new Date(), tokenInOut: sellerRevenue } });

                // 5. บันทึกประวัติ transaction (ผู้ขาย)
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
                
                // 6. บันทึกประวัติ transaction (ผู้ซื้อ)
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
                        data: { id: randomUUID(), buildingName: String(buyerBuildingName), fromWId: String(offer.sellerWalletId), toWId: String(bid.buyerWalletId), timestamp: now, kWH: matchAmount, tokenAmount: totalCost, status: 'paid', month: now.getMonth() + 1, year: now.getFullYear(), dailyAvg: matchAmount, peakDate: now, peakkWH: matchAmount }
                    });
                    await tx.receipt.create({ data: { id: randomUUID(), invoiceId: String(matchInvoice.id), timestamp: new Date(), walletTxId: String(buyerWalletTxId) } });
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

    // 3. Force-distribution: push remaining unsold energy to buildings with battery
    let forceDistributeResult = null;
    const remainingOffers = offers.filter(o => {
        const remaining = Number(o.kWH || 0) - Number(o.kWHSold || 0);
        return remaining > 0.001 && o.status === 'AVAILABLE';
    });
    console.log(`[Market] Force check: remainingOffers=${remainingOffers.length} totalBids=${bids.length} FORCE_ENABLED=${FORCE_DISTRIBUTION_ENABLED}`);
    if (remainingOffers.length > 0 && FORCE_DISTRIBUTION_ENABLED) {
        console.log(`[Market] Triggering force distribution for ${remainingOffers.length} remaining offers`);
        try {
            forceDistributeResult = await forceDistributeOffers(remainingOffers, { penaltyPrice: PENALTY_PRICE, marketType: 'DAY_AHEAD', createdTxIds });
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
 * 4. Intraday Market Clearing — match remaining Intraday bids/offers, cancel rest
 */
async function processIntradayClearing(targetDate) {
    console.log(`[Market] Clearing Intraday market for ${targetDate.toISOString()}`);

    const BID_MIN_PRICE = Number(process.env.MARKET_BID_MIN_PRICE || 3.5);
    const ADMIN_FEE_RATE = 0.05;

    const bidsRaw = await prisma.energyBid.findMany({ where: { marketType: 'INTRADAY', status: 'OPEN' } });
    const offersRaw = await prisma.energyOffer.findMany({ where: { marketType: 'INTRADAY', status: 'AVAILABLE' } });

    console.log(`[Intraday] Found ${bidsRaw.length} bids, ${offersRaw.length} offers`);

    // Helper: map walletId -> building
    async function getBuildingForWallet(walletId) {
        if (!walletId) return null;
        const wallet = await prisma.wallet.findUnique({ where: { id: String(walletId) }, select: { email: true } });
        if (!wallet?.email) return null;
        return await prisma.building.findFirst({ where: { email: wallet.email } }) || null;
    }

    // Filter bids: only buildings with battery + price ≥ BID_MIN_PRICE
    const bids = [];
    for (const b of bidsRaw) {
        if (b.ratePerkWH != null && Number(b.ratePerkWH) < BID_MIN_PRICE) continue;
        const buyerBuilding = await getBuildingForWallet(b.buyerWalletId);
        const buyerBatteryMeter = buyerBuilding?.name ? await prisma.meterInfo.findFirst({
            where: { buildingName: buyerBuilding.name, type: { contains: 'battery', mode: 'insensitive' } },
        }) : null;
        if (!buyerBatteryMeter) {
            console.log(`[Intraday] Skip bid from ${buyerBuilding?.name || b.buyerWalletId} — no battery`);
            continue;
        }
        bids.push({ ...b, buyerBuilding, buyerBatteryMeter });
    }

    // Enrich offers
    const offers = [];
    for (const o of offersRaw) {
        const sellerBuilding = await getBuildingForWallet(o.sellerWalletId);
        offers.push({ ...o, sellerBuilding });
    }

    // Sort: bids price DESC, offers price ASC
    bids.sort((a, b) => (b.ratePerkWH == null ? Infinity : Number(b.ratePerkWH)) - (a.ratePerkWH == null ? Infinity : Number(a.ratePerkWH)));
    offers.sort((a, b) => (a.ratePerkWH == null ? 0 : Number(a.ratePerkWH)) - (b.ratePerkWH == null ? 0 : Number(b.ratePerkWH)));

    let totalMatchedKwh = 0;
    const createdMatches = [];
    const matchLog = [];
    const orderCache = new Map();

    for (const bid of bids) {
        let remainingBidKwh = Number(bid.kWH) - Number(bid.kWHBought);
        if (remainingBidKwh <= 0) continue;

        for (const offer of offers) {
            if (offer.status !== 'AVAILABLE') continue;
            if (offer.sellerWalletId === bid.buyerWalletId) continue;

            const offerRate = Number(offer.ratePerkWH);
            const bidRate = bid.ratePerkWH != null ? Number(bid.ratePerkWH) : Infinity;
            if (offerRate > bidRate) continue;

            let remainingOfferKwh = Number(offer.kWH) - Number(offer.kWHSold);
            if (remainingOfferKwh <= 0) continue;

            const matchAmount = Math.min(remainingBidKwh, remainingOfferKwh);
            const clearingPrice = offerRate;
            const totalCost = matchAmount * clearingPrice;
            const adminFee = totalCost * ADMIN_FEE_RATE;
            const sellerRevenue = totalCost - adminFee;

            // Check buyer has enough tokens before entering transaction
            const buyerWalletPre = await prisma.wallet.findUnique({
                where: { id: bid.buyerWalletId },
                select: { tokenBalance: true }
            });
            const buyerBalancePre = Number(buyerWalletPre?.tokenBalance || 0);
            if (buyerBalancePre < totalCost) {
                console.log(`[Intraday] Skip match: ${bid.buyerBuilding?.name || bid.buyerWalletId} insufficient tokens (${buyerBalancePre} < ${totalCost})`);
                continue;
            }

            await prisma.$transaction(async (tx) => {
                // Re-check buyer balance inside transaction (atomic consistency)
                const bal = await tx.wallet.findUnique({ where: { id: bid.buyerWalletId }, select: { tokenBalance: true } });
                if (Number(bal?.tokenBalance || 0) < totalCost) {
                    console.log(`[Intraday] TX skip: buyer balance changed (${bal?.tokenBalance} < ${totalCost})`);
                    return;
                }

                // Update bid
                const bidIdStr = String(bid.id);
                if (!bidIdStr.includes('-')) {
                    await tx.energyBid.update({
                        where: { id: parseInt(bidIdStr, 10) },
                        data: { kWHBought: { increment: matchAmount }, status: (remainingBidKwh - matchAmount) <= 0.001 ? 'FULFILLED' : 'OPEN' }
                    });
                } else {
                    await tx.$executeRawUnsafe(
                        `UPDATE "EnergyBid" SET "kWHBought" = COALESCE("kWHBought",0) + $1, "status" = $2::text::"EnergyBidStatus" WHERE "id"::text = $3`,
                        matchAmount, (remainingBidKwh - matchAmount) <= 0.001 ? 'FULFILLED' : 'OPEN', bidIdStr
                    );
                }

                // Update offer
                const offerIdStr = String(offer.id);
                if (!offerIdStr.includes('-')) {
                    await tx.energyOffer.update({
                        where: { id: parseInt(offerIdStr, 10) },
                        data: { kWHSold: { increment: matchAmount }, status: (remainingOfferKwh - matchAmount) <= 0.001 ? 'SOLD' : 'AVAILABLE' }
                    });
                } else {
                    await tx.$executeRawUnsafe(
                        `UPDATE "EnergyOffer" SET "kWHSold" = COALESCE("kWHSold",0) + $1, "status" = $2::text::"EnergyOfferStatus" WHERE "id"::text = $3`,
                        matchAmount, (remainingOfferKwh - matchAmount) <= 0.001 ? 'SOLD' : 'AVAILABLE', offerIdStr
                    );
                }

                // Wallet transfers
                await tx.wallet.update({ where: { id: bid.buyerWalletId }, data: { tokenBalance: { decrement: totalCost } } });
                await tx.wallet.update({ where: { id: offer.sellerWalletId }, data: { tokenBalance: { increment: sellerRevenue } } });

                // Update buyer battery
                if (bid.buyerBatteryMeter) {
                    const nv = Number(bid.buyerBatteryMeter.value || 0) + matchAmount;
                    const nk = Number(bid.buyerBatteryMeter.kWH || 0) + matchAmount;
                    await tx.meterInfo.update({ where: { snid: bid.buyerBatteryMeter.snid }, data: { value: nv, kWH: nk, timestamp: new Date() } });
                }

                // WalletTx
                const buyerWalletTxId = randomUUID();
                await tx.walletTx.create({ data: { id: buyerWalletTxId, walletId: String(bid.buyerWalletId), timestamp: new Date(), tokenInOut: -totalCost } });
                await tx.walletTx.create({ data: { id: randomUUID(), walletId: String(offer.sellerWalletId), timestamp: new Date(), tokenInOut: sellerRevenue } });

                // Transactions
                const sellerTx = await tx.transaction.create({ data: { walletId: offer.sellerWalletId, buildingName: offer.sellerBuilding?.name || null, type: 'MARKETPLACE_SALE', tokenAmount: sellerRevenue, status: 'CONFIRMED' } });
                const buyerTx = await tx.transaction.create({ data: { walletId: bid.buyerWalletId, buildingName: bid.buyerBuilding?.name || null, type: 'MARKETPLACE_PURCHASE', tokenAmount: totalCost, status: 'CONFIRMED' } });

                // Invoice + Receipt
                try {
                    const now = new Date();
                    const inv = await tx.invoice.create({ data: { id: randomUUID(), buildingName: String(bid.buyerBuilding?.name || `B-${bid.buyerWalletId}`), fromWId: String(offer.sellerWalletId), toWId: String(bid.buyerWalletId), timestamp: now, kWH: matchAmount, tokenAmount: totalCost, status: 'paid', month: now.getMonth() + 1, year: now.getFullYear(), dailyAvg: matchAmount, peakDate: now, peakkWH: matchAmount } });
                    await tx.receipt.create({ data: { id: randomUUID(), invoiceId: String(inv.id), timestamp: new Date(), walletTxId: String(buyerWalletTxId) } });
                } catch (invErr) { console.warn('[Intraday] Invoice failed:', invErr.message || invErr); }

                // MarketOrder + MarketMatch
                try {
                    let buyerOrder = orderCache.get(`bid:${bid.id}`);
                    if (!buyerOrder) { buyerOrder = await ensureMarketOrderForBid(tx, bid); orderCache.set(`bid:${bid.id}`, buyerOrder); }
                    let sellerOrder = orderCache.get(`offer:${offer.id}`);
                    if (!sellerOrder) { sellerOrder = await ensureMarketOrderForOffer(tx, offer); orderCache.set(`offer:${offer.id}`, sellerOrder); }

                    const mm = await tx.marketMatch.create({ data: { runId: null, buyerOrderId: buyerOrder.id, sellerOrderId: sellerOrder.id, quantity: matchAmount, price: clearingPrice } });
                    createdMatches.push(mm);
                    matchLog.push({ buyerWalletId: bid.buyerWalletId, sellerWalletId: offer.sellerWalletId, quantity: matchAmount, price: clearingPrice });

                    await tx.marketOrder.update({ where: { id: buyerOrder.id }, data: { filled: { increment: matchAmount }, status: (Number(buyerOrder.filled) + matchAmount) >= Number(buyerOrder.quantity) ? 'FILLED' : 'PARTIAL' } });
                    await tx.marketOrder.update({ where: { id: sellerOrder.id }, data: { filled: { increment: matchAmount }, status: (Number(sellerOrder.filled) + matchAmount) >= Number(sellerOrder.quantity) ? 'FILLED' : 'PARTIAL' } });
                } catch (e) { console.warn('[Intraday] MarketMatch failed:', e.message || e); }
            });

            remainingBidKwh -= matchAmount;
            offer.kWHSold = Number(offer.kWHSold) + matchAmount;
            if (Number(offer.kWH) - offer.kWHSold <= 0.001) offer.status = 'SOLD';
            totalMatchedKwh += matchAmount;

            if (remainingBidKwh <= 0.001) break;
        }
    }

    // --- Force-distribution for remaining unsold IntraDay offers ---
    const PENALTY_PRICE = Number(process.env.MARKET_PENALTY_PRICE || 3.5);
    let forceDistributeResult = null;
    const remainingOffers = offers.filter(o => {
        const remaining = Number(o.kWH || 0) - Number(o.kWHSold || 0);
        return remaining > 0.001 && o.status === 'AVAILABLE';
    });
    if (remainingOffers.length > 0) {
        console.log(`[Intraday] Triggering force distribution for ${remainingOffers.length} remaining offers`);
        try {
            forceDistributeResult = await forceDistributeOffers(remainingOffers, { penaltyPrice: PENALTY_PRICE, marketType: 'INTRADAY' });
            console.log('[Intraday] Force distribution result:', JSON.stringify(forceDistributeResult));
        } catch (e) {
            console.warn('[Intraday] forceDistributeOffers failed', e.message || e, e.stack);
        }
    }

    // Cancel remaining unsold Intraday offers & unfilled bids (still AVAILABLE/OPEN after force distribution)
    const cancelledOffers = await prisma.energyOffer.updateMany({
        where: { marketType: 'INTRADAY', status: 'AVAILABLE' },
        data: { status: 'CANCELLED' }
    });
    const cancelledBids = await prisma.energyBid.updateMany({
        where: { marketType: 'INTRADAY', status: 'OPEN' },
        data: { status: 'CANCELLED' }
    });
    console.log(`[Intraday] Matched ${totalMatchedKwh} kWh, force-distributed ${forceDistributeResult?.distributed || 0} kWh. Cancelled ${cancelledOffers.count} offers, ${cancelledBids.count} bids.`);

    return { matched: totalMatchedKwh, matches: createdMatches, matchLog, forceDistribution: forceDistributeResult };
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

    console.log(`=== STARTING MARKET CLEARING for ${clearingDate.toISOString()} ===`);

    // ── Day-Ahead ──
    const daRun = await prisma.marketRun.create({ data: { marketType: 'DAY_AHEAD', runTime: new Date(), status: 'running', startAt: new Date() } });
    let daResult = { matched: 0, matches: [], matchLog: [], forceDistribution: null };
    try {
        await processIntraBuildingMatching(clearingDate);
        const result = await processDayAheadClearing(clearingDate);
        if (result && Array.isArray(result.matches)) {
            for (const m of result.matches) {
                try { await prisma.marketMatch.update({ where: { id: m.id }, data: { runId: daRun.id } }); } catch (e) {}
            }
        }
        await cleanupDayAheadOrders(clearingDate);
        await prisma.marketRun.update({ where: { id: daRun.id }, data: { status: 'completed', endAt: new Date(), clearedAt: new Date() } });
        daResult = result || daResult;
        console.log(`--- Day-Ahead: matched ${daResult.matched} kWh, force-distributed ${daResult.forceDistribution?.distributed || 0} kWh ---`);
    } catch (err) {
        await prisma.marketRun.update({ where: { id: daRun.id }, data: { status: 'failed', endAt: new Date() } });
        console.error('Day-Ahead clearing failed:', err.message || err);
    }

    // ── IntraDay is manual-only (always open, real-time P2P) — no auto clearing ──

    console.log('=== FINISHED DAY-AHEAD MARKET CLEARING ===');

    // Catch-all: cancel any remaining Day-Ahead AVAILABLE offers and OPEN bids
    const remainingOffers = await prisma.energyOffer.updateMany({
        where: { marketType: 'DAY_AHEAD', status: 'AVAILABLE' },
        data: { status: 'CANCELLED' },
    });
    const remainingBids = await prisma.energyBid.updateMany({
        where: { marketType: 'DAY_AHEAD', status: 'OPEN' },
        data: { status: 'CANCELLED' },
    });
    // Also clean up Day-Ahead MarketOrder records
    const remainingOrders = await prisma.marketOrder.updateMany({
        where: { marketType: 'DAY_AHEAD', status: { in: ['OPEN', 'PARTIAL'] } },
        data: { status: 'CANCELLED' },
    });
    console.log(`[Market] Day-Ahead catch-all cleanup: cancelled ${remainingOffers.count} offers, ${remainingBids.count} bids, ${remainingOrders.count} marketOrders`);

    return {
        ...daRun,
        matched: daResult.matched || 0,
        matches: daResult.matches || [],
        matchLog: daResult.matchLog || [],
        forceDistribution: daResult.forceDistribution || null,
    };
}

/**
 * Matching-only (00:00) — no battery requirement, no force distribution.
 * Simple rule: highest bid price wins. Orders stay open after matching.
 */
async function executeMarketMatching(targetDate) {
    // Manual trigger: match ALL DAY_AHEAD orders regardless of targetDate
    console.log(`=== STARTING MARKET MATCHING (00:00) ===`);

    const run = await prisma.marketRun.create({ data: { marketType: 'DAY_AHEAD', runTime: new Date(), status: 'running', startAt: new Date() } });

    try {
        await processIntraBuildingMatching(null); // match all dates
        const result = await processDayAheadClearing(null, false); // match all dates, no battery
        if (result && Array.isArray(result.matches)) {
            for (const m of result.matches) {
                try { await prisma.marketMatch.update({ where: { id: m.id }, data: { runId: run.id } }); } catch (e) {}
            }
        }
        await prisma.marketRun.update({ where: { id: run.id }, data: { status: 'completed', endAt: new Date() } });
        console.log(`=== MATCHING DONE: ${result?.matched || 0} kWh matched ===`);
        return {
            ...run,
            matched: result?.matched || 0,
            matches: result?.matches || [],
            matchLog: result?.matchLog || [],
            forceDistribution: null,
        };
    } catch (err) {
        await prisma.marketRun.update({ where: { id: run.id }, data: { status: 'failed', endAt: new Date() } });
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

/**
 * Force-distribution: push remaining unsold energy to buildings with battery.
 * Used by both Day-Ahead and IntraDay clearing.
 * @param {Array} offersList - remaining offers with kWH/kWHSold (or quantity/filled) and sellerWalletId
 * @param {Object} options - { penaltyPrice, marketType, createdTxIds }
 */
async function forceDistributeOffers(offersList, options = {}) {
    const FORCE_DISTRIBUTION_ENABLED = (process.env.MARKET_FORCE_DISTRIBUTE || 'true') === 'true';
    if (!FORCE_DISTRIBUTION_ENABLED) return { distributed: 0, priorityTable: [] };
    if (!offersList || offersList.length === 0) return { distributed: 0, priorityTable: [] };

    const PENALTY_PRICE = options.penaltyPrice != null ? Number(options.penaltyPrice) : Number(process.env.MARKET_PENALTY_PRICE || 3.5);
    const marketType = options.marketType || 'DAY_AHEAD';
    const createdTxIds = options.createdTxIds || [];

    // --- Phase A: Compute scores for ALL buildings ---
    const now = new Date();
    const year = now.getFullYear();

    const buildings = await prisma.building.findMany();
    const buildingScores = [];
    for (const b of buildings) {
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

        buildingScores.push({
            building: b,
            batteryKwh,
            batteryCapacity,
            monthlySum,
            batteryMode: (b.batteryTradeMode || b.tradeMode || 'MANUAL').toUpperCase(),
            batteryThresholdPct: Number(b.batterySellThreshold != null ? b.batterySellThreshold : 80),
        });
    }

    // Normalize scores: consumption (0-100) + battery emptiness (0-100) = max 200
    const maxMonthly = buildingScores.reduce((m, bs) => Math.max(m, bs.monthlySum), 0);
    for (const bs of buildingScores) {
        const consumptionWeight = maxMonthly > 0 ? (bs.monthlySum / maxMonthly) * 100 : 0;
        const emptynessPct = bs.batteryCapacity > 0
            ? ((bs.batteryCapacity - bs.batteryKwh) / bs.batteryCapacity) * 100
            : 0;
        bs.score = Math.round((consumptionWeight + emptynessPct) * 100) / 100;
    }

    buildingScores.sort((x, y) => y.score - x.score);

    // --- Phase B: Build priority table with pre-resolved wallet balances ---
    const crossPriorityTable = [];
    for (let idx = 0; idx < buildingScores.length; idx++) {
        const bs = buildingScores[idx];
        let walletBalance = 0;
        let note = '';

        // Resolve wallet balance
        const buyerWallet = await prisma.wallet.findFirst({
            where: { email: bs.building.email },
            select: { id: true, tokenBalance: true },
        });
        if (buyerWallet) {
            walletBalance = Math.round(Number(buyerWallet.tokenBalance || 0) * 100) / 100;
        }

        // Check why building might be skipped
        if (bs.batteryCapacity <= 0) {
            note = '❌ ไม่มี Battery';
        } else if (!buyerWallet) {
            note = '⚠️ No wallet';
        } else if (walletBalance <= 0) {
            note = '💰 Not enough tokens';
        }
        // note stays empty if building is eligible (will be filled during distribution)

        crossPriorityTable.push({
            rank: idx + 1,
            building: bs.building.name,
            batteryKwh: Math.round(bs.batteryKwh * 100) / 100,
            batteryCapacity: Math.round(bs.batteryCapacity * 100) / 100,
            hasBattery: bs.batteryCapacity > 0,
            monthlyConsumptionKwh: Math.round((bs.monthlySum || 0) * 100) / 100,
            score: Math.round(bs.score * 100) / 100,
            allocatedKwh: 0,
            walletBalance,
            status: 'skipped',
            note,
        });
    }

    // --- Phase C: Distribute each offer ---
    let distributedTotal = 0;
    const distributionLog = [];

    for (const offer of offersList) {
        let remaining = Number(offer.kWH || offer.quantity || 0) - Number(offer.kWHSold || offer.filled || 0);
        if (remaining <= 0) continue;

        const pricePerKwh = offer.ratePerkWH != null ? Number(offer.ratePerkWH) : PENALTY_PRICE;

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
                    maxSelfCharge = Math.max(0, capacity - currentKwh);
                    selfChargeReason = `SELF_CONSUME → charge to 100% (${currentKwh.toFixed(1)}/${capacity.toFixed(1)} kWh)`;
                } else if (batteryMode === 'AUTO_BATTERY_THRESHOLD') {
                    const thresholdKwh = capacity * (thresholdPct / 100);
                    maxSelfCharge = Math.max(0, thresholdKwh - currentKwh);
                    selfChargeReason = `AUTO → charge to ${thresholdPct}% (${currentKwh.toFixed(1)}/${capacity.toFixed(1)} kWh, target ${thresholdKwh.toFixed(1)})`;
                }

                if (maxSelfCharge > 0 && remaining > 0) {
                    const selfTake = Math.min(remaining, maxSelfCharge);
                    if (selfTake > 0) {
                        await prisma.$transaction(async (tx) => {
                            await tx.meterInfo.update({
                                where: { snid: sellerBatteryMeter.snid },
                                data: { kWH: { increment: selfTake } },
                            });
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

        // ── Step C2: Cross-building distribution ──
        if (remaining > 0) {
            for (const bs of buildingScores) {
                if (remaining <= 0) break;

                const entry = crossPriorityTable.find(p => p.building === bs.building.name);

                // Skip seller's own building (already handled in self-charge)
                if (sellerBuilding && bs.building.name === sellerBuilding.name) {
                    if (entry && !entry.note) entry.note = '🏠 Seller building (self-charged)';
                    continue;
                }

                // Skip buildings without battery
                if (bs.batteryCapacity <= 0) {
                    if (entry && !entry.note) entry.note = '❌ ไม่มี Battery';
                    continue;
                }

                // Resolve wallet (re-use from pre-resolved if available, otherwise query)
                const buyerWallet = await prisma.wallet.findFirst({
                    where: { email: bs.building.email },
                    select: { id: true, tokenBalance: true },
                });
                if (!buyerWallet) {
                    if (entry && !entry.note) entry.note = '⚠️ No wallet';
                    continue;
                }

                const buyerBalance = Number(buyerWallet.tokenBalance || 0);
                const maxAffordable = Math.floor((buyerBalance / pricePerKwh) * 10000) / 10000;
                if (maxAffordable <= 0) {
                    if (entry && !entry.note) entry.note = `💰 Insufficient tokens (balance: ${buyerBalance.toFixed(2)}, need ≥${pricePerKwh.toFixed(2)}/kWh)`;
                    continue;
                }

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

                    const recipientBattery = await tx.meterInfo.findFirst({
                        where: { buildingName: bs.building.name, type: { contains: 'battery', mode: 'insensitive' } },
                    });
                    if (recipientBattery) {
                        await tx.meterInfo.update({
                            where: { snid: recipientBattery.snid },
                            data: {
                                value: Number(recipientBattery.value || 0) + take,
                                kWH: Number(recipientBattery.kWH || 0) + take,
                                timestamp: new Date()
                            }
                        });
                    }

                    const fdBuyerWalletTxId = randomUUID();
                    await tx.walletTx.create({ data: { id: fdBuyerWalletTxId, walletId: buyerWallet.id, timestamp: new Date(), tokenInOut: -totalCost } });
                    await tx.walletTx.create({ data: { id: randomUUID(), walletId: offer.sellerWalletId, timestamp: new Date(), tokenInOut: sellerRevenue } });
                    const fdBuyerTx = await tx.transaction.create({ data: { walletId: buyerWallet.id, buildingName: bs.building.name, type: 'FORCED_DISTRIBUTION_PURCHASE', tokenAmount: totalCost, status: 'CONFIRMED' } });
                    const fdSellerTx = await tx.transaction.create({ data: { walletId: offer.sellerWalletId, buildingName: sellerBuilding?.name || null, type: 'FORCED_DISTRIBUTION_SALE', tokenAmount: sellerRevenue, status: 'CONFIRMED' } });

                    try {
                        const nowDate = new Date();
                        const fdInvoice = await tx.invoice.create({
                            data: { id: randomUUID(), buildingName: String(bs.building.name), fromWId: String(offer.sellerWalletId), toWId: String(buyerWallet.id), timestamp: nowDate, kWH: take, tokenAmount: totalCost, status: 'paid', month: nowDate.getMonth() + 1, year: nowDate.getFullYear(), dailyAvg: take, peakDate: nowDate, peakkWH: take }
                        });
                        await tx.receipt.create({ data: { id: randomUUID(), invoiceId: String(fdInvoice.id), timestamp: new Date(), walletTxId: String(fdBuyerWalletTxId) } });
                    } catch (invErr) { console.warn('[Market] FD invoice/receipt creation failed:', invErr.message || invErr); }

                    createdTxIds.push(fdBuyerTx.txid, fdSellerTx.txid);

                    const buyerOrder = await tx.marketOrder.create({ data: { side: 'BID', marketType, walletId: buyerWallet.id, quantity: take, filled: take, price: pricePerKwh, status: 'FILLED', targetDate: offer.targetDate, metadata: { forced: true, building: bs.building.name } } });
                    const sellerOrder = await ensureMarketOrderForOffer(tx, offer);
                    await tx.marketMatch.create({ data: { runId: null, buyerOrderId: buyerOrder.id, sellerOrderId: sellerOrder.id, quantity: take, price: pricePerKwh } });
                });

                remaining -= take;
                offerLog.crossDistributedKwh += take;
                offerLog.recipients.push({ building: bs.building.name, kwh: Math.round(take * 100) / 100, cost: Math.round(totalCost * 100) / 100 });

                const entryRecipient = crossPriorityTable.find(p => p.building === bs.building.name);
                if (entryRecipient) {
                    entryRecipient.allocatedKwh = Math.round((entryRecipient.allocatedKwh + take) * 100) / 100;
                    entryRecipient.walletBalance = Math.round(buyerBalance * 100) / 100;
                    entryRecipient.status = 'received';
                }
            }
        }

        distributedTotal += (offerLog.selfChargedKwh + offerLog.crossDistributedKwh);
        distributionLog.push(offerLog);
    }

    return { distributed: Math.round(distributedTotal * 100) / 100, priorityTable: crossPriorityTable, distributionLog };
}

module.exports = {
    processIntraBuildingMatching,
    processDayAheadClearing,
    processIntradayClearing,
    executeMarketClearing,
    executeMarketMatching,
};