/* eslint-disable */
if (typeof global !== 'undefined') {
  // Node.js injections for Mocha tests
  global.chai = require('chai');
  global.lib = require('../../index');
  global.browser = false;
} else {
  // Browser injections for Mocha tests
  window.lib = require('fbp-graph');
  window.browser = true;
}
