// Bridge: re-exports from new modular structure
// All logic moved to: offer.repository.js, trade.engine.js, market.utils.js
const repo = require('./offer.repository');
const engine = require('./trade.engine');
const utils = require('./market.utils');

module.exports = {
    ...repo,
    ...engine,
    ...utils,
};

