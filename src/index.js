const Logger = require('./logger');
const provisionWinston = require('./winston');
const buildBunyanStream = require('./bunyanStream');

try {
  //  All the code below optionally configures winston if it's installed
  const winston = require('winston');
  const Transport = require('winston-transport');

  //  If we have successfully loaded winston (user has it)
  //  we initialize our InsightTransport
  if (winston && Transport) {
    provisionWinston(winston, Transport);
  }
} catch (ignored) {
  // If winston isn't installed, proceed as usual
}

//  Logger is default export
module.exports = Logger;
//  Export as `bunyanStream` to not break existing integration
module.exports.bunyanStream = buildBunyanStream;
module.exports.provisionWinston = provisionWinston;
