const net = require('net');
const os = require('os');
const reconnectCore = require('reconnect-core');
const tls = require('tls');
const urlUtil = require('url');
const _ = require('lodash');
const {Writable} = require('stream');

const BadOptionsError = require('./optionsError');
const build = require('./serialize');
const defaults = require('./defaults');
const getSafeProp = require('./loggerUtils');
const InsightError = require('./error');
const levelUtil = require('./levels');
const text = require('./text');
const RingBuffer = require('./ringBuffer');


// patterns
const newline = /\n/g;
const tokenPattern = /[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}/;

// exposed Logger events
const errorEvent = 'error';
const logEvent = 'log';
const connectedEvent = 'connected';
const disconnectedEvent = 'disconnected';
const timeoutEvent = 'timed out';
const drainWritableEvent = 'drain';
const finishWritableEvent = 'finish';
const pipeWritableEvent = 'pipe';
const unpipeWritableEvent = 'unpipe';
const bufferDrainEvent = 'buffer drain';

/**
 * Prepend given log with token for sending to Insight Platform
 * and format log correctly.
 * @param {Array} log Log entry
 * @param {String} token Log token
 */
const finalizeLogString = (log, token) => `${token} ${log.toString().replace(newline, '\u2028')}\n`;

/**
 * Get console method corresponds to lvl
 * @param {Number} lvl log level
 * @returns {String}
 */
const getConsoleMethod = (lvl) => {
  if (lvl > 3) {
    return 'error';
  } if (lvl === 3) {
    return 'warn';
  }

  return 'log';
};


/**
 * Logger class that handles parsing of logs and sending logs to the Insight Platform.
 * @extends Writable
 */
