// Very hacky, but currently works flawlessly
if (!globalThis.browser) {
    globalThis.browser = chrome;
}
export const IS_FIREFOX = (typeof browser.runtime.getBrowserInfo === 'function')

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
export const ISSUER_REQUEST_ENDPOINT = `${SCHEME}://${DOMAIN_PORT}/${REQUEST_PATH}`;
export const ONION_ISSUER_REQUEST_ENDPOINT = `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/${REQUEST_PATH}`;
export const WWWA_ENDPOINT = `${SCHEME}://${DOMAIN_PORT}/${WWWA_PATH}`;
export const ONION_WWWA_ENDPOINT = `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/${WWWA_PATH}`;

// token redemption endpoints
const REDEMPTION_SERVICES = [
    "search",
    "images",
    "videos",
    "news",
    "podcasts"
]
let REDEMPTION_ENDPOINTS = [
    `${SCHEME}://${DOMAIN_PORT}/|`,
    `${SCHEME}://${DOMAIN_PORT}/html`,
    `${SCHEME}://${DOMAIN_PORT}/settings`,
    `${SCHEME}://${DOMAIN_PORT}/api/quick_settings/landing`,
    `${SCHEME}://${DOMAIN_PORT}/mother/context`,
    `${SCHEME}://${DOMAIN_PORT}/mother/summarize_document`,
    `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/|`,
    `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/html`,
    `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/settings`,
    `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/api/quick_settings/landing`,
    `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/mother/context`,
    `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/mother/summarize_document`
]
for (let i = 0; i < REDEMPTION_SERVICES.length; i++) {
    const service = REDEMPTION_SERVICES[i]
    REDEMPTION_ENDPOINTS.push(
        `${SCHEME}://${DOMAIN_PORT}/${service}`
    )
    REDEMPTION_ENDPOINTS.push(
        `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/${service}`
    )
    REDEMPTION_ENDPOINTS.push(
        `${SCHEME}://${DOMAIN_PORT}/html/${service}`
    )
    REDEMPTION_ENDPOINTS.push(
        `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/html/${service}`
    )
    REDEMPTION_ENDPOINTS.push(
        `${SCHEME}://${DOMAIN_PORT}/socket/${service}`
    )
    REDEMPTION_ENDPOINTS.push(
        `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/socket/${service}`
    )
    REDEMPTION_ENDPOINTS.push(
        `${SCHEME}://${DOMAIN_PORT}/api/quick_settings/${service}`
    )
    REDEMPTION_ENDPOINTS.push(
        `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/api/quick_settings/${service}`
    )
}
export {
    REDEMPTION_ENDPOINTS
};

let WEBREQUEST_REDEMPTION_ENDPOINTS = []
for (let i = 0; i < REDEMPTION_ENDPOINTS.length; i++) {
    let endpoint = REDEMPTION_ENDPOINTS[i];
    if (endpoint.endsWith('/|')) {
         // webRequest does not recognize urlFilter's |
         // so we remove the trailing |
        endpoint = endpoint.substring(0, endpoint.length-1)
    }
    WEBREQUEST_REDEMPTION_ENDPOINTS.push(endpoint)
    WEBREQUEST_REDEMPTION_ENDPOINTS.push(`${endpoint}?*`)
}
export {
    WEBREQUEST_REDEMPTION_ENDPOINTS
}

// token generation settings
export const TOKENS_TO_STASH = 500;
export const MAX_TOKENS = 2000;
export const LOW_TOKEN_COUNT = 50; // if available tokens below this threshold, show counts

// debug settings
export const VERBOSE = true;
export const GEN_TOKENS_ON_LOW_COUNT = true;
export const GEN_TOKENS_ON_ZERO_COUNT = true;

// settings for communication with Kagi Search extension
const FIREFOX_KAGI_EXTENSION_ID = "search@kagi.com";
const CHROME_KAGI_EXTENSION_ID = "cdglnehniifkbagbbombnjghhcihifij"; // release
// const CHROME_KAGI_EXTENSION_ID = "pihkihagjnjlpgepbplgffcogjgnknmj"; // debug

export const KAGI_EXTENSION_ID = IS_FIREFOX ? FIREFOX_KAGI_EXTENSION_ID : CHROME_KAGI_EXTENSION_ID;
