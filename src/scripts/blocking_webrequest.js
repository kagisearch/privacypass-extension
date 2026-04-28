import {
    ANONYMIZING_RULESET,
    REFERER_RULESET,
    ACCEPT_OVERRIDES,
    NO_TOKEN_REDIRECT_URL,
} from "./anonymization.js";

import {
    REDEMPTION_ENDPOINT_RE,
    DOMAIN,
    ONION_DOMAIN,
    ONION_SCHEME,
    LOW_TOKEN_COUNT,
    GEN_TOKENS_ON_LOW_COUNT,
    GEN_TOKENS_ON_ZERO_COUNT,
} from "./config.js";

import {
    FAILED_LOADING_NEXT_TOKEN_ERROR,
} from "./errors.js";

import {
    logError,
} from "../popup/utils.js";

import {
    genTokens,
} from "./generation_and_redemption.js";

const BLOCKING_URLS = [`*://*.${DOMAIN}/*`, `${ONION_SCHEME}://*.${ONION_DOMAIN}/*`];

const HEADER_SET = { ...ANONYMIZING_RULESET, ...REFERER_RULESET };
const HEADER_KEYS_LOWER = new Set(Object.keys(HEADER_SET).map(k => k.toLowerCase()));

function acceptFor(url) {
    const u = new URL(url);
    for (const o of ACCEPT_OVERRIDES) {
        if (o.subdomain && !u.hostname.startsWith(`${o.subdomain}.`)) continue;
        if (!u.pathname.startsWith(o.path)) continue;
        return o.accept;
    }
    return null;
}

async function onBeforeRequestListener(details) {
    if (/[?&]token=/.test(details.url)) {
        const u = new URL(details.url);
        u.searchParams.delete("token");
        return { redirectUrl: u.toString() };
    }
    if (REDEMPTION_ENDPOINT_RE.test(details.url)) {
        const { ready_tokens } = await browser.storage.local.get({ ready_tokens: [] });
        if (ready_tokens.length === 0) return { redirectUrl: NO_TOKEN_REDIRECT_URL };
    }
    return {};
}

async function onBeforeSendHeadersListener(details) {
    const headers = details.requestHeaders.filter(h => !HEADER_KEYS_LOWER.has(h.name.toLowerCase()));
    for (const [name, value] of Object.entries(HEADER_SET)) {
        if (value !== false) {
            headers.push({ name, value: name === "Accept" ? (acceptFor(details.url) ?? value) : value });
        }
    }
    if (REDEMPTION_ENDPOINT_RE.test(details.url)) {
        const { ready_tokens } = await browser.storage.local.get({ ready_tokens: [] });
        if (ready_tokens.length > 0) {
            const [token] = ready_tokens[ready_tokens.length - 1];
            ready_tokens.pop();
            await browser.storage.local.set({ ready_tokens });
            headers.push({ name: "X-Kagi-PrivacyPass-Client", value: "true" });
            headers.push({ name: "Authorization", value: `PrivateToken token="${token}"` });
        }
        if (!ready_tokens.length && GEN_TOKENS_ON_ZERO_COUNT) {
            logError(FAILED_LOADING_NEXT_TOKEN_ERROR);
            genTokens().catch(ex => logError(`${ex}`));
        } else if (GEN_TOKENS_ON_LOW_COUNT && ready_tokens.length <= LOW_TOKEN_COUNT) {
            genTokens().catch(ex => logError(`${ex}`));
        }
    }
    return { requestHeaders: headers };
}

export function addBlockingListeners(incogOnly) {
    removeBlockingListeners();
    const incog = incogOnly ? { incognito: true } : {};
    browser.webRequest.onBeforeRequest.addListener(
        onBeforeRequestListener,
        { urls: BLOCKING_URLS, types: ["main_frame", "sub_frame", "xmlhttprequest"], ...incog },
        ["blocking"]
    );
    browser.webRequest.onBeforeSendHeaders.addListener(
        onBeforeSendHeadersListener,
        { urls: BLOCKING_URLS, ...incog },
        ["blocking", "requestHeaders"]
    );
}

export function removeBlockingListeners() {
    browser.webRequest.onBeforeRequest.removeListener(onBeforeRequestListener);
    browser.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeadersListener);
}
