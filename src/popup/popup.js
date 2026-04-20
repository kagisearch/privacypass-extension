import {
  VERBOSE,
  TOKENS_TO_STASH,
  LOW_TOKEN_COUNT,
} from '../scripts/config.js'

import {
  logStatus,
  logError,
  clearError
} from './utils.js'

import {
  set_enabled,
  is_enabled
} from './enable_toggle.js'

// ---- UI elements

const status_msg = document.querySelector("#status-message")
const status_msg_div = document.querySelector("#status-message-div")
const status_msg_type = document.querySelector("#status-message-type")
const status_msg_color = document.querySelector("#status-message-color")
const debug_available_tokens_div = document.querySelector("#available-tokens")
const available_tokens_div = document.querySelector("#available-tokens-count")
const enabled_checkbox = document.querySelector("#kagipp-enabled")
const settingsbtn = document.querySelector("#kagipp-settings")
const lowtokencountdiv = document.querySelector("#low-token-area")
const gentokensbtn = document.querySelector("#kagipp-generate-tokens")
const gentokensbtndiv = document.querySelector("#kagipp-generate-tokens-div")
const closeerrorbtn = document.querySelector("#status-message-close")

// ---- UI utilities

function rerenderWhenStorageChanges(func) {
  browser.storage.local.onChanged.addListener(func)
  func()
}

// ---- status reporting

function display_status(status) {
  const { msg, type } = status;
  if (type == 'error') {
    status_msg_color.className = 'error-color'
    status_msg_type.textContent = "Error"
    status_msg.innerHTML = msg;
    status_msg_div.hidden = false;
  } else if (type == 'wait') {
    status_msg_div.hidden = true;
    status_msg_color.className = 'wait-color'
    status_msg_type.textContent = 'Generating new tokens'
  } else {
    clear_status_msg()
  }
}

function clear_status_msg() {
  status_msg_div.hidden = true;
  status_msg_color.className = "ready-color"
  status_msg_type.textContent = "Ready"
  status_msg.textContent = ""
}

rerenderWhenStorageChanges(async () => {
  const { status } = await browser.storage.local.get({ 'status': null })
  if (status) {
    display_status(status)
  } else {
    clear_status_msg()
  }
});

// ---- token counting

function display_token_count(n_tokens) {
  available_tokens_div.textContent = n_tokens;
  if (debug_available_tokens_div) {
    debug_available_tokens_div.textContent = n_tokens;
  }
  lowtokencountdiv.hidden = gentokensbtndiv.hidden = n_tokens >= LOW_TOKEN_COUNT;
}

rerenderWhenStorageChanges(async () => {
  const { ready_tokens } = await browser.storage.local.get({ ready_tokens: [] });
  display_token_count(ready_tokens.length);
});

// ----- Enabled / Disabled toggle

enabled_checkbox.addEventListener("change", set_enabled)

rerenderWhenStorageChanges(async () => {
  await is_enabled();
});

// TODO(jacob): i expect this to go away soon
// add CSS transition style
setTimeout(() => {
  let sheet = window.document.styleSheets[0];
  sheet.insertRule('label.switch > div.slider { transition: all 0.3s linear; }', sheet.cssRules.length);
}, 300)

settingsbtn.addEventListener("click", () => {
  browser.tabs.create({
    url: browser.runtime.getURL("pages/settings.html"),
  });

  window.close();
});

gentokensbtn.addEventListener("click", async () => {
  // attempt to generate tokens
  await logStatus("generating new tokens", 'wait')
  browser.runtime.sendMessage('fetch_tokens');
})

closeerrorbtn.addEventListener("click", function () {
  clearError();
})
