const { prisma } = require('../../utils/prisma');
const Offer = require('./offer.repository');
const { assertDayAheadMarketOpen, assertIntradayRate } = require('./market.utils');
const marketService = require('./market.service');

async function createOrder(req, res) {
  try {
    const { side, walletId, kwh, price, marketType, targetDate, sourceType, bypassLock } = req.body;
    if (!side || !walletId || kwh == null) return res.status(400).json({ error: 'side, walletId and kwh required' });

    // Resolve building name from wallet
    let buildingName = null;
    try {
      const wallet = await prisma.wallet.findUnique({ where: { id: String(walletId) }, select: { email: true } });
      if (wallet?.email) {
        const b = await prisma.building.findFirst({ where: { email: wallet.email }, select: { name: true } });
        if (b?.name) buildingName = b.name;
      }
    } catch {}

    // Enforce Day-Ahead lock: block submissions after 18:00 (bypass with admin password)
    try { assertDayAheadMarketOpen(marketType, bypassLock); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }

    // Enforce IntraDay minimum rate (pre-check before creating MarketOrder)
    if (price != null) {
      try { assertIntradayRate(marketType, price); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
    }

    if (String(side).toUpperCase() === 'OFFER') {
      const mo = await prisma.marketOrder.create({ data: {
        side: 'OFFER', marketType: marketType || 'DAY_AHEAD', walletId: String(walletId), buildingName,
        quantity: Number(kwh), price: price != null ? Number(price) : null, status: 'OPEN',
        targetDate: targetDate ? new Date(targetDate) : null, metadata: { sourceType }
      }});
      // also create energyOffer to keep existing flows
      try { const created = await Offer.createOffer({ sellerWalletId: walletId, kwh, ratePerKwh: price, sourceType, marketType, targetDate, bypassLock }); mo.metadata.energyOfferId = created.id; await prisma.marketOrder.update({ where: { id: mo.id }, data: { metadata: mo.metadata } }); } catch (e) { console.warn('warning: created MarketOrder but energyOffer creation failed', e.message || e); }
      return res.status(201).json(mo);
    }

    if (String(side).toUpperCase() === 'BID') {
      const mo = await prisma.marketOrder.create({ data: {
        side: 'BID', marketType: marketType || 'DAY_AHEAD', walletId: String(walletId), buildingName,
        quantity: Number(kwh), price: price != null ? Number(price) : null, status: 'OPEN',
        targetDate: targetDate ? new Date(targetDate) : null
      }});
      try { const created = await Offer.createBid({ buyerWalletId: walletId, kwh, ratePerKwh: price, marketType, targetDate, bypassLock }); mo.metadata = { energyBidId: created.id }; await prisma.marketOrder.update({ where: { id: mo.id }, data: { metadata: mo.metadata } }); } catch (e) { console.warn('warning: created MarketOrder but energyBid creation failed', e.message || e); }
      return res.status(201).json(mo);
    }

    return res.status(400).json({ error: 'side must be BID or OFFER' });
  } catch (err) {
    console.error('createOrder error', err);
    res.status(500).json({ error: err.message });
  }
}

async function listOrders(req, res) {
  try {
    const orders = await prisma.marketOrder.findMany({ orderBy: { createdAt: 'desc' } });

    // Resolve buildingName for orders missing it (lookup by walletId → email → building)
    const enriched = await Promise.all(orders.map(async (o) => {
      if (o.buildingName) return o;
      if (!o.walletId && !o.participantEmail) return o;
      try {
        const email = o.participantEmail || (
          await prisma.wallet.findUnique({ where: { id: String(o.walletId) }, select: { email: true } })
        )?.email;
        if (email) {
          const b = await prisma.building.findFirst({ where: { email }, select: { name: true } });
          if (b?.name) return { ...o, buildingName: b.name };
        }
      } catch {}
      return o;
    }));

    res.json({ orders: enriched });
  } catch (err) {
    console.error('listOrders error', err);
    res.status(500).json({ error: err.message });
  }
}

async function cancelOrder(req, res) {
  try {
    const { side } = req.query;
    const id = req.params.id;
    // cancel MarketOrder and underlying energyOffer/energyBid if present
    const order = await prisma.marketOrder.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'order not found' });
    await prisma.marketOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    try {
      const energyOfferId = order.metadata?.energyOfferId;
      const energyBidId = order.metadata?.energyBidId;
      if (energyOfferId) await Offer.cancelOffer(energyOfferId);
      if (energyBidId) await Offer.cancelBid(energyBidId);
    } catch (e) { console.warn('cancel underlying energy order failed', e.message || e); }
    return res.json({ canceled: true });
  } catch (err) {
    console.error('cancelOrder error', err);
    res.status(500).json({ error: err.message });
  }
}

