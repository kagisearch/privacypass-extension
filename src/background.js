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
  console.log("onInstalled")
  if (details.reason == "install") {
    await chrome.storage.local.set({ 'enabled': true });
    // onStart (which will be executed in approximately 1 second)
    // will pick up 'enabled': true and use it to enable the extension
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
  console.log(`onStart: ${new Date().toISOString().match(/(\d{2}:){2}\d{2}/)[0]}`);
  // The browser is being started up, or the extension being enabled.
  // When an extension is disabled or the browser is turned off,
  // the declarativeNetRequest rules used to send tokens to Kagi are removed.
  // However, there is no "onBrowserClose" or "onExtensionDisable" listener
  // allowing us to unload the tokens that were loaded in those rules.
  // If we don't do anything, those tokens will be lost.
  // Hence, we have to recover them from localStorage. An easy way that does not
  // require writing any new code is to trigger the code used when the PP mode toggle
  // is disabled.
  const was_enabled = (await browser.storage.local.get({ 'enabled': false }))['enabled'];
  // emulate PP mode being disabled
  await browser.storage.local.set({ 'enabled': false })
  await setDisabled();
  // if the extension was last enabled, simulate the PP mode toggle being enabled
  if (was_enabled) {
    await browser.storage.local.set({ 'enabled': true })
    await setEnabled();
  }
  // refresh extension icon
  await update_extension_icon(was_enabled);
  // when coming online, send status to Kagi Search extension
  await sendPPModeStatus();
}

browser.runtime.onStartup.addListener(async () => {
  // dummy operation to make sure background.js is run
  await browser.runtime.getPlatformInfo();
})

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

// init the extension
(async () => {
  console.log(`background.js: ${new Date().toISOString().match(/(\d{2}:){2}\d{2}/)[0]}`);
  setTimeout(async () => {
    await onStart();
  }, 1000)
})()
