import {
    SCHEME,
    DOMAIN_PORT,
    ONION_SCHEME,
    ONION_DOMAIN_PORT
} from '../scripts/config.js'

let $_GET = new URLSearchParams(location.search);
let endpoint = `${SCHEME}://${DOMAIN_PORT}/search`;

if ($_GET.has("onion")) {
    $_GET.delete("onion");
    endpoint = `${ONION_SCHEME}://${ONION_DOMAIN_PORT}/search`
}

location = `${endpoint}?${$_GET}`;
