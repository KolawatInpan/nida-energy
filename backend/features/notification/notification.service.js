// Notification service: สร้าง notification ตาม event ต่างๆ
const { prisma } = require('../../utils/prisma');

/**
 * สร้าง notification
 * @param {Object} param0
 * @param {string} param0.type - ประเภท event เช่น 'building_added', 'meter_added', 'user_registered', 'sell_electricity', 'invoice', 'topup', 'topup_success', 'payment_success'
 * @param {string} param0.message - ข้อความแจ้งเตือน
 * @param {string} [param0.email] - email ของผู้รับโดยตรง (ใช้ค่านี้ก่อน ถ้ามี)
 * @param {string} [param0.userId] - user credId (ใช้หา email ถ้าไม่ระบุ email โดยตรง)
 * @param {number} [param0.buildingId]
 * @param {number} [param0.meterId]
 */
async function createNotification({ type, message, email: directEmail = null, userId = null, buildingId = null, meterId = null }) {
  let email = directEmail || 'admin';
  if (!directEmail && userId) {
    const user = await prisma.user.findUnique({ where: { credId: String(userId) } });
    if (user && user.email) {
      email = user.email;
    }
  }

  return prisma.notification.create({
    data: {
      email,
      title: type || 'System Notification',
      body: message || '',
      data: { type, userId, buildingId, meterId },
      read: false
    },
  });
}

/**
 * ดึง notification สำหรับ user หรือ admin
 * @param {number|null} userId - ถ้า null = admin, ถ้า userId = เฉพาะ user
 * @param {number} [limit=20]
 */
async function getNotifications(userId = null, limit = 20) {
  let filter = {};
  
  if (userId) {
    if (String(userId).includes('@')) {
      filter.email = String(userId);
    } else {
      const user = await prisma.user.findUnique({ where: { credId: String(userId) } });
      if (user && user.email) {
        filter.email = user.email;
      } else {
        filter.email = 'not-found'; // หากไม่พบ User จะไม่แสดงแจ้งเตือน
      }
    }
  }

  return prisma.notification.findMany({
    where: Object.keys(filter).length > 0 ? filter : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Mark a notification as read
 */
async function markAsRead(notificationId) {
  return prisma.notification.update({
    where: { id: Number(notificationId) },
    data: { read: true },
  });
}

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
};
