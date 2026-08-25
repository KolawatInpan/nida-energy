const { getCurrentPrisma } = require('./utils/prisma');
const db = getCurrentPrisma();

db.user.findFirst({ select: { email: true, userId: true } }).then(u => {
  console.log('First user:', JSON.stringify(u));
  
  if (u && u.email) {
    return db.\$executeRawUnsafe\(
      'UPDATE "User" SET "userId" = 99 WHERE "email" = \$1',
      u.email
    ).then(() => db.user.findUnique({ where: { email: u.email }, select: { email: true, userId: true } }));
  }
}).then(r => {
  console.log('After update:', JSON.stringify(r));
}).catch(e => console.error('ERROR:', e.message));
