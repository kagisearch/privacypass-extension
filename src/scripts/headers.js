/*

This is the most security-sensitive and fiddly component in the extension.
In this module, we write code to:
- load and unload the Authentication token for the next Kagi query
- unload HTTP headers that could lead to deanonymization, such as Cookies
- set default values for some HTTP headers that are needed but would otherwise lead to partial deanonymization
- handle the case of the Referer header, which should stay unloaded also for the first HTTP request made _after_ disabling the extension
- work around the "token in the GET variable" corner case that happens when users search using the Kagi Session Link
- make sure to direct the user to a "no tokens" error page if they search with the extension enabled but no tokens available.
  This should be a redirect that however does make sure not to deanonymise the user, so we host it internally to the extension.

These modifications are made using the DeclarativeNetRequest API, which is fiddly and somewhat inconsistent across browsers.
In particular, some caveats:
- Safari does not allow some headers being dropped (crucially: Cookies)
- Redirects ignore header modifications, undoing the deanonymization
- Each header modification has a number id assigned to it, used for unloading it

*/

import {
    ACCEPT_EVENT_STREAM_OFFSET,
    ACCEPT_TRANSLATE_JSON_OFFSET,
    ACCEPT_QUICK_ANSWER_OFFSET,
    ACCEPT_QUICK_ANSWER_DOC_OFFSET,
    ACCEPT_TRANSLATE_TURSNTILE_OFFSET,
    KAGI_HTML_SLASH_REDIRECT,
    ONION_HTML_SLASH_REDIRECT,
    ANONYMIZING_RULES_OFFSET,
    ANONYMIZING_RULESET,
    REFERER_RULES_OFFSET,
    REFERER_RULESET,
    NO_TOKEN_REDIRECT_ID,
    NO_TOKEN_REDIRECT_URL,
    LOCAL_REDIRECTOR_URL,
    LOCAL_REDIRECTOR_ID,
    HTTP_AUTHORIZATION_ID,
    ONION_LOCAL_REDIRECTOR_ID,
    ACCEPT_QUICK_ANSWER_NT_OFFSET
} from "./anonymization.js";

import {
    VERBOSE,
    IS_FIREFOX,
    SCHEME,
    ONION_SCHEME,
    DOMAIN_PORT,
    ONION_DOMAIN_PORT,
    DOMAIN
} from './config.js'

import {
    debug_log
} from './debug_log.js'

// --- general utilities


function dropHeaderRule(headerKey, endpoint, ruleId, rulePriority, allResourceTypes = false) {
    let resourceTypes = ["main_frame", "sub_frame", "xmlhttprequest"];
    if (allResourceTypes) {
        resourceTypes = resourceTypes.concat(["csp_report", "font", "image", "media", "object", "other", "ping", "script", "stylesheet", "websocket"])
        if (IS_FIREFOX) {
            resourceTypes = resourceTypes.concat(["beacon", "imageset", "object_subrequest", "speculative", "web_manifest", "xml_dtd", "xslt"])
        } else {
            // chrome
            resourceTypes = resourceTypes.concat(["webbundle", "webtransport"])
        }
    }
    return {
        id: ruleId,
        priority: rulePriority,
        action: {
            type: "modifyHeaders",
            requestHeaders: [{ "header": headerKey, "operation": "remove" }]
        },
        condition:
        {
            urlFilter: endpoint,
            resourceTypes: resourceTypes
        }
    };
}

function editHeaderRule(headerKey, headerValue, endpoint, ruleId, rulePriority, allResourceTypes = false) {
    let resourceTypes = ["main_frame", "sub_frame", "xmlhttprequest"];
    if (allResourceTypes) {
        resourceTypes = resourceTypes.concat(["csp_report", "font", "image", "media", "object", "other", "ping", "script", "stylesheet", "websocket"])
        if (IS_FIREFOX) {
            resourceTypes = resourceTypes.concat(["beacon", "imageset", "object_subrequest", "speculative", "web_manifest", "xml_dtd", "xslt"])
        } else {
            // chrome
            resourceTypes = resourceTypes.concat(["webbundle", "webtransport"])
        }
    }
    return {
        id: ruleId,
        priority: rulePriority,
        action: {
            type: "modifyHeaders",
            requestHeaders: [{ "header": headerKey, "operation": "set", "value": headerValue }]
        },
        condition:
        {
            urlFilter: endpoint,
            resourceTypes: resourceTypes
        }
    };
}

// same as range in Python
function range(size, startAt = 0) {
    return [...Array(size).keys()].map(i => i + startAt);
}

