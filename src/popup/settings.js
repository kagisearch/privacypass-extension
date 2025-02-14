import {
  clearState
} from './clear.js'


// ----- generate tokens

const generatebtn = document.querySelector("#kagipp-generate-tokens")
const clearstatebtn = document.querySelector("#kagipp-clear-state")
const sessioncookieinp = document.querySelector("#kagipp-session-cookie")
const savesessioncookiebtn = document.querySelector("#kagipp-save-session-cookie")
const savesessioncookiecheck = document.querySelector("#kagipp-save-session-cookie-check")
const discardtokenbtn = document.querySelector("#kagipp-discard-current-token")
const discardtokencheck = document.querySelector("#kagipp-discard-current-token-check")

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

  discardtokencheck.style.display = "inline";
  setTimeout(() => {
    discardtokencheck.style.display = "none";
  }, 1000)
}

if (discardtokenbtn) {
  discardtokenbtn.addEventListener("click", discard_current_token)
}

async function clear_state() {
  await clearState();
  window.close();
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

  savesessioncookiecheck.style.display = "inline";
  setTimeout(() => {
    savesessioncookiecheck.style.display = "none";
  }, 1000)
}

if (sessioncookieinp && savesessioncookiebtn && savesessioncookiecheck) {
  const { kagi_session } = await browser.storage.local.get({ "kagi_session": "" })
  sessioncookieinp.value = kagi_session
  savesessioncookiebtn.addEventListener("click", save_session_cookie_value)
}