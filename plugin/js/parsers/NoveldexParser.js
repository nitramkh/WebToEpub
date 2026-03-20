"use strict";

parserFactory.register("noveldex.io", () => new NoveldexParser());

/**
 * Parser for the http://noveldex.io/ site.
 */
class NoveldexParser extends Parser { // eslint-disable-line no-unused-vars
    constructor() {
        super();
    }

    /*
     * NOTE: As of 2026-03, it seems that classes and ids on this site can't be
     * trusted to remain stable. In a short timespan, over three separate
     * occurences, multiple classes and at least one id has been changed.
     */

    /**
     * Function for extracting a specific value from any of the schema/context
     * "scripts" in the main page dom.
     * 
     * @param { Document } dom Source to extract from.
     * @param { string } key The property to find (first found).
     * @returns { unknown | null } The found property, or null.
     * 
     * @private
     */
    extractFromContext(dom, key) {
        /** @type { NodeListOf<HTMLScriptElement> } */
        const contextContainers = dom.querySelectorAll("script[type='application/ld+json']");

        const property = Array.from(contextContainers, contextContainer => {
            let context = null;
            
            // Theoretically overkill but I have trust issues.
            try {
                context = JSON.parse(contextContainer.innerHTML);
            } catch (e) {} // eslint-disable-line no-empty

            return context?.[key] ?? null;
        }).find(property => property != null);

        return property;
    }

    /**
     * @param { Document } dom 
     * @param { ChapterUrlsUI } chapterUrlsUI
     */
    async getChapterUrls(dom, chapterUrlsUI) {
        /**
         * @param { Document } dom
         */
        const extractChapters = (dom) => {
            const foundChaptersList = /\\"chapters\\":(\[(?:\{[^\]]+\})*\])/.exec(dom.body.innerHTML)?.[1];

            /**
             * Either we are on a loaded page with missing JSON blobs which will
             * be refetched to get an unloaded version, or somethings broken.
             */
            if (foundChaptersList == null)
                return null;

            /** @type { Array<object> } */
            let parsedChapters;

            /**
             * The chapters are stored as a stringified JSON inside a string,
             * therefore we must parse it twice, first to unescape the string;
             * then to actually parse the JSON.
             */
            try { parsedChapters = (JSON.parse(JSON.parse(`"${ foundChaptersList }"`))); }
            catch (e) {  } // eslint-disable-line no-empty

            const chapters = parsedChapters.map(entry => {
                if (
                    entry == null
                    || typeof entry !== "object"
                    || entry["number"] == null
                    || typeof entry["number"] !== "number"
                    || entry["title"] == null
                    || typeof entry["title"] !== "string"
                    || entry["isLocked"] == null
                    || typeof entry["isLocked"] !== "boolean"
                )
                    return null;
 
                return {
                    number: entry["number"],
                    title: entry["title"],
                    locked: entry["isLocked"]
                };
            })
                .filter(chapter => chapter != null && !chapter.locked)
                .map(chapter => {
                    return {
                        // NOTE: Hard-code very bad but not worth fixing.
                        sourceUrl: `${ dom.baseURI.replace(/\?.*$/, "") }/chapter/${chapter.number}`,
                        title: `Chapter ${ chapter.number } - ${ chapter.title }`
                    };
                });

            return chapters;
        };

        /**
         * @param { Document } dom 
         */
        const nextTocPageUrl = (dom) => {
            const foundCurrent = /\\"currentPage\\":(\d+),/.exec(dom.body.innerHTML)?.[1];
            const foundTotal = /\\"totalPages\\":(\d+),/.exec(dom.body.innerHTML)?.[1];

            // Either we're on a loaded page, or something broken.
            if (foundCurrent == null || foundTotal == null) {
                // Check what page we are currently on.
                const pageCheck = /\?.*page=(\d+)/.exec(dom.baseURI);

                /**
                 * If this is the main page; short-circuit and refetch it to get
                 * an unloaded page which contains the expected values/formats;
                 * instead of having a split path.
                 * 
                 * I've noted some inconsistencies on this page where
                 * occasionally some JSON blobs are missing from a loaded page,
                 * but XHR/fetched pages are not built-out and have not had any
                 * issues yet. The chapter data in JSON blobs.
                 */
                if (pageCheck == null || pageCheck[1] === "1")
                    return dom.baseURI;

                // Somethings broken so fail gracefully.
                return null;
            }

            // Count starts at 1.
            const current = parseInt(foundCurrent);
            const total = parseInt(foundTotal);

            // Previous page was the final one.
            if (current >= total)
                return null;

            // Replace old page number with new one; or append it.
            const url = dom.baseURI.includes("?")
                ? dom.baseURI.replace(/(?:\?.*?)?(\?|&)(page=)\d+/, (_, symbol, prefix) => symbol + prefix + (current + 1))
                : `${ dom.baseURI }?page=${ current + 1}`;

            return url;
        };

