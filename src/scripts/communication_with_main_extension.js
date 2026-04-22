/*
  The Kagi Privacy Pass extension will send single messages:
  - When being installed/activated send status report
  - When changing enabled/disabled send status report
*/

import {
    KAGI_EXTENSION_ID,
} from './config.js'

async function sendPPModeStatus() {
    const { enabled } = await chrome.storage.local.get({ 'enabled': true });
    try {
        await chrome.runtime.sendMessage(KAGI_EXTENSION_ID, { 'enabled': enabled });
    } catch (ex) {
    }
}

// Kagi Search extension asked for a status report
async function statusRequestListener(request, sender, sendResponse) {
    if (sender.id !== KAGI_EXTENSION_ID) {
        // reject messages from other extensions
        return;
    }
    const { enabled } = await chrome.storage.local.get({ 'enabled': true });
    sendResponse(enabled); // chrome
    return enabled; // firefox
};

export {
    sendPPModeStatus,
    statusRequestListener
};
