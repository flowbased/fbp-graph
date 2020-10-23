//     NoFlo - Flow-Based Programming for JavaScript
//     (c) 2014-2017 Flowhub UG
//     NoFlo may be freely distributed under the MIT license
//
// Platform detection method
/* eslint-env browser, node */
exports.isBrowser = function isBrowser() {
  if ((typeof process !== 'undefined') && process.execPath && process.execPath.match(/node|iojs/)) {
    return false;
  }
  return true;
};

exports.deprecated = function deprecated(message) {
  if (exports.isBrowser()) {
    if (window.NOFLO_FATAL_DEPRECATED) { throw new Error(message); }
    console.warn(message);
    return;
  }
  if (process.env.NOFLO_FATAL_DEPRECATED) {
    throw new Error(message);
  }
  console.warn(message);
};
