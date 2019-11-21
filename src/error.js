export class InsightError extends Error {
  constructor(msg) {
    super(msg);

    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = msg;
  }
}

export class BadOptionsError extends InsightError {
  constructor(opts, msg) {
    super(msg);

    this.options = opts;
  }
}
