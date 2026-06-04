// Bridge: re-exports from new modular structure
// TODO: update all consumers to import from offer.repository / trade.engine / market.utils directly
const repo = require('./offer.repository');
const engine = require('./trade.engine');
const utils = require('./market.utils');

module.exports = {
    ...repo,
    ...engine,
    ...utils,
};

