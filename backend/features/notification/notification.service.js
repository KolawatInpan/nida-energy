// Notification service: สร้าง notification ตาม event ต่างๆ
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * สร้าง notification
 * @param {Object} param0
 * @param {string} param0.type - ประเภท event เช่น 'building_added', 'meter_added', 'user_registered', 'sell_electricity', 'invoice', 'topup', 'topup_success', 'payment_success'
 * @param {string} param0.message - ข้อความแจ้งเตือน
 * @param {number} [param0.userId] - user id (null = admin)
 * @param {number} [param0.buildingId]
 * @param {number} [param0.meterId]
 */
async function createNotification({ type, message, userId = null, buildingId = null, meterId = null }) {
  return prisma.notification.create({
    data: {
      type,
      message,
      userId,
      buildingId,
      meterId,
    },
  });
}

/**
 * ดึง notification สำหรับ user หรือ admin
 * @param {number|null} userId - ถ้า null = admin, ถ้า userId = เฉพาะ user
 * @param {number} [limit=20]
 */
async function getNotifications(userId = null, limit = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

module.exports = {
  createNotification,
  getNotifications,
};
