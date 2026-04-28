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
    ACCEPT_OVERRIDES,
    ANONYMIZING_RULES_OFFSET,
    ANONYMIZING_RULESET,
    REFERER_RULESET,
    NO_TOKEN_REDIRECT_URL,
    LOCAL_REDIRECTOR_URL,
    LOCAL_REDIRECTOR_ID,
    HTTP_AUTHORIZATION_ID,
    UNCLASSIFIED_TAB_CATCHER_ID
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

function compileHeaderRuleset(ruleset, offset, ruleEndpointPath = "/", rulePriority = 1, subDomain = "") {
    let add_rules = [];
    let nrules = offset; // rule separation
    const full_domain_port = (subDomain != "") ? `${subDomain}.${DOMAIN_PORT}` : DOMAIN_PORT;
    const full_onion_domain_port = (subDomain != "") ? `${subDomain}.${ONION_DOMAIN_PORT}` : ONION_DOMAIN_PORT;

    // note, using ||kagi.com will cover subdomains such as translate.kagi.com. this is useful for blanket rules such as anonymisation.
    add_rules.push(headerRule(ruleset, `||${full_domain_port}${ruleEndpointPath}`, ++nrules, rulePriority, true));
    add_rules.push(headerRule(ruleset, `||${full_onion_domain_port}${ruleEndpointPath}`, ++nrules, rulePriority, true));

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
    ...ACCEPT_OVERRIDES.map(o => compileHeaderRuleset({ Accept: o.accept }, o.id, o.path, 2, o.subdomain ?? "")),
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
// leak the token to the server before the cookie-stripping redirect kicks in.
// We "triangulate": redirect such requests to an extension-local page that re-navigates to the
// original URL with `token` stripped, forcing DNR to re-apply all header rules on the second hop.
// The full original URL is passed via the fragment so the local page can parse and clean it.
const localRedirectorRules = {
    addRules: [{
        id: LOCAL_REDIRECTOR_ID,
        priority: 1,
        condition: {
            regexFilter: "^.*[?&]token=.*$",
            requestDomains: REDEMPTION_REQUEST_DOMAINS,
            resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"]
        },
        action: {
            type: "redirect",
            redirect: {
                regexSubstitution: `${LOCAL_REDIRECTOR_URL}#\\0`
            }
        }
    }],
    removeRuleIds: [LOCAL_REDIRECTOR_ID]
};

// Catches requests from tabs we haven't yet classified as incog or not
function unclassifiedTabCatcherRule(knownTabIds) {
    return {
        addRules: [{
            id: UNCLASSIFIED_TAB_CATCHER_ID,
            priority: 3,
            condition: {
                regexFilter: "^.*$",
                requestDomains: REDEMPTION_REQUEST_DOMAINS,
                resourceTypes: ["main_frame", "sub_frame"],
                excludedTabIds: knownTabIds
            },
            action: {
                type: "redirect",
                redirect: {
                    regexSubstitution: `${LOCAL_REDIRECTOR_URL}#\\0`
                }
            }
        }],
        removeRuleIds: [UNCLASSIFIED_TAB_CATCHER_ID]
    };
}

const generalRules = [antiFingerprintingRules, localRedirectorRules].reduce(mergeRules);

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
    unclassifiedTabCatcherRule,
    range
};
