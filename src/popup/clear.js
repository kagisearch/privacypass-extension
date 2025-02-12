import {
    range
} from '../scripts/headers.js'

import {
    update_extension_icon
} from '../scripts/icon.js'

async function clearState() {
    // clear local storage (includes status, tokens, kagi_session, etc)
    await browser.storage.local.clear();
    // clear all header rules
    await browser.declarativeNetRequest.updateDynamicRules({
        addRules: [],
        removeRuleIds: range(999)
    });
    await update_extension_icon(false);
}

export {
    clearState
};