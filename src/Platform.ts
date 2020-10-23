//     NoFlo - Flow-Based Programming for JavaScript
//     (c) 2014-2017 Flowhub UG
//     NoFlo may be freely distributed under the MIT license
//
// Platform detection method
/* eslint-env browser, node */
export function isBrowser(): boolean {
  if ((typeof process !== 'undefined') && process.execPath && process.execPath.match(/node|iojs/)) {
    return false;
  }
  return true;
};