class Logger extends Writable {
  /**
   * Creates a Logger instance
   *
   * @constructor
   * @param {Map} opts Logger options
  */
  constructor(opts) {
    super({
      objectMode: true
    });

    // Sanity options checks
    if (_.isUndefined(opts)) {
      throw new BadOptionsError(opts, text.noOptions());
    } else if (!_.isObject(opts)) {
      throw new BadOptionsError(opts, text.optionsNotObj(typeof opts));
    } else if (_.isUndefined(opts.region) && _.isUndefined(opts.host)) {
      throw new BadOptionsError(opts, text.noRegion(opts.region));
    } else if (!_.isUndefined(opts.region) && !_.isUndefined(opts.host)) {
      throw new BadOptionsError(opts, text.noRegionAndHost(opts.region));
    } else if (_.isUndefined(opts.token)) {
      throw new BadOptionsError(opts, text.noToken());
    } else if (!_.isString(opts.token) || !tokenPattern.test(opts.token)) {
      throw new BadOptionsError(opts, text.invalidToken(opts.token));
    }

    //  Fetch levels from options or default if not provided
    this.levels = levelUtil.normalize(opts);

    //  Check each level provided for existing conflict
    //  and define property on logger so it can be called for logging
    //  e.g. `logger.randomlevelname('message')`
    this.levels.forEach((lvlName) => {
      if (lvlName in this) {
        throw new BadOptionsError(opts, text.levelConflict(lvlName));
      }

      Object.defineProperty(this, lvlName, {
        enumerable: true,
        value() {
          this.log(lvlName, ...arguments);
        },
        writable: false
      });
    });

    // Boolean options
    this.secure = opts.secure === undefined ? defaults.secure : opts.secure;
    this.debugEnabled = opts.debug === undefined ? defaults.debug : opts.debug;
    this.json = !!opts.json;
    this.takeLevelFromLog = !!opts.takeLevelFromLog;
    this.flatten = opts.flatten;
    this.flattenArrays = 'flattenArrays' in opts ? opts.flattenArrays : opts.flatten;
    this.console = opts.console;
    this.withLevel = 'withLevel' in opts ? opts.withLevel : true;
    this.withHostname = opts.withHostname;
    this.withStack = opts.withStack;
    this.timestamp = opts.timestamp || false;

    // String or Numeric options
    this.bufferSize = opts.bufferSize || defaults.bufferSize;
    this.port = opts.port || (this.secure ? defaults.portSecure : defaults.port);
    this.host = opts.host || `${opts.region}.${opts.baseHost || defaults.baseHost}`;
    this.minLevel = opts.minLevel;
    this.replacer = opts.replacer;
    this.inactivityTimeout = opts.inactivityTimeout || defaults.inactivityTimeout;
    this.disableTimeout = opts.disableTimeout;
    this.token = opts.token;
    this.reconnectInitialDelay = opts.reconnectInitialDelay || defaults.reconnectInitialDelay;
    this.reconnectMaxDelay = opts.reconnectMaxDelay || defaults.reconnectMaxDelay;
    this.reconnectBackoffStrategy = opts.reconnectBackoffStrategy || defaults.reconnectBackoffStrategy;

    //  Configure debug logging
    if (!this.debugEnabled) {
      // If there is no debug set, empty logger should be used
      this.debugLogger = {
        log: () => {
        }
      };
    } else if (opts.debugLogger && opts.debugLogger.log) {
      this.debugLogger = opts.debugLogger;
    } else {
      this.debugLogger = defaults.debugLogger;
    }

    //  Setup buffer for log events
    this.ringBuffer = new RingBuffer(this.bufferSize);

    const isSecure = this.secure;
    //  Setup connection to the Insight Platform

    this.reconnect = reconnectCore(function initialize() {
      let connection;
      const args = [].slice.call(arguments);

      if (isSecure) {
        connection = tls.connect.apply(tls, args, () => {
          if (!connection.authorized) {
            const errMsg = connection.authorizationError;

            this.emit(new InsightError(text.authError(errMsg)));
          } else if (tls && tls.CleartextStream && connection instanceof tls.CleartextStream) {
            this.emit('connect');
          }
        });
      } else {
        connection = net.connect.apply(null, args);
      }
      if (!opts.disableTimeout) {
        connection.setTimeout(opts.inactivityTimeout || defaults.inactivityTimeout);
      }

      return connection;
    });

    //  RingBuffer emits buffer shift event, meaning we are discarding some data!
    this.ringBuffer.on('buffer shift', () => {
      this.debugLogger.log('Buffer is full, will be shifting records until buffer is drained.');
    });

    this.on(bufferDrainEvent, () => {
      this.debugLogger.log('RingBuffer drained.');
      this.drained = true;
    });

    this.on(timeoutEvent, () => {
      if (this.drained) {
        this.debugLogger.log(
          `Socket was inactive for ${this.inactivityTimeout / 1000} seconds. Destroying.`
        );
        this.closeConnection();
      } else {
        this.debugLogger.log('Inactivity timeout event emitted but buffer was not drained.');
        this.once(bufferDrainEvent, () => {
          this.debugLogger.log('Buffer drain event emitted for inactivity timeout.');
          this.closeConnection();
        });
      }
    });
  }

  /**
   * Override {Writable} _write method.
   * Get the connection promise .then write the next log on the ringBuffer
   * to the Insight Platform connection when its available
   */
  _write(ch, enc, cb) {
    this.drained = false;
    this.connection.then((conn) => {
      const record = this.ringBuffer.read();

      if (record) {
        // we are checking the buffer state here just after conn.write()
        // to make sure the last event is sent to socket.
        if (this.ringBuffer.isEmpty()) {
          conn.write(record, () => {
            process.nextTick(() => {
              this.emit(bufferDrainEvent);
            });
          });
        } else {
          conn.write(record);
        }
      } else {
        //  This from my experience, means we have not written to the
        //  ringBuffer, which means that reading will return `null`.
        this.debugLogger.log('This should not happen. Read from ringBuffer returned null.');
      }
      cb();
    }).catch((err) => {
      this.emit(errorEvent, err);
      this.debugLogger.log(`Error: ${err}`);
      cb();
    });
  }

