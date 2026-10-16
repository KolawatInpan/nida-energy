const { prisma } = require('../../utils/prisma');

async function getMeters() {
  const meters = await prisma.meterInfo.findMany({
    include: {
      building: {
        include: {
          assignedUsers: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
  return meters;
}

async function getMetersByBuilding(buildingId) {
  const id = parseInt(buildingId);
  const meters = await prisma.meterInfo.findMany({
    where: { building: { id } },
    include: {
      building: {
        include: {
          assignedUsers: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
  return meters;
}

async function getMeterBySnid(snid) {
  if (!snid || String(snid).trim() === '') return null;

  const meter = await prisma.meterInfo.findUnique({
    where: { snid: String(snid) },
    include: {
      building: {
        include: {
          assignedUsers: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });

  return meter;
}

async function getApprovedMeters() {
  const meters = await prisma.meterInfo.findMany({
    where: { approveStatus: "approved" },
    include: {
      building: {
        include: {
          assignedUsers: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
  return meters;
}

async function getApprovedMetersByBuilding(buildingId) {
  const meters = await prisma.meterInfo.findMany({
    where: {
      // MeterInfo has no `buildingId` column — it links to Building via `buildingName`,
      // so the building is reached through the relation (same pattern as getMetersByBuilding).
      building: { id: parseInt(buildingId) },
      approveStatus: "approved",
    },
    include: {
      building: {
        include: {
          assignedUsers: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
  return meters;
}

async function getPendingMeters() {
  const meters = await prisma.meterInfo.findMany({
    where: { approveStatus: "pending" },
    include: {
      building: {
        include: {
          assignedUsers: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
  return meters;
}

async function getRejectedMeters() {
  const meters = await prisma.meterInfo.findMany({
    where: { approveStatus: "rejected" },
    include: {
      building: {
        include: {
          assignedUsers: {
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
  return meters;
}

async function createMeter(buildingIdOrName, meterType, meterNumber, capacity, dateInstalled) {
  // buildingIdOrName may be numeric id or building name
  let building = null;
  if (!buildingIdOrName) throw new Error('Missing building identifier');

  const parsed = parseInt(buildingIdOrName);
  if (Number.isInteger(parsed)) {
    building = await prisma.building.findUnique({ where: { id: parsed } });
  }
  if (!building) {
    building = await prisma.building.findUnique({ where: { name: String(buildingIdOrName) } });
  }
  if (!building) throw new Error(`Building not found: ${buildingIdOrName}`);

  const meter = await prisma.meterInfo.create({
    data: {
      snid: meterNumber,
      // `buildingName` IS the relation to Building — MeterInfo has no `buildingId`,
      // and passing one made every meter insert fail with "Unknown argument `buildingId`".
      buildingName: building.name,
      type: meterType,
      capacity: capacity || 0,
      value: 0,
      kWH: 0,
      approveStatus: 'pending',
      dateInstalled: dateInstalled ? new Date(dateInstalled) : new Date(),
      dateSubmit: new Date(),
    },
  });

  return meter;
}

async function updateMeter(snid, updates = {}) {
  if (!snid) throw new Error('snid is required');
  const data = {};
  if (updates.type !== undefined) data.type = updates.type;
  if (updates.capacity !== undefined) data.capacity = updates.capacity;
  if (updates.status !== undefined || updates.approveStatus !== undefined) {
    data.approveStatus = updates.approveStatus || updates.status;
  }
  if (Object.keys(data).length === 0) return null;

  return prisma.meterInfo.update({ where: { snid }, data });
}

async function deleteMeter(snid) {
  if (!snid) throw new Error('snid is required');
  return prisma.meterInfo.delete({ where: { snid } });
}

async function getMeterStats(buildingId) {
  const where = buildingId ? { buildingId: parseInt(buildingId) } : {};
  const [total, approved, pending, rejected] = await Promise.all([
    prisma.meterInfo.count({ where }),
    prisma.meterInfo.count({ where: { ...where, approveStatus: 'approved' } }),
    prisma.meterInfo.count({ where: { ...where, approveStatus: 'pending' } }),
    prisma.meterInfo.count({ where: { ...where, approveStatus: 'rejected' } }),
  ]);
  return { total, approved, pending, rejected };
}

module.exports = {
  getMeters,
  getMetersByBuilding,
  getMeterBySnid,
  getApprovedMeters,
  getApprovedMetersByBuilding,
  getPendingMeters,
  getRejectedMeters,
  createMeter,
  updateMeter,
  deleteMeter,
  getMeterStats,
};
