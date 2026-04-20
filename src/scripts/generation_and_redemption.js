import {
    VERBOSE,
    LOW_TOKEN_COUNT,
    GEN_TOKENS_ON_LOW_COUNT,
    GEN_TOKENS_ON_ZERO_COUNT,
    REDEMPTION_ENDPOINT_RE,
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
    authorizationRule,
    noTokensRedirectRule,
} from './headers.js'

import {
    OVER_QUOTA_ERROR,
    FAILED_LOADING_NEXT_TOKEN_ERROR
} from './errors.js'

async function loadTokensRules() {
    let { ready_tokens } = await browser.storage.local.get({ ready_tokens: [] });
    const beginning_prior_epoch = beginningOfPriorEpoch();
    while (ready_tokens.length > 0 && ready_tokens[ready_tokens.length - 1][1] <= beginning_prior_epoch) {
        ready_tokens.pop();
    }
    await browser.storage.local.set({ ready_tokens });

    const active = ready_tokens[ready_tokens.length - 1];
    if (!active && GEN_TOKENS_ON_ZERO_COUNT) {
        logError(FAILED_LOADING_NEXT_TOKEN_ERROR);
        genTokens().catch(ex => logError(`${ex}`));
    } else if (GEN_TOKENS_ON_LOW_COUNT && ready_tokens.length <= LOW_TOKEN_COUNT) {
        genTokens().catch(ex => logError(`${ex}`));
    }

    return active ? authorizationRule(active) : noTokensRedirectRule;
}

async function forceLoadNextTokens() {
    let { ready_tokens } = await browser.storage.local.get({ ready_tokens: [] });
    ready_tokens.pop();
    await browser.storage.local.set({ ready_tokens });
    const { enabled } = await browser.storage.local.get({ 'enabled': false });
    if (enabled) {
        await browser.declarativeNetRequest.updateDynamicRules(await loadTokensRules());
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
    if (!REDEMPTION_ENDPOINT_RE.test(details.url)) return;
    if (VERBOSE) {
        debug_log(`setPPHeadersListener: ${details.statusCode} ${details.url}`)
        const remiaining_tokens = await countTokens();
        debug_log(`remaining tokens: ${remiaining_tokens}`)
    }
    let { ready_tokens } = await browser.storage.local.get({ ready_tokens: [] });
    ready_tokens.pop();
    await browser.storage.local.set({ ready_tokens });
    await browser.declarativeNetRequest.updateDynamicRules(await loadTokensRules());
}

export {
    loadTokensRules,
    setPPHeadersListener,
    genTokens,
    forceLoadNextTokens,
};