  //  Here we want to overwrite the setDefaultEncoding method but eslint will complain
  // if we don't use `this` in a class method (should be static in that scenario), so here we
  // ignore the error
  /* eslint class-methods-use-this: ["error", { "exceptMethods": ["setDefaultEncoding"] }] */
  setDefaultEncoding() {/* no. */
  }

  /**
   * Finalize the log and write() to Logger stream
   * @param {String} lvl Indicates logger level, e.g. 'warn', 'debug' etc.
   * @param {(String|Map|Array)} log log object
   */
  log(lvl, log) {
    let modifiedLevel = lvl;
    let modifiedLog = log;

    // If function is called without second argument, with just a message:
    //  logger.log('oops');
    //
    //  Then we set the log level to null if we shouldn't take the level from the log,
    //  since it doesn't exist.
    //  We then place the message in the right variable.
    if (modifiedLog === undefined) {
      modifiedLog = modifiedLevel;
      modifiedLevel = this.takeLevelFromLog ? modifiedLog.level : null;
    }

    let lvlName;

    //  If we have a Level
    if (modifiedLevel || modifiedLevel === 0) {
      [modifiedLevel, lvlName] = this.toLevel(modifiedLevel);

      // If lvl is present, it must be recognized
      if (!modifiedLevel && modifiedLevel !== 0) {
        this.emit(errorEvent, new InsightError(text.unknownLevel(modifiedLevel)));

        return;
      }

      // If lvl is below minLevel, it is dismissed
      if (modifiedLevel < this.minLevel) {
        return;
      }
    }

    // If log is an array, it is treated as a collection of log events
    if (_.isArray(modifiedLog)) {
      if (modifiedLog.length) {
        modifiedLog.forEach((modLog) => {
          this.log(modifiedLevel, modLog);
        });
      } else {
        this.emit(errorEvent, new InsightError(text.noLogMessage()));
      }

      return;
    }

    // If log is an object, it is serialized to string and may be augmented
    // with timestamp and level. For strings, these may be prepended.
    if (_.isObject(modifiedLog)) {
      let safeTime;
      let safeLevel;
      let safeHostname;

      if (this.timestamp) {
        safeTime = getSafeProp(modifiedLog, 'time');
        modifiedLog[safeTime] = new Date();
      }

      //  Set level if present
      if (this.withLevel && lvlName) {
        safeLevel = getSafeProp(modifiedLog, 'level');
        modifiedLog[safeLevel] = lvlName;
      }

      //  Set level if present
      if (this.withHostname) {
        safeHostname = getSafeProp(modifiedLog, 'hostname');
        modifiedLog[safeHostname] = os.hostname();
      }

      modifiedLog = this._serialize(modifiedLog);

      if (!modifiedLog) {
        this.emit(errorEvent, new InsightError(text.serializedEmpty()));

        return;
      }

      if (this.console) {
        console[getConsoleMethod(modifiedLevel)](JSON.parse(modifiedLog));
      }

      if (safeTime) {
        delete modifiedLog[safeTime];
      }
      if (safeLevel) {
        delete modifiedLog[safeLevel];
      }
    } else {
      if (_.isEmpty(modifiedLog)) {
        this.emit(errorEvent, new InsightError(text.noLogMessage()));

        return;
      }

      modifiedLog = [modifiedLog.toString()];

      if (this.withLevel && lvlName) {
        modifiedLog.unshift(lvlName);
      }

      if (this.withHostname) {
        modifiedLog.unshift(os.hostname());
      }

      if (this.timestamp) {
        modifiedLog.unshift((new Date()).toISOString());
      }

      modifiedLog = modifiedLog.join(' ');

      if (this.console) {
        console[getConsoleMethod(modifiedLevel)](modifiedLog);
      }
    }

    this.emit(logEvent, modifiedLog);

    // if RingBuffer.write returns false, don't create any other write request for
    // the writable stream to avoid memory leak this means there are already 'bufferSize'
    // of write events in the writable stream and that's what we want.
    if (this.ringBuffer.write(finalizeLogString(modifiedLog, this.token))) {
      this.write();
    }
  }

