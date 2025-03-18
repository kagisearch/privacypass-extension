import {
    REDEMPTION_ENDPOINTS,
    STAGING
} from './config.js';

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const REFERER_EQUIVALENT_HEADERS = {
    "Referer": false,
}

const REFERER_EQUIVALENT_NON_SAFARI_HEADERS = {
    "Sec-Fetch-Site": "none", // cannot be set in Safari, but leaks domain from which the search page is visited
}

export const REFERER_RULESET = isSafari ? REFERER_EQUIVALENT_HEADERS : Object.assign({}, REFERER_EQUIVALENT_HEADERS, REFERER_EQUIVALENT_NON_SAFARI_HEADERS);
export const REFERER_RULES_OFFSET = 10;

let UNIVERSAL_DEANONYMIZING_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", // from Safari, Tor Browser allows "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Referer": false,
    "Accept-Encoding": "gzip, deflate", // from Safari, Tor Browser offers "gzip, deflate, br, zstd",
    "Accept-Language": "en-US,en;q=0.5",
    "Cookie": false, // can't remove it in Safari, but won't stop the script from running
    "Sec-GPC": "1", // it may be force-added by privacy-respecting browsers
    "X-Kagi-Authorization": false,

    // cache headers differ between Ctrl-Shift-R and normal search. They are difficult to tame, eg Brave ignores changes to Cache-Control.
    // while detecting shift-ctrl-R could link sessions, in any case after shift-ctrl-R the search query itself would repeat and unlink
    // hence we don't attempt uniforming these:
    // "Pragma": "no-cache", // applied on Ctrl-Shift-R
    // "Cache-Control": "max-age=0;no-cache" // applied on Ctrl-Shift-R
    // "Cache-Control": "max-age=0" // brave on normal search
    // "Cache-Control": false
};

if (STAGING) {
    // testing and debugging on staging requires some cookies
    delete UNIVERSAL_DEANONYMIZING_HEADERS['Cookie'];
}

// The following headers cause an error if modified in Safari
const NON_SAFARI_DEANONYMISING_HEADERS = {
    "sec-ch-ua": false, // cannot be set in Safari, but it appears to be forcefully added by Chrome
    "sec-ch-ua-mobile": false, // cannot be set in Safari, but it appears to be forcefully added by Chrome
    "sec-ch-ua-platform": false, // cannot be set in Safari, but it appears to be forcefully added by Chrome
    "Sec-Fetch-Site": "none", // cannot be set in Safari, but leaks domain from which the search page is visited
    "Sec-Fetch-User": "?1", // cannot be set in Safari
    "Priority": "u=0, i" // cannot be set in Safari, but it appears to be forcefuflly added in Firefox
};

export const ANONYMIZING_RULESET = isSafari ? UNIVERSAL_DEANONYMIZING_HEADERS : Object.assign({}, UNIVERSAL_DEANONYMIZING_HEADERS, NON_SAFARI_DEANONYMISING_HEADERS);
export const ANONYMIZING_RULES_OFFSET = 20;
export const ACCEPT_EVENT_STREAM_OFFSET = 150;
export const ACCEPT_QUICK_ANSWER_OFFSET = 152;
export const ACCEPT_QUICK_ANSWER_DOC_OFFSET = 154;
export const ACCEPT_TRANSLATE_JSON_OFFSET = 156;
export const ACCEPT_TRANSLATE_TURSNTILE_OFFSET = 158;
export const KAGI_HTML_SLASH_REDIRECT = 180;
export const ONION_HTML_SLASH_REDIRECT = 182;

const INITIAL_HTTP_AUTHORIZATION_ID = 200
const INITIAL_NO_TOKEN_REDIRECT_ID = 400
let HTTP_AUTHORIZATION_ID = {}
let NO_TOKEN_REDIRECT_ID = {}
for (let i = 0; i < REDEMPTION_ENDPOINTS.length; i++) {
    const endpoint = REDEMPTION_ENDPOINTS[i]
    // the factor "2" and "3" below must be >= than the number of rules added in compileHTTPAuthorizationRuleset,
    NO_TOKEN_REDIRECT_ID[endpoint] = INITIAL_NO_TOKEN_REDIRECT_ID + 2 * i
    HTTP_AUTHORIZATION_ID[endpoint] = INITIAL_HTTP_AUTHORIZATION_ID + 3 * i
}
export {
    HTTP_AUTHORIZATION_ID,
    NO_TOKEN_REDIRECT_ID
};
export const INVALID_TOKEN_REDIRECT_URL = browser.runtime.getURL("pages/invalid-token.html");
export const NO_TOKEN_REDIRECT_URL = browser.runtime.getURL("pages/out-of-tokens.html");
export const LOCAL_REDIRECTOR_URL = browser.runtime.getURL("pages/redirector.html");
export const LOCAL_REDIRECTOR_ID = 2;
export const ONION_LOCAL_REDIRECTOR_ID = 4;