function compileHeaderRuleset(ruleset, offset, ruleEndpointPath = "", rulePriority = 1, subDomain = "") {
    let add_rules = [];
    let nrules = offset; // rule separation
    const full_domain_port = (subDomain != "") ? `${subDomain}.${DOMAIN_PORT}` : DOMAIN_PORT;
    const full_onion_domain_port = (subDomain != "") ? `${subDomain}.${ONION_DOMAIN_PORT}` : ONION_DOMAIN_PORT;
    // note, using ||kagi.com will cover subdomains such as translate.kagi.com. this is useful for blanket rules such as anonymisation.
    // subdomain-specific rules should pass subDomain instead
    const endpoint = (ruleEndpointPath != "") ? `||${full_domain_port}/${ruleEndpointPath}` : `||${full_domain_port}/`;
    const onion_endpoint = (ruleEndpointPath != "") ? `||${full_onion_domain_port}/${ruleEndpointPath}` : `||${full_onion_domain_port}/`;

    // create the rules to deal with the headers that deanonymise the user
    for (const key in ruleset) {
        const val = ruleset[key];
        if (val) {
            add_rules.push(editHeaderRule(key, val, endpoint, ++nrules, rulePriority, true));
            add_rules.push(editHeaderRule(key, val, onion_endpoint, ++nrules, rulePriority, true));
        } else {
            add_rules.push(dropHeaderRule(key, endpoint, ++nrules, rulePriority, true));
            add_rules.push(dropHeaderRule(key, onion_endpoint, ++nrules, rulePriority, true));
        }
    }

    let rules = {
        addRules: add_rules,
        removeRuleIds: range(nrules - offset, offset + 1)
    };

    return rules;
};

async function setHeaderRuleset(ruleset, offset, ruleEndpointPath = "", rulePriority = 1, subDomain = "") {
    const rules = compileHeaderRuleset(ruleset, offset, ruleEndpointPath, rulePriority, subDomain);
    if (VERBOSE) {
        debug_log(`setHeaderRuleset: ${rules}`)
    }
    await browser.declarativeNetRequest.updateDynamicRules(rules)
}

async function unsetHeaderRuleset(ruleset, offset) {
    let rule_ids = compileHeaderRuleset(ruleset, offset).removeRuleIds;
    if (VERBOSE) {
        debug_log(`unsetHeaderRuleset: ${rule_ids}`);
    }
    await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [],
        removeRuleIds: rule_ids
    });
}

// --- applies rules around the Referer header

/*
 * The following "Referer" rules are here to protect a user that:
 * 1. Searches <sensitive query> via Privacy Pass: https://kagi.com/search?q=<sensitive query>
 * 2. Disables Privacy Pass from the results page, re-loading its session cookie
 * 3. Opens another Kagi.com page, leaking "https://kagi.com/search?q=<sensitive query>" via its Referer (or equivalent) header
*/

async function setRefererRules() {
    return await setHeaderRuleset(REFERER_RULESET, REFERER_RULES_OFFSET)
}

async function unsetRefererRules() {
    return await unsetHeaderRuleset(REFERER_RULESET, REFERER_RULES_OFFSET);
}

async function selfRemovingUnsetRefererHeadersListener(details) {
    if (VERBOSE) {
        debug_log(`selfRemovingUnsetRefererHeadersListener`)
    }
    if (!browser.webRequest.onCompleted.hasListener(selfRemovingUnsetRefererHeadersListener)) {
        if (VERBOSE) {
            debug_log(`selfRemovingUnsetRefererHeadersListener: no prior listener, doing nothing`)
        }
        return;
    }
    // remove the specific referer rules
    await unsetRefererRules();
    // remove the listener
    browser.webRequest.onCompleted.removeListener(selfRemovingUnsetRefererHeadersListener);
}

// --- general deanonymising header removal
async function setAntiFingerprintingRules() {
    await setHeaderRuleset(ANONYMIZING_RULESET, ANONYMIZING_RULES_OFFSET)
    // just for /socket/* endpoints, force Accept: "text/event-stream"
    await setHeaderRuleset({ Accept: "text/event-stream" }, ACCEPT_EVENT_STREAM_OFFSET, "socket/", 2);
    // support for quick answer and summarize document from search results page
    await setHeaderRuleset({ Accept: "application/vnd.kagi.stream" }, ACCEPT_QUICK_ANSWER_NT_OFFSET, "_s/quick_answer", 2);
    await setHeaderRuleset({ Accept: "application/vnd.kagi.stream" }, ACCEPT_QUICK_ANSWER_OFFSET, "mother/context", 2);
    await setHeaderRuleset({ Accept: "application/vnd.kagi.stream" }, ACCEPT_QUICK_ANSWER_DOC_OFFSET, "mother/summarize_document", 2);
    // just for translate.kagi.com/?/translate/ to accept "application/json" and turnstile to */*
    await setHeaderRuleset({ Accept: "application/json" }, ACCEPT_TRANSLATE_JSON_OFFSET, "?/translate", 2, "translate");
    await setHeaderRuleset({ Accept: "*/*" }, ACCEPT_TRANSLATE_TURSNTILE_OFFSET, "api/auth/turnstile", 2, "translate");
}


