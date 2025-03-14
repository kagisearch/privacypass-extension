import {
    DEBUG_LOG_ACTIVITY,
} from './config.js'

async function debug_log(msg) {
    console.log(msg)
    // only log activity when extension built as "VERBOSE"
    // this is exclusively a debug feature
    if (!DEBUG_LOG_ACTIVITY) {
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
}

export {
    debug_log
};
