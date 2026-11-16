/*
  Chrome refuses our DNR redirects to redirector.html when the navigation's initiator
  isn't allowed by web_accessible_resources, such as selecting "Search With Kagi"
  in the context menu or a link to Kagi on another site. This leaves the tab on an
  ERR_BLOCKED_BY_CLIENT page, so we detect the failed redirect and navigate the tab to the
  redirector ourselves.
*/

import {
    DOMAIN,
    ONION_DOMAIN,
} from './config.js';

import {
    LOCAL_REDIRECTOR_URL,
} from './anonymization.js';

const REDIRECTED_REQUEST_FILTER = {
    urls: [`*://*.${DOMAIN}/*`, `*://*.${ONION_DOMAIN}/*`],
    types: ["main_frame"],
};

// requestId -> redirector URL
// capped since redirects that Chrome follows get no further events to clean them up
const redirectsToRedirector = new Map();
const MAX_TRACKED_REDIRECTS = 32;

function onBeforeRedirect(details) {
    if (details.tabId < 0 || !details.redirectUrl.startsWith(LOCAL_REDIRECTOR_URL)) {
        return;
    }
    redirectsToRedirector.set(details.requestId, details.redirectUrl);
    if (redirectsToRedirector.size > MAX_TRACKED_REDIRECTS) {
        redirectsToRedirector.delete(redirectsToRedirector.keys().next().value);
    }
}

function onErrorOccurred(details) {
    const redirectUrl = redirectsToRedirector.get(details.requestId);
    if (redirectUrl === undefined) {
        return;
    }
    redirectsToRedirector.delete(details.requestId);
    // Chrome blocked the redirect, but it always lets the extension navigate to its own pages
    browser.tabs.update(details.tabId, { url: redirectUrl }).catch(() => { });
}

function setRedirectorFallbackListeners() {
    browser.webRequest.onBeforeRedirect.addListener(onBeforeRedirect, REDIRECTED_REQUEST_FILTER);
    browser.webRequest.onErrorOccurred.addListener(onErrorOccurred, REDIRECTED_REQUEST_FILTER);
}

export {
    setRedirectorFallbackListeners,
};
