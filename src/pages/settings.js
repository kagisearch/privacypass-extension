import {
  clearState
} from '../popup/clear.js'

import {
  DEBUG_LOG_ACTIVITY
} from '../scripts/config.js'

// ----- generate tokens

const clearstatebtn = document.querySelector("#kagipp-clear-state")
const sessioncookieinp = document.querySelector("#kagipp-session-cookie")
const savesessioncookiebtn = document.querySelector("#kagipp-save-session-cookie")
const discardtokenbtn = document.querySelector("#kagipp-discard-current-token")
const exportdebugbtn = document.querySelector("#kagipp-export-debug-log")

discardtokenbtn.addEventListener("click", () => {
  browser.runtime.sendMessage('force_load_next_token');
});

clearstatebtn.addEventListener("click", async () => {
  await clearState();
  window.location.reload();
});

savesessioncookiebtn.addEventListener("click", async () => {
  let token = sessioncookieinp.value;
  if (token.startsWith('https://kagi.com')) {
    const url = new URL(token);
    token = url.searchParams.get('token');

    if (token) sessioncookieinp.value = token;
  }

  await browser.storage.local.set({ "kagi_session": token })
});

{
  const { kagi_session } = await browser.storage.local.get({ "kagi_session": "" })
  sessioncookieinp.value = kagi_session
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
