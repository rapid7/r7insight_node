const generateTransport = require('./transport');

/**
 * Initializes our InsightTransport within winston.transports
 * 
 * @param winston winston module
 * @param Transport winstow-transport module for inheritance
 */
function provisionWinston(winston, Transport) {
  //  If we have already initialized the transport, return
  if (winston.transports.Insight) {
    return;
  }

  const InsightTransport = generateTransport(winston, Transport);

  //  eslint isn't happy since we're assigning to function parameter
  /* eslint no-param-reassign: ["error", { "props": false }] */
  winston.transports.Insight = InsightTransport;
}

module.exports = provisionWinston;
