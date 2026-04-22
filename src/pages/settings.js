import {
  clearState
} from '../popup/clear.js'

// ----- generate tokens

const clearstatebtn = document.querySelector("#kagipp-clear-state")
const sessioncookieinp = document.querySelector("#kagipp-session-cookie")
const savesessioncookiebtn = document.querySelector("#kagipp-save-session-cookie")
const discardtokenbtn = document.querySelector("#kagipp-discard-current-token")

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
