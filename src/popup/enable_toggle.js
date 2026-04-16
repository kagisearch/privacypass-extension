import {
  update_extension_icon
} from '../scripts/icon.js'

const enabled_checkbox = document.querySelector("#kagipp-enabled")
const status_message_indicator = document.querySelector("#status-message-indicator")

function update_indicator_opacity(enabled) {
  status_message_indicator.style.opacity = enabled ? 1 : 0.5;
}

async function is_enabled() {
  const { enabled } = await browser.storage.local.get({ 'enabled': false })
  enabled_checkbox.checked = enabled;
  update_indicator_opacity(enabled);
  await update_extension_icon(enabled);
}

async function set_enabled() {
  // the UI determines if it should be enabled or not, not background.js
  const enabled = enabled_checkbox.checked;
  await browser.storage.local.set({ 'enabled': enabled })
  browser.runtime.sendMessage('enabled_changed')
  update_indicator_opacity(enabled);
}

export {
  is_enabled,
  set_enabled
};
