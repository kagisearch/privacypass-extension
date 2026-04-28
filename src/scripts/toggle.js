import {
    loadTokensRules,
    setPPHeadersListener,
    genTokens,
} from './generation_and_redemption.js'

import {
    generalRules,
    mergeRules,
    unclassifiedTabCatcherRule,
} from './headers.js'

import {
    update_extension_icon
} from './icon.js'

import {
    WEBREQUEST_REDEMPTION_ENDPOINTS,
    REDEMPTION_ENDPOINT_RE,
    IS_FIREFOX,
} from './config.js'

import {
    addBlockingListeners,
    removeBlockingListeners,
} from './blocking_webrequest.js'

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
    INVALID_TOKEN_REDIRECT_URL
} from './anonymization.js'

let nonIncogTabIds = null;
let incogTabIds = null;

async function applyRules(rules, { replaceAll = false } = {}) {
    let addRules = rules.addRules;
    if (nonIncogTabIds !== null) {
        const excludedTabIds = Array.from(nonIncogTabIds);
        // scope PP/anonymizing rules to incog; leave rules that set their own excludedTabIds (e.g. catcher) alone
        addRules = addRules.map(r => r.condition.excludedTabIds ? r : ({ ...r, condition: { ...r.condition, excludedTabIds } }));
        const removeRuleIds = replaceAll ? (await browser.declarativeNetRequest.getSessionRules()).map(r => r.id) : rules.removeRuleIds;
        await browser.declarativeNetRequest.updateSessionRules({ addRules, removeRuleIds });
        if (replaceAll) {
            const staleIds = (await browser.declarativeNetRequest.getDynamicRules()).map(r => r.id);
            await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds: staleIds });
        }
    } else {
        const removeRuleIds = replaceAll ? (await browser.declarativeNetRequest.getDynamicRules()).map(r => r.id) : rules.removeRuleIds;
        await browser.declarativeNetRequest.updateDynamicRules({ addRules, removeRuleIds });
        if (replaceAll) {
            const staleIds = (await browser.declarativeNetRequest.getSessionRules()).map(r => r.id);
            await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: staleIds });
        }
    }
}

async function checkingDoubleSpendListener(details) {
    if (!REDEMPTION_ENDPOINT_RE.test(details.url)) return;
    if (nonIncogTabIds?.has(details.tabId)) return;
    if (details.statusCode == 401) {
        // unauthorized, likely it's a doublespend
        // a token was double spent, load the next one
        let { ready_tokens } = await browser.storage.local.get({ ready_tokens: [] });
        ready_tokens.pop();
        await browser.storage.local.set({ ready_tokens });
        if (!IS_FIREFOX) {
            await applyRules(await loadTokensRules());
        }
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
            const active_tabs_cur_window = await chrome.tabs.query({ active: true, currentWindow: true });
            const cur_tab = active_tabs_cur_window[0];
            if (cur_tab && cur_tab.id && cur_tab.id == details.tabId) {
                await browser.tabs.reload(details.tabId, { bypassCache: true });
            }
        }
    } else if (details.statusCode == 403) {
        // let the user know that their tokens are stale
        // realistically, this should only happen to devs debugging against staging
        browser.tabs.create({ url: INVALID_TOKEN_REDIRECT_URL });
    }
}

function onTabCreated(tab) {
    (tab.incognito ? incogTabIds : nonIncogTabIds).add(tab.id);
    applyMode();
}

function onTabRemoved(tabId) {
    nonIncogTabIds.delete(tabId);
    incogTabIds.delete(tabId);
}

async function applyMode() {
    const { enabled } = await browser.storage.local.get({ enabled: true });

    if (enabled === false) {
        await setDisabled();
        return;
    }

    if (!IS_FIREFOX) {
        if (enabled === "incognito-only") {
            browser.tabs.onCreated.addListener(onTabCreated);
            browser.tabs.onRemoved.addListener(onTabRemoved);
            const tabs = await browser.tabs.query({});
            nonIncogTabIds = new Set(tabs.filter(t => !t.incognito).map(t => t.id));
            incogTabIds = new Set(tabs.filter(t => t.incognito).map(t => t.id));
        } else {
            browser.tabs.onCreated.removeListener(onTabCreated);
            browser.tabs.onRemoved.removeListener(onTabRemoved);
            nonIncogTabIds = null;
            incogTabIds = null;
        }
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
            await applyMode();
            await sendPPModeStatus();
            return;
        }
    }
    if (IS_FIREFOX) {
        addBlockingListeners(enabled === "incognito-only");
        await applyRules({ addRules: [] }, { replaceAll: true });
        browser.webRequest.onCompleted.addListener(
            checkingDoubleSpendListener,
            {
                urls: WEBREQUEST_REDEMPTION_ENDPOINTS,
                ...(enabled === "incognito-only" ? { incognito: true } : {})
            },
            []
        );
    } else {
        const catcher = nonIncogTabIds !== null ? unclassifiedTabCatcherRule([...nonIncogTabIds, ...incogTabIds]).addRules : [];
        await applyRules({ addRules: [...generalRules.addRules, ...(await loadTokensRules()).addRules, ...catcher] }, { replaceAll: true });
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
    }
    await update_extension_icon(enabled);
}

async function setDisabled() {
    await applyRules({ addRules: [] }, { replaceAll: true });
    nonIncogTabIds = null;
    incogTabIds = null;
    browser.tabs.onCreated.removeListener(onTabCreated);
    browser.tabs.onRemoved.removeListener(onTabRemoved);
    browser.webRequest.onSendHeaders.removeListener(setPPHeadersListener);
    browser.webRequest.onCompleted.removeListener(checkingDoubleSpendListener);
    removeBlockingListeners();
    await update_extension_icon(false);
}

export {
    applyMode,
    applyRules,
    nonIncogTabIds,
};
