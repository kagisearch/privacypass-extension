import {
  update_extension_icon
} from '../scripts/icon.js'

const status_message_indicator = document.querySelector("#status-message-indicator")
const mode_group = document.querySelector("#pp-mode-form").elements["pp-mode"]

function parseMode(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

function update_indicator_opacity(enabled) {
  status_message_indicator.style.opacity = enabled ? 1 : 0.5;
}

async function is_enabled() {
  const { enabled } = await browser.storage.local.get({ 'enabled': true })
  mode_group.value = String(enabled);
  update_indicator_opacity(enabled !== false);
  await update_extension_icon(enabled);
}

async function set_enabled() {
  const mode = parseMode(mode_group.value);
  await browser.storage.local.set({ enabled: mode });
  browser.runtime.sendMessage('enabled_changed')
  update_indicator_opacity(mode !== false);
}

export {
  is_enabled,
  set_enabled
};
