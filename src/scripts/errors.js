// happens when the extension tries to load the next token but there are none left:
export const FAILED_LOADING_NEXT_TOKEN_ERROR = "<strong>You run out of tokens</strong><br/>Click \"Generate tokens\" to generate more.";

// happens when you are over your quota and therefore generate 0 tokens
export const OVER_QUOTA_ERROR = "<strong>Monthly token generation limit reached (4x per Account)</strong><br/>Each Kagi account is limited to generating Privacy Pass tokens up to 4x per month. If you use Privacy Pass on other devices or browsers, they may still have available tokens.";

// /pp/gettokens replies 401
export const TOKEN_REQUEST_UNAUTHORIZED_ERROR = "<strong>Token generation unauthorized</strong><br/>Your session has expired, and Privacy Pass couldn't generate more tokens. Please sign in to Kagi and click \"Generate tokens\" to proceed.";

// /pp/gettokens replies 403, {"error_code": "no_subscription"}
export const TOKEN_REQUEST_NO_SUBSCRIPTION_ERROR = "<strong>Token generation unauthorized</strong><br/>Privacy Pass requires a paid subscription with unlimited searches. Please upgrade your plan to access it. For more information, visit our <a href=\"https://help.kagi.com/kagi/privacy/privacy-pass.html\" target=\"_blank\" rel=\"noopener noreferrer\">help page</a>.";

// /pp/gettokens replies 403, {"error_code": "unsupported_subscription"}
export const TOKEN_REQUEST_UNSUPPORTED_SUBSCRIPTION_ERROR = "<strong>Token generation unauthorized</strong><br/>Privacy Pass requires a paid subscription with unlimited searches. Please upgrade your plan to access it. For more information, visit our <a href=\"https://help.kagi.com/kagi/privacy/privacy-pass.html\" target=\"_blank\" rel=\"noopener noreferrer\">help page</a>.";

// the fetch for /pp/wwwa or /pp/gettokens fails
export const FETCH_FAILED_ERROR = "<strong>Token generation failed</strong><br/>Are you online?";

// when no session cookie is found
export const NO_KAGI_SESSION_ERROR = "<strong>Token generation failed</strong><br/>Sign in to Kagi in a non-incognito window and click \"Generate tokens\". If you're already signed in, simply click \"Generate tokens\" to proceed.";

// when the cookie jar is inaccessible (Tor Browser specific)
export const NO_COOKIE_JAR_ACCESS = "<strong>Token generation failed</strong><br/>Are you using the Tor Browser? If so, load your <a href=\"https://help.kagi.com/kagi/privacy/private-browser-sessions.html\" target=\"_blank\" rel=\"noopener noreferrer\">Session Link</a> in the extension's settings menu. Then click \"Generate tokens\" to proceed.";

// the extension UI sends an unrecognized command to the background service worker
export const UI_COMMAND_NOT_RECOGNIZED_ERROR = "<strong>Command not recognized</strong><br/>This error should not have happened. Please contact support@kagi.com with the steps to reproduce it. Thank you for your help.";

// some unexpected exception is thrown
// use the following as UNEXPECTED_ERROR_FMT.replace("{ERROR}", error_str); // where error_str contains the error as a string.
export const UNEXPECTED_ERROR_FMT = "<strong>An unexpected error happened</strong><br/>Please contact support@kagi.com with the error code - {ERROR} - and if possible, the steps to reproduce it. Thank you for your help."