// removes any custom HTTP header rules
async function unsetAntiFingerprintingRules() {
    await unsetHeaderRuleset(ANONYMIZING_RULESET, ANONYMIZING_RULES_OFFSET)
    await unsetHeaderRuleset({ Accept: "text/event-stream" }, ACCEPT_EVENT_STREAM_OFFSET);
    await unsetHeaderRuleset({ Accept: "application/vnd.kagi.stream" }, ACCEPT_QUICK_ANSWER_OFFSET);
    await unsetHeaderRuleset({ Accept: "application/vnd.kagi.stream" }, ACCEPT_QUICK_ANSWER_DOC_OFFSET);
    await unsetHeaderRuleset({ Accept: "application/json" }, ACCEPT_TRANSLATE_JSON_OFFSET);
    await unsetHeaderRuleset({ Accept: "*/*" }, ACCEPT_TRANSLATE_TURSNTILE_OFFSET);
}

// --- sets HTTP Authorization header

function compileHTTPAuthorizationRuleset(endpoint, token_tuple) {
    const [token, token_date] = token_tuple;

    const offset = HTTP_AUTHORIZATION_ID[endpoint];
    let add_rules = [];
    let nrules = offset; // rule separation

    // NOTE: if you increase the number of rules below this line, match this with the constant factor in `anonymization.js`
    add_rules.push(editHeaderRule("X-Kagi-PrivacyPass-Client", "true", endpoint, ++nrules, 2));
    add_rules.push(editHeaderRule("Authorization", `PrivateToken token="${token}"`, endpoint, ++nrules, 2));

    const rules = {
        addRules: add_rules,
        removeRuleIds: range(nrules - offset, offset + 1)
    };

    return rules;
}

async function setLocaRedirectorHeader() {
    if (VERBOSE) {
        debug_log(`setLocaRedirectorHeader`)
    }
    // requests with `token=...` as a GET variable (ie, from session link / search bar main without extension)
    // search without the redirect rule results in
    // 1. the server sees the token sent to kagi.com (we do also send a PP token), redirects to search
    // 2. the redirect gets the cookies stripeed anyway, so kagi.com ends up served. PP token present
    // in step 1 user is deanonymised.
    // A DNR redirect can be set to strip the `token` variable from the URL.
    // However, this causes an internal redirect that does not apply any of the rules above,
    // meaning the user sends their Cookie in the headers, resulting in deanonymisation.

    // We address this by "triangulating" requests with a `token` GET variable.
    // We filter only such requests, strip the token variable, and send them to an endpoint on a domain different than kagi.com
    // (in this case, the local extension storage)
    // This endpoint returns 303 redirect to kagi.com/search?non_token_variables
    // This causes the browser to finally apply the above filtering rules, getting around the limitations of DNR.

    // We write the redirect rule using regexes. The URLTransform approach does not seem to behave properly.
    // this should only be applied for the /search endpoint, since this is the one used for the Kagi session link
    const rules = {
        addRules: [{
            id: LOCAL_REDIRECTOR_ID,
            priority: 1,
            condition: {
                regexFilter: "^https?://kagi.com/search/?\\??(.*)[\\?|&](token=[^&]*)(.*)$", // match search queries including a `token` get variable
                resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"]
            },
            action: {
                type: "redirect",
                redirect: {
                    regexSubstitution: `${LOCAL_REDIRECTOR_URL}?\\1\\3&onion=0` // remove only the `token` get variable
                }
            }
        }, {
            id: ONION_LOCAL_REDIRECTOR_ID,
            priority: 1,
            condition: {
                regexFilter: "^https?://kagi2pv5bdcxxqla5itjzje2cgdccuwept5ub6patvmvn3qgmgjd6vid.onion/search/?\\??(.*)[\\?|&](token=[^&]*)(.*)$", // match search queries including a `token` get variable
                resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"]
            },
            action: {
                type: "redirect",
                redirect: {
                    regexSubstitution: `${LOCAL_REDIRECTOR_URL}?\\1\\3&onion=1` // remove only the `token` get variable
                }
            }
        }],
        removeRuleIds: [LOCAL_REDIRECTOR_ID, ONION_LOCAL_REDIRECTOR_ID]
    };

    await browser.declarativeNetRequest.updateDynamicRules(rules);
}

async function unsetLocaRedirectorHeader() {
    if (VERBOSE) {
        debug_log("unsetLocaRedirectorHeader");
    }
    await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [],
        removeRuleIds: [LOCAL_REDIRECTOR_ID, ONION_LOCAL_REDIRECTOR_ID]
    });
}

