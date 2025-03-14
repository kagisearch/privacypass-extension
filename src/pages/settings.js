import {
  clearState
} from '../popup/clear.js'

import {
  DEBUG_LOG_ACTIVITY
} from '../scripts/config.js'

// ----- generate tokens

const generatebtn = document.querySelector("#kagipp-generate-tokens")
const clearstatebtn = document.querySelector("#kagipp-clear-state")
const sessioncookieinp = document.querySelector("#kagipp-session-cookie")
const savesessioncookiebtn = document.querySelector("#kagipp-save-session-cookie")
const savesessioncookiecheck = document.querySelector("#kagipp-save-session-cookie-check")
const discardtokenbtn = document.querySelector("#kagipp-discard-current-token")
const discardtokencheck = document.querySelector("#kagipp-discard-current-token-check")
const exportdebugbtn = document.querySelector("#kagipp-export-debug-log")

async function generate_tokens() {
  // attempt to generate tokens
  browser.runtime.sendMessage('fetch_tokens');
  if (generatebtn) {
    generatebtn.style.cursor = "wait";
    setTimeout(window.close, 500)
  }
}

if (generatebtn) {
  generatebtn.addEventListener("click", generate_tokens)
}

async function discard_current_token() {
  browser.runtime.sendMessage('force_load_next_token');

  if (discardtokencheck) {
    discardtokencheck.style.display = "inline";
    setTimeout(() => {
      discardtokencheck.style.display = "none";
    }, 1000)
  }
}

if (discardtokenbtn) {
  discardtokenbtn.addEventListener("click", discard_current_token)
}

async function clear_state() {
  await clearState();
  window.location.reload();
}

if (clearstatebtn) {
  clearstatebtn.addEventListener("click", clear_state)
}

async function save_session_cookie_value() {
  let token = sessioncookieinp.value;
  if (token.startsWith('https://kagi.com')) {
    const url = new URL(token);
    token = url.searchParams.get('token');

    if (token) sessioncookieinp.value = token;
  }

  await browser.storage.local.set({ "kagi_session": token })

  if (savesessioncookiecheck) {
    savesessioncookiecheck.style.display = "inline";
    setTimeout(() => {
      savesessioncookiecheck.style.display = "none";
    }, 1000)
  }
}

if (sessioncookieinp && savesessioncookiebtn) {
  const { kagi_session } = await browser.storage.local.get({ "kagi_session": "" })
  sessioncookieinp.value = kagi_session
  savesessioncookiebtn.addEventListener("click", save_session_cookie_value)
}

async function export_debug_log() {
  const { log } = await browser.storage.local.get({ 'log': [] });
  const log_txt = JSON.stringify(log);
  const filename = "debug_log.txt"
  const inputblob = new File([log_txt], filename, {
    type: "text/plain"
  });
  const url = URL.createObjectURL(inputblob);
  var link = document.createElement("a"); // Or maybe get it from the current document
  link.href = url;
  link.download = filename
  link.textContent = "download"
  link.style.display = "none"
  document.body.appendChild(link); // Or append it whereever you want
  link.click()
  link.remove()
}

if (exportdebugbtn) {
  if (DEBUG_LOG_ACTIVITY) {
    if (exportdebugbtn.parentNode) {
      exportdebugbtn.parentNode.style.display = "inherit"
    }
    exportdebugbtn.addEventListener("click", export_debug_log)
  }
}