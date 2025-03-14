import {
    VERBOSE,
} from './config.js'

async function debug_log(msg) {
    // only log activity when extension built as "VERBOSE"
    // this is exclusively a debug feature
    if (!VERBOSE) {
        return;
    }
    let { log } = await browser.storage.local.get({ 'log': [] });
    const evt = {
        'level': 'info',
        'message': msg,
        'timestamp': (new Date()).getTime(),
    }
    log.push(evt)
    await browser.storage.local.set({ 'log': log });
    console.log(msg)
}

export {
    debug_log
};
