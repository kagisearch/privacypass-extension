
import {
    loadTokensRules,
    setPPHeadersListener,
    genTokens,
} from './generation_and_redemption.js'

import {
    generalRules,
} from './headers.js'

import {
    update_extension_icon
} from './icon.js'

import {
    VERBOSE,
    WEBREQUEST_REDEMPTION_ENDPOINTS,
    REDEMPTION_ENDPOINT_RE,
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

import {
    debug_log
} from './debug_log.js'

import {
    INVALID_TOKEN_REDIRECT_URL
} from './anonymization.js'

async function checkingDoubleSpendListener(details) {
    if (!REDEMPTION_ENDPOINT_RE.test(details.url)) return;
    if (VERBOSE) {
        debug_log(`checkingDoubleSpendListener: ${details.statusCode} ${details.url}`)
    }
    if (details.statusCode == 401) {
        // unauthorized, likely it's a doublespend
        if (VERBOSE) {
            debug_log(`> loading a new token for ${details.url}`)
        }
        // a token was double spent, load the next one
        let { ready_tokens } = await browser.storage.local.get({ ready_tokens: [] });
        ready_tokens.pop();
        await browser.storage.local.set({ ready_tokens });
        await browser.declarativeNetRequest.updateDynamicRules(await loadTokensRules());
        /*
         * The status at this line is:
         * - an error page is shown (or no results displayed in case of a /socket/ request failing)
         * - a new token is loaded for the endpoint that last failed
         * This may be a one-off error, eg due to an update in header rules, or a race condition.
         * If that's the case, we would rather reload the page now that a new token was set.
         * If the error has happened repeatedly though, this is not a good strategy,
         * as it may single out that there is a failing user making repeated queries, and also
         * loop infinitely.
         * Our approach here is the following:
         * - load the time of the last recorded double-spend
         * - if very recent, then this is a repeated failure, don't reload;
         *   just show the error telling the user to check the documentation and possibly report the failure
         * - if the last error is not very recent, then automatically reload the page
        */
        const now = (new Date()).getTime(); // unix time in milliseconds
        const { last_double_spend } = await browser.storage.local.get({ 'last_double_spend': 0 });
        const gap = now - last_double_spend;
        await browser.storage.local.set({ 'last_double_spend': now }); // update the last_double_spend information
        if (gap > 60 * 1000) { // if the last seen doublespend was more than 1 minute ago
            // likely one-off double-spend, reload the current page
            if (VERBOSE) {
                debug_log("checkingDoubleSpendListener: one-off double-spend, reloading");
            }
            const active_tabs_cur_window = await chrome.tabs.query({ active: true, currentWindow: true });
            const cur_tab = active_tabs_cur_window[0];
            if (cur_tab && cur_tab.id && cur_tab.id == details.tabId) {
                await browser.tabs.reload(details.tabId, { bypassCache: true });
            }
        } else {
            if (VERBOSE) {
                debug_log("checkingDoubleSpendListener: repeated double-spend, not reloading");
            }
        }
    } else if (details.statusCode == 403) {
        // let the user know that their tokens are stale
        // realistically, this should only happen to devs debugging against staging
        browser.tabs.create({ url: INVALID_TOKEN_REDIRECT_URL });
    } else {
        if (VERBOSE) {
            debug_log(`> ok loading ${details.url}`)
        }
    }
}

async function setEnabled() {
    if (VERBOSE) {
        debug_log("setEnabled")
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
    let existingRules = await browser.declarativeNetRequest.getDynamicRules();
    await browser.declarativeNetRequest.updateDynamicRules({
        addRules: [...generalRules.addRules, ...(await loadTokensRules()).addRules],
        removeRuleIds: existingRules.map(r => r.id), // Must cover *all* rules, including from old versions of the extension
    });
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
        debug_log("setDisabled")
    }

    let existingRules = await browser.declarativeNetRequest.getDynamicRules();
    await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingRules.map(r => r.id) });

    browser.webRequest.onSendHeaders.removeListener(setPPHeadersListener);
    browser.webRequest.onCompleted.removeListener(checkingDoubleSpendListener);
    await update_extension_icon(false);
}

export {
    setEnabled,
    setDisabled
};
