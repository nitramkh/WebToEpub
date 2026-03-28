"use strict";

/**
 * Functions specific to Firefox version of plug-in
 */
class Firefox { // eslint-disable-line no-unused-vars
    /**
     * @private
     */
    constructor() {}

    /**
     * `fetch()` calls on Firefox include an origin header which makes some
     * sites fail with a CORS violation. We need to use a `webRequest` to remove
     * origin from header.
     * 
     * @param { browser.webRequest._OnBeforeSendHeadersDetails } e The request details containing the original headers.
     * @returns { browser.webRequest.BlockingResponse } Object containing the modified headers.
     * 
     * @private
     */
    static filterHeaders(e) {
        return { requestHeaders: e.requestHeaders.filter(
            h => ((h.name.toLowerCase() !== "origin")
                || !h.value.startsWith("moz-extension://"))
        ) };
    }

    /**
     * Start listener which intercepts web requests and removes origin headers.
     * 
     * @returns { void } Changes are made directly web requests.
     * 
     * @public
     */
    static startWebRequestListeners() {
        browser.webRequest.onBeforeSendHeaders.addListener(
            Firefox.filterHeaders,
            { urls: ["<all_urls>"] },
            ["blocking", "requestHeaders"]
        );
    }

    /**
     * Inject the dom extraction content script into the tab corresponding to
     * `tabId`.
     * 
     * @param { number | undefined } tabId The tab to inject into.
     * @returns { void } Response is provided via event hooks.
     * 
     * @public
     */
    static injectContentScript(tabId) {
        chrome.tabs.executeScript(tabId, { file: "js/ContentScript.js", runAt: "document_end" },
            function(result) {   // eslint-disable-line no-unused-vars
                if (chrome.runtime.lastError) {
                    util.log(chrome.runtime.lastError.message);
                }
            }
        );
    }
}

