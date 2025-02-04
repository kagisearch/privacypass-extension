import {
  logError,
} from './popup/utils.js'

import {
  PERIODIC_TOKEN_STASHING,
  TOKEN_STASHING_PERIOD,
  DOMAIN_PORT,
  ONION_DOMAIN_PORT,
  VERBOSE,
  SCHEME,
  ONION_SCHEME
} from './scripts/config.js'

import {
  genTokens,
  setPPHeaders,
} from './scripts/generation_and_redemption.js';

import {
  setEnabled,
  setDisabled
} from './scripts/toggle.js'

import {
  sendPPModeStatus,
  statusRequestListener
} from './scripts/communication_with_main_extension.js'

// ---- UI commands listener

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (VERBOSE) {
    console.log(`onMessage: ${message}`);
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
      await logError(`${ex}`);
      return;
    }
  } else if (message == "set_new_search_token") {
    // the redirector was invoked, to be sure load a new token
    await setPPHeaders(`${SCHEME}://${DOMAIN_PORT}/search`)
  } else if (message == "onion_set_new_search_token") {
    // the redirector was invoked, to be sure load a new token
    await setPPHeaders(`${ONION_SCHEME}://${ONION_DOMAIN_PORT}/search`)
  } else {
    await logError("Command not recognized.")
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
    // No need to do anything on update
    // Since we have periodic checks using the PERIODIC_TOKEN_STASHING alarm
  }
});

// ----- code run periodically to generate fresh tokens

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === PERIODIC_TOKEN_STASHING) {
    // Periodically download more tokens as needed
    if (VERBOSE) {
      console.log(`periodic token stashing, ${new Date().toISOString().match(/(\d{2}:){2}\d{2}/)[0]}`);
    }
    try {
      await genTokens();
    } catch (ex) {
      await logError(`${ex}`);
      return;
    }
  }
});

// ----- listen to status requests from Kagi Search extension

chrome.runtime.onMessageExternal.addListener(statusRequestListener);

// ----- run when loading the extension

async function onStart() {
  if (VERBOSE) {
    console.log(`onStart: ${new Date().toISOString().match(/(\d{2}:){2}\d{2}/)[0]}`);
  }
  // Restart the periodic token stashing alarm as needed
  const alarm = await chrome.alarms.get(PERIODIC_TOKEN_STASHING);
  if (!alarm) {
    // Create an alarm to handle WWW-Authenticate update and token stashing
    await chrome.alarms.create(PERIODIC_TOKEN_STASHING, {
      delayInMinutes: 0,
      periodInMinutes: TOKEN_STASHING_PERIOD
    });
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
