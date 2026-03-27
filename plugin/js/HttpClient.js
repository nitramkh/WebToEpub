/*
 * Makes HTML calls using Fetch API.
 */

"use strict";

class FetchErrorHandler {
    /**
     * @public
     */
    constructor() {  }

    /**
     * Get the localized text message to put in the cancel button.
     * 
     * @param { UrlString } url The url of the image.
     * @param { string | number } error The error code or message.
     * @returns { string } The fail message.
     * 
     * @protected
     */
    makeFailMessage(url, error) {
        return UIText.Error.htmlFetchFailed(url, error);
    }

    /**
     * Make a UI message for retrying a fetch.
     * 
     * @param { UrlString } url The url which failed.
     * @param { number } error The error it failed with.
     * 
     * @private
     */
    makeFailCanRetryMessage(url, error) {
        return this.makeFailMessage(url, error) + " " +
            UIText.Warning.httpFetchCanRetry;
    }

    /**
     * Get localized text to populate cancel button with.
     * 
     * FIXME: Why have this and the public static clone?
     * 
     * @returns { string } The localized text.
     * 
     * @protected
     */
    getCancelButtonText() {
        return UIText.Common.cancel;
    }

    /**
     * Get localized text to populate cancel button with.
     * 
     * @returns { string } The localized text.
     * 
     * @public
     */
    static cancelButtonText() {
        return UIText.Common.cancel;
    }

    /**
     * Make a rejected promise with localized error message.
     * 
     * @param { UrlString } url The url which failed.
     * @param { Error } error The error it failed with.
     * @returns { Promise<never> } Rejected promise with a localized error message.
     * 
     * @throws { Error } The localized error.
     * 
     * @public
     */
    onFetchError(url, error) {
        return Promise.reject(new Error(this.makeFailMessage(url, error.message)));
    }

    /**
     * Determine what to do on response error and do it.
     * 
     * @template { FetchResponseHandler } T The type of response handler to use; needed to determine return type.
     * @param { UrlString } url The url which failed.
     * @param { WrapFetchOptions & { responseHandler: T } } wrapOptions Optional options
     * @param { Response } response The failed response.
     * @param { string } [errorMessage] Optionally the a error message to use.
     * @returns { Promise<Awaited<ReturnType<T["extractContentFromResponse"]>>> } A promise which either resolves to a retry; or a rejection with the error.
     * 
     * @throws { TypeError | RangeError | Error } `this.retryFetch`
     * @throws { TypeError | RangeError | Error } `this.promptUserForRetry`
     * @throws { Error } The response error if retry is not performed.
     * 
     * @public
     */
    onResponseError(url, wrapOptions, response, errorMessage) {
        let failError;

        if (errorMessage) {
            failError = new Error(errorMessage);
        } else {
            failError = new Error(this.makeFailMessage(response.url, response.status));
        }

        let retry = FetchErrorHandler.getAutomaticRetryBehaviourForStatus(response);

        if (retry.retryDelay.length === 0) {
            return Promise.reject(failError);
        }

        if (wrapOptions.retry === undefined) {
            wrapOptions.retry = retry;
            return this.retryFetch(url, wrapOptions);
        }

        if (0 < wrapOptions.retry.retryDelay.length) {
            return this.retryFetch(url, wrapOptions);
        }

        if (wrapOptions.retry.promptUser) {
            return this.promptUserForRetry(url, wrapOptions, response, failError);
        } else {
            return Promise.reject(failError);
        }
    }

    /**
     * Show a prompt to user asking whether to retry fetch.
     * 
     * @template { FetchResponseHandler } T The type of response handler to use; needed to determine return type.
     * @param { UrlString } url The url to refetch.
     * @param { WrapFetchOptions & { responseHandler: T } } wrapOptions Optional options.
     * @param { Response } response The failed response.
     * @param { Error } failError The reason the previous fetch failed.
     * @returns { Promise<Awaited<ReturnType<T["extractContentFromResponse"]>>> } A promise which resolves either to the response of the retry; or rejects with the original error.
     * 
     * @throws { TypeError | RangeError | Error } `HttpClient.wrapFetchImpl`
     * @throws { Error } If user chooses to not retry.
     * 
     * @private
     */
    promptUserForRetry(url, wrapOptions, response, failError) {
        let msg;

        if (wrapOptions.retry.HTTP === 403) { 
            msg = new Error(UIText.Warning.warning403ErrorResponse(new URL(response.url).hostname) + this.makeFailCanRetryMessage(url, response.status));
        } else {
            msg = new Error(new Error(this.makeFailCanRetryMessage(url, response.status)));
        }

        let cancelLabel = this.getCancelButtonText();

        return new Promise((resolve, reject) => {
            if (wrapOptions.retry.HTTP === 403) {
                msg.openurl = response.url;
                msg.blockurl = url;
            }

            msg.retryAction = () => resolve(HttpClient.wrapFetchImpl(url, wrapOptions));
            msg.cancelAction = () => reject(failError);
            msg.cancelLabel = cancelLabel;

            ErrorLog.showErrorMessage(msg);
        });
    }

