// Very hacky, but currently works flawlessly
if (!globalThis.browser) {
    globalThis.browser = chrome;
}
export const IS_FIREFOX = (typeof browser.runtime.getBrowserInfo === 'function')

// debug settings
export const STAGING = false;
export const GEN_TOKENS_ON_LOW_COUNT = true;
export const GEN_TOKENS_ON_ZERO_COUNT = true;

// endpoints
export const SCHEME = "https"
export const DOMAIN = "kagi.com"
export const PORT = "443"
export const DOMAIN_PORT = (PORT == "443") ? DOMAIN : `${DOMAIN}:${PORT}`
export const ONION_SCHEME = "http"
export const ONION_DOMAIN = "kagi2pv5bdcxxqla5itjzje2cgdccuwept5ub6patvmvn3qgmgjd6vid.onion"
export const ONION_DOMAIN_PORT = ONION_DOMAIN;

// token generation endpoints
export const REQUEST_PATH = "pp/gettokens"
export const WWWA_PATH = "pp/wwwa"
export const ISSUER_REQUEST_ENDPOINT = STAGING ? `${SCHEME}://stage.${DOMAIN_PORT}/${REQUEST_PATH}` : `${SCHEME}://${DOMAIN_PORT}/${REQUEST_PATH}`;
export const ONION_ISSUER_REQUEST_ENDPOINT = `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/${REQUEST_PATH}`;
export const WWWA_ENDPOINT = STAGING ? `${SCHEME}://stage.${DOMAIN_PORT}/${WWWA_PATH}` : `${SCHEME}://${DOMAIN_PORT}/${WWWA_PATH}`;
export const ONION_WWWA_ENDPOINT = `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/${WWWA_PATH}`;

export const REDEMPTION_ENDPOINT_REGEX = "^https?://kagi[^/]+/(html/|socket/)?($|\\?|search|images|videos|news|podcasts|settings|mother/|reverse/)";
export const REDEMPTION_ENDPOINT_RE = new RegExp(REDEMPTION_ENDPOINT_REGEX);

export const REDEMPTION_REQUEST_DOMAINS = STAGING
    ? [DOMAIN, ONION_DOMAIN, `stage.${DOMAIN}`]
    : [DOMAIN, ONION_DOMAIN];

export const WEBREQUEST_REDEMPTION_ENDPOINTS = STAGING
    ? [`${SCHEME}://${DOMAIN_PORT}/*`, `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/*`, `${SCHEME}://stage.${DOMAIN_PORT}/*`]
    : [`${SCHEME}://${DOMAIN_PORT}/*`, `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/*`];

// token generation settings
export const TOKENS_TO_STASH = 300;
export const MAX_TOKENS = 2000;
export const LOW_TOKEN_COUNT = 50; // if available tokens below this threshold, show counts

// settings for communication with Kagi Search extension
const FIREFOX_KAGI_EXTENSION_ID = "search@kagi.com";
const CHROME_KAGI_EXTENSION_ID = "cdglnehniifkbagbbombnjghhcihifij"; // release
// const CHROME_KAGI_EXTENSION_ID = "pihkihagjnjlpgepbplgffcogjgnknmj"; // debug

export const KAGI_EXTENSION_ID = IS_FIREFOX ? FIREFOX_KAGI_EXTENSION_ID : CHROME_KAGI_EXTENSION_ID;
