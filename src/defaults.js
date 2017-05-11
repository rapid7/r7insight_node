export const bufferSize = 16192;

export const secure = true;

export const baseHost = 'data.logs.insight.rapid7.com';

export const port = 80;

export const portSecure = 443;

export const reconnectInitialDelay = 1000;

export const reconnectMaxDelay = 15 * 1000;

export const reconnectBackoffStrategy = 'fibonacci';

export const inactivityTimeout = 15 * 1000;

export const levels = [
  'debug',
  'info',
  'notice',
  'warning',
  'err',
  'crit',
  'alert',
  'emerg'
];

export const bunyanLevels = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal'
];

export const debug = false;

export const debugLogger = (() => {
  const timestamp = () => {
  };

  timestamp.toString = () =>
      `[DEBUG ${(new Date()).toLocaleString()}] Logentries r7insight_node: `;

  return { log: console.log.bind(console, '%s', timestamp) };
})();