    /**
     * Attempt to refetch after waiting configured amount of time.
     * 
     * @template { FetchResponseHandler } T The type of response handler to use; needed to determine return type.
     * @param { UrlString } url The url to refetch.
     * @param { WrapFetchOptions & { responseHandler: T } } wrapOptions Optional options.
     * @returns { Promise<Awaited<ReturnType<T["extractContentFromResponse"]>>> } The found response.
     * 
     * @throws { TypeError | RangeError | Error } `HttpClient.wrapFetchImpl`
     * 
     * @private
     */
    async retryFetch(url, wrapOptions) {
        let delayBeforeRetry = wrapOptions.retry.retryDelay.pop() * 1000;

        await util.sleep(delayBeforeRetry);

        return HttpClient.wrapFetchImpl(url, wrapOptions);
    }

    /**
     * Determine what response to have to a response status.
     * 
     * FIXME: The types for this can be better in relation to the 999 custom.
     * 
     * @param { Response & { retryDelay: number[] | null | undefined } } response The failed response.
     * @returns { RetryBehavior } The decided behavior.
     * 
     * @private
     */
    static getAutomaticRetryBehaviourForStatus(response) {
        // Seconds to wait before each retry (note: order is reversed).
        let retryDelay = [120, 60, 30, 15];

        switch (response.status) {
            case 403:
                return { retryDelay: [1], promptUser: true, HTTP: 403 };
            case 429:
                FetchErrorHandler.show429Error(response);
                return { retryDelay: retryDelay, promptUser: true };
            case 445:
            // Random Unique exception thrown on Webnovel/Qidian. Not part of w3 spec...
                return { retryDelay: retryDelay, promptUser: false };
            case 509:
            // Server asked for rate limiting.
                return { retryDelay: retryDelay, promptUser: true };
            case 500:
            // Is fault at server, retry might clear.
                return { retryDelay: retryDelay, promptUser: false };
            case 502: 
            case 503: 
            case 504:
            case 520:
            case 522:
            // Intermittent fault.
                return { retryDelay: retryDelay, promptUser: true };
            case 524:
            // Cloudflare random error.
                return { retryDelay: [1], promptUser: true };
            case 999:
            /*
             * Custom WebToEpub error (some api's fail and a few seconds later
             * it is a success).
             */
                return { retryDelay: response.retryDelay, promptUser: false };
            default:
            // It's dead Jim :(
                return { retryDelay: [], promptUser: false };
        }
    }

    /**
     * Show UI alert to user for 429 error. Note that this does not actually
     * check if the response was 429, it just trusts you.
     * 
     * @param { Response } response The response which gave 429.
     * @returns { void } Actions are taken on the UI.
     * 
     * @private
     * 
     * @see [MDN - 429 - Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429)
     */
    static show429Error(response) {
        let host = new URL(response.url).hostname;

        if (!FetchErrorHandler.rateLimitedHosts.has(host)) {
            FetchErrorHandler.rateLimitedHosts.add(host);
            alert(UIText.Warning.warning429ErrorResponse(host));
        }
    }
}

/**
 * @type { Set<HostnameString> }
 */
FetchErrorHandler.rateLimitedHosts = new Set();

class FetchImageErrorHandler extends FetchErrorHandler { // eslint-disable-line no-unused-vars
    /**
     * @param { UrlString } parentPageUrl The url of the page which the image is contained on.
     * 
     * @public
     */
    constructor(parentPageUrl) {
        super();
        this.parentPageUrl = parentPageUrl;
    }

    /**
     * Get the localized text message to put in the cancel button.
     * 
     * @param { UrlString } url The url of the image.
     * @param { string | number } error The error code or message.
     * @returns { string } The fail message.
     * 
     * @protected
     */
    makeFailMessage(url, error) {
        return UIText.Error.imageFetchFailed(url, this.parentPageUrl, error);
    }

