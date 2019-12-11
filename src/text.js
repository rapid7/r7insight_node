const englishList = (arr) => arr.join(', ').replace(/, ([^,]+)$/g, ' and $1');

module.exports = {
  // Operation Error Messages
  authError: (err) => `TLS authorization error: ${err || 'UNKNOWN'}.`,
  duplicateLevelNums: (nums) => `The custom levels included duplicate levels: ${englishList(nums)}.`,
  duplicateLevels: (names) => `The custom levels included duplicate names: ${englishList(names)}.`,
  invalidLevelNum: (num) => `The custom levels object had the invalid level number ${num}.`,
  invalidToken: (token) => `The opts.token property "${token}" does not appear to be valid.`,
  levelConflict: (name) => `The custom level name ${name} conflicts with a native property.`,
  levelNotString: (value) => `The custom level value ${value} is invalid.`,
  levelsNotObj: (type) => `The opts.levels value is a ${type}.`,
  noLogMessage: () => 'Log method was called without a message argument.',
  noOptions: () => 'The options argument is missing.',
  noRegion: () => 'The region argument is missing.',
  noRegionAndHost: () => 'Region and host cannot be defined together.',
  noToken: () => 'The opts.token property is missing.',
  optionsNotObj: (type) => `The options argument is a ${type}.`,
  serializedEmpty: () => 'Log message argument existed, but serialized to an empty string.',
  tooManyLevels: (count) => `The custom levels array had ${count} members (max is 8).`,
  unknownLevel: (level) => `The log method was called with the unknown level "${level}".`,
};
