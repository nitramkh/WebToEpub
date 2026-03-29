"use strict";

parserFactory.register("rtd.moe", () => new FakeParser());

/**
 * This is a dummy parser, intended to act like a parser that reads a lot of
 * chapters, slowly. For testing other parts of WebToEpub. Note that to use it
 * you must open the site "rtd.moe".
 */
class FakeParser extends Parser {
    /**
     * @public
     */
    constructor() {
        super();
    }

    /**
     * Function for fetching the links to **all** chapters.
     * 
     * @override
     * @returns { Promise<ChapterLink[]> } The found chapters.
     * 
     * @protected
     */
    async getChapterUrls() {
        let chapters = [];

        for (let i = 1; i < 30; ++i) {
            chapters.push({
                sourceUrl:  `https://rtd.moe/Chapter/${i}.html`,
                title: `Chapter ${i}`,
                newArc: null
            });
        }

        return chapters;
    }

    /**
     * Function for extracting the chapter content from the chapter dom.
     * 
     * @override
     * @param { Document } dom The dom of the chapter page.
     * @returns { Element } The element holding the content.
     * 
     * @protected
     */
    findContent(dom) {
        return Parser.findConstrutedContent(dom);
    }

    /**
     * Extract **story title**; override this if default implementation can't
     * find it.
     * 
     * @override
     * @param { Document } dom The document to find title in.
     * @returns { string | Node | null } The found title, or null if not.
     * 
     * @protected
     */
    extractTitleImpl(dom) {
        return dom.querySelector("h1");
    }

    /**
     * Fetch a single chapter by URL. Hook if need to chase hyperlinks in page
     * to get all chapter content.
     * 
     * @param { UrlString } url Url to chapter to fetch.
     * @returns { Promise<Document | undefined> } The fetched response.
     * 
     * @protected
     */
    async fetchChapter(url) {
        let newDoc = Parser.makeEmptyDocForContent(url);
        this.addTitleToChapter(newDoc, url);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return newDoc.dom; 
    }

    /**
     * Create a title element using `newDoc.dom` and insert it into
     * `newDoc.content`.
     * 
     * @param { { dom: Document, content: HTMLDivElement } } newDoc The document and container to use.
     * @param { string } url The title content to set.
     * @returns { void } Changes are made on `newDoc` directly.
     * 
     * @private
     */
    addTitleToChapter(newDoc, url) {
        let title = newDoc.dom.createElement("h1");
        title.textContent = url;
        newDoc.content.appendChild(title);
    }

    /**
     * Just dump an empty array.
     * 
     * @returns { Node[] } An empty array.
     * 
     * @protected
     */
    getInformationEpubItemChildNodes() {
        return [];
    }    
}