    /**
     * Get the localized text message to put in the cancel button.
     * 
     * @returns { string } The text to put in the cancel button.
     * 
     * @protected
     */
    getCancelButtonText() {
        return UIText.Common.skip;
    }
}

/*
 * Makes HTML calls using Fetch API.
 */
class HttpClient {
    /**
     * @private
     */
    constructor() {  }

    /**
     * Make default options for `fetch`.
     * 
     * @returns { RequestInit } The created options.
     */
    static makeOptions() {
        return { credentials: "include" };
    }

    /**
     * Generic fetch function for making XHR requests.
     * 
     * @param { UrlString } url The url to fetch.
     * @param { Partial<Omit<WrapFetchOptions, "responseHandler">> } [wrapOptions] Optional options.
     * @returns { Promise<FetchResponseHandler> } Promise which resolves to the response.
     * 
     * @throws { TypeError | RangeError | Error } `this.wrapFetchImpl`
     * 
     * @public
     */
    static wrapFetch(url, wrapOptions) {
        if (wrapOptions == null) {
            wrapOptions = {
                errorHandler: new FetchErrorHandler()
            };
        }

        if (wrapOptions.errorHandler == null) {
            wrapOptions.errorHandler = new FetchErrorHandler();
        }

        /**
         * FIXME: Is it intentional to not allow providing a "custom"
         * responseHandler here?
         */
        wrapOptions.responseHandler = new FetchResponseHandler();

        if (wrapOptions.makeTextDecoder != null) {
            wrapOptions.responseHandler.makeTextDecoder = wrapOptions.makeTextDecoder;
        }
        
        return HttpClient.wrapFetchImpl(url, wrapOptions);
    }

    /**
     * Shorthand function for fetching a page as html.
     * 
     * @param { UrlString } url The url to fetch.
     * @returns { Promise<FetchHtmlResponseHandler> } A promise which resolves to the found content html.
     * 
     * @throws { TypeError | RangeError | Error } `this.wrapFetchImpl`
     * 
     * @public
     */
    static fetchHtml(url) {
        /** @type { Partial<WrapFetchOptions> & { responseHandler: FetchHtmlResponseHandler} } */
        let wrapOptions = {
            responseHandler: new FetchHtmlResponseHandler()
        };

        // FIXME: Should this be calling wrapFetch instead?
        return HttpClient.wrapFetchImpl(url, wrapOptions);
    }

    /**
     * Shorthand function for fetching a page as json.
     * 
     * @param { UrlString } url The url to fetch.
     * @param { RequestInit & { parser: Parser | null | undefined } } [fetchOptions] Optional options.
     * @returns { Promise<FetchJsonResponseHandler> } A promise which resolves to the found content json.
     * 
     * @throws { TypeError | RangeError | Error } `this.wrapFetchImpl`
     * 
     * @public
     */
    static fetchJson(url, fetchOptions) {
        let parser = fetchOptions?.parser;
        delete fetchOptions?.parser;

        /** @type { Partial<WrapFetchOptions> & { responseHandler: FetchJsonResponseHandler } } */
        let wrapOptions = {
            responseHandler: new FetchJsonResponseHandler(),
            fetchOptions: /** @type { RequestInit } */ (fetchOptions),
            parser: parser
        };

        return HttpClient.wrapFetchImpl(url, wrapOptions);
    }

    /**
     * Shorthand function for fetching a page as text.
     * 
     * @param { UrlString } url The url to fetch.
     * @returns { Promise<string> } A promise which resolves to the found content text.
     * 
     * @throws { TypeError | RangeError | Error } `this.wrapFetchImpl`
     * 
     * @public
     */
    static fetchText(url) {
        /** @type { Partial<WrapFetchOptions> & { responseHandler: FetchTextResponseHandler } } */
        let wrapOptions = {
            responseHandler: new FetchTextResponseHandler(),
        };

        return HttpClient.wrapFetchImpl(url, wrapOptions);
    }

