import {
    VERBOSE,
    LOW_TOKEN_COUNT,
    GEN_TOKENS_ON_LOW_COUNT,
    GEN_TOKENS_ON_ZERO_COUNT,
    REDEMPTION_ENDPOINTS
} from './config.js'

import {
    getWWWAuthenticateHeader,
    tokenGenerationProtocol
} from "./privacypass.js"

import {
    logError,
    logStatus,
    clearError
} from "../popup/utils.js";

import {
    debug_log
} from './debug_log.js'

import {
    countTokens,
    beginningOfPriorEpoch
} from './manage_tokens.js'

import {
    setAuthorizationHeader,
    unsetAuthorizationHeader,
    setNoTokensRedirect
} from './headers.js'

import {
    OVER_QUOTA_ERROR,
    FAILED_LOADING_NEXT_TOKEN_ERROR
} from './errors.js'

async function unloadNextToken(endpoint) {
    if (VERBOSE) {
        // debug_log(`unloadNextToken: ${endpoint}`)
    }
    const { enabled } = await browser.storage.local.get({ 'enabled': false });
    if (enabled) {
        return;
    }
    // recover last loaded token
    const previously_loaded_token_tuple = await unsetAuthorizationHeader(endpoint);
    if (previously_loaded_token_tuple) {
        // recover currently stored tokens
        const { ready_tokens } = await chrome.storage.local.get({ 'ready_tokens': [] })
        // re-append previously loaded token
        const new_ready_tokens = ready_tokens.concat([previously_loaded_token_tuple]);
        await chrome.storage.local.set({ 'ready_tokens': new_ready_tokens });
    }
}

async function loadNextToken(endpoint) {
    if (VERBOSE) {
        debug_log(`loadNextToken: ${endpoint}`)
    }
    const { enabled } = await browser.storage.local.get({ 'enabled': false });
    if (!enabled) {
        return;
    }

    // load all tokens in extension storage
    let { ready_tokens } = await chrome.storage.local.get({ 'ready_tokens': [] })

    // beginning of prior epoch
    const beginning_prior_epoch = beginningOfPriorEpoch();

    let next_token_tuple = false;
    if (ready_tokens.length > 0) {
        do {
            // pop the next oldest token
            const [oldest_token, oldest_token_date] = ready_tokens.pop();
            if (oldest_token_date > beginning_prior_epoch) {
                next_token_tuple = [oldest_token, oldest_token_date];
            }
        } while (!next_token_tuple);
        await chrome.storage.local.set({ "ready_tokens": ready_tokens })
    }

    if (next_token_tuple) {
        // found a fresh token
        // => load token in Authorization header and remove it from token list
        await setAuthorizationHeader(endpoint, next_token_tuple);
        const remiaining_tokens = await countTokens();
        if (remiaining_tokens <= LOW_TOKEN_COUNT) {
            if (GEN_TOKENS_ON_LOW_COUNT) { // always true, useful to set to false for debug
                await genTokens();
            }
        }
    } else {
        // did not find a fresh token
        await logError(FAILED_LOADING_NEXT_TOKEN_ERROR);
        await unsetAuthorizationHeader(endpoint);
        await setNoTokensRedirect(endpoint);
        if (GEN_TOKENS_ON_ZERO_COUNT) { // always true, useful to set to false for debug
            await genTokens();
        }
    }
}

async function forceLoadNextToken(endpoint) {
    const { enabled } = await browser.storage.local.get({ 'enabled': false });
    if (enabled) {
        // extension is enabled, simply call loadNextToken
        await setPPHeaders(endpoint);
    } else {
        // extension is disabled, hence next token will be the last one in the ready_tokens list
        let { ready_tokens } = await chrome.storage.local.get({ 'ready_tokens': [] })
        // new_ready_tokens = ready_tokens[:-1]
        const new_ready_tokens = ready_tokens.splice(0, ready_tokens.length-1)
        await chrome.storage.local.set({ 'ready_tokens': new_ready_tokens });
    }
}

async function genTokens() {
    if (VERBOSE) {
        debug_log('genTokens')
    }
    await logStatus("generating new tokens", 'wait')
    // try to fetch the tokens via .onion domain
    // if it fails and you are on Tor, then you probably are online, will fail on Kagi.com too
    // if it fails and you are not on tor, it will try on kagi.com as it should
    let onion = true;
    let WA = await getWWWAuthenticateHeader(onion);
    if (WA == "") {
        onion = false;
        WA = await getWWWAuthenticateHeader()
    }
    const tokens = await tokenGenerationProtocol(WA, onion);
    // store tokens together with the current time, to allow the extension removing stale tokens if unused for a while
    if (tokens.length <= 0) {
        throw OVER_QUOTA_ERROR;
    }
    // tokens stored as FIFO, popping new tokens from the end of the list
    const current_time = (new Date()).getTime()
    const { ready_tokens } = await chrome.storage.local.get({ "ready_tokens": [] })
    const new_tokens = tokens.map((tok) => [tok, current_time]);
    await chrome.storage.local.set({ "ready_tokens": new_tokens.concat(ready_tokens) })
    // if enabled, load next token
    const { enabled } = await browser.storage.local.get({ 'enabled': false });
    if (enabled) {
        for (let i = 0; i < REDEMPTION_ENDPOINTS.length; i++) {
            const endpoint = REDEMPTION_ENDPOINTS[i];
            await loadNextToken(endpoint);
        }
    }
    await clearError();
}

async function setPPHeaders(endpoint) {
    if (VERBOSE) {
        debug_log(`setPPHeaders: ${endpoint}`)
    }
    try {
        await loadNextToken(endpoint);
    } catch (ex) {
        await logError(`${ex}`);
        return;
    }
}

async function unsetPPHeaders(endpoint) {
    if (VERBOSE) {
        debug_log(`unsetPPHeaders: ${endpoint}`)
    }
    await unloadNextToken(endpoint);
}

async function setPPHeadersListener(details) {
    if (VERBOSE) {
        debug_log(`setPPHeadersListener: ${details.statusCode} ${details.url}`)
        const remiaining_tokens = await countTokens();
        debug_log(`remaining tokens: ${remiaining_tokens}`)
    }
    const url = new URL(details.url);
    const scheme_domain_port = url.origin;
    const pathname = url.pathname; // comes with a leading /
    const endpoint = (pathname == "/" || pathname.endsWith('/html')) ? `${scheme_domain_port}${pathname}|` : `${scheme_domain_port}${pathname}`;
    await setPPHeaders(endpoint);
}

export {
    setPPHeaders,
    unsetPPHeaders,
    setPPHeadersListener,
    genTokens,
    forceLoadNextToken
};