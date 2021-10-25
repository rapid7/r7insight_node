# r7insight_node: Insight Platform Client

Allows you to send logs to the [Insight Platform](https://www.rapid7.com/products/)
(or Logentries) account from Node.js.

This client is not backwards-compatible with [Le_Node](https://github.com/rapid7/le_node).  
An upgrade guide can be found on [the wiki](https://github.com/rapid7/r7insight_node/wiki/2.0-Migration-Guide).  

There’s a separate client intended for use in the browser, called
[r7insight_js](https://github.com/rapid7/r7insight_js), which uses http and is optimized
for browser-specific logging needs.

- [r7insight_node: Insight Platform Client](#r7insight_node-insight-platform-client)
  - [Start](#start)
  - [Development](#development)
  - [Options](#options)
    - [Required](#required)
    - [Behavior](#behavior)
    - [Log Processing Options`](#log-processing-options)
    - [Other](#other)
  - [Log Levels](#log-levels)
  - [Events](#events)
    - [Logger Events](#logger-events)
      - [`'error'`](#error)
      - [`'log'`](#log)
      - [`'connected'` and `'disconnected'` and `'timed out'`](#connected-and-disconnected-and-timed-out)
      - [`'drain'`, `'finish'`, `'pipe'`, and `'unpipe'`](#drain-finish-pipe-and-unpipe)
      - [`'buffer drain'`](#buffer-drain)
    - [RingBuffer Events](#ringbuffer-events)
      - [`'buffer shift'`](#buffer-shift)
  - [Log Entries](#log-entries)
    - [Object Serialization](#object-serialization)
    - [Optional Augmentation](#optional-augmentation)
    - [Flattening Log Objects](#flattening-log-objects)
  - [Methods](#methods)
  - [Buffering](#buffering)
  - [Connection Handling](#connection-handling)
  - [Using as a Winston ‘Transport’](#using-as-a-winston-transport)
    - [Pre-requisites](#pre-requisites)
    - [Code Example](#code-example)
  - [Using with Bunyan](#using-with-bunyan)
  - [Using with Ts.ED Logger](#using-with-tsed-logger)

## Start

```javascript
const Logger = require('r7insight_node');

const logger = new Logger({ token: '<token>' , region: '<region>'});

logger.warning("I'll put this over here, with the rest of the fire.");
```

## Development

Workflow is as follows:
- Fork the repository
- Clone it locally
- `npm install` for installing the packages
- Add unit testing for desired functionality - `npm test` for testing
- Work on functionality
- Bump relevant version when finished `npm version [major|minor|patch]`
- Update typescript definitions if necessary
  * ```bash
    # You can simply paste all this into your terminal
    npm uninstall -g r7insight_node
    npm pack
    npm i -g r7insight_node-*.tgz
    npm install -g dts-gen
    dts-gen -m r7insight_node -f index.d.ts -o
    ```
- Push and open a pull request

## Options

The options object you provide to the constructor only requires your access
token, but you can configure its behavior further.

All of the following except `token`, `levels` and `secure` can also be
configured after instantiation as settable properties on the client. They are
accessors, though, and invalid values will be ignored.

### Required

 - **token:** String. Log token for the Rapid7 Insight Platform.
 - **region**: The region of ingestion endpoint to be used. Examples: `eu`, `us` etc.

### Behavior
 - **console:** If truthy, log events also get sent to `console.log`,
   `console.warn` and `console.error` as appropriate. Default: `false`.
 - **levels**: Custom names for the 8 log levels and their corresponding
   methods. More details on this below.
 - **minLevel**: The minimum level to actually record logs at. String or Number.
   Defaults to 0.
 - **takeLevelFromLog**: If truthy, will take log message level from message. Default: `false`.  
   E.g. if `true`:
   ```javascript
   // Rather than call different functions based on level:
   logger.warn({message: 'hello'});
   // You can call the same function with different levels within object:
   logger.log({level: 'warn', message: 'hello'});
   ```
 - **bufferSize**: The maximum number of log entries that may be queued in the 
   internal ring buffer for sending at a given moment. Default: `16192`.
 - **secure:** If truthy, uses a TLS connection. Default: `true`.
 - **inactivityTimeout:** The time, in milliseconds, that inactivity should warrant
   closing the connection to the host until needed again. Defaults to 15 seconds.
 - **disableTimeout**: Sets the socket timeout to 0. Should not be used with 
   inactivityTimeout option.
 - **reconnectInitialDelay**: Initial wait time in milliseconds while reconnecting. 
   Default: `1000`
 - **reconnectMaxDelay**: Maximum wait time in milliseconds while reconnecting.
   Default: `15 * 1000`
 - **reconnectBackoffStrategy**: Backoff strategy to be used while trying to reconnect.
   It can be either `fibonacci` or `exponential`. Default: `fibonnacci`   


### Log Processing Options
 - **flatten**: Convert objects into a single-level object where the values of
   interior objects become dot-notation properties of the root object. Defaults
   to `false`. More details on this below.
 - **flattenArrays**: If `flatten` is true, you can also indicate whether arrays
   should be subject to the same process. Defaults to `true` if `flatten` is
   `true`; otherwise meaningless.
 - **replacer**: A custom value-transform function to be used during JSON
   serialization. Applied before error transformation.
 - **timestamp**: If truthy, prefix entries with an ISO timestamp (if strings)
   or add the same as a property (if objects). Default: `false`.
 - **withLevel**: Will prepend (string) or add property (object) indicating the
   log level. Default: `true`.
 - **withHostname**: Will prepend(string) or add property (object) indicating the 
   hostname from which the log was sent. Default: `false`.
 - **withStack**: If an object is or contains an `Error` object, setting this to
   `true` will cause the stack trace to be included. Default: `false.`

### Other
 - **host**: Optional host to send logs to. Normally you would not want to set this,
   but it may be useful for mocking during tests. The value may be just the host
   or the host with the port specified.
 - **port**: As above. This will default to 80 if `secure` is false, or 443 if
   it’s true.
 - **debug**: Setting this to `true` will enable debug logging with a default stdout
  logger.
 - **debugLogger**: Use this to override default stdout logger. New logger must
  implement a `log` method.

## Log Levels

The default log levels are:

 0. debug
 1. info
 2. notice
 3. warning
 4. err
 5. crit
 6. alert
 7. emerg

You can provision the constructor with custom names for these levels with either
an array or an object hash:

```javascript
[ 'boring', 'yawn', 'eh', 'hey' ]

{ boring: 0, yawn: 1, eh: 2, hey: 3 }
```

In the former case, the index corresponds to the numeric level, so sparse arrays
are valid. In either case, missing levels will be filled in with the defaults.

The `minLevel` option respects either level number (e.g. `2`) or the name (e.g.
`'eh'`).

The level names each become methods on the client, which are just sugar for
calling `client.log(lvl, logentry)` with the first argument curried.

Since these names will appear on the client, they can’t collide with existing
properties. Not that you’re particularly likely to try naming a log level
‘hasOwnProperty’ or ‘_write’ but I figured I should mention it.

So the following three are equivalent:

```javascript
logger.notice('my msg');
logger.log('notice', 'my msg');
logger.log(2, 'my msg');
```

It’s also possible to forgo log levels altogether. Just call `log` with a single
argument and it will be interpreted as the log entry. When used this way, the
`minLevel` setting is ignored.

## Events

### Logger Events

These events are also exported in the `Logger`, so you can access them using `Logger.errorEvent`, `Logger.bufferDrainEvent` etc. Example:

```javascript
   logger.notice({ type: 'server', event: 'shutdown' });
   logger.once(Logger.bufferDrainEvent, () => {
      logger.closeConnection();
      logger.on(Logger.disconnectedEvent, () => {
        process.exit();
      });
   });
```

#### `'error'`
The client is an EventEmitter, so you should (as always) make sure you have a
listener on `'error'`. Error events can occur when there’s been a problem with
the connection or if a method was called with invalid parameters. Note that
errors that occur during instantiation, as opposed to operation, will **throw**.

#### `'log'`
Triggered when a log is about to be written to the underlying connection. The
prepared log object or string is supplied as an argument.

#### `'connected'` and `'disconnected'` and `'timed out'` 
These indicate when a new connection to the host is established, destroyed or 
timed out due to client side inactivity. Inactivity timeout is normal if the connection 
is inactive for a configurable period of time (see inactivityTimeout); it will 
be reopened when needed again. Disconnection can be either a result of socket inactivity or a network failure.

#### `'drain'`, `'finish'`, `'pipe'`, and `'unpipe'`
These are events inherited from `Writable`.

#### `'buffer drain'`
This event is emitted when the underlying ring buffer is fully consumed and Socket.write callback called.
This can be useful when it’s time for the application to terminate but you want
to be sure any pending logs have finished writing.

```javascript
   logger.notice({ type: 'server', event: 'shutdown' });
   logger.once('buffer drain', () => {
      logger.closeConnection();
      logger.on('disconnected', () => {
        process.exit();
      });
   });
```

### RingBuffer Events

#### `'buffer shift'`

Buffer shift event is emitted when the internal buffer is shifted due to reaching `bufferSize`
of events in the buffer. This event may be listened for security/operations related reasons as
each time this event is emitted, a log event will be discarded and discarded log event will
never make it to the Insight Platform.

```javascript
logger.ringBuffer.on('buffer shift', () => {
    // PagerDuty or send an email 
});
```

## Log Entries

Log entries can be strings or objects. If the log argument is an array, it will
be interpretted as multiple log events.

### Object Serialization

In the case of objects, the native JSON.stringify serialization is augmented in
several ways. In addition to handling circular references, it will automatically
take care of a variety of objects and primitives which otherwise wouldn’t
serialize correctly, like Error, RegExp, Set, Map, Infinity, NaN, etc.

If you choose to set `withStack` to true, errors will include their stacktraces
as an array (so that they are not painful to look at). Be sure to turn on
"expand JSON" (meaning pretty print) in the options in the Insight Platform:

![stack trace as seen in logentries app][screen1]

You can adjust this further by supplying your own custom `replacer`. This is a
standard argument to JSON.stringify -- See [MDN: JSON > Stringify > The Replacer Parameter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#The_replacer_parameter)
for details. In the event that you supply a custom replacer, it is applied
prior to the built-in replacer described above so you can override its behavior.

### Optional Augmentation

Two options are available, `timestamp` and `withLevel`, which will add data to
your log events. For objects, these are added as properties (non-mutatively).
For strings, these values are prepended. If the name of a property would cause
a collision with an existing property, it will be prepended with an underscore.

### Flattening Log Objects

In some cases it will end up being easier to query your data if objects aren’t
deeply nested. With the `flatten` and `flattenArrays` options, you can tell the
client to transform objects like so:

  * `{ "a": 1, "b": { "c": 2 } }` => `{ "a": 1, "b.c": 2 }`

If `flattenArrays` has not been set to false, this transformation will apply to
arrays as well:

  * `{ "a": [ "b", { "c": 3 } ] }` => `{ "a.0": "b", "a.1.c": 3 }`

## Methods

In addition to `log` and its arbitrary sugary cousins, you can call
`closeConnection` to explicitly close an open connection if one exists; you
might wish to do this as part of a graceful exit. The connection will reopen if
you log further.

Also, because the client is actually a writable stream, you can call `write`
directly. This gives you lower-level access to writing entries. It is in object
mode, but this means it expects discreet units (one call = one entry), not
actual objects; you should pass in strings. This is useful if you want to pipe
stdout, for example.

## Buffering

If there’s a problem with the connection (network loss or congestion),
entries will be buffered in an internal ring buffer to a max of 16192(`bufferSize`)
entries by default. After that, internal ring buffer will `shift` records
to keep only last `bufferSize` number of records in memory. A log that indicates the
buffer was full will be sent to internal logger "once" this happens.
If `console` is true, these log entries will still display there, but they will
not make it to the Insight Platform.

You can adjust the maximum size of the buffer with the `bufferSize` option.
You’ll want to raise it if you’re dealing with very high volume (either a high
number of logs per second, or when log entries are unusually long on average).
Outside of these situations, exceeding the max buffer size is more likely an
indication of creating logs in a synchronous loop (which seems like a bad idea).

## Connection Handling

If the connection fails, it will keep retrying with a `fibonacci` backoff by default. 
Connection retry will start with a delay of `reconnectInitialDelay` and the delay between each retry 
will go up to a maximum of `reconnectMaxDelay` with each retry in fibonacci sequence. 
Backoff strategy can be changed to `exponential` through constructor if necessary.

A connection to the host does not guarantee that your logs are transmitting
successfully. If you have a bad token, there is no feedback from the server to
indicate this. The only way to confirm that your token is working is to check
the live tail in InsightOps. I will investigate this further to see if there’s
some other means with which a token can be tested for validity.

## Using as a Winston ‘Transport’

### Pre-requisites

- `winston` and `winston-transport` installed
  * Check [package.json](./package.json) for currently supported version

### Code Example

```javascript
const winston = require('winston');

// If Winston is included in your package.json dependencies,
// you can just require the Insight Logger
// to initialize it.
require('r7insight_node');

const token = '00112233-4455-6677-8899-aabbccddeeff';
const transports = [];

transports.push(
	new winston.transports.Console({
		format: winston.format.simple(),
		level: 'debug',
	})
);

transports.push(
	new winston.transports.Insight({
		token,
		region: 'eu',
		level: 'debug',
	})
);

const logger = winston.createLogger({
	transports,
});

logger.info('hello there');
```


The Insight client will place the transport constructor at `winston.transports`,
even if Winston itself hasn’t yet been required.

```javascript
const Logger = require('r7insight_node');
const winston = require('winston');

assert(winston.transports.Insight);
```

- Winston is an optional dependency in `r7insight_node` and and if included it
requires `winston-transport` for the `InsightTransport` to extend it.

- When adding a new Insight transport, the options argument passed to Winston’s
`add` method supports the usual options in addition to those which are Winston-
specific. If custom levels are not provided, Winston’s defaults will be used.

```javascript
winston.add(new winston.transports.Insight({ token: '<token>', region: '<region>' }));
```

- In the hard-to-imagine case where you’re using Winston without including it in
package.json, you can explicitly provision the transport by first requiring
Winston and then importing and calling `provisionWinston` like this:
```javascript
const winston = require('winston');

const Logger = require('r7insight_node');

Logger.provisionWinston();
```

## Using with Bunyan

For Bunyan it’s like so:

```javascript
const bunyan = require('bunyan');
const Logger = require('r7insight_node');

const loggerDefinition = Logger.bunyanStream({ token: '<token', region: '<region>' });

// One stream
const logger1 = bunyan.createLogger(loggerDefinition);

// Multiple streams
const logger2 = bunyan.createLogger({
	name: 'my leg',
	streams: [ loggerDefinition, otherLoggerDefinition ]
});
```

As with Winston, the options argument takes the normal constructor options (with
the exception of `timestamp`, which is an option you should set on Bunyan itself
instead). Bunyan uses six log levels, so the seventh and eighth, if provided,
will be ignored; by default Bunyan’s level names will be used.

The object returned by `bunyanStream` is the Bunyan logging ‘channel’ definition
in total. If you want to futz with this you can -- you can change its `name` or
get the `stream` object itself from here.


## Using with Ts.ED Logger

For Ts.ED logger it's like so:

```typescript
import {Logger} from "@tsed/logger";
import "@tsed/logger-insight";

const logger = new Logger("loggerName");

logger.appenders.set("stdout", {
  type: "insight",
  level: ["info"],
  options: {
    token: "the token",
    region: "us"
    // other options of insight
  }
});
```

As with Winston, the options argument takes the normal constructor options.

See more details on [Ts.ED logger](https://logger.tsed.io/appenders/insight.html)