    /**
     * Concrete implementation for fetching a page.
     * 
     * @template { FetchResponseHandler } T The type of response handler to use; needed to determine return type.
     * @param { UrlString } url The url to fetch.
     * @param { Partial<WrapFetchOptions> & { responseHandler: T } } wrapOptions The options to use when fetching.
     * @returns { Promise<Awaited<ReturnType<T["extractContentFromResponse"]>>> } The found response.
     * 
     * @throws { TypeError | RangeError } `this.checkResponseAndGetData`
     * @throws { Error } `ErrorHandler.onFetchError`
     * @throws { TypeError | RangeError | Error } `ErrorHandler.onResponseError`
     * 
     * @public
     */
    static async wrapFetchImpl(url, wrapOptions) {
        // FIXME: I'm pretty sure this should be below the errorHandler default?
        if (BlockedHostNames.has(new URL(url).hostname)) {
            let skipurlerror = new Error("!Blocked! URL skipped because the user blocked the site");
            return wrapOptions.errorHandler.onFetchError(url, skipurlerror); // Returns Just a reject<never>
        }

        await HttpClient.setPartitionCookies(url);

        if (wrapOptions.fetchOptions == null) {
            wrapOptions.fetchOptions = HttpClient.makeOptions();
        }

        if (wrapOptions.errorHandler == null) {
            wrapOptions.errorHandler = new FetchErrorHandler();
        }

        try
        {
            let response = await fetch(url, wrapOptions.fetchOptions);
            let ret = await HttpClient.checkResponseAndGetData(url, wrapOptions, response);

            if (wrapOptions.parser?.isCustomError(ret)) {
                let CustomErrorResponse = wrapOptions.parser.setCustomErrorResponse(url, wrapOptions, ret);

                // Returns reject<never> or Recurses back into wrapFetchImpl
                return wrapOptions.errorHandler.onResponseError(CustomErrorResponse.url, CustomErrorResponse.wrapOptions, CustomErrorResponse.response, CustomErrorResponse.errorMessage);
            }
            return ret;
        }
        catch (error)
        {
            return wrapOptions.errorHandler.onFetchError(url, error); // Just a reject<never>
        }
    }

    /**
     * Check a raw fetch response and extract data; or handle failure.
     * 
     * @template { FetchResponseHandler } T The type of response handler to use; needed to determine return type.
     * @param { UrlString } url The url of the original request, may used for retries.
     * @param { WrapFetchOptions & { responseHandler: T } } wrapOptions The options.
     * @param { Response } response The response to check.
     * @returns { ReturnType<T["extractContentFromResponse"]> } The "parsed" response, or a rejection.
     * 
     * @throws { TypeError | RangeError } `FetchResponseHandler.extractContentFromResponse`
     * 
     * @private
     */
    static checkResponseAndGetData(url, wrapOptions, response) {
        if (!response.ok) {
            // Returns reject<never> or recurses into wrapFetchImpl
            return /** @type { ReturnType<T["extractContentFromResponse"]> } */ (wrapOptions.errorHandler.onResponseError(url, wrapOptions, response));
        } else {
            let handler = wrapOptions.responseHandler;
            handler.setResponse(response);

            return /** @type { ReturnType<T["extractContentFromResponse"]> } */ (handler.extractContentFromResponse(response));
        }
    }


    /**
     * FIXME: I don't fully know, but all usages use this to modify headers, but
     *        I don't understand the purpose.
     * 
     * @param { chrome.declarativeNetRequest.Rule[] } RulesArray The new rules to set.
     * @returns { Promise<void> } Changes are made on state directly.
     * 
     * @public
     */
    static async setDeclarativeNetRequestRules(RulesArray) {
        let url = chrome.runtime.getURL("").split("/").filter(a => a != "");
        let id = url[url.length - 1];

        for (let i = 0; i < RulesArray.length; i++) {
            // Limit rule to only WebToEpub domain to prevent potential security problems.
            RulesArray[i].condition.initiatorDomains = [id];
        }

        let oldRules = await chrome.declarativeNetRequest.getSessionRules();

        // In firefox i had declarativeNetRequest.getSessionRules() fail with undefined.
        if (oldRules == null) {
            oldRules = [];
        }

        let oldRuleIds = oldRules.map(rule => rule.id);

        await chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: oldRuleIds,
            addRules: RulesArray
        });
    }

    /**
     * Normalize cookies before making fetch calls.
     * 
     * @param { UrlString } url The url for which to set the cookies for?
     * @returns { Promise<void> } Changes are made on browser cookie state directly.
     * 
     * @private
     */
    static async setPartitionCookies(url) {
        // Get partitionKey in the form of https://<site name>.<tld>.
        let parsedUrl = new URL(url);

        try {
            /**
             * Get all cookie from the site which use the partitionKey
             * (e.g. cloudflare).
             * 
             * Set domain to the highest level from the website as all
             * subdomains are included.
             * 
             * @see [#1445](https://github.com/dteviot/WebToEpub/issues/1445)
             * @see [#1447](https://github.com/dteviot/WebToEpub/issues/1447)
             */
            let urlparts = parsedUrl.hostname.split(".");

            // FIXME: This is in no way a string.
            let cookies = "";

            if (!util.isFirefox()) {
                cookies = await chrome.cookies.getAll({
                    domain: urlparts[urlparts.length-2] + "." + urlparts[urlparts.length-1],
                    partitionKey: {  }
                });
            } else {
                cookies = await browser.cookies.getAll({
                    domain: urlparts[urlparts.length-2] + "." + urlparts[urlparts.length-1],
                    partitionKey: {  }
                });
            }

            cookies = cookies.filter(item => item.partitionKey != undefined);

            /*
             * Create new cookies for the site without the partitionKey; cookies
             * without the partitionKey get sent with fetch.
             * 
             * FIXME: If this can be just chrome; can the above also be so?
             */
            cookies.forEach(element => chrome.cookies.set({
                domain: element.domain,
                url: "https://" + element.domain.substring(1),
                name: element.name, 
                value: element.value
            }));
        } catch {
            // Probably running browser that doesn't support partitionKey, e.g. Kiwi.
            console.log("failed to set cookie");
        } 
    }
}

