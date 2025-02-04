const enabled_checkbox = document.querySelector("#kagipp-enabled")

async function is_enabled() {
  if (!browser.storage) {
    return;
  }
  const { enabled } = await browser.storage.local.get({ 'enabled': false })
  enabled_checkbox.checked = enabled;
}

async function set_enabled() {
  if (!browser.storage || !browser.runtime) {
    return;
  }
  // the UI determines if it should be enabled or not, not background.js
  const enabled = enabled_checkbox.checked;
  await browser.storage.local.set({ 'enabled': enabled })
  browser.runtime.sendMessage('enabled_changed')
}

export {
  is_enabled,
  set_enabled
};
