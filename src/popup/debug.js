// This file includes code useful while debugging the extension.
// Removing this file will disable the code and related UI elements

import {
  set_enabled
} from './enable_toggle.js'

const debugactionsdiv = document.querySelector("#debug-actions")
const enabled_checkbox = document.querySelector("#kagipp-enabled")

// attempt to fetch tokens
async function gen_tokens() {
  browser.runtime.sendMessage('fetch_tokens');
}

async function erase_tokens() {
  // clear tokens
  await browser.storage.local.set({ "ready_tokens": [] })
  // remove Authorization header
  enabled_checkbox.checked = false;
  await set_enabled();
  await browser.storage.local.remove("loaded_tokens")
}

function enable_debug_buttons() {
  if (debugactionsdiv) {
    // create <button id="kagipp-erase-tokens" class="action-button" title="Erases all held tokens"></button>
    let erasebtn = document.createElement("button")
    erasebtn.id = "kagipp-erase-tokens"
    erasebtn.className = "action-button"
    erasebtn.title = "rases all held tokens"
    erasebtn.textContent = "Erase"
    erasebtn.addEventListener("click", erase_tokens)
    debugactionsdiv.prepend(erasebtn)

    // create <button id="kagipp-gen-tokens" class="action-button" title="Fetches new tokens"></button>
    let genbtn = document.createElement("button")
    genbtn.id = "kagipp-gen-tokens"
    genbtn.className = "action-button"
    genbtn.title = "Fetches new tokens"
    genbtn.textContent = "Fetch"
    genbtn.addEventListener("click", gen_tokens)
    debugactionsdiv.prepend(genbtn)

    // crete <div>Available tokens: <span id="available-tokens">666</span></div>
    let availabletokenscont = document.createElement("div")
    let availabletokensspan = document.createElement("span")
    availabletokensspan.id = "available-tokens"
    availabletokenscont.textContent = "Available tokens: "
    availabletokenscont.append(availabletokensspan)
    debugactionsdiv.prepend(availabletokenscont)
  }
}

enable_debug_buttons();
