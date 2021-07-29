/* eslint-disable */

'use strict';

const _ = require('lodash');
const bunyan = require('bunyan');
const mitm = require('mitm');
const tape = require('tape');
const winston = require('winston');

const defaults = require('../src/defaults.js');
const levels = require('../src/levels.js');
const Logger = require('../src/index.js');
const RingBuffer = require('../src/ringBuffer.js');

//  Fake token
const token = '00000000-0000-0000-0000-000000000000';

// CUSTOM LEVEL NAMES

tape('Levels are default if custom levels are not supplied.', function (t) {
  t.deepEqual(levels.normalize({}), defaults.levels, 'undefined');
  t.deepEqual(levels.normalize({ levels: null }), defaults.levels, 'null');
  t.deepEqual(levels.normalize({ levels: {} }), defaults.levels, 'empty obj');
  t.deepEqual(levels.normalize({ levels: [] }), defaults.levels, 'empty arr');
  t.deepEqual(
      levels.normalize({ levels: _.noop }),
      defaults.levels,
      'function'
  );

  t.end();
});

tape('Weird value for custom levels object throws.', function (t) {
  t.throws(levels.normalize.bind(null, { levels: 4 }), 'number');
  t.throws(levels.normalize.bind(null, { levels: 'cheese' }), 'string');
  t.throws(levels.normalize.bind(null, { levels: NaN }), 'number (NaN)');
  t.throws(levels.normalize.bind(null, { levels: true }), 'boolean');

  t.end();
});

tape('Custom levels without valid indices throw.', function (t) {
  t.throws(levels.normalize.bind(
      null, { levels: { a: -1 } }), 'negative index');
  t.throws(levels.normalize.bind(
      null, { levels: { a: 3.14 } }), 'decimals');
  t.throws(levels.normalize.bind(
      null, { levels: { a: '$$$' } }), 'non-numeric');
  t.throws(levels.normalize.bind(
      null, { levels: { a: null } }), 'null');
  t.doesNotThrow(
      levels.normalize.bind(null, { levels: { a: 1 } }),
      'valid index does not throw'
  );

  t.end();
});

