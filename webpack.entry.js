/* eslint-env browser */
const fbpGraph = require('./lib/index.js');

const exported = {
  'fbp-graph': fbpGraph,
};

if (window) {
  window.require = function require(moduleName) {
    if (exported[moduleName]) {
      return exported[moduleName];
    }
    throw new Error(`Module ${moduleName} not available`);
  };
}
