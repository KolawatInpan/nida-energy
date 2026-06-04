module.exports = {
  controller: require('./offer.controller'),
  model: require('./offer.model'),       // bridge → offer.repository + trade.engine + market.utils
  service: require('./offer.service'),   // bridge → same
  routes: require('./offer.routes'),
  marketRoutes: require('./market.routes'),
  marketController: require('./market.controller'),
  marketService: require('./market.service'),
  tradeEngine: require('./trade.engine'),
  utils: require('./market.utils'),
  repository: require('./offer.repository'),
};

