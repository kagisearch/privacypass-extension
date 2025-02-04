import {
    range
} from '../scripts/headers.js'

async function clearState() {
    // clear local storage (includes status, tokens, kagi_session, etc)
    await browser.storage.local.clear();
    // clear all header rules
    await browser.declarativeNetRequest.updateDynamicRules({
        addRules: [],
        removeRuleIds: range(999)
    });
}

export {
    clearState
};