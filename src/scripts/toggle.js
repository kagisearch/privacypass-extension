
import {
    setPPHeaders,
    unsetPPHeaders,
    setPPHeadersListener,
    genTokens,
} from './generation_and_redemption.js'

import {
    setRefererRules,
    setAntiFingerprintingRules,
    unsetAntiFingerprintingRules,
    setLocaRedirectorHeader,
    unsetLocaRedirectorHeader,
    selfRemovingUnsetRefererHeadersListener
} from './headers.js'

import {
    update_extension_icon
} from './icon.js'

import {
    VERBOSE,
    REDEMPTION_ENDPOINTS,
    WEBREQUEST_REDEMPTION_ENDPOINTS,
} from './config.js'

import {
    get_kagi_session
} from './kagi_session.js';

import {
    countTokens
} from './manage_tokens.js';

import {
    logError,
} from '../popup/utils.js';

import {
    sendPPModeStatus,
} from './communication_with_main_extension.js'

async function checkingDoubleSpendListener(details) {
    if (VERBOSE) {
        console.log(`checkingDoubleSpendListener: ${details.statusCode} ${details.url}`)
    }
    if (details.statusCode == 401) {
        // unauthorized, likely it's a doublespend
        const url = new URL(details.url);
        const scheme_domain_port = url.origin;
        const pathname = url.pathname; // comes with a leading /
        const endpoint = (pathname == "/") ? `${scheme_domain_port}${pathname}|` : `${scheme_domain_port}${pathname}`;
        if (VERBOSE) {
            console.log(`> loading a new token for ${endpoint}`)
        }
        await setPPHeaders(endpoint);
    }
}

async function setEnabled() {
    if (VERBOSE) {
        console.log("setEnabled")
    }
    // check if the user has no tokens and will be unable to generate more
    const n_tokens = await countTokens();
    if (n_tokens <= 0) {
        try {
            await get_kagi_session();
            await genTokens();
        } catch (ex) {
            await logError(`${ex}`);
            await browser.storage.local.set({ 'enabled': false })
            await update_extension_icon(false);
            await sendPPModeStatus();
            return;
        }
    }
    // enable Privacy Pass mode
    await setRefererRules();
    await setAntiFingerprintingRules();
    await setLocaRedirectorHeader();
    for (let i = 0; i < REDEMPTION_ENDPOINTS.length; i++) {
        let endpoint = REDEMPTION_ENDPOINTS[i];
        await setPPHeaders(endpoint);
    }
    browser.webRequest.onSendHeaders.addListener(
        setPPHeadersListener,
        {
            urls: WEBREQUEST_REDEMPTION_ENDPOINTS
        },
        []
    )
    browser.webRequest.onCompleted.addListener(
        checkingDoubleSpendListener,
        {
            urls: WEBREQUEST_REDEMPTION_ENDPOINTS
        },
        []
    )
    await update_extension_icon(true);
}

async function setDisabled() {
    if (VERBOSE) {
        console.log("setDisabled")
    }
    await unsetAntiFingerprintingRules();
    await unsetLocaRedirectorHeader();
    for (let i = 0; i < REDEMPTION_ENDPOINTS.length; i++) {
        let endpoint = REDEMPTION_ENDPOINTS[i];
        await unsetPPHeaders(endpoint);
    }
    browser.webRequest.onSendHeaders.removeListener(setPPHeadersListener);
    browser.webRequest.onCompleted.removeListener(checkingDoubleSpendListener);
    browser.webRequest.onCompleted.addListener(
        selfRemovingUnsetRefererHeadersListener,
        { urls: ["<all_urls>"] },
        ["responseHeaders"]
    )
    await update_extension_icon(false);
}

export {
    setEnabled,
    setDisabled
};
