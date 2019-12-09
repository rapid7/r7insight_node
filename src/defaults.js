const bufferSize = 16192;

//  Default to secure stream
const secure = true;

const baseHost = 'data.logs.insight.rapid7.com';

const port = 80;

const portSecure = 443;

const reconnectInitialDelay = 1000;

const reconnectMaxDelay = 15 * 1000;

const reconnectBackoffStrategy = 'fibonacci';

const inactivityTimeout = 15 * 1000;

const levels = [
  'debug',
  'info',
  'notice',
  'warning',
  'err',
  'crit',
  'alert',
  'emerg'
];

const bunyanLevels = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal'
];

const debug = false;

/**
 * Object which imitates a {Logger} instance  
 * Can be used like `debugLogger.log('msg')`
 * @return {Map} Dictionary with a `log` method which console.logs given
 * output
*/
const debugLogger = (() => {
  const timestamp = () => {
  };

  timestamp.toString = () => `[DEBUG ${(new Date()).toLocaleString()}] Insight r7insight_node: `;

  return {log: console.log.bind(console, '%s', timestamp)};
})();

module.exports = {
  baseHost,
  bufferSize,
  bunyanLevels,
  debug,
  debugLogger,
  inactivityTimeout,
  levels,
  port,
  portSecure,
  reconnectBackoffStrategy,
  reconnectInitialDelay,
  reconnectMaxDelay,
  secure,
};