/**
 * @type { Set<HostnameString> }
 */
let BlockedHostNames = new Set();

/**
 * FIXME: AnonymousFunction.bind() can be converted into arrow functions?
 */
class FetchResponseHandler {
    /**
     * The raw response provided by fetch.
     * 
     * @type { Response | undefined }
     * @public
     */
    response;

    /**
     * The content type of the response.
     * 
     * @type { string | null | undefined }
     * @public
     */
    contentType;

    /**
     * The response parsed into json.
     * 
     * @type { string | undefined }
     * @public
     */
    json;

    /**
     * The raw binary of the response.
     * 
     * @type { ArrayBuffer | undefined }
     * @public
     */
    arrayBuffer;

    /**
     * Check whether the response is HTML.
     * 
     * @returns { boolean } Whether the response is HTML.
     * 
     * @public
     */
    isHtml() {
        return this.contentType.startsWith("text/html");
    }

    /**
     * Set the response used by all other member functions, and infer content
     * type.
     * 
     * @param { Response } response The fetch response to use.
     * @returns { void } Changes are made on state directly.
     * 
     * @public
     */
    setResponse(response) {
        this.response = response;
        this.contentType = response.headers.get("content-type");
    }

    /**
     * Parses response and populates either the `this.html` or `this.binary`
     * properties.
     * 
     * FIXME: Having the return type union is not optimal as an instance of this
     *        class always returns this. But since FetchTextResponseHandler
     *        inherits, it must be present.
     * 
     * @param { Response } response The response to parse.
     * @returns { Promise<this | string> } An reference to this instance, with the relevant property populated; string can only be returned if instance is `FetchTextResponseHandler`.
     * 
     * @throws { TypeError | RangeError } https://developer.mozilla.org/en-US/docs/Web/API/Request/arrayBuffer#exceptions
     * @throws { RangeError } `this.makeTextDecoder`
     * @throws { TypeError } https://developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString#exceptions
     * 
     * @public
     */
    extractContentFromResponse(response) {
        if (this.isHtml()) {
            return this.responseToHtml(response);
        } else {
            return this.responseToBinary(response);
        }
    }

    /**
     * Parse the response as HTML.
     * 
     * @param { Response } response The response to parse.
     * @returns { Promise<this> } A reference to this instance; with parsed HTML inserted into `this.html`.
     * 
     * @throws { TypeError | RangeError } https://developer.mozilla.org/en-US/docs/Web/API/Request/arrayBuffer#exceptions
     * @throws { RangeError } `this.makeTextDecoder`
     * @throws { TypeError } https://developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString#exceptions
     * 
     * @protected
     */
    responseToHtml(response) {
        return response.arrayBuffer().then(function(rawBytes) {
            let data = this.makeTextDecoder(response).decode(rawBytes);
            let html = new DOMParser().parseFromString(data, "text/html");

            util.setBaseTag(this.response.url, html);
            this.responseXML = html;

            return this;
        }.bind(this));
    }

