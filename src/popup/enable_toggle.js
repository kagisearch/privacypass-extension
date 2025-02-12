import {
  update_extension_icon
} from '../scripts/icon.js'

const enabled_checkbox = document.querySelector("#kagipp-enabled")
const status_message_indicator = document.querySelector("#status-message-indicator")

async function update_indicator_opacity(enabled) {
  if (!status_message_indicator) {
    return;
  }
  if (typeof enabled === "undefined") {
    const { _enabled } = await browser.storage.local.get({ 'enabled': false })
    enabled = _enabled;
  }
  if (enabled) {
    status_message_indicator.style.opacity = 1;
  } else {
    status_message_indicator.style.opacity = 0.5;
  }
}

async function is_enabled() {
  if (!browser.storage) {
    return;
  }
  const { enabled } = await browser.storage.local.get({ 'enabled': false })
  enabled_checkbox.checked = enabled;
  await update_indicator_opacity(enabled);
}

async function set_enabled() {
  if (!browser.storage || !browser.runtime) {
    return;
  }
  // the UI determines if it should be enabled or not, not background.js
  const enabled = enabled_checkbox.checked;
  await browser.storage.local.set({ 'enabled': enabled })
  browser.runtime.sendMessage('enabled_changed')
  await update_indicator_opacity(enabled);
}

export {
  is_enabled,
  set_enabled
};
