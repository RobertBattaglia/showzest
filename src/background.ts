try {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      chrome.scripting.executeScript({
        target: {tabId},
        files: ['build/script.js'],
      })
    }
  })
} catch(e) {
  console.error(e)
}
