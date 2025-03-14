import {
  logError,
  time
} from './popup/utils.js'

import {
  update_extension_icon
} from './scripts/icon.js'

import {
  DOMAIN_PORT,
  ONION_DOMAIN_PORT,
  VERBOSE,
  SCHEME,
  ONION_SCHEME,
  REDEMPTION_ENDPOINTS
} from './scripts/config.js'

import {
  genTokens,
  setPPHeaders,
  forceLoadNextToken,
} from './scripts/generation_and_redemption.js';

import {
  setEnabled,
  setDisabled
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
    const { enabled } = await browser.storage.local.get({ 'enabled': false });
    if (enabled) {
      await setEnabled();
    } else {
      await setDisabled();
    }
    // when enabled status changed, inform Kagi Search extension
    await sendPPModeStatus();
  } else if (message == "fetch_tokens") {
    try {
      await genTokens();
    } catch (ex) {
      await logError(`${ex}<br/>Last attempt to generate tokens: ${time()}.`);
      return;
    }
  } else if (message == "set_new_search_token") {
    // the redirector was invoked, to be sure load a new token
    await setPPHeaders(`${SCHEME}://${DOMAIN_PORT}/search`)
  } else if (message == "onion_set_new_search_token") {
    // the redirector was invoked, to be sure load a new token
    await setPPHeaders(`${ONION_SCHEME}://${ONION_DOMAIN_PORT}/search`)
  } else if (message == "force_load_next_token") {
    for (let i = 0; i < REDEMPTION_ENDPOINTS.length; i++) {
      let endpoint = REDEMPTION_ENDPOINTS[i];
      await forceLoadNextToken(endpoint);
    }
  } else {
    await logError(UI_COMMAND_NOT_RECOGNIZED_ERROR);
  }
})

// ----- code run on install

chrome.runtime.onInstalled.addListener(async (details) => {
  // in install, enable the extension and fetch some tokens
  if (details.reason == "install") {
    await chrome.storage.local.set({ 'enabled': true });
    await setEnabled();
    await onStart();
  } else if (details.reason == "update") {
    // if extension was enabled before receiving the oupdate,
    // force a disable-enable cycle in order to apply any changes
    const { enabled } = await browser.storage.local.get({ 'enabled': false });
    if (enabled) {
      await chrome.storage.local.set({ 'enabled': false });
      await setDisabled();
      await sendPPModeStatus();
      await chrome.storage.local.set({ 'enabled': true });
      await setEnabled();
    }

    // when enabled status changed, inform Kagi Search extension
    await sendPPModeStatus();

    // make sure the icon extension reflects enabled/disabled
    await update_extension_icon(enabled);
  }
});

// ----- listen to status requests from Kagi Search extension

chrome.runtime.onMessageExternal.addListener(statusRequestListener);

// ----- run when loading the extension

async function onStart() {
  if (VERBOSE) {
    debug_log(`onStart: ${new Date().toISOString().match(/(\d{2}:){2}\d{2}/)[0]}`);
  }
  // reset enabled/disabled status depending on what the user left it as
  const { enabled } = await browser.storage.local.get({ 'enabled': false });
  if (enabled) {
    await setEnabled();
  } else {
    await setDisabled();
  }
  // when coming online, send status to Kagi Search extension
  await sendPPModeStatus();
}

browser.runtime.onStartup.addListener(onStart)

// -- keep background.js alive (to address non-persistency of manifest V3 extensions)

// run setInterval every 20s to prevent SW sleep after launch
setInterval(async () => {
  await browser.runtime.getPlatformInfo();
}, 20 * 1000);

chrome.runtime.onInstalled.addListener(() => {
  // run another callback every 4 minutes to avoid the browser killing background.js after 5 minutes
  chrome.alarms.create('keepAlive', { periodInMinutes: 4 });
});

chrome.alarms.onAlarm.addListener(async (info) => {
  if (info.name === 'keepAlive') {
    await browser.runtime.getPlatformInfo();
  }
});
