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
            version: "3.6.0"
          }
        };

        window.GM_xmlhttpRequest = (details) => {
          const reqId = Math.random().toString(36).slice(2);
          let finished = false;
          const cleanup = () => {
            window.removeEventListener("YTZEN_XMLHTTPREQUEST_RESPONSE", onResponse);
          };
          const finish = () => {
            if (finished) return false;
            finished = true;
            cleanup();
            return true;
          };
          const onResponse = (ev) => {
            if (!ev || !ev.detail || ev.detail.id !== reqId) return;
            if (!finish()) return;
            if (ev.detail.success) {
              if (typeof details.onload === "function") {
                details.onload({
                  status: ev.detail.status,
                  responseText: ev.detail.responseText,
                  response: ev.detail.responseText,
                  text: () => ev.detail.responseText,
                  json: () => {
                    try { return JSON.parse(ev.detail.responseText); } catch(_) { return null; }
                  }
                });
              }
            } else if (typeof details.onerror === "function") {
              details.onerror(new Error(ev.detail.error || "Network error"));
            }
          };
          window.addEventListener("YTZEN_XMLHTTPREQUEST_RESPONSE", onResponse);
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
          return {
            abort: () => {
              if (!finish()) return;
              if (typeof details.onabort === "function") details.onabort();
            }
          };
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
