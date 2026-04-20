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
    REFERER_RULESET,
    NO_TOKEN_REDIRECT_URL,
    LOCAL_REDIRECTOR_URL,
    LOCAL_REDIRECTOR_ID,
    HTTP_AUTHORIZATION_ID,
    ONION_LOCAL_REDIRECTOR_ID
} from "./anonymization.js";

import {
    IS_FIREFOX,
    DOMAIN_PORT,
    ONION_DOMAIN_PORT,
    REDEMPTION_ENDPOINT_REGEX,
    REDEMPTION_REQUEST_DOMAINS,
} from './config.js'

// --- general utilities


function headerRule(headers, endpoint, ruleId, rulePriority, allResourceTypes = false) {
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
            requestHeaders: Object.entries(headers).map(([header, value]) =>
                value ? { header, operation: "set", value } : { header, operation: "remove" }
            )
        },
        condition: {
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
    add_rules.push(headerRule(ruleset, endpoint, ++nrules, rulePriority, true));
    add_rules.push(headerRule(ruleset, onion_endpoint, ++nrules, rulePriority, true));

    let rules = {
        addRules: add_rules,
        removeRuleIds: range(nrules - offset, offset + 1)
    };

    return rules;
};

function mergeRules(a, b) {
    return {
        addRules: [...a.addRules, ...b.addRules],
        removeRuleIds: [...a.removeRuleIds, ...b.removeRuleIds]
    };
}

const antiFingerprintingRules = [
    compileHeaderRuleset({ ...ANONYMIZING_RULESET, ...REFERER_RULESET }, ANONYMIZING_RULES_OFFSET),
    // just for /socket/* endpoints, force Accept: "text/event-stream"
    compileHeaderRuleset({ Accept: "text/event-stream" }, ACCEPT_EVENT_STREAM_OFFSET, "socket/", 2),
    // support for quick answer and summarize document from search results page
    compileHeaderRuleset({ Accept: "application/vnd.kagi.stream" }, ACCEPT_QUICK_ANSWER_OFFSET, "mother/context", 2),
    compileHeaderRuleset({ Accept: "application/vnd.kagi.stream" }, ACCEPT_QUICK_ANSWER_DOC_OFFSET, "mother/summarize_document", 2),
    // just for translate.kagi.com/?/translate/ to accept "application/json" and turnstile to */*
    compileHeaderRuleset({ Accept: "application/json" }, ACCEPT_TRANSLATE_JSON_OFFSET, "?/translate", 2, "translate"),
    compileHeaderRuleset({ Accept: "*/*" }, ACCEPT_TRANSLATE_TURSNTILE_OFFSET, "api/auth/turnstile", 2, "translate"),
].reduce(mergeRules);


// --- sets HTTP Authorization header

function authorizationRule(token_tuple) {
    const [token, token_date] = token_tuple;
    return {
        addRules: [{
            id: HTTP_AUTHORIZATION_ID,
            priority: 2,
            action: {
                type: "modifyHeaders",
                requestHeaders: [
                    { header: "X-Kagi-PrivacyPass-Client", operation: "set", value: "true" },
                    { header: "Authorization", operation: "set", value: `PrivateToken token="${token}"` },
                ]
            },
            condition: {
                regexFilter: REDEMPTION_ENDPOINT_REGEX,
                requestDomains: REDEMPTION_REQUEST_DOMAINS,
                resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"]
            }
        }],
        removeRuleIds: [HTTP_AUTHORIZATION_ID]
    };
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
const localRedirectorRules = {
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
                regexSubstitution: `${LOCAL_REDIRECTOR_URL}?\\1\\3` // remove only the `token` get variable
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

const htmlIndexRedirectorRules = {
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

const generalRules = [antiFingerprintingRules, localRedirectorRules, htmlIndexRedirectorRules].reduce(mergeRules);

const noTokensRedirectRule = {
    addRules: [{
        id: HTTP_AUTHORIZATION_ID,
        priority: 1,
        action: { type: "redirect", redirect: { url: NO_TOKEN_REDIRECT_URL } },
        condition: {
            regexFilter: REDEMPTION_ENDPOINT_REGEX,
            requestDomains: REDEMPTION_REQUEST_DOMAINS,
            resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"]
        }
    }],
    removeRuleIds: [HTTP_AUTHORIZATION_ID]
};

export {
    generalRules,
    mergeRules,
    authorizationRule,
    noTokensRedirectRule,
    range
};
