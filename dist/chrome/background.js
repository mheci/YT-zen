// YT-zen Extension Background Service Worker
// Handles asynchronous cross-origin fetches for SponsorBlock and oEmbed metadata

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GM_xmlhttpRequest") {
    const { method = "GET", url, headers = {}, data } = message.details;
    
    const fetchOptions = {
      method,
      headers: new Headers(headers)
    };
    if (method !== "GET" && method !== "HEAD" && data) {
      fetchOptions.body = data;
    }

    fetch(url, fetchOptions)
      .then(async (response) => {
        const text = await response.text();
        sendResponse({
          success: true,
          status: response.status,
          responseText: text
        });
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message
        });
      });
    return true; // Keep message channel open for async response
  }
});

// Extension installation first-run onboarding trigger
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open Options page on first install
    chrome.runtime.openOptionsPage();
  }
});
