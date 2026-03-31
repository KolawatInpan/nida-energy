const { HEADER_NAME, getModeFromRequest, getPrismaForMode, runWithMode } = require('../utils/prisma');

function dataModeMiddleware(req, res, next) {
  const mode = getModeFromRequest(req);
  runWithMode(mode, () => {
    req.dataMode = mode;
    req.prisma = getPrismaForMode(mode);
    res.setHeader(HEADER_NAME, mode);
    next();
  });
}

module.exports = dataModeMiddleware;

