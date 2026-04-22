import {
  logError,
  time
} from './popup/utils.js'

import {
  VERBOSE,
} from './scripts/config.js'

import {
  genTokens,
  forceLoadNextTokens,
} from './scripts/generation_and_redemption.js';

import {
  applyMode,
} from './scripts/toggle.js'

import {
  debug_log
} from './scripts/debug_log.js'

import {
  sendPPModeStatus,
  statusRequestListener
} from './scripts/communication_with_main_extension.js'

import {
  UI_COMMAND_NOT_RECOGNIZED_ERROR
} from './scripts/errors.js'

// ---- UI commands listener

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (VERBOSE) {
    debug_log(`onMessage: ${message}`);
  }
  if (message == "enabled_changed") {
    await applyMode();
    // when enabled status changed, inform Kagi Search extension
    await sendPPModeStatus();
  } else if (message == "fetch_tokens") {
    try {
      await genTokens();
    } catch (ex) {
      await logError(`${ex}<br/>Last attempt to generate tokens: ${time()}.`);
      return;
    }
  } else if (message == "force_load_next_token") {
    await forceLoadNextTokens();
  } else {
    await logError(UI_COMMAND_NOT_RECOGNIZED_ERROR);
  }
})

// ----- listen to status requests from Kagi Search extension

chrome.runtime.onMessageExternal.addListener(statusRequestListener);

// ----- run when loading the extension

async function onStart() {
  if (VERBOSE) {
    debug_log(`onStart: ${new Date().toISOString().match(/(\d{2}:){2}\d{2}/)[0]}`);
  }
  console.log(`onStart: ${new Date().toISOString().match(/(\d{2}:){2}\d{2}/)[0]}`);
  await applyMode();
  // when coming online, send status to Kagi Search extension
  await sendPPModeStatus();
}

console.log(`background.js: ${new Date().toISOString().match(/(\d{2}:){2}\d{2}/)[0]}`);
onStart();
