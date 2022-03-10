const Logger = require('./logger');
const provisionWinston = require('./winston');
const buildBunyanStream = require('./bunyanStream');

let winston = null,
    Transport = null;

try {
  //  All the code below optionally loads winston if it's installed
  winston = require('winston');
  Transport = require('winston-transport');
} catch (ignored) {
  // If winston isn't installed, proceed as usual
}

//  If we have successfully loaded winston (user has it)
//  we initialize our InsightTransport
if (winston && Transport) {
  provisionWinston(winston, Transport);
}

//  Logger is default export
module.exports = Logger;
//  Export as `bunyanStream` to not break existing integration
module.exports.bunyanStream = buildBunyanStream;
module.exports.provisionWinston = provisionWinston;