  /**
   * Close connection via reconnection
   */
  closeConnection() {
    this.debugLogger.log('Closing retry mechanism along with its connection.');
    if (!this.reconnection) {
      this.debugLogger.log('No reconnection instance found. Returning.');

      return;
    }
    // this makes sure retry mechanism and connection will be closed.
    this.reconnection.disconnect();
    this.connection = null;
  }

  /**
   * Close connection via reconnection
   * @param {String|Number} val logging name ('warn') or number (0)
   * @return {Array} If val is valid returns `[<logging_num>, <logging_name>]`
   * else empty array `[]`
  */
  toLevel(val) {
    let num;

    if (levelUtil.isNumberValid(val)) {
      num = parseInt(val, 10); // -0
    } else {
      num = this.levels.indexOf(val);
    }

    const name = this.levels[num];

    return name ? [num, name] : [];
  }

  get reconnect() {
    return this._reconnect;
  }

  set reconnect(func) {
    this._reconnect = func;
  }

  get connection() {
    // The $connection property is a promise. On error, manual close, or
    // inactivityTimeout, it deletes itself.
    if (this._connection) {
      return this._connection;
    }

    this.debugLogger.log('No connection exists. Creating a new one.');
    // clear the state of previous reconnection and create a new one with a new connection promise.
    if (this.reconnection) {
      // destroy previous reconnection instance if it exists.
      this.reconnection.disconnect();
      this.reconnection = null;
    }

    this.reconnection = this.reconnect({
      // all options are optional
      failAfter: Infinity,
      immediate: false,
      initialDelay: this.reconnectInitialDelay,
      maxDelay: this.reconnectMaxDelay,
      randomisationFactor: 0,
      strategy: this.reconnectBackoffStrategy
    });

    this.connection = new Promise((resolve) => {
      const connOpts = {
        host: this.host,
        port: this.port
      };

      // reconnection listeners
      this.reconnection.on('connect', (connection) => {
        this.debugLogger.log('Connected');
        this.emit(connectedEvent);

        // connection listeners
        connection.on('timeout', () => {
          this.emit(timeoutEvent);
        });
        resolve(connection);
      });

      this.reconnection.on('reconnect', (n, delay) => {
        if (n > 0) {
          this.debugLogger.log(`Trying to reconnect. Times: ${n} , previous delay: ${delay}`);
        }
      });

      this.reconnection.once('disconnect', () => {
        this.debugLogger.log('Socket was disconnected');
        this.connection = null;
        this.emit(disconnectedEvent);
      });

      this.reconnection.on('error', (err) => {
        this.debugLogger.log(`Error occurred during connection: ${err}`);
      });

      // now try to connect
      this.reconnection.connect(connOpts);
    });

    return this.connection;
  }

  set connection(obj) {
    this._connection = obj;
  }

  get reconnection() {
    return this._reconnection;
  }

  set reconnection(func) {
    this._reconnection = func;
  }

  get debugEnabled() {
    return this._debugEnabled;
  }

  set debugEnabled(val) {
    this._debugEnabled = !!val;
  }

  get debugLogger() {
    return this._debugLogger;
  }

  set debugLogger(func) {
    this._debugLogger = func;
  }

  get ringBuffer() {
    return this._ringBuffer;
  }

  set ringBuffer(obj) {
    this._ringBuffer = obj;
  }

  get secure() {
    return this._secure;
  }

  set secure(val) {
    this._secure = !!val;
  }

  get token() {
    return this._token;
  }

  set token(val) {
    this._token = val;
  }