    /**
     * Extract response as binary.
     * 
     * @param { Response } response  The response to extract from.
     * @returns { Promise<this> } A reference to this instance; with extracted binary inserted into `this.arrayBuffer`.
     * 
     * @throws { TypeError | RangeError } https://developer.mozilla.org/en-US/docs/Web/API/Request/arrayBuffer#exceptions
     * 
     * @private
     */
    responseToBinary(response) {
        return response.arrayBuffer().then(function(data) {
            this.arrayBuffer = data;

            return this;
        }.bind(this));
    }

    /**
     * Parse the response as text.
     * 
     * @param { Response } response The response to parse.
     * @returns { Promise<string> } The parsed text response as a string.
     * 
     * @throws { TypeError | RangeError } https://developer.mozilla.org/en-US/docs/Web/API/Request/arrayBuffer#exceptions
     * @throws { RangeError } `this.makeTextDecoder`
     * 
     * @protected
     */
    responseToText(response) {
        return response.arrayBuffer().then(function(rawBytes) {
            return this.makeTextDecoder(response).decode(rawBytes);
        }.bind(this));
    }

    /**
     * Parse response to json.
     * 
     * @param { Response } response The response to parse.
     * @returns { Promise<this> } A reference to this instance; with parsed json inserted into `this.json`.
     * 
     * @throws { TypeError } https://developer.mozilla.org/en-US/docs/Web/API/Request/text#exceptions
     * @throws { SyntaxError } https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#exceptions
     * 
     * @protected
     */
    responseToJson(response) {
        return response.text().then(function(data) {
            this.json =  JSON.parse(data);
            return this;
        }.bind(this));
    }

    /**
     * Create a decoder for response.
     * 
     * @param { Response } response The response to create a decoder for.
     * @returns { TextDecoder } The created decoder.
     * 
     * @throws { RangeError } https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/TextDecoder#exceptions
     * 
     * @public
     */
    makeTextDecoder(response) {
        let utflabel = this.charsetFromHeaders(response.headers);

        return new TextDecoder(utflabel);
    }

    /**
     * Figure out charset based on the fetch response headers; or provide a
     * default.
     * 
     * @param { Headers } headers The headers to extrapolate from.
     * @returns { string } The found charset; or a default.
     * 
     * @private
     */
    charsetFromHeaders(headers) {
        let contentType = headers.get("Content-Type");

        if (!util.isNullOrEmpty(contentType)) {
            let pieces = contentType.toLowerCase().split("charset=");

            if (2 <= pieces.length) {
                return pieces[1].split(";")[0].replace(/"/g, "").trim();
            }
        }

        return FetchResponseHandler.DEFAULT_CHARSET;
    }
}
FetchResponseHandler.DEFAULT_CHARSET = "utf-8";

class FetchJsonResponseHandler extends FetchResponseHandler {
    /**
     * @public
     */
    constructor() {
        super();
    }

    /**
     * Parse response to json.
     * 
     * @param { Response } response The response to parse.
     * @returns { Promise<this> } A reference to this instance; with parsed json inserted into `this.json`.
     * 
     * @throws { TypeError } https://developer.mozilla.org/en-US/docs/Web/API/Request/text#exceptions
     * @throws { SyntaxError } https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#exceptions
     * 
     * @override
     * @public
     */
    extractContentFromResponse(response) {
        return super.responseToJson(response);
    }
}

class FetchTextResponseHandler extends FetchResponseHandler {
    /**
     * @public
     */
    constructor() {
        super();
    }

    /**
     * Parse the response as text.
     * 
     * @param { Response } response The response to parse.
     * @returns { Promise<string> } The parsed text response as a string.
     * 
     * @throws { TypeError | RangeError } https://developer.mozilla.org/en-US/docs/Web/API/Request/arrayBuffer#exceptions
     * @throws { RangeError } `this.makeTextDecoder`
     * 
     * @override
     * @public
     */
    extractContentFromResponse(response) {
        return super.responseToText(response);
    }
}


class FetchHtmlResponseHandler extends FetchResponseHandler {
    /**
     * @public
     */
    constructor() {
        super();
    }

    /**
     * Parse the response as HTML.
     * 
     * @param { Response } response The response to parse.
     * @returns { Promise<this> } A reference to this instance; with parsed HTML inserted into `this.html`.
     * 
     * @throws { TypeError | RangeError } https://developer.mozilla.org/en-US/docs/Web/API/Request/arrayBuffer#exceptions
     * @throws { RangeError } `this.makeTextDecoder`
     * @throws { TypeError } https://developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString#exceptions
     * 
     * @override
     * @public
     */
    extractContentFromResponse(response) {
        return super.responseToHtml(response);
    }
}
