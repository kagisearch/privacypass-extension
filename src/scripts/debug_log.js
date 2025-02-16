async function debug_log(msg) {
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