  get bufferSize() {
    return this._bufferSize;
  }

  set bufferSize(val) {
    this._bufferSize = val;
  }

  get console() {
    return this._console;
  }

  set console(val) {
    this._console = !!val;
  }

  get serialize() {
    return this._serialize;
  }

  set serialize(func) {
    this._serialize = func;
  }

  get flatten() {
    return this._flatten;
  }

  set flatten(val) {
    this._flatten = !!val;
    this.serialize = build(this);
  }

  get flattenArrays() {
    return this._flattenArrays;
  }

  set flattenArrays(val) {
    this._flattenArrays = !!val;
    this.serialize = build(this);
  }

  get host() {
    return this._host;
  }

  set host(val) {
    const host = val.replace(/^https?:\/\//, '');
    const url = urlUtil.parse(`http://${host}`);

    this._host = url.hostname;
    if (url.port) {
      this.port = url.port;
    }
  }

  get json() {
    return this._json;
  }

  set json(val) {
    this._json = val;
  }

  get reconnectMaxDelay() {
    return this._reconnectMaxDelay;
  }

  set reconnectMaxDelay(val) {
    this._reconnectMaxDelay = val;
  }

  get reconnectInitialDelay() {
    return this._reconnectInitialDelay;
  }

  set reconnectInitialDelay(val) {
    this._reconnectInitialDelay = val;
  }

  get reconnectBackoffStrategy() {
    return this._reconnectBackoffStrategy;
  }

  set reconnectBackoffStrategy(val) {
    this._reconnectBackoffStrategy = val;
  }

  get minLevel() {
    return this._minLevel;
  }

  set minLevel(val) {
    const [num] = this.toLevel(val);

    this._minLevel = _.isNumber(num) ? num : 0;
  }

  get port() {
    return this._port;
  }

  set port(val) {
    const port = parseFloat(val);

    if (Number.isInteger(port) && _.inRange(port, 65536)) {
      this._port = port;
    }
  }

  get replacer() {
    return this._replacer;
  }

  set replacer(val) {
    this._replacer = _.isFunction(val) ? val : undefined;
    this.serialize = build(this);
  }

  get inactivityTimeout() {
    return this._inactivityTimeout;
  }

  set inactivityTimeout(val) {
    if (Number.isInteger(val) && val >= 0) {
      this._inactivityTimeout = parseInt(val, 10);
    }

    if (!_.isNumber(this._inactivityTimeout)) {
      this._inactivityTimeout = defaults.inactivityTimeout;
    }
  }

  get timestamp() {
    return this._timestamp;
  }

  set timestamp(val) {
    this._timestamp = !!val;
  }

  get withLevel() {
    return this._withLevel;
  }

  set withLevel(val) {
    this._withLevel = !!val;
  }

  get withHostname() {
    return this._withHostname;
  }

  set withHostname(val) {
    this._withHostname = !!val;
  }

  get withStack() {
    return this._withStack;
  }

  set withStack(val) {
    this._withStack = !!val;
    this.serialize = build(this);
  }

  get levels() {
    return this._levels && this._levels.slice();
  }

  set levels(val) {
    this._levels = val;
  }

  get disableTimeout() {
    return this._disableTimeout;
  }

  set disableTimeout(val) {
    this._disableTimeout = !!val;
  }
}

module.exports = Logger;
module.exports.errorEvent = errorEvent;
module.exports.logEvent = logEvent;
module.exports.connectedEvent = connectedEvent;
module.exports.disconnectedEvent = disconnectedEvent;
module.exports.timeoutEvent = timeoutEvent;
module.exports.drainWritableEvent = drainWritableEvent;
module.exports.finishWritableEvent = finishWritableEvent;
module.exports.pipeWritableEvent = pipeWritableEvent;
module.exports.unpipeWritableEvent = unpipeWritableEvent;
module.exports.bufferDrainEvent = bufferDrainEvent;
