"use strict";

/**
 * Factory class for creating instances of `Parser` subclasses.
 */
class ParserFactory {
    /**
     * Map containing all hostname based "rules" for selecting parsers.
     * 
     * @type { Map<HostnameString, ParserConstructor> }
     * @private
     */
    parsers;

    /**
     * Array containing all url/dom rules for selecting parsers.
     * 
     * @type { ParserRule[] }
     * @private
     */
    parserRules;

    /**
     * Array containing all url rules for selecting parsers.
     * 
     * @type { ParserUrlRule[] }
     */
    parserUrlRules;

    /**
     * Array containing all manual selection parsers.
     * 
     * @type { ParserManualSelect[] }
     * @private
     */
    manualSelection;

    /**
     * @public
     */
    constructor() {
        this.parsers = new Map();
        this.parserRules = [];
        this.parserUrlRules = [];
        this.manualSelection = [];
        this.registerManualSelect("", () => undefined);
    }

    /**
     * Check if url is archive.org.
     * 
     * @param { UrlString } url The url to check.
     * @returns { boolean } Whether it is archive.org.
     * 
     * @public
     */
    static isWebArchive(url) {
        let host = util.extractHostName(url);
        let subs = ["web", "web-beta"];

        for (let sub of subs) {
            if (host.startsWith(sub + ".archive.org")) {
                return true;
            }
        }
        return false;
    }

    /**
     * Strip anything related to archive.org from the url.
     * 
     * @param { UrlString } url The url to strip
     * @returns { UrlString } The stripped url.
     * 
     * @private
     */
    static stripWebArchive(url) {
        let hostName = url.split("://");

        return hostName[2] ? "https://" + hostName[2] : url; 
    }

    /**
     * Remove www. prefix from provided hostname if present.
     * 
     * @param { HostnameString } hostName The hostname to strip.
     * @returns { HostnameString } The stripped hostname.
     * 
     * @private
     */
    static stripLeadingWww(hostName) {
        return hostName.startsWith("www.") ? hostName.substring(4) : hostName;            
    }

    /**
     * Register a parser for provided `hostName`.
     * 
     * @param { HostnameString } hostName The hostname to register parser for, ex. "example.com".
     * @param { ParserConstructor } constructor Constructor function to create a new instance of parser.
     * @returns { void } Changes are made on internal state directly.
     * @throws { Error } If parser for `hostName` has already been registered.
     * 
     * @public
     */
    register(hostName, constructor) {
        if (this.parsers.get(ParserFactory.stripLeadingWww(hostName)) == null) {
            this.parsers.set(ParserFactory.stripLeadingWww(hostName), constructor);
        } else {
            throw new Error("Duplicate parser registered for hostName " + hostName);
        }
    }

    /**
     * Basically `ParserFactory.register` combined with a note that the
     * site is dead.
     * 
     * @param { HostnameString } hostName The hostname of the site to register parser for, ex. "example.com".
     * @param { ParserConstructor } constructor Constructor function to create a new instance of parser.
     * @returns { void } Changes are made on internal state directly.
     * 
     * @public
     */
    registerDeadSite(hostName, constructor) {
        this.register(hostName, constructor);
    }

    /**
     * Register a parser by `hostName` and override if already present.
     * 
     * @param { HostnameString } hostName The hostname to register parser for, ex. "example.com".
     * @param { ParserConstructor } constructor Constructor function to create a new instance of parser.
     * @returns { void } Changes are made on internal state.
     * 
     * @public
     */
    reregister(hostName, constructor) {
        this.parsers.set(ParserFactory.stripLeadingWww(hostName), constructor);
    }

    /**
     * Register a parser to be selectable in the UI.
     * 
     * @param { ParserNameString } name The name of the parser; e.g. what will show up in the UI.
     * @param { ParserConstructor } constructor To obtain the parser.
     * @returns { void } Changes are made on internal state directly.
     * 
     * @public
     */
    registerManualSelect(name, constructor) {
        this.manualSelection.push({name, constructor});
    }

    /**
     * Register a parser rule based on page url and main page dom.
     * 
     * @param { ParserRuleTestFunction } test Predicate that checks if parser can handle URL & DOM.
     * @param { ParserConstructor } constructor To obtain parser to handle the URL-
     * @returns { void } Changes are made on internal state directly.
     * 
     * @public
     */
    registerRule(test, constructor) {
        this.parserRules.push( { test: test, constructor: constructor } );
    }

    /**
     * Register a parser rule based on page url.
     * 
     * @param { ParserUrlRuleTestFunction } test Predicate that checks if parser can handle URL.
     * @param { ParserConstructor } constructor To obtain parser to handle the URL.
     * @returns { void } Changes are made on internal state directly.
     * 
     * @public
     */
    registerUrlRule(test, constructor) {
        this.parserUrlRules.push( {test: test, constructor: constructor } );
    }

    /**
     * Attempt to find a parser by matching the url.
     * 
     * @param { UrlString } url The url to find a parser for.
     * @returns { Parser | null | undefined } The found parser or null.
     * 
     * @public
     */
    fetchByUrl(url) {
        let hostName = ParserFactory.hostNameForParserSelection(url);
        let constructor = this.parsers.get(hostName);

        if (constructor !== undefined) {
            return constructor(url);
        }

        for (let pair of this.parserUrlRules) {
            if (pair.test(url)) {
                return pair.constructor(url);
            }
        }

        return null;
    }

