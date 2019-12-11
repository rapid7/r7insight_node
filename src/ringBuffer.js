const {EventEmitter} = require('events');

/**
 * RingBuffer class which stores and manages log events
 */
class RingBuffer extends EventEmitter {
  /**
   * Creates a RingBuffer instance
   *
   * @constructor
   * @param {Number} limit Buffer limit
  */
  constructor(limit) {
    super();

    this.records = [];
    this.limit = limit;
    this.bufferWasFull = false;
  }

  /**
   * Write log to buffer
   * @param {String|Array|Map} log Log event to write to buffer
   * @returns {Boolean} Whether log was successfully written to buffer
   */
  write(log) {
    this.records.push(log);
    if (this.records.length > this.limit) {
      this.records.shift();

      if (!this.bufferWasFull) {
        this.emit('buffer shift');
        this.bufferWasFull = true;
      }

      return false;
    }

    return true;
  }

  /**
   * Read log event from buffer
   * @returns {String|Array|Map} log Log event from buffer
  */
  read() {
    this.bufferWasFull = false;

    return this.records.shift();
  }

  /**
   * Check whether buffer is empty
   * @returns {Boolean} success
  */
  isEmpty() {
    return this.records.length === 0;
  }
}

module.exports = RingBuffer;
