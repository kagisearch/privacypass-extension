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
    authorizationRules,
    noTokensRedirectRules,
    mergeRules
} from './headers.js'

import {
    OVER_QUOTA_ERROR,
    FAILED_LOADING_NEXT_TOKEN_ERROR
} from './errors.js'

async function loadTokensRules() {
    const { ready_tokens, loaded_tokens } = await browser.storage.local.get({ ready_tokens: [], loaded_tokens: {} });
    const beginning_prior_epoch = beginningOfPriorEpoch();
    let rules = { addRules: [], removeRuleIds: [] };
    let ranOut = false;

    for (const endpoint of REDEMPTION_ENDPOINTS) {
        const currentToken = loaded_tokens[endpoint];
        const valid = currentToken && currentToken[1] > beginning_prior_epoch;
        if (!valid) {
            let next_token_tuple = null;
            while (!next_token_tuple && ready_tokens.length > 0) {
                const [oldest_token, oldest_token_date] = ready_tokens.pop();
                if (oldest_token_date > beginning_prior_epoch) {
                    next_token_tuple = [oldest_token, oldest_token_date];
                }
            }
            if (next_token_tuple) {
                loaded_tokens[endpoint] = next_token_tuple;
            } else {
                delete loaded_tokens[endpoint];
                ranOut = true;
            }
        }
        rules = mergeRules(rules, loaded_tokens[endpoint] ? authorizationRules(endpoint, loaded_tokens[endpoint]) : noTokensRedirectRules(endpoint));
    }

    await browser.storage.local.set({ ready_tokens, loaded_tokens });

    if (ranOut && GEN_TOKENS_ON_ZERO_COUNT) {
        logError(FAILED_LOADING_NEXT_TOKEN_ERROR);
        genTokens().catch(ex => logError(`${ex}`));
    } else if (GEN_TOKENS_ON_LOW_COUNT && ready_tokens.length <= LOW_TOKEN_COUNT) {
        genTokens().catch(ex => logError(`${ex}`));
    }

    return rules;
}

async function forceLoadNextTokens() {
    const { enabled } = await browser.storage.local.get({ 'enabled': false });
    if (enabled) {
        await browser.storage.local.set({ loaded_tokens: {} });
        await browser.declarativeNetRequest.updateDynamicRules(await loadTokensRules());
    } else {
        // extension is disabled, hence next token will be the last one in the ready_tokens list
        let { ready_tokens } = await chrome.storage.local.get({ 'ready_tokens': [] })
        const new_ready_tokens = ready_tokens.splice(0, ready_tokens.length - 1)
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
        await browser.declarativeNetRequest.updateDynamicRules(await loadTokensRules());
    }
    await clearError();
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
    const { loaded_tokens } = await browser.storage.local.get({ loaded_tokens: {} });
    delete loaded_tokens[endpoint];
    await browser.storage.local.set({ loaded_tokens });
    await browser.declarativeNetRequest.updateDynamicRules(await loadTokensRules());
}

export {
    loadTokensRules,
    setPPHeadersListener,
    genTokens,
    forceLoadNextTokens,
};
