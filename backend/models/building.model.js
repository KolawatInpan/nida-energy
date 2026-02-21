const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function computeBuildingEnergyTotals(buildingId) {
	const bId = Number(buildingId);
	// find building and sum MeterInfo.kwh by buildingName (schema uses buildingName relation)
	const building = await prisma.building.findUnique({ where: { id: bId } });
	if (!building) return { produced: 0, consumed: 0, net: 0 };
	const meterAgg = await prisma.meterInfo.aggregate({ where: { buildingName: building.name }, _sum: { kwh: true } });
  const produced = (meterAgg._sum && meterAgg._sum.kwh ? Number(meterAgg._sum.kwh) : 0) || (building && building.energy ? Number(building.energy) : 0);
  // We don't have separate consumed/produced breakdown in current schema; return produced as both produced and energy, consumed 0.
  const consumed = 0;
  return { produced, consumed, net: produced - consumed };
}

async function getAllBuildings() {
  const buildings = await prisma.building.findMany({ orderBy: { name: 'asc' }, include: { owner: { select: { credId: true } } } });
  return await Promise.all(buildings.map(async (b) => {
    const totals = await computeBuildingEnergyTotals(b.id);
    const ownerCredId = b.owner ? b.owner.credId : null;
    const { owner, ...rest } = b;
    return { ...rest, ownerId: ownerCredId, produced: totals.produced, consumed: totals.consumed, net: totals.net, energy: totals.produced };
  }));
}

async function getBuildingById(id) {
	let b = null;
	if (!isNaN(Number(id))) {
		b = await prisma.building.findUnique({ where: { id: Number(id) }, include: { owner: { select: { credId: true } } } });
	}
	if (!b) {
		b = await prisma.building.findUnique({ where: { name: String(id) }, include: { owner: { select: { credId: true } } } });
	}
	if (!b) return null;
	const totals = await computeBuildingEnergyTotals(b.id);
	const totalMeters = await prisma.meterInfo.count({ where: { buildingName: b.name } });
	const produceMeters = await prisma.meterInfo.count({ where: { buildingName: b.name, produceMeter: true } });
	const consumeMeters = await prisma.meterInfo.count({ where: { buildingName: b.name, consumeMeter: true } });
	const batMeters = await prisma.meterInfo.count({ where: { buildingName: b.name, batMeter: true } });

	const ownerCredId = b.owner ? b.owner.credId : null;
	const { owner, ...rest } = b;
	return {
		...rest,
		ownerId: ownerCredId,
		produced: totals.produced,
		consumed: totals.consumed,
		net: totals.net,
		energy: totals.produced,
		meterCounts: { total: totalMeters, produce: produceMeters, consume: consumeMeters, bat: batMeters },
	};
}

async function createBuilding({ name, mapURL = null, address = null, province = null, postal = null, ownerEmail }) {
	if (!ownerEmail || !String(ownerEmail).includes('@')) {
		const e = new Error('owner email not resolved or missing');
		e.status = 400;
		throw e;
	}
	// ensure owner user exists to satisfy FK constraint
	const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
	if (!owner) {
		const e = new Error(`owner user with email ${ownerEmail} not found; create the user first`);
		e.status = 400;
		throw e;
	}
	// If building with same name already exists, return it (idempotent)
	const existing = await prisma.building.findUnique({ where: { name } });
	if (existing) {
		const totalsEx = await computeBuildingEnergyTotals(existing.id);
		const totalMetersEx = await prisma.meterInfo.count({ where: { buildingName: existing.name } });
		const produceMetersEx = await prisma.meterInfo.count({ where: { buildingName: existing.name, produceMeter: true } });
		const consumeMetersEx = await prisma.meterInfo.count({ where: { buildingName: existing.name, consumeMeter: true } });
		const batMetersEx = await prisma.meterInfo.count({ where: { buildingName: existing.name, batMeter: true } });
		const rest = existing;
		return { ...rest, ownerId: owner ? owner.credId : null, produced: totalsEx.produced, consumed: totalsEx.consumed, net: totalsEx.net, meterCounts: { total: totalMetersEx, produce: produceMetersEx, consume: consumeMetersEx, bat: batMetersEx } };
	}

	const b = await prisma.building.create({ data: { name, mapURL, address, province, postal, email: ownerEmail } });
	const totals = await computeBuildingEnergyTotals(b.id);
	const rest = b;
	const totalMeters = await prisma.meterInfo.count({ where: { buildingName: b.name } });
	const produceMeters = await prisma.meterInfo.count({ where: { buildingName: b.name, produceMeter: true } });
	const consumeMeters = await prisma.meterInfo.count({ where: { buildingName: b.name, consumeMeter: true } });
	const batMeters = await prisma.meterInfo.count({ where: { buildingName: b.name, batMeter: true } });
	// Use the previously-resolved `owner` variable for owner credId
	return { ...rest, ownerId: owner ? owner.credId : null, produced: totals.produced, consumed: totals.consumed, net: totals.net, meterCounts: { total: totalMeters, produce: produceMeters, consume: consumeMeters, bat: batMeters } };
}

async function updateBuilding(id, data) {
	const updated = await prisma.building.update({ where: { id: Number(id) }, data });
	return updated;
}

async function deleteBuilding(id) {
	return await prisma.building.delete({ where: { id: Number(id) } });
}

async function listBuildings() {
	return await prisma.building.findMany({ orderBy: { name: 'asc' } });
}

module.exports = {
	computeBuildingEnergyTotals,
	getAllBuildings,
	getBuildingById,
	createBuilding,
	updateBuilding,
	deleteBuilding,
	listBuildings,
};