async function setHTMLIndexRedirector() {
    if (VERBOSE) {
        debug_log(`setHTMLIndexRedirector`)
    }
    const rules = {
        addRules: [{
            id: KAGI_HTML_SLASH_REDIRECT,
            priority: 1,
            condition: {
                urlFilter: `||${DOMAIN_PORT}/html/|`,
                resourceTypes: ["main_frame", "sub_frame"]
            },
            action: {
                type: "redirect",
                redirect: {
                    url: `https://${DOMAIN_PORT}/html`
                }
            }
        }, {
            id: ONION_HTML_SLASH_REDIRECT,
            priority: 1,
            condition: {
                urlFilter: `||${ONION_DOMAIN_PORT}/html/|`,
                resourceTypes: ["main_frame", "sub_frame"]
            },
            action: {
                type: "redirect",
                redirect: {
                    url: `http://${ONION_DOMAIN_PORT}/html`
                }
            }
        }],
        removeRuleIds: [KAGI_HTML_SLASH_REDIRECT, ONION_HTML_SLASH_REDIRECT]
    };

    await browser.declarativeNetRequest.updateDynamicRules(rules);
}

async function unsetHTMLIndexRedirector() {
    if (VERBOSE) {
        debug_log("unsetHTMLIndexRedirector");
    }
    await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [],
        removeRuleIds: [KAGI_HTML_SLASH_REDIRECT, ONION_HTML_SLASH_REDIRECT]
    });
}

async function setAuthorizationHeader(endpoint, token_tuple) {
    if (VERBOSE) {
        debug_log(`[${endpoint}] ${token_tuple[0].substring(0, 32)}`)
    }
    await unsetNoTokensRedirect(endpoint);
    const rules = compileHTTPAuthorizationRuleset(endpoint, token_tuple);
    await browser.declarativeNetRequest.updateDynamicRules(rules);
    // load the token tuple in local storage
    let { loaded_tokens } = await browser.storage.local.get({ "loaded_tokens": {} })
    loaded_tokens[endpoint] = token_tuple
    await browser.storage.local.set({ "loaded_tokens": loaded_tokens })
}

async function unsetAuthorizationHeader(endpoint) {
    await unsetNoTokensRedirect(endpoint);
    let rule_ids = compileHTTPAuthorizationRuleset(endpoint, ["placeholder", 0]).removeRuleIds;
    if (VERBOSE) {
        // debug_log(`unsetAuthorizationHeader: ${rule_ids} ${endpoint}`);
    }
    await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [],
        removeRuleIds: rule_ids
    });

    // recover token tuple from local storage
    let { loaded_tokens } = await browser.storage.local.get({ "loaded_tokens": {} })
    let token_tuple = false;
    if (endpoint in loaded_tokens) {
        token_tuple = loaded_tokens[endpoint]
        delete loaded_tokens[endpoint];
        await browser.storage.local.set({ "loaded_tokens": loaded_tokens });
    }
    return token_tuple;
}

async function setNoTokensRedirect(endpoint) {
    debug_log(`setNoTokensRedirect: ${endpoint}`);
    let resourceTypes = ["main_frame", "sub_frame", "xmlhttprequest", "csp_report", "font", "image", "media", "object", "other", "ping", "script", "stylesheet", "websocket"];
    if (IS_FIREFOX) {
        resourceTypes = resourceTypes.concat(["beacon", "imageset", "object_subrequest", "speculative", "web_manifest", "xml_dtd", "xslt"])
    } else {
        // chrome
        resourceTypes = resourceTypes.concat(["webbundle", "webtransport"])
    }
    const rules = {
        addRules: [
            {
                id: NO_TOKEN_REDIRECT_ID[endpoint],
                priority: 1,
                action: { type: "redirect", redirect: { url: NO_TOKEN_REDIRECT_URL } },
                condition: { urlFilter: endpoint, resourceTypes: resourceTypes }
            }
        ],
        removeRuleIds: [NO_TOKEN_REDIRECT_ID[endpoint]]
    };
    await browser.declarativeNetRequest.updateDynamicRules(rules);
}

async function unsetNoTokensRedirect(endpoint) {
    if (VERBOSE) {
        // debug_log(`unsetNoTokensRedirect: ${endpoint}`)
    }
    await browser.declarativeNetRequest.updateDynamicRules({
        addRules: [], removeRuleIds: [NO_TOKEN_REDIRECT_ID[endpoint]]
    });
}

export {
    setRefererRules,
    selfRemovingUnsetRefererHeadersListener,
    setAntiFingerprintingRules,
    unsetAntiFingerprintingRules,
    setNoTokensRedirect,
    setHTMLIndexRedirector,
    unsetHTMLIndexRedirector,
    setAuthorizationHeader,
    unsetAuthorizationHeader,
    setLocaRedirectorHeader,
    unsetLocaRedirectorHeader,
    range
};
