const englishList = arr => arr.join(', ').replace(/, ([^,]+)$/g, ' and $1');

export default {
  // Initialization Error Messages

  duplicateLevelNums: nums =>
      `The custom levels included duplicate levels: ${englishList(nums)}.`,

  duplicateLevels: names =>
      `The custom levels included duplicate names: ${englishList(names)}.`,

  invalidLevelNum: num =>
      `The custom levels object had the invalid level number ${num}.`,

  invalidToken: token =>
      `The opts.token property "${token}" does not appear to be valid.`,

  levelConflict: name =>
      `The custom level name ${name} conflicts with a native property.`,

  levelNotString: value =>
      `The custom level value ${value} is invalid.`,

  levelsNotObj: type =>
      `The opts.levels value is a ${type}.`,

  noOptions: () =>
      'The options argument is missing.',

  noRegion: () =>
      'The region argument is missing.',

  noRegionAndHost: () =>
      'Region and host cannot be defined together.',

  noToken: () =>
      'The opts.token property is missing.',

  optionsNotObj: type =>
      `The options argument is a ${type}.`,

  tooManyLevels: count =>
      `The custom levels array had ${count} members (max is 8).`,

  // Operation Error Messages

  authError: err =>
      `TLS authorization error: ${err || 'UNKNOWN'}.`,

  bufferFull: log =>
      `Buffer is full, unable to log: "${log.substr(0, 25)} ...".`,

  cannotConnect: () =>
      'Unable to connect to host. Will attempt again in three minutes.',

  noLogMessage: () =>
      'Log method was called without a message argument.',

  serializedEmpty: () =>
      'Log message argument existed, but serialized to an empty string.',

  unknownLevel: level =>
      `The log method was called with the unknown level "${level}".`,

  // Deprecation Warnings

  deprecatedLevelMethod: () =>
  'The `level` method is deprecated. Use the `minLevel` property, ' +
  'which allows specifying level by either the name or the index.',

  deprecatedWinstonMethod: () =>
  'The `winston` method is deprecated. Winston was automatically ' +
  'provisioned with a Logentries transport as soon as you `require()`d ' +
  'this module.'
};
