import {
    SCHEME,
    DOMAIN_PORT,
    ONION_SCHEME,
    ONION_DOMAIN_PORT
} from '../scripts/config.js'

import {
    getWWWAuthenticateHeader
} from '../scripts/privacypass.js'

// fetch query parameter
let $_GET = {};
if (document.location.toString().indexOf('?') !== -1) {
    const query = document.location
        .toString()
        .replace(/^.*?\?/, '')
        .replace(/#.*$/, '')
        .split('&');

    for (let i = 0, l = query.length; i < l; i++) {
        const aux = decodeURIComponent(query[i]).split('=');
        $_GET[aux[0]] = aux[1];
    }
}
// const url = document.querySelector("#url");
// url.textContent = window.location.href;
// console.log(window.location.href);
// url.textContent = $_GET['q'];

// detect whether onion domain reachable
let WA = await getWWWAuthenticateHeader(true);
const onion = (WA != "");

// perform search
let endpoint = "";
if (onion) {
    endpoint = `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/search`
    browser.runtime.sendMessage('onion_set_new_search_token');
} else {
    endpoint = `${SCHEME}://${DOMAIN_PORT}/search`
    browser.runtime.sendMessage('set_new_search_token');
}

// set a small delay to let the new token to be loaded
setTimeout(() => {
    window.location.replace(`${endpoint}?q=${$_GET['q']}`);
}, 100)