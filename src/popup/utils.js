// ---- error reporting

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
  console.log(`Error: ${err}`)
  const msg = `Error, ${err} (${time()})`
  logStatus(msg, 'error')
}

async function clearError() {
  await browser.storage.local.set({ 'status': null });
}

export {
  logStatus,
  logError,
  clearError
};
