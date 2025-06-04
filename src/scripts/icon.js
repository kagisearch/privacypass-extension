async function update_extension_icon(enabled) {
  if (typeof enabled === "undefined") {
    enabled = (await browser.storage.local.get({ 'enabled': false }))['enabled'];
  }
  const path = enabled ? "enabled" : "disabled";
  await chrome.action.setIcon({
    path: {
      16: `../images/icons/${path}/icon-16.png`,
      32: `../images/icons/${path}/icon-32.png`,
      64: `../images/icons/${path}/icon-64.png`,
      128: `../images/icons/${path}/icon-128.png`
    }
  });
}

export {
  update_extension_icon
}
