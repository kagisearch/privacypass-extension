import {
  NO_KAGI_SESSION_ERROR,
  NO_COOKIE_JAR_ACCESS
} from './errors.js'

import {
  STAGING
} from './config.js'

/*
 * Attempts to grab sessions from existing Kagi windows.
 */
async function get_kagi_session() {
  // first we try to read the `kagi_session` from the cookies, as this is always where
  // the freshest value will be available

  let failed_to_read_cookie_jar = false;
  let cookie = false;
  try {
    let cookie_url = STAGING ? 'https://stage.kagi.com' : 'https://kagi.com';
    let cookie_name = STAGING ? 'kagi_session_stage' : 'kagi_session';
    cookie = await browser.cookies.get({
      url: cookie_url,
      name: cookie_name,
    });
  } catch (ex) {
    failed_to_read_cookie_jar = true;
  }

  // if there is a cookie, store a copy in the extension's localStorage
  // and return it
  if (cookie && cookie.value) {
    const token = cookie.value;
    await browser.storage.local.set({ "kagi_session": token })
    return token;
  }

  // if no cookie was found (say cause you removed the session cookie from the cookie jar after generating PP tokens)
  // try reading the last value stored in localStorage
  const { kagi_session } = await browser.storage.local.get({ "kagi_session": false });
  if (kagi_session) {
    return kagi_session;
  }

  // if no cookie was available in the cookie jar or localStorage, but the cookie jar was accessible
  // then just remind the user to log into kagi
  if (!failed_to_read_cookie_jar) {
    throw NO_KAGI_SESSION_ERROR;
  }

  // if you are here, the cookie jar was inaccessible and no session token was loaded into localStorage
  // via the settings UI. likely you are using the Tor browser, or some other browser that does not
  // let extensions see into the cookie jar
  throw NO_COOKIE_JAR_ACCESS;
}

export {
  get_kagi_session
};
