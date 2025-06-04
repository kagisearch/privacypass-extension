/*
 * Privacy Pass protocol implementation
 */

import init, * as kagippjs from "./kagippjs/kagippjs.js";

import {
  WWWA_ENDPOINT,
  ONION_WWWA_ENDPOINT,
  ISSUER_REQUEST_ENDPOINT,
  ONION_ISSUER_REQUEST_ENDPOINT,
  TOKENS_TO_STASH,
  VERBOSE,
} from './config.js'

import {
  debug_log
} from './debug_log.js'

import {
  get_kagi_session
} from './kagi_session.js'

import {
  FETCH_FAILED_ERROR,
  TOKEN_REQUEST_UNAUTHORIZED_ERROR,
  TOKEN_REQUEST_NO_SUBSCRIPTION_ERROR,
  TOKEN_REQUEST_UNSUPPORTED_SUBSCRIPTION_ERROR,
  UNEXPECTED_ERROR_FMT,
  OVER_QUOTA_ERROR
} from './errors.js'

// returns WWW-Authenticate header
async function getWWWAuthenticateHeader(onion = false) {
  if (VERBOSE) {
    debug_log(`getWWWAuthenticateHeader: onion = ${onion}`)
  }
  // get WWW-Authenticate HTTP header value
  let origin_wwwa_value = "";
  const endpoint = onion ? ONION_WWWA_ENDPOINT : WWWA_ENDPOINT;
  try {
    const resp = await fetch(endpoint, { method: "GET", headers: { 'X-Kagi-PrivacyPass-Client': 'true' } });
    origin_wwwa_value = resp.headers.get("WWW-Authenticate");
  } catch (ex) {
    if (onion) {
      // this will signal that WWWA could not fetch via .onion
      // the extension will then try normally.
      // if the failure is due to not being on Tor, this is the right path
      // if the failure is due to being on Tor but offline, then trying to fetch from kagi.com
      //   won't deanonymise anyway, and will result in the "are you online?" error message, also the right path
      return origin_wwwa_value;
    }
    throw FETCH_FAILED_ERROR;
  }
  return origin_wwwa_value;
}

// performs the token generation protocol
async function tokenGenerationProtocol(wwwa_value, onion = false) {
  if (VERBOSE) {
    debug_log(`tokenGenerationProtocol: ${wwwa_value}, onion = ${onion}`)
  }
  const nr = TOKENS_TO_STASH;
  const endpoint = onion ? ONION_ISSUER_REQUEST_ENDPOINT : ISSUER_REQUEST_ENDPOINT;
  let token_request_delay = 0.;
  let token_finalization_delay = 0.;

  // load WASM for Privacy Pass core library
  await init();

  // prepare batched TokenRequest
  token_request_delay = Date.now();
  const header_s = JSON.stringify({ header: wwwa_value, error: "" });
  const token_request_rv_s = await kagippjs.token_request(header_s, nr);
  const token_request_rv = JSON.parse(token_request_rv_s);
  const client_state_s = JSON.stringify(token_request_rv[0]);
  const token_request = token_request_rv[1]["token_request"];
  token_request_delay = Date.now() - token_request_delay;

  // send TokenRequest to Issuer
  const kagi_session = await get_kagi_session();
  let issuer_response = false;
  try {
    issuer_response = await fetch(endpoint, {
      method: "POST",
      body: token_request,
      headers: {
        "Content-Type": "application/private-token-request",
        "Authorization": kagi_session,
        'X-Kagi-PrivacyPass-Client': 'true',
      }
    });
  } catch (ex) {
    throw FETCH_FAILED_ERROR;
  }
  if (!issuer_response) {
    throw FETCH_FAILED_ERROR;
  }
  if (!issuer_response.ok) {
    const status = issuer_response.status;
    const body = await issuer_response.text();
    if (status == 401) {
      // 401 UNAUTHORIZED {"error_code": "not_logged_in"}
      throw TOKEN_REQUEST_UNAUTHORIZED_ERROR;
    } else if (status == 403) {
      if (body.includes("no_subscription")) {
        // 403 FORBIDDEN {"error_code": "no_subscription"}
        throw TOKEN_REQUEST_NO_SUBSCRIPTION_ERROR;
      }
      // 403 FORBIDDEN {"error_code": "unsupported_subscription"}
      throw TOKEN_REQUEST_UNSUPPORTED_SUBSCRIPTION_ERROR;
    } else if (status == 429) {
      // 429 TOO MANY REQUESTS
      throw OVER_QUOTA_ERROR;
    } else {
      throw UNEXPECTED_ERROR_FMT.replace("{ERROR}", `[${status}: ${body}]`);
    }
  }
  const token_response = await issuer_response.text();
  const token_response_s = JSON.stringify({
    token_response: token_response, error: ""
  });

  // finalise token generation
  token_finalization_delay = Date.now();
  const token_finalization_rv_s = await kagippjs.token_finalization(header_s, client_state_s, token_response_s);
  const token_finalization_rv = JSON.parse(token_finalization_rv_s);
  const tokens = token_finalization_rv["tokens"];
  token_finalization_delay = Date.now() - token_finalization_delay;
  if (VERBOSE) {
    const total_runtime = token_request_delay + token_finalization_delay;
    debug_log(`> Runtime for generationg ${TOKENS_TO_STASH} tokens: ${total_runtime}`);
  }
  return tokens;
}

export {
  getWWWAuthenticateHeader,
  tokenGenerationProtocol
};