tape('Ensure region or host is provided, else throw', function(t) {
  t.throws(() => {
    new Logger({ token: '00112233-4455-6677-8899-aabbccddeeff' });
  });

  t.doesNotThrow(() => {
    new Logger({ token: '00112233-4455-6677-8899-aabbccddeeff', region: 'eu' });
  });

  t.doesNotThrow(() => {
    new Logger({ token: '00112233-4455-6677-8899-aabbccddeeff',
                 host: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
  });

  t.end();
});

tape('If region and host is defined, throw', function(t) {
  t.throws(() => {
    new Logger({ token: '00112233-4455-6677-8899-aabbccddeeff',
                 region: 'eu',
                 host: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
  });

  t.end();
});

tape('Custom levels with invalid names throw.', function (t) {
  t.throws(levels.normalize.bind(null, { levels: [[]] }), 'object');
  t.throws(levels.normalize.bind(null, { levels: [true] }), 'boolean');
  t.throws(levels.normalize.bind(null, { levels: [NaN] }), 'NaN');

  t.end();
});

tape('Custom levels with duplicate names throw.', function (t) {
  t.throws(levels.normalize.bind(null, { levels: ['a', 'b', 'a'] }),
      'duplicate strings');

  t.throws(levels.normalize.bind(null, { levels: ['230', 230] }),
      'coercively duplicative strings');

  t.doesNotThrow(levels.normalize.bind(null, { levels: ['A', 'a'] }),
      'case sensitive');

  t.end();
});

tape('Custom levels with conflicting names throw.', function (t) {

  function makeLogger(levels) {
    new Logger({ token, levels, region: 'eu' });
  }

  t.throws(makeLogger.bind(null, ['log']), 'own property');

  t.throws(makeLogger.bind(null, ['write']), 'inherited property');

  t.doesNotThrow(makeLogger.bind(null, ['propX']), 'valid property');

  t.end();
});

// LOGGER CONSTRUCTION

tape('Logger throws with bad options.', function (t) {

  function withOpts(opts) {
    return function () {
      new Logger(opts);
    };
  }

  t.throws(withOpts(), 'missing options');
  t.throws(withOpts('cats'), 'primitive');
  t.throws(withOpts({}), 'missing token');
  t.throws(withOpts({ token: [], region: 'eu' }), 'nonsense token type');
  t.throws(withOpts({ token: 'abcdef', region: 'eu' }), 'nonsense token string');

  t.end();
});

tape('Logger does not forgive or forget.', function (t) {
  /* jshint newcap: false */

  t.throws(function () {
    Logger({ token, region: 'eu' });
  }, 'missing new throws');

  t.end();
});

tape('Logger allows custom log level methods at construction.', function (t) {
  const logger = new Logger({
    token,
    levels: ['tiny', 'small'],
    region: 'eu'
  });

  t.equal(_.isFunction(logger.tiny), true,
      'custom method present');

  t.equal(_.isFunction(logger[defaults.levels[1]]), false,
      'replaced default absent');

  t.equal(_.isFunction(logger[defaults.levels[2]]), true,
      'other default present');

  t.end();
});

tape('Logger allows specification of minLevel at construction', function (t) {

  const name = defaults.levels[3];

  const logger1 = new Logger({ token, minLevel: name, region: 'eu' });

  t.equal(logger1.minLevel, 3, 'by name.');

  const logger2 = new Logger({ token, minLevel: 3, region: 'eu' });

  t.equal(logger2.minLevel, 3, 'by index (num)');

  const logger3 = new Logger({ token, minLevel: '3', region: 'eu' });

  t.equal(logger3.minLevel, 3, 'by index (str)');

  t.end();

});

tape('Logger allows specification of withHostname at construction', function (t) {

  const logger1 = new Logger({ token, withHostname: true, region: 'eu' });

  t.equal(logger1.withHostname, true, 'withHostname');

  const logger2 = new Logger({ token, region: 'eu' });

  t.equal(logger2.withHostname, false, 'withHostname');

  t.end();

});


// CUSTOM JSON SERIALIZATION

tape('Error objects are serialized nicely.', function (t) {
  const msg = 'no kittens found';
  const err = new Error(msg);
  const log = { errs: [err] };

  const logger1 = new Logger({ token, region: 'eu' });

  t.equal(JSON.parse(logger1.serialize(err)).message, msg,
      'error object is serialized.');

  t.equal(JSON.parse(logger1.serialize(log)).errs[0].message, msg,
      'including when nested.');

  t.equal(JSON.parse(logger1.serialize(err)).stack, undefined,
      'by default, stack is not included.');

  const logger2 = new Logger({ token, withStack: true, region: 'eu' });

  t.true(JSON.parse(logger2.serialize(err)).stack,
      'withStack option causes its inclusion.');

  t.end();
});

tape('Arguments and regex patterns are serialized.', function (t) {
  const argObj = (function () {
    return arguments;
  })(1, 2, 3);
  const regObj = /abc/;

  const logger = new Logger({ token, region: 'eu' });

  t.true(logger.serialize(argObj) === '[1,2,3]', 'arguments become arrays.');

  t.true(logger.serialize(regObj) === '"/abc/"', 'patterns become strings');

  t.end();
});

tape('Custom value transformer is respected.', function (t) {
  function alwaysKittens(key, val) {
    return _.isObject(val) ? val : 'kittens';
  }

  const log = {
    status: 'green',
    friends: ['dogs', 'gerbils', 'horses'],
    err: new Error('not kittens :(')
  };

  const logger = new Logger({ token, replacer: alwaysKittens, region: 'eu' });

  const res = JSON.parse(logger.serialize(log));

  t.equal(res.status, 'kittens', 'single property.');

  t.true(res.friends.every(function (v) {
        return v == 'kittens';
      }),
      'array elements');

  t.equal(res.err.message, 'kittens',
      'custom replacer cooperates with automatic error transormation');

  t.end();
});

tape('Circular references don’t make the sad times.', function (t) {
  const consciousness = {};
  consciousness.iAm = consciousness;

  const logger = new Logger({ token, region: 'eu' });

  const res = JSON.parse(logger.serialize(consciousness));

  t.true(res, 'circular reference allowed');

  t.equal(res.iAm, '[Circular ~]', 'circular reference indicated');

  t.end();
});

tape('Serialize objects that inherit from non-Object objects fine', function (t) {
  function NullObj() {
  }

  NullObj.prototype = Object.create(null);
  const newObj = new NullObj();

  newObj.prop = 1;

  const logger = new Logger({ token, region: 'eu' });

  const res = JSON.parse(logger.serialize(newObj));

  t.true(res, 'object from non object doesn’t throw');

  t.equal(res.prop, 1, 'properties are still seen');

  t.end();
});

tape('Object.create(null) objects don’t destroy everything.', function (t) {
  const nullObj = Object.create(null);

  nullObj.prop = 1;

  const logger = new Logger({ token, region: 'eu' });

  const res = JSON.parse(logger.serialize(nullObj));

  t.true(res, 'null-prototype object doesn’t throw');

  t.equal(res.prop, 1, 'properties are still seen');

  t.end();
});

// FLATTENED DATA

tape('Flattening options work.', function (t) {
  const log = {
    lilBub: {
      occupation: 'prophet',
      paws: [
        { excellence: { value: 10, max: 5 } },
        { excellence: { value: 10, max: 5 } },
        { excellence: { value: 10, max: 5 } },
        { excellence: { value: 10, max: 5 } }
      ]
    }
  };

  function replacer(key, val) {
    return key == 'value' ? val * 2 : val;
  }

  const logger1 = new Logger({
    token,
    flatten: true,
    flattenArrays: false,
    region: 'eu'
  });

  const logger2 = new Logger({
    token,
    flatten: true,
    replacer: replacer,
    region: 'eu'
  });

  const res = JSON.parse(logger1.serialize(log));

  t.true('lilBub.occupation' in res, 'keys use dot notation');

  t.equal(res['lilBub.occupation'], 'prophet', 'non-objects are values');

  t.true(
      'lilBub.paws' in res,
      'flattenArrays:false treats arrays as non-objects'
  );

  t.true(
      'excellence.value' in res['lilBub.paws'][0],
      'flattenArrays:false still lets object members transform'
  );

  const res2 = JSON.parse(logger2.serialize(log));

  t.true(
      'lilBub.paws.0.excellence.max' in res2,
      'flattenArrays:true treats arrays as objects'
  );

  t.equals(
      res2['lilBub.paws.0.excellence.value'], 20,
      'custom replacers are still respected and applied first'
  );

  t.end();
});

// SENDING DATA

function mockTest(cb) {
  const mock = mitm();

  mock.on('connection', function(socket, opts) {
    socket.on('data', function(buffer) {
      mock.disable();
      cb(buffer.toString());
    });
  });
}

tape('Data is sent over standard connection.', function (t) {
  t.plan(4);
  t.timeoutAfter(2000);

  const lvl = defaults.levels[3];
  const msg = 'test';
  const tkn = token;

  const mock = mitm();

  mock.on('connection', function (socket, opts) {

    t.pass('connection made');

    socket.on('data', function (buffer) {
      t.pass('data received');
      t.equal(socket.encrypted, undefined, 'socket is not secure');

      const log = buffer.toString();
      const expected = [tkn, lvl, msg + '\n'].join(' ');

      t.equal(log, expected, 'message matched');

      mock.disable();
    });
  });

  const logger = new Logger({ token: tkn, secure: false, region: 'eu' });

  logger[lvl](msg);
});

tape('Data is sent over secure connection.', function (t) {
  t.plan(5);
  t.timeoutAfter(2000);

  const lvl = defaults.levels[3];
  const msg = 'test';
  const tkn = token;

  const mock = mitm();

  mock.on('connection', function (socket, opts) {

    t.pass('connection made');

    t.equal(opts.port, defaults.portSecure, 'correct port');
    t.equal(socket.encrypted, true, 'socket is secure');

    socket.on('data', function (buffer) {
      t.pass('data received');

      const log = buffer.toString();
      const expected = [tkn, lvl, msg + '\n'].join(' ');

      t.equal(log, expected, 'message matched');

      mock.disable();
    });
  });

  const logger = new Logger({ token: tkn, secure: true, region: 'eu' });

  logger[lvl](msg);
});

tape('Log methods can send multiple entries.', function (t) {
  t.plan(2);
  t.timeoutAfter(4000);

  const lvl = defaults.levels[3];
  const tkn = token;
  const logger = new Logger({ token: tkn, region: 'eu' });
  let count = 0;

  mockTest(function (data) {
    count++;
    if (count == 1) return t.pass('as array');
    t.equal(tkn + ' ' + lvl + ' test2\n', data, 'message matched');
  });

  logger[lvl](['test1', 'test2']);

});

tape('Non-JSON logs may carry timestamp.', function (t) {
  t.plan(1);
  t.timeoutAfter(2000);

  mockTest(function (data) {

    t.true(pattern.test(data), 'matched');

  });

  const lvl = defaults.levels[3];
  const tkn = token;
  const pattern = new RegExp(
      '^' + token +
      ' \\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d.\\d{3}Z \\w+ test\\n$'
  );

  const logger = new Logger({ token: tkn, timestamp: true, region: 'eu' });

  logger[lvl]('test');
});

tape('Non-JSON logs may carry Hostname.', function (t) {
  t.plan(1);
  t.timeoutAfter(2000);

  mockTest(function (data) {
    t.true(pattern.test(data), 'matched');

  });
  const os = require('os');
  const lvl = defaults.levels[3];
  const tkn = token;
  const pattern = new RegExp(`^${token} ${os.hostname()} \\w+ test\\n$`);

  const logger = new Logger({ token: tkn, withHostname: true, region: 'eu' });

  logger[lvl]('test');
});


tape('JSON logs may carry Hostname.', function (t) {
  t.plan(1);
  t.timeoutAfter(2000);

  mockTest(function (data) {
    const log = JSON.parse(data.substr(37));
    t.equals(os.hostname(), log.hostname);
  });
  const os = require('os');
  const lvl = defaults.levels[3];
  const tkn = token;

  const logger = new Logger({ token: tkn, withHostname: true, region: 'eu' });

  logger[lvl]({msg: "Testing!"});
});


tape('JSON logs match expected pattern.', function (t) {
  t.timeoutAfter(2000);

  mockTest(function (data) {
    try {

      const log = JSON.parse(data.substr(37));

      t.pass('valid JSON');

      t.true(_.isNull(log.msg), 'JSON datatypes survive');

      t.true(timestampPattern.test(log.time), 'carried timestamp');

      t.equal(log.level, 'o', 'original properties respected');

      t.equal(log._level, lvl, 'appended properties avoid collision');

      t.end();

    } catch (err) {

      t.fail('valid JSON');

      t.end();
    }
  });

  const lvl = defaults.levels[3];
  const tkn = token;
  const timestampPattern = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d.\d{3}Z$/;

  const logger = new Logger({ token: tkn, timestamp: true, region: 'eu' });

  logger[lvl]({ msg: null, level: 'o' });

});

tape('Directly logged error objects survive.', function (t) {
  t.plan(1);
  t.timeoutAfter(500);

  const message = 'warp breach imminent';
  const error = new Error(message);
  const logger = new Logger({ token, region: 'eu' });

  logger.on('error', function (err) {
    t.comment(err.stack);
    t.fail('error logged on error');
  });

  mockTest(function (data) {
    const log = JSON.parse(data.substr(37));
    t.equal(log.message, message, 'error logged on connection');
  });

  logger.log(error);
});

tape('Invalid calls to log methods emit error.', function (t) {
  t.plan(2);
  t.timeoutAfter(500);

  const logger1 = new Logger({ token, region: 'eu' });

  logger1.on('error', function () {
    t.pass('no arguments');
  });

  logger1.log(3);

  const logger2 = new Logger({ token, region: 'eu' });

  logger2.on('error', function () {
    t.pass('empty array');
  });

  logger2.log(3, []);
});

tape('Socket gets re-opened as needed.', function (t) {
  t.plan(1);
  t.timeoutAfter(3000);

  const logger = new Logger({ token, region: 'eu' });

  mockTest(function (data) {

    mockTest(function (data) {
      t.pass('successful');
    });
  });

  logger.log(3, 'qwerty');

  setTimeout(function () {
    logger.closeConnection();

    setTimeout(function () {
      logger.log(3, 'qwerty');
    }, 500);
  }, 500);
});


tape('Logger minLevel option is supported and works', function (t) {
  t.plan(1);
  t.timeoutAfter(1000);

  const logger = new Logger({
    token,
    region: 'eu',
    minLevel: 'info',
  });

  mockTest(_ => {
    t.fail('Data should not be sent with lower logger level.');
  });

  logger.debug('asd');
  logger.log('debug', 'asd');
  logger['debug']('asd');

  t.pass('Test finished');
});

tape('Winston JSON logger minLevel option is supported and works', function (t) {
  t.plan(1);
  t.timeoutAfter(1000);

  const logger = winston.createLogger({
    transports: [
      new winston.transports.Insight({
        token,
        region: 'eu',
        minLevel: 'info',
        json: true,
      }),
    ]
  });

  mockTest(_ => {
    t.fail('Data should not be sent with lower logger level.');
  });

  logger.debug('asd');
  logger.log('debug', 'asd');
  logger['debug']('asd');

  t.pass('Test finished');
});

tape('Winston String logger minLevel option is supported and works', function (t) {
  t.plan(1);
  t.timeoutAfter(1000);

  const logger = winston.createLogger({
    transports: [
      new winston.transports.Insight({
        token,
        region: 'eu',
        minLevel: 'info',
      }),
    ]
  });

  mockTest(_ => {
    t.fail('Data should not be sent with lower logger level.');
  });

  logger.debug('asd');
  logger.log('debug', 'asd');
  logger['debug']('asd');

  t.pass('Test finished');
});

tape('Socket is not closed after inactivity timeout when buffer is not empty.', function (t) {
  t.plan(3);
  t.timeoutAfter(1000);
  const lvl = defaults.levels[3];
  const tkn = token;
  const logger = new Logger({ token, inactivityTimeout: 300, region: 'eu' });

  const mock = mitm();

  mock.on('connection', function (socket, opts) {
    socket.once('data', function (buffer) {
      const log1 = buffer.toString();
      const expected1 = [tkn, lvl, 'first log' + '\n'].join(' ');
      t.equals(log1, expected1, 'first log received.');
    });

    logger.once('timed out', function () {
      t.true(logger.drained, 'timeout event triggered and logger was drained.');
    });

    setTimeout(function () {
      logger.log(lvl, 'second log');
      socket.once('data', function (buffer) {
        const log2 = buffer.toString();
        const expected2 = [tkn, lvl, 'second log' + '\n'].join(' ');
        t.equals(log2, expected2, 'log before inactivity timeout received.');
      });
    }, 299);
    mock.disable();
  });
  logger.log(lvl, 'first log');
});


tape('RingBuffer buffers and shifts when it is full', function (t) {
  t.plan(5);
  t.timeoutAfter(1000);

  const ringBuffer = new RingBuffer(1);
  ringBuffer.on('buffer shift', function () {
    t.pass('Buffer shift event emitted');
  });
  t.true(ringBuffer.write('Test log'), 'RingBuffer buffers');
  t.false(ringBuffer.write('Another test log'), 'RingBuffer shifts');
  t.equal(ringBuffer.read(), 'Another test log', 'got expected log event');
  t.true(ringBuffer.isEmpty(), 'No records left in the buffer');
});

// WINSTON TRANSPORT

tape('Winston supports string format logging', function (t) {
  t.plan(4);
  t.timeoutAfter(1000);

  t.true(winston.transports.Insight,
      'provisioned constructor automatically');

  t.doesNotThrow(function () {
    winston.add(new winston.transports.Insight({ token, region: 'eu' }));
  }, 'transport can be added');

  winston.remove(winston.transports.Console);

  let messageReceived = 0;

  mockTest((data) => {
    //  We're only expecting one message
    if (messageReceived == 1) return;
    messageReceived++;

    t.pass('winston log transmits');
    t.equal(data, `${token} warn mysterious radiation\n`, 'msg as expected');
  });

  winston.warn('mysterious radiation');
});

tape('Winston supports string format logging with metadata', function (t) {
  t.plan(4);
  t.timeoutAfter(1000);

  t.true(winston.transports.Insight,
      'provisioned constructor automatically');

  winston.remove(winston.transports.Insight);
  t.doesNotThrow(function () {
    winston.add(new winston.transports.Insight({ token, region: 'eu' }));
  }, 'transport can be added');

  winston.remove(winston.transports.Console);

  let messageReceived = 0;

  mockTest((data) => {
    //  We're only expecting one message
    if (messageReceived == 1) return;
    messageReceived++;

    t.pass('winston log transmits');
    const expectedMessage = `${token} error: test error message {"account_id":"account_id"}\n`;

    t.equal(data, expectedMessage, 'msg as expected');
  });

  winston.error('test error message', { account_id: 'account_id' });
});

tape('Winston supports string format logging with multiple metadata', function (t) {
  t.plan(4);
  t.timeoutAfter(1000);

  t.true(winston.transports.Insight,
      'provisioned constructor automatically');

  winston.remove(winston.transports.Insight);
  t.doesNotThrow(function () {
    winston.add(new winston.transports.Insight({ token, region: 'eu' }));
  }, 'transport can be added');

  winston.remove(winston.transports.Console);

  let messageReceived = 0;

  mockTest((data) => {
    //  We're only expecting one message
    if (messageReceived == 1) return;
    messageReceived++;

    t.pass('winston log transmits');
    const expectedMessage = `${token} error: test error message with error with metadata {"account_id":"account_id","hello_there":"general kenobi"}\n`;

    t.equal(data, expectedMessage, 'msg as expected');
  });

  winston.error('test error message with error with metadata', { account_id: 'account_id' }, { hello_there: 'general kenobi' });
});

tape('Winston supports JSON format logging with metadata', function (t) {
  t.plan(4);
  t.timeoutAfter(1000);

  t.true(winston.transports.Insight,
      'provisioned constructor automatically');

  winston.remove(winston.transports.Insight);
  t.doesNotThrow(function () {
    winston.add(new winston.transports.Insight({ token, region: 'eu', json: true }));
  }, 'transport can be added');

  winston.remove(winston.transports.Console);

  let messageReceived = 0;

  mockTest((data) => {
    //  We're only expecting one message, don't accept other messages
    if (messageReceived == 1) return;
    messageReceived++;

    t.pass('winston log transmits');
    const expectedMessage = `${token} {"account_id":"account_id","level":"error","message":"test error message"}\n`;

    t.equal(data, expectedMessage, 'msg as expected');
  });

  winston.error('test error message', { account_id: 'account_id' });
});

tape('Winston supports JSON format logging with multiple metadata', function (t) {
  t.plan(4);
  t.timeoutAfter(1000);

  t.true(winston.transports.Insight,
      'provisioned constructor automatically');

  winston.remove(winston.transports.Insight);
  t.doesNotThrow(function () {
    winston.add(new winston.transports.Insight({ token, region: 'eu', json: true }));
  }, 'transport can be added');

  winston.remove(winston.transports.Console);

  let messageReceived = 0;

  mockTest((data) => {
    //  We're only expecting one message, don't accept other messages
    if (messageReceived == 1) return;
    messageReceived++;

    t.pass('winston log transmits');
    const expectedMessage = `${token} {"account_id":"account_id","level":"error","message":"test error message with error with metadata","hello_there":"general kenobi"}\n`;

    t.equal(data, expectedMessage, 'msg as expected');
  });

  winston.error('test error message with error with metadata', { account_id: 'account_id' }, { hello_there: 'general kenobi' });
});

tape('Winston supports JSON format logging with timestamps', function (t) {
  t.plan(4);
  t.timeoutAfter(1000);

  t.true(winston.transports.Insight,
      'provisioned constructor automatically');

  winston.remove(winston.transports.Insight);
  t.doesNotThrow(function () {
    winston.add(new winston.transports.Insight({ token, region: 'eu', json: true, timestamp: true }));
  }, 'transport can be added');

  winston.remove(winston.transports.Console);

  let messageReceived = 0;

  mockTest((data) => {
    //  We're only expecting one message, don't accept other messages
    if (messageReceived == 1) return;
    messageReceived++;

    t.pass('winston log transmits');

    //  Remove token
    data = data.substring(token.length + 1);

    //  Turn to object
    data = JSON.parse(data);
    t.assert(data.time);
  });

  winston.error('test error message with error with metadata');
});

tape("Winston supports json logging.", function (t) {
  t.plan(2);
  t.timeoutAfter(2000);

  const logger = winston.createLogger({
    transports: [
      new winston.transports.Insight({ token, region: 'eu', json: true }),
    ]
  });

  let messageReceived = 0;

  mockTest(function (data) {
    //  We're only expecting one message
    if (messageReceived == 1) return;
    messageReceived++;

    t.pass("winston logs in json format");
    const expect = {
      foo: "bar",
      level: "warn",
      message: "msg",
    };
    t.equal(data, `${token} ${JSON.stringify(expect)}\n`, 'json as expected');
  });

  logger.warn("msg", { foo: "bar" });
});



// BUNYAN STREAM

tape('Bunyan integration is provided.', function (t) {
  t.plan(9);

  const streamDef = Logger.bunyanStream({ token, minLevel: 3, region: 'eu' });

  t.true(streamDef, 'bunyan stream definition created');

  t.equal(streamDef.level, defaults.bunyanLevels[3],
    'minLevel translated correctly');

  t.equal(streamDef.stream._logger._host, 'eu.data.logs.insight.rapid7.com')

  const logger = bunyan.createLogger({
    name: 'whatevs',
    streams: [streamDef]
  });

  t.true(logger, 'bunyan logger created');

  mockTest(function (data) {
    t.pass('bunyan stream transmits');

    const log = JSON.parse(data.substr(37));

    t.pass('valid json');

    t.equal(log.yes, 'okay', 'data as expected');

    t.equal(log.level, 40, 'bunyan level number as expected');

    t.equal(log._level, defaults.bunyanLevels[3], 'level name as expected');
  });

  logger[defaults.bunyanLevels[3]]({ yes: 'okay' });
});


tape('Bunyan integration respects region option.', function (t) {
  t.plan(2);

  const streamDef = Logger.bunyanStream({ token, minLevel: 3, region: 'craggy_island' });

  t.equal(streamDef.stream._logger._host, 'craggy_island.data.logs.insight.rapid7.com')

  const logger = bunyan.createLogger({
    name: 'whatevs',
    streams: [streamDef]
  });

  t.equal(logger.streams[0].stream._logger._host, 'craggy_island.data.logs.insight.rapid7.com')
});
