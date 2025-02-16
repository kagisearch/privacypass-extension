/*
  The Kagi Privacy Pass extension will send single messages:
  - When being installed/activated send status report
  - When changing enabled/disabled send status report
*/

import {
    KAGI_EXTENSION_ID,
    VERBOSE
} from './config.js'

import {
    debug_log
} from './debug_log.js'

async function sendPPModeStatus() {
    if (VERBOSE) {
        debug_log('sendPPModeStatus')
    }
    const { enabled } = await chrome.storage.local.get({ 'enabled': false });
    try {
        await chrome.runtime.sendMessage(KAGI_EXTENSION_ID, { 'enabled': enabled });
    } catch (ex) {
        if (VERBOSE) {
            debug_log(`Main extension not available: ${ex}`)
        }
    }
}

// Kagi Search extension asked for a status report
async function statusRequestListener(request, sender, sendResponse) {
    if (sender.id !== KAGI_EXTENSION_ID) {
        // reject messages from other extensions
        return;
    }
    if (VERBOSE) {
        debug_log(`message from Kagi Search extension: ${request}`)
    }
    const { enabled } = await chrome.storage.local.get({ 'enabled': false });
    sendResponse(enabled); // chrome
    return enabled; // firefox
};

export {
    sendPPModeStatus,
    statusRequestListener
};