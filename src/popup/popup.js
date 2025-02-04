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
const viewmorelessbtn = document.querySelector("#view-more")
const viewmorelesstext = document.querySelector("#view-more-text")
const viewmoreicn = document.querySelector("#view-more-icon")
const viewlessicn = document.querySelector("#view-less-icon")
const learnmoretxt = document.querySelector("#learn-more")
const lowtokencountdiv = document.querySelector("#low-token-area")
const gentokensbtn = document.querySelector("#kagipp-generate-tokens")
const gentokensbtndiv = document.querySelector("#kagipp-generate-tokens-div")
const closeerrorbtn = document.querySelector("#status-message-close")

// ---- UI utilities

function flex(elem) {
  elem.style.display = "flex";
}

function show(elem, type) {
  let display_type = "block";
  if (type) {
    display_type = type;
  }
  elem.style.display = display_type;
}

function hide(elem) {
  elem.style.display = "none";
}

function setIntervalAndFire(func, interval) {
  func()
  setInterval(func, interval)
}

// ---- status reporting

function display_status(status) {
  const { msg, type } = status;
  if (type == 'error') {
    status_msg_color.className = 'error-color'
    status_msg_type.textContent = "Error"
    status_msg.textContent = msg;
    show(status_msg_div)
  } else if (type == 'wait') {
    hide(status_msg_div)
    status_msg_color.className = 'wait-color'
    status_msg_type.textContent = 'Generating new tokens'
  } else {
    clear_status_msg()
  }
}

function clear_status_msg() {
  hide(status_msg_div)
  status_msg_color.className = "ready-color"
  status_msg_type.textContent = "Ready"
  status_msg.textContent = ""
}

setIntervalAndFire(async () => {
  if (!browser.storage) {
    return;
  }
  const { status } = await browser.storage.local.get({ 'status': null })
  if (status) {
    display_status(status)
  } else {
    clear_status_msg()
  }
}, 1000)

// ---- token counting

function display_token_count(n_tokens) {
  if (available_tokens_div) {
    available_tokens_div.textContent = n_tokens;
  }
  if (debug_available_tokens_div) {
    debug_available_tokens_div.textContent = n_tokens;
  }
  if (n_tokens < LOW_TOKEN_COUNT) {
    flex(lowtokencountdiv)
    show(gentokensbtndiv)
  } else {
    hide(lowtokencountdiv)
    hide(gentokensbtndiv)
  }
}

async function countTokens() {
  if (!browser.storage) {
    return;
  }
  const { ready_tokens } = await browser.storage.local.get({ 'ready_tokens': [] })
  return ready_tokens.length
}

setIntervalAndFire(async () => {
  // preiodically check for number of available tokens
  if (!browser.storage) {
    return;
  }
  const available_tokens = await countTokens()
  // account for tokens loaded in header
  const { loaded_tokens } = await browser.storage.local.get({ "loaded_tokens": {} })
  display_token_count(available_tokens + Object.keys(loaded_tokens).length)
}, 1000)

// ----- Enabled / Disabled toggle

if (enabled_checkbox) {
  enabled_checkbox.addEventListener("change", set_enabled)
}

(async () => {
  // try reading right away
  await is_enabled()
  // add CSS transition style
  setTimeout(() => {
    let sheet = window.document.styleSheets[0];
    sheet.insertRule('label.switch > div.slider { transition: all 0.3s linear; }', sheet.cssRules.length);
  }, 300)
  // also do a delayed check since there could be a race condition
  setTimeout(() => {
    setIntervalAndFire(async () => {
      await is_enabled();
    });
  }, 1000)
})()

function open_settings() {
  if (!browser.windows) {
    return;
  }
  const height = 220;
  const width = 240;
  const top = screen.height / 2 - height / 2;
  const left = screen.width / 2 - width / 2;

  browser.windows.create({
    url: browser.runtime.getURL("popup/settings.html"),
    type: "popup",
    height: height,
    width: width,
    top: parseInt(top),
    left: parseInt(left)
  });
}

if (settingsbtn) {
  settingsbtn.addEventListener("click", open_settings)
}

// -- token-generation button

if (gentokensbtn) {
  gentokensbtn.addEventListener("click", async () => {
    // attempt to generate tokens
    await logStatus("generating new tokens", 'wait')
    browser.runtime.sendMessage('fetch_tokens');
  })
}

// -- view more/view less button

function toggle_view_more_less() {
  if (viewmorelesstext.textContent == "View more") {
    viewmorelesstext.textContent = "View less"
    hide(viewmoreicn)
    show(viewlessicn, "inline-block")
    learnmoretxt.className = "learn-more"
  } else {
    viewmorelesstext.textContent = "View more"
    hide(viewlessicn)
    show(viewmoreicn, "inline-block")
    learnmoretxt.className = "learn-more learn-more-overflow"
  }
}

if (viewmorelessbtn && viewmorelesstext) {
  viewmorelesstext.textContent = "View more"
  viewmorelessbtn.addEventListener("click", toggle_view_more_less)
}

if (closeerrorbtn) {
  closeerrorbtn.addEventListener("click", function () {
    clearError();
  })
}