const codependency = require('codependency');

const Logger = require('./logger');
const provisionWinston = require('./winston');
const buildBunyanStream = require('./bunyanStream');


//  All the code below optionally configures winston, we need to do this
//  here since we can only use codependency within the `package.json` `"main"`
//  script, which gives us the correct `module`. Otherwise it errors out

//  Use codependency for dynamically loading winston
const requirePeer = codependency.register(module);

//  Import winston
const winston = requirePeer('winston', {optional: true});
const Transport = requirePeer('winston-transport', {optional: true});

//  If we have successfully loaded winston (user has it)
//  we initialize our InsightTransport
if (winston) {
  provisionWinston(winston, Transport);
}

//  Logger is default export
module.exports = Logger;
//  Export as `bunyanStream` to not break existing integration
module.exports.bunyanStream = buildBunyanStream;
module.exports.provisionWinston = provisionWinston;
