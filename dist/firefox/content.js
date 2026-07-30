// YT-zen content script wrapper
// Injects the unified userscript into YouTube's page context with a GM API polyfill layer

(async function () {
  "use strict";

  // Prevent double loading
  if (window.__YTZEN_INJECTED__) return;
  window.__YTZEN_INJECTED__ = true;

  // Retrieve existing configurations from extension storage
  chrome.storage.local.get(null, async (settings) => {
    // Read the userscript code from the extension bundle
    const userScriptUrl = chrome.runtime.getURL("yt-zen.user.js");
    let userScriptText = "";
    try {
      const r = await fetch(userScriptUrl);
      userScriptText = await r.text();
    } catch (e) {
      console.error("[YT-zen] Failed to fetch userscript bundle:", e);
      return;
    }

    // Build the GM API polyfill layer
    const polyfill = `
      (() => {
        const _settings = ${JSON.stringify(settings)};
        
        window.unsafeWindow = window;
        
        window.GM_getValue = (key, def) => {
          if (key in _settings) return _settings[key];
          return def;
        };
        
        window.GM_setValue = (key, val) => {
          _settings[key] = val;
          // Dispatch a custom event to notify content script of the write
          window.dispatchEvent(new CustomEvent("YTZEN_SET_VALUE", {
            detail: { key, val }
          }));
        };
        
        window.GM_deleteValue = (key) => {
          delete _settings[key];
          window.dispatchEvent(new CustomEvent("YTZEN_DELETE_VALUE", {
            detail: { key }
          }));
        };
        
        window.GM_listValues = () => Object.keys(_settings);
        
        window.GM_registerMenuCommand = (name, fn) => {
          // No-op inside extension web pages (options are in popup/options page)
        };
        
        window.GM_addStyle = (css) => {
          const style = document.createElement("style");
          style.textContent = css;
          (document.head || document.documentElement).appendChild(style);
          return style;
        };
        
        window.GM_info = {
          script: {
            name: "YT-zen",
            version: "3.5.8"
          }
        };

        window.GM_xmlhttpRequest = (details) => {
          const reqId = Math.random().toString(36).slice(2);
          // Bridge to background worker for cross-origin fetches (CORS bypass)
          window.dispatchEvent(new CustomEvent("YTZEN_XMLHTTPREQUEST", {
            detail: {
              id: reqId,
              details: {
                method: details.method || "GET",
                url: details.url,
                headers: details.headers,
                data: details.data
              }
            }
          }));
          
          // Capture asynchronous response
          const onResponse = (ev) => {
            if (ev.detail.id === reqId) {
              window.removeEventListener("YTZEN_XMLHTTPREQUEST_RESPONSE", onResponse);
              if (e.detail.success) {
                if (typeof details.onload === "function") {
                  details.onload({
                    status: e.detail.status,
                    responseText: e.detail.responseText,
                    response: e.detail.responseText,
                    text: () => e.detail.responseText,
                    json: () => {
                      try { return JSON.parse(e.detail.responseText); } catch(_) { return null; }
                    }
                  });
                }
              } else if (typeof details.onerror === "function") {
                details.onerror(new Error(e.detail.error));
              }
            }
          };
          window.addEventListener("YTZEN_XMLHTTPREQUEST_RESPONSE", onResponse);
        };
      })();
    `;

    // Inject combined polyfill + userscript
    const script = document.createElement("script");
    script.textContent = polyfill + "\n" + userScriptText;
    (document.head || document.documentElement).appendChild(script);
    script.remove(); // Clean up tag immediately
  });

  // Listen to write commands from the injected script page context
  window.addEventListener("YTZEN_SET_VALUE", (e) => {
    const { key, val } = e.detail;
    const obj = {};
    obj[key] = val;
    chrome.storage.local.set(obj);
  });

  window.addEventListener("YTZEN_DELETE_VALUE", (e) => {
    const { key } = e.detail;
    chrome.storage.local.remove(key);
  });

  // Listen to cross-origin fetch commands from page context
  window.addEventListener("YTZEN_XMLHTTPREQUEST", (e) => {
    const { id, details } = e.detail;
    chrome.runtime.sendMessage({
      type: "GM_xmlhttpRequest",
      details
    }, (response) => {
      window.dispatchEvent(new CustomEvent("YTZEN_XMLHTTPREQUEST_RESPONSE", {
        detail: {
          id,
          url: details.url,
          success: response && response.success,
          status: response && response.status,
          responseText: response && response.responseText,
          error: response && response.error
        }
      }));
    });
  });

  // Listen to settings synchronization across tabs
  chrome.storage.onChanged.addListener((changes) => {
    // Notify the page context of external configuration updates
    for (let key in changes) {
      window.dispatchEvent(new CustomEvent("YTZEN_SET_VALUE_SYNC", {
        detail: { key, val: changes[key].newValue }
      }));
    }
  });
})();