        const chapters =  await this.walkTocPages(
            dom,
            extractChapters,
            nextTocPageUrl,
            chapterUrlsUI
        );

        return chapters;
    }

    /**
     * @param { Document } dom 
     */
    findContent(dom) {
        // Use query to narrow search down to raw script tag contents.
        const scripts = Array.from(dom.querySelectorAll("script:not([src])"), script => script.innerHTML);

        // Look for blocks of text enclosed by invisible characters.
        const mainRegex = /(?:[\uFEFF\u200B\u200C\u200D]+)(.+?)(?:[\uFEFF\u200B\u200C\u200D]+)/;

        let foundContent = null;
        for (const script of scripts) {
            const match = mainRegex.exec(script);
            if (match) {
                foundContent = match[1];
                break;
            }
        }

        // FIXME: Error out?
        if (!foundContent) return null;

        // Undo JSON escape.
        const unescaped = JSON.parse(`["${foundContent}"]`)[0];

        // Parse partially unescaped HTML.
        const elementified = dom.createElement("div");
        elementified.innerHTML = unescaped;

        // Unescape HTML-escaped tags, and remove nested <p> tags.
        Array.from(elementified.querySelectorAll("p"))
            .filter(p => p.innerText.startsWith("<p>"))
            .forEach(p => p.outerHTML = p.textContent);

        return elementified;
    }

    /**
     * @param { Document } dom
     */
    extractTitleImpl(dom) {
        /** @type { HTMLHeadingElement } */
        const storyTitle = dom.querySelector("main h1:first-of-type");
        
        return storyTitle;
    }

    /**
     * @param { Document } dom 
     */
    extractAuthor(dom) {
        let author = this.extractFromContext(dom, "author");

        /*
         * Null-check is needed since typeof null is object for some
         * unfathomable reason.
         */
        author = author != null && typeof author === "object" && author?.["name"] || null;

        /*
         * Translator team's name is stored in a massive escaped JSON blob under
         * team -> name.
         */
        const translator = /(?:\\"team\\":.+?\\"name\\":\\")(.*?)(?:\\")/.exec(dom.body.innerHTML);

        const combined = [author, translator?.[1]].filter(s => s != null && s !== "").join(", ");

        return combined !== "" ? combined : super.extractAuthor(dom);
    }

    /**
     * @param { Document } dom 
     */
    extractLanguage(dom) {
        return dom.querySelector("html").getAttribute("lang");
    }

    /**
     * @param { Document } dom
     */
    extractSubject(dom) {
        /**
         * @param { Document } dom
         */
        const extractGenres = (dom) => {
            const genres = this.extractFromContext(dom, "genre");

            if (!Array.isArray(genres)) return [];

            return genres.filter(property => typeof property === "string");
        };

        /**
         * @param { Document } dom 
         */
        const extractTags = (dom) => {
            /** @type { NodeListOf<HTMLAnchorElement> } */
            const tagAnchors = dom.querySelectorAll("a[href*='tag']");

            return Array.from(tagAnchors, anchor => anchor.innerText);
        };

        return extractGenres(dom).concat(extractTags(dom)).join(", ");
    }

    /**
     * @param { Document } dom 
     */
    extractDescription(dom) {
        const description = this.extractFromContext(dom, "description");

        return typeof description === "string" ? description : "";
    }

    /**
     * @param { Document } dom 
     */
    findCoverImageUrl(dom) {
        const url = this.extractFromContext(dom, "image");
        
        if (typeof url !== "string") return null;

        return url.startsWith("/") ? util.resolveRelativeUrl(dom.baseURI, url) : url;
    }
}
