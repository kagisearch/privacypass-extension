async function clearState() {
    await browser.storage.local.clear();
    browser.runtime.sendMessage("enabled_changed");
}

export {
    clearState
};
