
async function countTokens() {
    // only count remaining tokens, don't account for tokens loaded into header
    const { ready_tokens } = await chrome.storage.local.get({ 'ready_tokens': [] })
    return ready_tokens.length
}

function beginningOfPriorEpoch() {
    // returns the first day of prior month
    let epoch_beginning = new Date.now();
    // sets to last day of previous month
    epoch_beginning.setDate(0);
    // sets to first day of previous month
    epoch_beginning.setDate(1);
    return epoch_beginning.getTime();
}

export {
    countTokens,
    beginningOfPriorEpoch
};
