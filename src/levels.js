const _ = require('lodash');

const BadOptionsError = require('./optionsError');
const defaults = require('./defaults');
const text = require('./text');

/**
 * Check whether n is a valid logger number.
 * @param n object to be checked
 * @returns boolean
 */
const isNumberValid = (n) => Number.isInteger(parseFloat(n)) && _.inRange(n, 8);

/**
 * Normalize logger levels array.
 * Checks number of levels and validity of each level.
 * @param {Array} arr array containing logger levels
 * @param {Map} opts original options object - used for output in case of error
 * @returns {Array}
 */
const normArr = (arr, opts) => {
  if (arr.length > 8) {
    throw new BadOptionsError(opts, text.tooManyLevels(arr.length));
  }

  return arr.map((val) => {
    if (val && _.isString(val)) {return val;}
    if (_.isNumber(val) && Number.isFinite(val)) {return val.toString();}
    if (_.isNull(val) || _.isUndefined(val)) {return undefined;}

    throw new BadOptionsError(opts, text.levelNotString(val));
  });
};


/**
 * Normalize logger levels dictionary.
 * Check the values dictionary for duplicates and invalid levels
 * @param obj dictionary containing levels
 * @param opts original options object - used for output in case of error
 */
const normObj = (obj, opts) => {
  const lvlNums = _.values(obj);

  lvlNums.forEach((num) => {
    if (!isNumberValid(num)) {
      throw new BadOptionsError(opts, text.invalidLevelNum(num));
    }
  });

  //  Check for duplicates
  const duplicates = _(obj).countBy().pick((lvl) => lvl > 1)
    .keys()
    .value();

  if (duplicates.length > 0) {
    throw new BadOptionsError(opts, text.duplicateLevelNums(duplicates));
  }

  return _.reduce(obj, (arr, i, name) => {
    const reducedArr = arr;

    reducedArr[i] = name;

    return reducedArr;
  }, []);
};

/**
 * Takes an options dictionary, normalizes embedded levels if they exist
 * otherwise returns defaults.
 * @param opts options dictionary
 * @returns array
 */
const normalize = (opts) => {
  let custom = opts.levels;

  //  Ensure custom is object
  if (!_.isUndefined(custom) && !_.isNull(custom) && !_.isObject(custom)) {
    throw new BadOptionsError(opts, text.levelsNotObj(typeof custom));
  }

  //  If no custom options are provided, return defaults
  if (!custom) {
    return defaults.levels.slice();
  }

  //  Normalize supplied custom levels
  custom = _.isArray(custom) ? normArr(custom, opts) : normObj(custom, opts);

  //  Generate levels array but use custom levels before using default level
  //  useful for example overwriting the highest priority while leaving others
  //  intact
  const levels = defaults.levels.map((lvl, i) => custom[i] || lvl);

  //  Check whether duplicates exist
  const duplicates = _(levels).countBy().pickBy((count) => count > 1)
    .keys()
    .value();

  if (duplicates.length) {
    throw new BadOptionsError(opts, text.duplicateLevels(duplicates));
  }

  return levels;
};

module.exports = {
  isNumberValid,
  normalize,
};
