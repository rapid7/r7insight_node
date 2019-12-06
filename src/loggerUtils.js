/**
 * Get a new prop name that does not exist in the log.
 *
 * @param {Map} log Log object
 * @param {String} prop property name
 * @returns {String} safeProp
 */
const getSafeProp = (log, prop) => {
  let safeProp = prop;

  while (safeProp in log) {
    safeProp = `_${safeProp}`;
  }

  return safeProp;
};

module.exports = getSafeProp;