async function triggerClearing(req, res) {
  try {
    const result = await marketService.executeMarketClearing();
    // Extract priority table from force distribution
    const forceDist = result?.forceDistribution || null;

    // Resolve match details with building names and bid comparison
    const matchDetails = [];
    const bidMap = new Map();
    // Try MarketMatch records first, fallback to matchLog
    const matchSource = (Array.isArray(result?.matches) && result.matches.length > 0) ? result.matches : (result?.matchLog || []);
    const isDetailed = Array.isArray(result?.matches) && result.matches.length > 0;
    if (matchSource.length > 0) {
      for (const m of matchSource) {
        let buyerName = 'Unknown', sellerName = 'Unknown';
        let bidPrice = null, offerPrice = null;
        let matchKwh = 0, clearedPrice = 0;

        if (isDetailed) {
          // Detailed: resolve from MarketOrder records
          const buyerOrder = m.buyerOrderId ? await prisma.marketOrder.findUnique({ where: { id: m.buyerOrderId }, select: { walletId: true, buildingName: true, price: true } }).catch(() => null) : null;
          const sellerOrder = m.sellerOrderId ? await prisma.marketOrder.findUnique({ where: { id: m.sellerOrderId }, select: { walletId: true, buildingName: true, price: true } }).catch(() => null) : null;
          const resolveName = async (order) => {
            if (order?.buildingName) return order.buildingName;
            if (order?.walletId) {
              const w = await prisma.wallet.findUnique({ where: { id: order.walletId }, select: { email: true } }).catch(() => null);
              if (w?.email) {
                const b = await prisma.building.findFirst({ where: { email: w.email }, select: { name: true } }).catch(() => null);
                if (b?.name) return b.name;
              }
            }
            return 'Unknown';
          };
          buyerName = await resolveName(buyerOrder);
          sellerName = await resolveName(sellerOrder);
          bidPrice = buyerOrder?.price != null ? Number(buyerOrder.price) : null;
          offerPrice = sellerOrder?.price != null ? Number(sellerOrder.price) : null;
          matchKwh = Math.round(Number(m.quantity || 0) * 100) / 100;
          clearedPrice = Number(m.price || 0);
        } else {
          // Fallback: use matchLog data (resolve from walletId)
          const resolveFromWallet = async (walletId) => {
            if (!walletId) return 'Unknown';
            const w = await prisma.wallet.findUnique({ where: { id: String(walletId) }, select: { email: true } }).catch(() => null);
            if (w?.email) {
              const b = await prisma.building.findFirst({ where: { email: w.email }, select: { name: true } }).catch(() => null);
              if (b?.name) return b.name;
            }
            return 'Unknown';
          };
          buyerName = await resolveFromWallet(m.buyerWalletId);
          sellerName = await resolveFromWallet(m.sellerWalletId);
          matchKwh = Math.round(Number(m.quantity || 0) * 100) / 100;
          clearedPrice = Number(m.price || 0);
        }

        const totalCost = matchKwh * clearedPrice;
        const adminFee = totalCost * 0.05;
        const sellerRevenue = totalCost - adminFee;

        if (!bidMap.has(buyerName)) {
          bidMap.set(buyerName, { price: bidPrice, name: buyerName });
        }

        matchDetails.push({
          seller: sellerName,
          sellerPrice: offerPrice,
          buyer: buyerName,
          buyerPrice: bidPrice,
          kwh: matchKwh,
          clearedPrice,
          totalCost: Math.round(totalCost * 100) / 100,
          sellerRevenue: Math.round(sellerRevenue * 100) / 100,
          adminFee: Math.round(adminFee * 100) / 100,
        });
      }
    }

    // Build bid ranking
    const bidRanking = [...bidMap.values()]
      .sort((a, b) => (b.price || 0) - (a.price || 0))
      .map((b, i) => ({ rank: i + 1, building: b.name, price: b.price, reason: i === 0 ? '🥈 Highest Bid Price' : 'Lower bid price' }));

    res.json({
      success: true,
      runId: result?.id || null,
      matchCount: result?.matched || 0,
      forcedDistributions: result?.forceDistribution?.distributed || 0,
      matches: matchDetails,
      bidRanking,
      priorityTable: forceDist?.priorityTable || [],
      distributionLog: forceDist?.distributionLog || [],
    });
  } catch (err) {
    console.error('triggerClearing error', err);
    res.status(500).json({ error: err.message });
  }
}

async function sellToBid(req, res) {
  try {
    const { orderId, sellerWalletId, kwh, price } = req.body || {};
    if (!orderId || !sellerWalletId || kwh == null) return res.status(400).json({ error: 'orderId, sellerWalletId and kwh required' });

    // resolve energyBidId from marketOrder metadata if present
    const mo = await prisma.marketOrder.findUnique({ where: { id: String(orderId) } });
    let energyBidId = null;
    if (mo) energyBidId = mo.metadata?.energyBidId || null;
    // if no marketOrder or metadata, assume orderId is an energyBid id
    if (!energyBidId) energyBidId = orderId;

    const result = await Offer.sellToBid({ bidId: energyBidId, sellerWalletId: String(sellerWalletId), kwh: Number(kwh), price: typeof price !== 'undefined' ? Number(price) : null });
    res.status(201).json(result);
  } catch (err) {
    console.error('sellToBid error', err);
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function listMatches(req, res) {
  try {
    const matches = await prisma.marketMatch.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(matches);
  } catch (err) {
    console.error('listMatches error', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createOrder,
  listOrders,
  cancelOrder,
  triggerClearing,
  listMatches,
  sellToBid,
};