    /**
     * Attempt to find a parser for a page. If one can't be found it will return
     * an instance of `DefaultParser`.
     * 
     * @param { UrlString } url The url to find a parser for.
     * @param { Document } dom The dom of the page to find a parser for.
     * @returns { Parser | undefined } The found parser; which may be `DefaultParser`.
     * 
     * @public
     */
    fetch(url, dom) {
        let forUrl = this.fetchByUrl(url);

        if (forUrl != null) {
            return forUrl;
        }

        /**
         * No exact match found, see if any parser is willing to handle the URL
         * and/or DOM.
         */
        let maxConfidence = 0;
        let constructor = null;

        for (let pair of this.parserRules) {
            let confidence = (pair.test(url, dom) * 1.0);

            if (maxConfidence < confidence) {
                maxConfidence = confidence;
                constructor = pair.constructor;
            }
        }

        if (0 < maxConfidence) {
            // Not-null cast is currently safe here.
            return /** @type { ParserConstructor } */ (constructor)(url);
        }

        // Still no parser found, fall back to default.
        return new DefaultParser();
    }

    /**
     * Extracts hostname from url.
     * 
     * @param { UrlString } url The url to extract from.
     * @returns { HostnameString } The extracted hostname.
     * 
     * @private
     */
    static hostNameForParserSelection(url) {
        if (ParserFactory.isWebArchive(url)) {
            url = ParserFactory.stripWebArchive(url);
        }
        return ParserFactory.stripLeadingWww(util.extractHostName(url));
    }

    /**
     * Populate the options of the `selectTag` with the currently registered
     * "manual selection" parsers, **if the select element doesn't already have
     * any options present**.
     * 
     * @param { HTMLSelectElement } selectTag The select element to populate.
     * @returns { void } Changes are made on `selectTag` directly.
     * 
     * @public
     */
    populateManualParserSelectionTag(selectTag) {
        let options = selectTag.options;

        if (options.length === 0) {
            for (let p of this.manualSelection) {
                options.add(new Option(p.name));
            }
        }
    }

    /**
     * Try to find a parser matching `parserName`.
     * 
     * @param { ParserNameString } parserName The name of the parser as defined when registering using `registerManualSelect`.
     * @returns { Parser | undefined } The found parser; or undefined if one could not be found.
     * 
     * @public
     */
    manuallySelectParser(parserName) {
        for (let m of this.manualSelection) {
            if (m.name === parserName) {
                return m.constructor();
            }
        }
    }

    /**
     * Adds the parser property to the provided pages.
     * 
     * @param { Parser } initialParser The original parser for the main ToC page; may be replaced based on chapter hostnames.
     * @param { ChapterLink[] } webPages The pages to append to.
     * @returns { Promise<void> } Promise which returns once `webPages` has been updated.
     * 
     * @public
     */
    async addParsersToPages(initialParser, webPages) {
        /** @type { Map<HostnameString, ChapterLink[]> } */
        let pagesByHost = new Map();
        let initialUrl = initialParser.state.chapterListUrl;
        let initialHostName = ParserFactory.hostNameForParserSelection(initialUrl);

        for (let page of webPages) {
            let key = ParserFactory.hostNameForParserSelection(page.sourceUrl);

            if (key === initialHostName) {
                page.parser = initialParser;
                continue;
            }

            let pages = pagesByHost.get(key);

            if (pages == null) {
                pages = [];
                pagesByHost.set(key, pages);
            }

            pages.push(page);
        }

        for (let pair of pagesByHost) {
            await this.assignParserToPages(pair[1], initialParser);
        }
    }

    /**
     * Attempt to find a singular appropriate parser for all provided links.
     * 
     * @param { ChapterLink[] } webPages The links to find a parser for.
     * @param { Parser } initialParser Parser whose state is stolen and put into the newly found parser.
     * @returns { Promise<void> } Promise which resolves when changes have been made to `webPages` objects.
     * 
     * @private
     */
    async assignParserToPages(webPages, initialParser) {
        let url = webPages[0].sourceUrl;
        let parser = this.fetchByUrl(url);

        if (parser == null) {
            let responseXML = (await HttpClient.wrapFetch(url)).responseXML;

            parser = parserFactory.fetch(url, responseXML);
        }

        ParserFactory.copyParserToPages(parser, webPages, initialParser);
    }

    /**
     * Sets the parser of all provided chapters stealing the state of
     * `initialParser`.
     * 
     * @param { Parser } parser The new parser.
     * @param { ChapterLink[] } webPages The links to set the parser for.
     * @param { Parser } initialParser The parser to steal state from.
     * @returns { void } Changes are made on `parser` and `webPages` objects directly.
     * 
     * @private
     */
    static copyParserToPages(parser, webPages, initialParser) {
        parser.copyState(initialParser);

        for (let page of webPages) {
            page.parser = parser;
        }
    }
}

/**
 * Global parser factory instance.
 * 
 * @type { ParserFactory }
 */
let parserFactory = new ParserFactory();