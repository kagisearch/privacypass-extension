// ---- error reporting

import {
  debug_log
} from '../scripts/debug_log.js';

function time() {
  return new Date().toISOString().match(/(\d{2}:){2}\d{2}/)[0]
}

async function logStatus(msg, type) {
  if (!browser.storage) {
    return;
  }
  await browser.storage.local.set({ 'status': { 'msg': msg, 'type': type } });
}

async function logError(err) {
  debug_log(`Error: ${err}`)
  logStatus(err, 'error')
}

async function clearError() {
  await browser.storage.local.set({ 'status': null });
}

export {
  logStatus,
  logError,
  clearError,
  time
};
