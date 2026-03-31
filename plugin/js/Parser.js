/*
  Base class that all parsers build from.
*/
"use strict";

/**
 * For sites that have multiple chapters per web page, this can minimize HTTP calls
 */
class FetchCache { // eslint-disable-line no-unused-vars
    /**
     * @type { string | null }
     */
    path;

    /**
     * @type { Document | null | undefined }
     */
    dom;

    constructor() {
        this.path = null;
        this.dom = null;
    }

    /**
     * Fetch content at {@link url} and store it in {@link dom}.
     * 
     * @param { UrlString } url The url to fetch.
     * @returns { Promise<Document> }
     */
    async fetch(url) {
        if  (!this.inCache(url)) {
            this.dom = (await HttpClient.wrapFetch(url)).responseXML;
            this.path = new URL(url).pathname;
        }

        return /** @type { Document } */ (this.dom.cloneNode(true));
    }

    /**
     * Check whether the contents at {@link url} are cached here.
     * 
     * @param { UrlString } url The url to check.
     * @returns { boolean } Whether the contents at said url have been cached.
     */
    inCache(url) {
        return (((new URL(url).pathname) === this.path) && (this.dom !== null));
    }
}

/**
 * A Parser's state variables
*/
class ParserState {
    /**
     * @type { Map<UrlString, ChapterLink> }
     */
    webPages;

    /**
     * The url of the main ToC page.
     * 
     * @type { UrlString | null }
     */
    chapterListUrl;

    /**
     * The dom of the main ToC page.
     * 
     * @type { Document | null | undefined }
     */
    firstPageDom;

    constructor() {
        this.webPages = new Map();
        this.chapterListUrl = null;
    }

    /**
     * Set the pages which are to be fetched in {@link ParserState.webPages},
     * also populates the {@link ChapterLink.nextPrevChapters} field in all
     * provided urls.
     * 
     * @param { ChapterLink[] } urls The pages to fetch.
     * @returns { void } Changes are made on the {@link ParserState.webPages} and {@link ChapterLink.nextPrevChapters} directly.
     */
    setPagesToFetch(urls) {
        /** @type { Set<UrlString> } */
        let nextPrevChapters = new Set();

        /** @type { Map<UrlString, ChapterLink> } */
        this.webPages = new Map();

        for (let i = 0; i < urls.length; ++i) {
            let page = urls[i];

            if (i < urls.length - 1) {
                nextPrevChapters.add(util.normalizeUrlForCompare(urls[i + 1].sourceUrl));
            }

            page.nextPrevChapters = nextPrevChapters;
            this.webPages.set(page.sourceUrl, page);

            nextPrevChapters = new Set();
            nextPrevChapters.add(util.normalizeUrlForCompare(page.sourceUrl));
        }
    }
}

/**
 * The base type of parser which all other parsers inherit from.
 * 
 * FIXME: To make the subclasses overrides actually inherit the types you
 *        need to put this type declaration in a .d.ts file...
 * 
 * @abstract
 */
class Parser {
    /**
     * @type { number }
     */
    minimumThrottle;

    /**
     * @type { number }
     */
    maxSimultanousFetchSize;

    /**
     * @type { ParserState }
     */
    state;

    /**
     * @type { ImageCollector }
     */
    imageCollector;

    /**
     * @type { UserPreferences | null } 
     */
    userPreferences;

    /**
     * @param { ImageCollector } [imageCollector]
     */
    constructor(imageCollector) {
        this.minimumThrottle = 500;
        this.maxSimultanousFetchSize = 1;
        this.state = new ParserState();
        this.imageCollector = imageCollector || new ImageCollector();
        this.userPreferences = null;
    }

    /**
     * Copy the state of {@link otherParser} onto this parser's {@link state}.
     * 
     * @param { Parser } otherParser The parser to steal from.
     * @returns { void } Changes are made on {@link state}, {@link imageCollector}, and {@link userPreferences}.
     */
    copyState(otherParser) {
        this.state = otherParser.state;
        this.imageCollector.copyState(otherParser.imageCollector);
        this.userPreferences = otherParser.userPreferences;
    }

    /**
     * Set the pages which are to be fetched in `Parser.state`, also populates
     * the `ChapterLink.nextPrevChapters` field in all provided urls.
     * 
     * @param { ChapterLink[] } urls The pages to fetch.
     * @returns { void } Changes are made on the `Parser.state` and `ChapterLink.nextPrevChapters` directly.
     * 
     * @public
     */
    setPagesToFetch(urls) {
        this.state.setPagesToFetch(urls);
    }

    /**
     * Get the current set of pages to be fetched.
     * 
     * @returns { Map<UrlString, ChapterLink> } Pairs of the source urls and current information about the chapters.
     * 
     * @public
     */
    getPagesToFetch() {
        return this.state.webPages;
    }
    
    /**
     * Use this option if the parser isn't sending the correct HTTP header
     * 
     * FIXME: Not sure but I think this is used to determine if the response
     * from attempting to fetch a page is a so called custom error; I.E.
     * site/subclass specific?
     * 
     * @param { FetchResponseHandler | string } response The response to check.
     * @returns { boolean } Whether the response is a custom error.
     */
    isCustomError(response) {  // eslint-disable-line no-unused-vars
        return false;
    }

    /**
     * FIXME: Not fully sure; but if {@link isCustomError} returns true, this
     * will be called to allow the parser implementation to customize the
     * response? Also the type is cursed, I know, but it would require code
     * changes to fix it.
     * 
     * @template { FetchResponseHandler } T
     * @param { UrlString } url 
     * @param { WrapFetchOptions & { responseHandler: T } } wrapOptions 
     * @param { string | FetchResponseHandler } checkedresponse 
     * @returns { CustomErrorResponse & { wrapOptions: WrapFetchOptions & { responseHandler: T } } }
     */
    setCustomErrorResponse(url, wrapOptions, checkedresponse) {
        //example
        let ret = {};
        ret.url = url;
        ret.wrapOptions = wrapOptions;
        ret.response = {};

        //URL that's get opened on 'Open URL for Captcha' click
        ret.response.url = checkedresponse.response.url;
        ret.response.status = 403;

        //How often should it be retried and with how much delay in between
        ret.response.retryDelay = [80,40,20,10,5];
        ret.errorMessage = "This is a custom error message that will be displayed should all retries fail";

        //return empty to throw error
        return {};
    }

    /**
     * FIXME: Literally 0 references.
     * 
     * @param { UserPreferences } userPreferences The updated user preferences.
     * @returns { void } Changes are made on internal properties directly.
     */
    onUserPreferencesUpdate(userPreferences) {
        this.userPreferences = userPreferences;
        this.imageCollector.onUserPreferencesUpdate(userPreferences);
    }

    /**
     * Check whether a page is packable.
     * 
     * @param { ChapterLink } webPage The page to check.
     * @returns { boolean | undefined } Whether the page is packable.
     */
    isWebPagePackable(webPage) {
        return ((webPage.isIncludeable) && ((webPage.rawDom != null) || (webPage.error != null)));
    }

    /**
     * Extract content from page and remove trash.
     * 
     * @param { ChapterLink } webPage The page to extract the content from.
     * @returns { Element } The resultant content.
     */
    convertRawDomToContent(webPage) {
        let content = this.findContent(webPage.rawDom);
        this.customRawDomToContentStep(webPage, content);
        util.decodeCloudflareProtectedEmails(content);

        if (this.userPreferences.removeNextAndPreviousChapterHyperlinks.value) {
            this.removeNextAndPreviousChapterHyperlinks(webPage, content);
        }

        this.removeUnwantedElementsFromContentElement(content);
        this.replaceWpBlockSpacersWithHR(content);
        this.addTitleToContent(webPage, content);
        util.fixBlockTagsNestedInInlineTags(content);
        this.imageCollector.replaceImageTags(content);
        util.removeUnusedHeadingLevels(content);
        util.makeHyperlinksRelative(webPage.rawDom.baseURI, content);
        util.setStyleToDefault(content);
        util.prepForConvertToXhtml(content);
        util.removeEmptyAttributes(content);
        util.removeSpansWithNoAttributes(content);
        util.removeEmptyDivElements(content);
        util.removeTrailingWhiteSpace(content);

        if (util.isElementWhiteSpace(content)) {
            let errorMsg = UIText.Warning.warningNoVisibleContent(webPage.sourceUrl);
            ErrorLog.showErrorMessage(errorMsg);
        }

        return content;
    }

    /**
     * Add title to the content and chapter info if applicable.
     * 
     * @param { ChapterLink } webPage The chapter information.
     * @param { Document } content The full dom of the chapter.
     * @returns { void } Changes are made on the provided objects.
     * 
     * @public
     */
    addTitleToContent(webPage, content) {
        let title = this.findChapterTitle(webPage.rawDom, webPage);

        if (title != null) {
            if (title instanceof HTMLElement) {
                title = title.textContent;
            }

            if (webPage.title == "[placeholder]") { // FIXME: Probably don't use such a hyperspecific string to indicate undefined?
                webPage.title = /** @type { Element | string } */ (title).trim();
            }

            if (!this.titleAlreadyPresent(/** @type { Element | string } */ (title), content)) {
                let titleElement = webPage.rawDom.createElement("h1");
                titleElement.appendChild(webPage.rawDom.createTextNode(title.trim()));
                content.insertBefore(titleElement, content.firstChild);
            }
        } else {
            if (webPage.title == "[placeholder]") {
                webPage.title = webPage.rawDom.title;
            }
        }
    }

    /**
     * Check if the provided title matches the one found in {@link content}.
     * 
     * @param { string } title The title to check.
     * @param { ParentNode } content The node to look for a title to comprare against in.
     * @returns { boolean } Whether they match.
     */
    titleAlreadyPresent(title, content) {
        let existingTitle = content.querySelector("h1, h2, h3, h4, h5, h6");

        return (existingTitle != null)
            && (title.trim() === existingTitle.textContent.trim());
    }

    /**
     * Element with title of an individual chapter. Override this when the
     * chapter title not in content element.
     * 
     * @param { Document } dom The full dom of the chapter page.
     * @param { ChapterLink } webPage The chapter info?
     * @returns { Element | string | null } The found title or null if unable.
     * 
     * @protected
     */
    findChapterTitle(dom, webPage) {   // eslint-disable-line no-unused-vars
        return null;
    }

    /**
     * Replace wordpress spacers with pure HTML ones.
     * 
     * FIXME: Should this be refactored into {@link WordpressBaseParser}?
     * 
     * @param { ParentNode } content The element to remove from.
     * @returns { void } Changes are made on the provided {@link content} object.
     */
    replaceWpBlockSpacersWithHR(content) {
        [...content.querySelectorAll("div.wp-block-spacer")].forEach(
            e => e.replaceWith(content.ownerDocument.createElement("hr"))
        );
    }

    /**
     * Removes all unwanted elements from the chapter content; may be overridden
     * in subclasses, but should still call super.
     * 
     * @param { Element } element The element to remove from.
     * @returns { void } Changes are made on the provided `element` object.
     * 
     * @public
     */
    removeUnwantedElementsFromContentElement(element) {
        /** 
         * TODO: While not neccessary, this is begging for a touchup refactor.
         */

        util.removeScriptableElements(element);
        util.removeComments(element);
        util.removeElements(element.querySelectorAll("noscript, input"));
        util.removeUnwantedWordpressElements(element);
        util.removeMicrosoftWordCrapElements(element);
        util.removeShareLinkElements(element);
        util.removeLeadingWhiteSpace(element);
    }

    /**
     * Override for any custom processing, this is called before any other
     * processing has ben done on the result from {@link findContent}.
     * 
     * @param { ChapterLink } chapter The chapter info.
     * @param { Element } content The completely unprocessesed found content.
     */
    customRawDomToContentStep(chapter, content) { // eslint-disable-line no-unused-vars

    }

    /**
     * By default find the cover image and display it, then call
     * `this.populateUIImpl`.
     * 
     * @param { Document } dom The DOM of the first page; e.g. chapter list container page.
     * @returns { void }  Changes are made on UI directly.
     * 
     * @public
     */
    populateUI(dom) {
        CoverImageUI.showCoverImageUrlInput(true);
        let coverUrl = this.findCoverImageUrl(dom);
        CoverImageUI.setCoverImageUrl(coverUrl);
        this.populateUIImpl();
    }

    /**
     * 
     * @returns { void }
     */
    populateUIImpl() {
        // default implementation is do nothing more
    }

    /**
     * Default implementation, take first image in content section.
     * 
     * @param { Document } dom The DOM of the first page; e.g. chapter list container page.
     * @returns { UrlString | null } The url of the image or null if none found.
     */
    findCoverImageUrl(dom) {
        if (dom != null) {
            // FIXME: This seems odd, cache this no?
            let content = this.findContent(dom);

            if (content != null) {
                let cover = content.querySelector("img");

                if (cover != null) {
                    return cover.src;
                }
            }
        }

        return null;
    }

    /**
     * Removes links to next and previous chapters; but also calls
     * `findParentNodeOfChapterLinkToRemoveAt`, so depending on the parser, it
     * may be doing anyhing.
     * 
     * @param { ChapterLink } webPage The chapter to remove links from.
     * @param { Element } element The content element containing the chapter content.
     */
    removeNextAndPreviousChapterHyperlinks(webPage, element) {
        // FIXME: Refactor findParentNodeOfChapterLinkToRemoveAt into an abstract function. Also it may be compeltely broken type-wise.

        /**
         * @type { (element: HTMLAnchorElement) => HTMLElement}
         */
        let elementToRemove = (this.findParentNodeOfChapterLinkToRemoveAt != null) ?
            this.findParentNodeOfChapterLinkToRemoveAt.bind(this)
            : (element) => element;

        let chapterLinks = [...element.querySelectorAll("a")]
            .filter(link => webPage.nextPrevChapters.has(util.normalizeUrlForCompare(link.href)))
            .map(link => elementToRemove(link));

        util.removeElements(chapterLinks);
    }

    /**
     * Default implementation turns each webPage into single epub item.
     * 
     * @param { ChapterLink } webPage The page to make into an item.
     * @param { number } epubItemIndex The index?
     * @returns { ChapterEpubItem[] } The created item instance.
     */
    webPageToEpubItems(webPage, epubItemIndex) {
        let content = this.convertRawDomToContent(webPage);
        let items = [];

        if (content != null) {
            items.push(new ChapterEpubItem(webPage, content, epubItemIndex));
        }

        return items;
    }

    /**
     * Create a placeholder for {@link webPage}.
     * 
     * @param { ChapterLink } webPage The page to make palceholder for. 
     * @param { number } epubItemIndex The index?
     * @returns { ChapterEpubItem[] } The created item instance.
     */
    makePlaceholderEpubItem(webPage, epubItemIndex) {
        let temp = Parser.makeEmptyDocForContent(webPage.sourceUrl);

        temp.content.textContent = UIText.Default.chapterPlaceholderMessage(webPage.sourceUrl, webPage.error);

        util.convertPreTagToPTags(temp.dom, temp.content);

        return [new ChapterEpubItem(webPage, temp.content, epubItemIndex)];
    }

    /**
     * Default implementation to extract title from meta property or use
     * document title as fallback.
     * 
     * @param { Document } dom The document to find title in.
     * @returns { string } The found title.
     * 
     * @private
     */
    static extractTitleDefault(dom) {
        let title = dom.querySelector("meta[property='og:title']");
        return (title === null) ? dom.title : title.getAttribute("content");
    }

    /**
     * Extract **story title**; override this if default implementation can't
     * find it.
     * 
     * @param { Document } dom The document to find title in.
     * @returns { string | Node | null } The found title, or null if not.
     * 
     * @protected
     */
    extractTitleImpl(dom) {
        return Parser.extractTitleDefault(dom);
    }

    /**
     * Find the title in `dom` from `this.extractTitleImpl` or using
     * `extractTitleDefault` as fallback.
     * 
     * @param { Document } dom The document to extract title from.
     * @returns { string } The found title.
     * 
     * @private
     */
    extractTitle(dom) {
        let title = this.extractTitleImpl(dom);

        if (title == null) {
            title = Parser.extractTitleDefault(dom);
        }

        if (title.textContent !== undefined) {
            title = title.textContent;
        }

        return title.trim();
    }

    /**
    * default implementation
    */
    extractAuthor(dom) {  // eslint-disable-line no-unused-vars
        return "<unknown>";
    }

    /**
    * default implementation, 
    * if not available, default to English
    */
    extractLanguage(dom) {
        // try jetpack tag
        let locale = dom.querySelector("meta[property='og:locale']");
        if (locale !== null) {
            return locale.getAttribute("content");
        }

        // try <html>'s lang attribute
        locale = dom.querySelector("html").getAttribute("lang") ?? "en";
        return locale.split("-")[0];
    }

    /**
    * default implementation, 
    * if not available, return ''
    */
    extractSubject(dom) {   // eslint-disable-line no-unused-vars
        return "";
    }

    extractDescription(dom) {
        let infoDiv = document.createElement("div");
        if (this.getInformationEpubItemChildNodes !== undefined)
        {
            this.populateInfoDiv(infoDiv, dom);
        }
        return infoDiv.textContent;
    }

    /**
    * default implementation, Derived classes will override
    */
    extractSeriesInfo(dom, metaInfo) {  // eslint-disable-line no-unused-vars
    }

    async loadEpubMetaInfo(dom) {  // eslint-disable-line no-unused-vars
        return;
    }

    /**
     * Compile all the meta info required to create the EPUB.
     * 
     * @param { Document } dom The DOM of the first page; e.g. chapter list container page.
     * @param { boolean } useFullTitle 
     * @returns { EpubMetaInfo }
     */
    getEpubMetaInfo(dom, useFullTitle) {
        let metaInfo = new EpubMetaInfo();

        metaInfo.uuid = dom.baseURI;

        try {
            metaInfo.title = this.extractTitle(dom);
        }
        catch (err) {
            metaInfo.title = "";
        }
        try {
            metaInfo.author = this.extractAuthor(dom).trim();
        }
        catch (err) {
            metaInfo.author = "";
        }
        try {
            metaInfo.language = this.extractLanguage(dom);
        }
        catch (err) {
            metaInfo.language = "";
        }
        try {
            metaInfo.fileName = this.makeSaveAsFileNameWithoutExtension(metaInfo.title, useFullTitle);
        }
        catch (err) {
            metaInfo.fileName = "web.epub";
        }
        try {
            metaInfo.subject = this.extractSubject(dom);
        }
        catch (err) {
            metaInfo.subject = "";
        }
        try {
            metaInfo.description = this.extractDescription(dom);
        }
        catch (err) {
            metaInfo.description = "";
        }

        this.extractSeriesInfo(dom, metaInfo);

        return metaInfo;
    }

    singleChapterStory(baseUrl, dom) {
        return [{
            sourceUrl: baseUrl,
            title: this.extractTitle(dom)
        }];
    }

    getBaseUrl(dom) {
        return Array.from(dom.getElementsByTagName("base"))[0].href;
    }

    makeSaveAsFileNameWithoutExtension(title, useFullTitle) {
        let maxFileNameLength = useFullTitle ? 512 : 20;
        let fileName = (title == null)  ? "web" : util.safeForFileName(title, maxFileNameLength);
        if (util.isStringWhiteSpace(fileName)) {
            // title is probably not English, so just use it as is
            fileName = title;
        }
        return fileName;
    }

    /**
     * Get epub item supplier based on cached pages.
     * 
     * @returns { EpubItemSupplier } The created supplier.
     */
    epubItemSupplier() {
        let epubItems = this.webPagesToEpubItems([...this.state.webPages.values()]);

        this.fixupHyperlinksInEpubItems(epubItems);

        return new EpubItemSupplier(this, epubItems, this.imageCollector);
    }

    /**
     * Create epub items for each page.
     * 
     * @param { ChapterLink[] } webPages The pages to make into items
     * @returns { ChapterEpubItem[] } The created items.
     */
    webPagesToEpubItems(webPages) {
        let epubItems = [];
        let index = 0;

        /**
         * TODO: Make getInformationEpubItemChildNodes an abstract function for
         * documentation purposes.
         */
        if (this.userPreferences.addInformationPage.value &&
            this.getInformationEpubItemChildNodes !== undefined) {
            epubItems.push(this.makeInformationEpubItem(this.state.firstPageDom));
            ++index;
        }

        for (let webPage of webPages.filter(c => this.isWebPagePackable(c))) {
            let newItems = (webPage.error == null)
                ? webPage.parser.webPageToEpubItems(webPage, index)
                : this.makePlaceholderEpubItem(webPage, index);

            epubItems = epubItems.concat(newItems);
            index += newItems.length;
            delete(webPage.rawDom);
        }

        return epubItems;
    }

    /**
     * Creates the "extra" information page at the start of created EPUBs.
     * 
     * NOTE: Don't call this if getInformationEpubItemChildNodes is not set.
     * 
     * @param { Document } dom The dom of the main/first ToC page.
     * @returns { ChapterEpubItem } The created item.
     */
    makeInformationEpubItem(dom) {
        let titleText = UIText.Default.informationPageTitle;
        let title = document.createElement("h1");
        title.appendChild(document.createTextNode(titleText));

        let div = document.createElement("div");
        let urlElement = document.createElement("p");
        let bold = document.createElement("b");
        bold.textContent = UIText.Default.tableOfContentsUrl;
        urlElement.appendChild(bold);
        urlElement.appendChild(document.createTextNode(this.state.chapterListUrl));
        div.appendChild(urlElement);

        let infoDiv = document.createElement("div");
        this.populateInfoDiv(infoDiv, dom);
        
        /** @type { (HTMLHeadingElement | HTMLDivElement)[] } */
        let childNodes = [title, div, infoDiv];

        /** @type { ChapterLink } */
        let chapter = {
            sourceUrl: this.state.chapterListUrl,
            title: titleText,
            newArc: null
        };
        
        return new ChapterEpubItem(chapter, { childNodes: childNodes }, 0);
    }

    /**
     * Fill info div with relevant information child items.
     * 
     * NOTE: Don't call this if getInformationEpubItemChildNodes is not set.
     * 
     * @param { HTMLDivElement } infoDiv The element to fill.
     * @param { Document } dom The dom to extract the child items from.
     * @returns { void } Changes are made on {@link infoDiv} directly.
     */
    populateInfoDiv(infoDiv, dom) {
        for (let n of this.getInformationEpubItemChildNodes(dom).filter(n => n != null)) {
            let clone = util.sanitizeNode(n);

            if (clone) {
                this.cleanInformationNode(clone);
            }

            if (clone != null) {
                infoDiv.appendChild(clone);
            }
        }

        // this "page" doesn't go through image collector, so strip images
        util.removeChildElementsMatchingSelector(infoDiv, "img");
    }

    /**
     * FIXME: Figure out what this is intended for.
     * 
     * @param { Node } node The node to clean.
     * @returns { void } Changes are made on {@link node} directly.
     */
    cleanInformationNode(node) {     // eslint-disable-line no-unused-vars
        // do nothing, derived class overrides as required
    }

    /**
     * Called when plugin has obtained the first web page.
     * 
     * @param { UrlString } url Url to the main ToC page used.
     * @param { Document } firstPageDom The DOM of the first page; e.g. chapter list container page.
     * @returns { Promise<void> }
     */
    async onLoadFirstPage(url, firstPageDom) {
        this.state.firstPageDom = firstPageDom;
        this.state.chapterListUrl = url;
        let chapterUrlsUI = new ChapterUrlsUI(this);
        this.userPreferences.setReadingListCheckbox(url);

        try {
            let chapters = await this.getChapterUrls(firstPageDom, chapterUrlsUI);

            if (this.userPreferences.chaptersPageInChapterList.value) {
                chapters = this.addFirstPageUrlToWebPages(url, firstPageDom, chapters);
            }

            chapters = this.cleanWebPageUrls(chapters);
            chapters?.forEach(chapter => chapter.title = chapter.title?.trim());

            await this.userPreferences.readingList.deselectOldChapters(url, chapters);

            chapterUrlsUI.populateChapterUrlsTable(chapters);

            if (0 < chapters.length) {
                if (chapters[0].sourceUrl === url) {
                    chapters[0].rawDom = firstPageDom;
                    this.updateLoadState(chapters[0]);
                }
                ProgressBar.setValue(0);
            }

            this.state.setPagesToFetch(chapters);

            chapterUrlsUI.connectButtonHandlers();
        } catch (err) {
            ErrorLog.showErrorMessage(err);
        }
    }

    /**
     * @param { ChapterLink[] } webPages 
     * @returns { ChapterLink[] }
     */
    cleanWebPageUrls(webPages) {
        /** @type { Set<UrlString> } */
        let foundUrls = new Set();

        /**
         * @param { ChapterLink } webPage 
         * @returns { boolean }
         */
        let isUnique = function(webPage) {
            let unique = !foundUrls.has(webPage.sourceUrl);
            if (unique) {
                foundUrls.add(webPage.sourceUrl);
            }
            return unique;
        };

        return webPages
            .map(this.fixupImgurGalleryUrl)
            .filter(p => util.isUrl(p.sourceUrl))
            .filter(isUnique);
    }

    /**
     * @param { ChapterLink } webPage 
     * @returns { ChapterLink }
     */
    fixupImgurGalleryUrl(webPage) {
        webPage.sourceUrl = Imgur.fixupImgurGalleryUrl(webPage.sourceUrl);
        return webPage;
    }

    /**
     * @param { UrlString } url Url to the main ToC page used.
     * @param { Document } firstPageDom The DOM of the first page; e.g. chapter list container page.
     * @param { ChapterLink[] } webPages 
     * @returns { ChapterLink[] }
     */
    addFirstPageUrlToWebPages(url, firstPageDom, webPages) {
        let present = webPages.find(e => e.sourceUrl === url);
        if (present)
        {
            return webPages;
        } else {
            return [{
                sourceUrl:  url,
                title: this.extractTitle(firstPageDom)
            }].concat(webPages);
        }
    }

    onFetchChaptersClicked() {
        if (0 == this.state.webPages.size) {
            ErrorLog.showErrorMessage(UIText.Error.noChaptersFoundAndFetchClicked);
        } else {
            this.fetchWebPages();
        }
    }

    /**
     * Fetch the chapter contents.
     * 
     * @returns
     */
    fetchContent() {
        return this.fetchWebPages();
    }

    /**
     * Update the progressbar to set the new maximum; and current value to one.
     * 
     * @param { number } length The total number of pages/chapters to be fetched.
     * @returns { void } Changes are made on UI directly.
     */
    setUiToShowLoadingProgress(length) {
        // FIXME: Superfluous?
        main.getPackEpubButton().disabled = true;

        ProgressBar.setMax(length + 1);
        ProgressBar.setValue(1);
    }

    /**
     * 
     * @returns { Promise<unknown> }
     */
    async fetchWebPages() {
        let pagesToFetch = [...this.state.webPages.values()].filter(c => c.isIncludeable);

        if (pagesToFetch.length === 0) {
            return Promise.reject(new Error("No chapters found."));
        }

        this.setUiToShowLoadingProgress(pagesToFetch.length);

        this.imageCollector.reset();
        this.imageCollector.setCoverImageUrl(CoverImageUI.getCoverImageUrl());

        await this.addParsersToPages(pagesToFetch);

        let index = 0;

        try
        {
            let group = this.groupPagesToFetch(pagesToFetch, index);
            while (0 < group.length) {
                await Promise.all(group.map(async (webPage) => this.fetchWebPageContent(webPage)));

                index += group.length;
                group = this.groupPagesToFetch(pagesToFetch, index);

                if (util.sleepController.signal.aborted) {
                    break;
                }
            }
        }
        catch (err)
        {
            ErrorLog.log(err);
        }
    }

    /**
     * Find and append parsers to all pages; which are then added to the parser
     * property.
     * 
     * @param { ChapterLink[] } pagesToFetch The pages to find parsers for. 
     * @returns { Promise<void> } Promise which returns once changes have been made to the {@link pagesToFetch} objects.
     */
    async addParsersToPages(pagesToFetch) {
        parserFactory.addParsersToPages(this, pagesToFetch);
    }

    /**
     * Fetch the next group of pages to fetch **simultanously**, starting from
     * index.
     * 
     * @param { ChapterLink[] } webPages All pages to fetch.
     * @param { number } index The index to start grouping at.
     * @returns { ChapterLink[] } The next group.
     */
    groupPagesToFetch(webPages, index) {
        return webPages.slice(index, index + this.maxSimultanousFetchSize);
    }

    /**
     * 
     * @param { ChapterLink } webPage 
     * @returns 
     * @throws { Error } May throw if fetch fails.
     */
    async fetchWebPageContent(webPage) {
        ChapterUrlsUI.showDownloadState(webPage.row, ChapterUrlsUI.DOWNLOAD_STATE_SLEEPING);

        await this.rateLimitDelay();

        ChapterUrlsUI.showDownloadState(webPage.row, ChapterUrlsUI.DOWNLOAD_STATE_DOWNLOADING);

        let pageParser = webPage.parser;

        try {
            let webPageDom = await pageParser.fetchChapter(webPage.sourceUrl);

            delete webPage.error;

            webPage.rawDom = webPageDom;
            pageParser.preprocessRawDom(webPageDom);
            pageParser.removeUnusedElementsToReduceMemoryConsumption(webPageDom);

            let content = pageParser.findContent(webPage.rawDom);
            if (content == null) {
                let errorMsg = UIText.Error.errorContentNotFound(webPage.sourceUrl);
                throw new Error(errorMsg);
            }

            return pageParser.fetchImagesUsedInDocument(content, webPage);
        } catch (error) {
            if (this.userPreferences.skipChaptersThatFailFetch.value) {
                ErrorLog.log(error);
                webPage.error = error;
            } else {
                webPage.isIncludeable = false;
                throw error;
            }
        }
    }

    /**
     * Download all relevant images.
     * 
     * @param { Element } content The content element.
     * @param { ChapterLink } webPage The chapter link.
     * @returns { Promise<void> } Downloaded images are stored in the {@link imageCollector}.
     */
    async fetchImagesUsedInDocument(content, webPage) {
        let revisedContent = await this.imageCollector.preprocessImageTags(content, webPage.sourceUrl);

        this.imageCollector.findImagesUsedInDocument(revisedContent);
        
        await this.imageCollector.fetchImages(() => { }, webPage.sourceUrl);
        this.updateLoadState(webPage);
    }

    /**
     * default implementation
     * derived classes override if need to do something to fetched DOM before
     * normal processing steps
     * 
     * @param { Document } webPageDom The dom of the page.
     * @returns { void }
     */
    preprocessRawDom(webPageDom) { // eslint-disable-line no-unused-vars
    }

    /**
     * Remove trash from dom.
     * 
     * @param { Document } webPageDom
     * @returns { void }
     */
    removeUnusedElementsToReduceMemoryConsumption(webPageDom) {
        util.removeElements(webPageDom.querySelectorAll("select, iframe"));
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
        return (await HttpClient.wrapFetch(url)).responseXML;
    }

    updateReadingList() {
        this.userPreferences.readingList.update(
            this.state.chapterListUrl,
            [...this.state.webPages.values()]
        );
    }

    /**
     * FIXME: Update UI to show a page has been downloaded? If so a rename is
     * probably warranted?
     * 
     * @param { ChapterLink } webPage The page to set the state for.
     * @returns { void } Changes are made on elements directly.
     */
    updateLoadState(webPage) {
        ChapterUrlsUI.showDownloadState(webPage.row, ChapterUrlsUI.DOWNLOAD_STATE_LOADED);
        ProgressBar.updateValue(1);
    }

    /**
     * Do something when "Pack EPUB" button is pressed.
     *
     * @returns { void}
     */
    onStartCollecting() {
    }    

    /**
     * Fix internal links inside epub items.
     * 
     * @param { ChapterEpubItem[] } epubItems The epub items whose links to fix.
     * @returns { void } Changes are made on {@link epubItems} directly.
     */
    fixupHyperlinksInEpubItems(epubItems) {
        let targets = this.sourceUrlToEpubItemUrl(epubItems);

        for (let item of epubItems) {
            for (let link of item.getHyperlinks().filter(this.isUnresolvedHyperlink)) {
                if (!this.hyperlinkToEpubItemUrl(link, targets)) {
                    this.makeHyperlinkAbsolute(link);
                }
            }
        }
    }

    /**
     * Convert chapter url to "internal" epub.
     * 
     * @param { ChapterEpubItem[] } epubItems The epub items.
     * @returns { Map<UrlString, UrlString> } Pairs of the original link and the epub link.
     */
    sourceUrlToEpubItemUrl(epubItems) {
        /** @type { Map<UrlString, UrlString> } */
        let targets = new Map();

        for (let item of epubItems) {
            let key = util.normalizeUrlForCompare(item.sourceUrl);
            
            // Some source URLs may generate multiple epub items.
            // In that case, want FIRST epub item
            if (!targets.has(key)) {
                targets.set(key, util.makeRelative(item.getZipHref()));
            }
        }

        return targets;
    }

    /**
     * Check whether an element is has a href, and whether it points to
     * somewhere unresolved.
     * 
     * @param { Element } link The element to check.
     * @returns { boolean } Whether it leads to somewhere unresolved.
     */
    isUnresolvedHyperlink(link) {
        let href = link.getAttribute("href");

        if (href == null) {
            return false;
        }

        return !href.startsWith("#") &&
            !href.startsWith("../Text/");
    }

    /**
     * Check whether a link points to an epub item "internal" link. If the
     * target does point to an epub item, modify its href.
     * 
     * @param { HTMLAnchorElement } link 
     * @param { Map<UrlString, UrlString> } targets 
     * @returns { boolean } Whether the link href points to a epub item in targets.
     */
    hyperlinkToEpubItemUrl(link, targets) {
        let key = util.normalizeUrlForCompare(link.href);
        let targetInEpub = targets.has(key);

        if (targetInEpub) {
            link.href = targets.get(key) + link.hash;
        }

        return targetInEpub;
    }

    /**
     * FIXME: I don't know.
     * 
     * @param { HTMLAnchorElement } link The anchor whose href to make absolute.
     * @returns { void } Changes are made on {@link link} directly.
     */
    makeHyperlinkAbsolute(link) {
        if (link.href !== link.getAttribute("href")) {
            link.href = link.href;       // eslint-disable-line no-self-assign
        }
    }

    /**
     * Whether the parser is disabled.
     * 
     * @returns { string | null } String error/reason message; or null for enabled.
     */
    disabled() {
        return null;
    }

    tagAuthorNotes(elements) {
        for (let e of elements) {
            e.classList.add("webToEpub-author-note");
        }
    }

    tagAuthorNotesBySelector(element, selector) {
        let notes = element.querySelectorAll(selector);
        if (this.userPreferences.removeAuthorNotes.value) {
            util.removeElements(notes);
        } else {
            this.tagAuthorNotes(notes);
        }
    }

    /**
     * Create an empty document.
     * 
     * @param { UrlString | null | undefined } baseUrl The base url to use for the created document.
     * @returns { { dom: Document, content: HTMLDivElement } } The created document and main content container.
     */
    static makeEmptyDocForContent(baseUrl) {
        let dom = document.implementation.createHTMLDocument("");

        if (baseUrl != null) {
            util.setBaseTag(baseUrl, dom);        
        }

        let content = dom.createElement("div");
        content.className = Parser.WEB_TO_EPUB_CLASS_NAME;
        dom.body.appendChild(content);

        return {
            dom: dom,
            content: content 
        };
    }

    /**
     * Find artificial content container div which may have been created earlier
     * in dom.
     * 
     * @param { Document } dom The parent to look in.
     * @returns { HTMLDivElement | null } The found content container.
     * 
     * @public
     */
    static findConstrutedContent(dom) {
        return /** @type { HTMLDivElement | null } */ (dom.querySelector("div." + Parser.WEB_TO_EPUB_CLASS_NAME));
    }

    static addTextToChapterContent(newDoc, contentText) {
        let lines = contentText
            .replace(/\r/g, "\n")
            .replace(/\n\n/g, "\n")
            .split("\n")
            .filter(s => !util.isNullOrEmpty(s));
        for (let line of lines) {
            let pnode = newDoc.dom.createElement("p");
            pnode.textContent = line;
            newDoc.content.appendChild(pnode);
        }
    }

    /**
     * Extract chapter links from all ToC pages found in `dom`.
     * 
     * @param { Document } dom The first/main ToC page dom.
     * @param { (dom: Document) => ChapterLink[] } extractPartialChapterList Function which extracts chapter links from ToC doms.
     * @param { (dom: Document) => UrlString[] } getUrlsOfTocPages Function which extracts the urls of all ToC pages to fetch.
     * @param { ChapterUrlsUI } chapterUrlsUI Reference the the UI to update progress.
     * @returns { Promise<ChapterLink[]> } Promise which resolves to all found chapter links.
     * 
     * @throws { TypeError | RangeError | Error } `this.getChaptersFromAllTocPages`
     * 
     * @protected
     */
    async getChapterUrlsFromMultipleTocPages(dom, extractPartialChapterList, getUrlsOfTocPages, chapterUrlsUI)  {
        let chapters = extractPartialChapterList(dom);
        let urlsOfTocPages = getUrlsOfTocPages(dom);

        return await this.getChaptersFromAllTocPages(chapters, extractPartialChapterList, urlsOfTocPages, chapterUrlsUI);
    }

    /**
     * Compile minimum rate limits from all sources and return value.
     * 
     * @returns { number } The actual rate limiting/time to wait.
     */
    getRateLimit()
    {
        let manualDelayPerChapterValue = (!isNaN(parseInt(this.userPreferences.manualDelayPerChapter.value)))?parseInt(this.userPreferences.manualDelayPerChapter.value):this.minimumThrottle;

        if (!this.userPreferences.overrideMinimumDelay.value)
        {
            return Math.max(this.minimumThrottle, manualDelayPerChapterValue);
        }

        return manualDelayPerChapterValue;
    }

    /**
     * Sleep function between chapters.
     * 
     * @returns { Promise<void> } Promise which returns when sleep is completed.
     */
    async rateLimitDelay() {
        let manualDelayPerChapterValue = this.getRateLimit();
        await util.sleep(manualDelayPerChapterValue);
    }

    /**
     * Fetch all chapters found on `urlsOfRocPages` and append them to
     * `chapters` and return updated list.
     * 
     * @param { ChapterLink[] } chapters The current chapters list.
     * @param { (dom: Document) => ChapterLink[] } extractPartialChapterList Function which extracts chapter links from ToC doms.
     * @param { UrlString[] } urlsOfTocPages The urls of the ToC pages to extract from.
     * @param { ChapterUrlsUI } chapterUrlsUI Reference the the UI to update progress.
     * @param { Partial<WrapFetchOptions> } [wrapOptions] Optional options passed along when fetching pages.
     * @returns { Promise<ChapterLink[]> } Promise which resolves to all found chapter links.
     * 
     * @throws { TypeError | RangeError | Error } `HttpClient.wrapFetch`
     * 
     * @protected
     */
    async getChaptersFromAllTocPages(chapters, extractPartialChapterList, urlsOfTocPages, chapterUrlsUI, wrapOptions)  {
        if (0 < chapters.length) {
            chapterUrlsUI.showTocProgress(chapters);
        }

        for (let url of urlsOfTocPages) {
            await this.rateLimitDelay();

            let newDom = (await HttpClient.wrapFetch(url, wrapOptions)).responseXML;
            let partialList = extractPartialChapterList(newDom);

            chapterUrlsUI.showTocProgress(partialList);
            chapters = chapters.concat(partialList);
        }

        return chapters;
    }

    async walkTocPages(dom, chaptersFromDom, nextTocPageUrl, chapterUrlsUI) {
        let chapters = chaptersFromDom(dom);
        chapterUrlsUI.showTocProgress(chapters);
        let url = nextTocPageUrl(dom, chapters, chapters);
        while (url != null) {
            await this.rateLimitDelay();
            dom = (await HttpClient.wrapFetch(url)).responseXML;
            let partialList = chaptersFromDom(dom);
            chapterUrlsUI.showTocProgress(partialList);
            chapters = chapters.concat(partialList);
            url = nextTocPageUrl(dom, chapters, partialList);
        }
        return chapters;
    }

    moveFootnotes(dom, content, footnotes) {
        if (0 < footnotes.length) {
            let list = dom.createElement("ol");
            for (let f of footnotes) {
                let item = dom.createElement("li");
                f.removeAttribute("style");
                item.appendChild(f);
                list.appendChild(item);
            }
            let header = dom.createElement("h2");
            header.appendChild(dom.createTextNode("Footnotes"));
            content.appendChild(header);
            content.appendChild(list);
        }
    }

    async walkPagesOfChapter(url, moreChapterTextUrl) {
        let dom = (await HttpClient.wrapFetch(url)).responseXML;
        let count = 2;
        let nextUrl = moreChapterTextUrl(dom, url, count);
        let oldContent = this.findContent(dom);
        while (nextUrl != null) {
            await this.rateLimitDelay();
            let nextDom = (await HttpClient.wrapFetch(nextUrl)).responseXML;
            let newContent = this.findContent(nextDom);
            nextUrl = moreChapterTextUrl(nextDom, url, ++count);
            oldContent.appendChild(dom.createElement("br"));
            util.moveChildElements(newContent, oldContent);
        }
        return dom;
    }

    /**
     * Function for fetching the links to **all** chapters.
     * 
     * @param { Document } firstPageDom The DOM of the main/first page.
     * @param { ChapterUrlsUI } chapterUrlsUI Reference to the UI to allow for loading progress updates.
     * @returns { Promise<ChapterLink[]> } The found chapters.
     * 
     * @throws { Error } Subclass implementations are "allowed to" throw.
     * 
     * @protected
     * @abstract
     */
    async getChapterUrls(firstPageDom, chapterUrlsUI) { // eslint-disable-line no-unused-vars
        throw new Error("Abstract method not implemented.");
    }

    /**
     * Function for extracting the chapter content from the chapter dom.
     * 
     * @param { Document } dom The dom of the chapter page.
     * @returns { Element } The element holding the content.
     * 
     * @protected
     * @abstract
     */
    findContent(dom) { // eslint-disable-line no-unused-vars
        throw new Error("Abstract method not implemented.");
    }

    /**
     * @callback getInformationEpubItemChildNodes
     * @param { Document } dom The document to extract information from.
     * @returns { Node[] } Array containing the found relevant information.
     */

    /**
     * Extract relevant information to put on information page; not required to
     * implement.
     * 
     * FIXME: This makes TS errors at every implementation since it now expects
     *        this to be a property, not a member function. But to fix this you
     *        need to rework either the call-sites or usages.
     * 
     * @type { getInformationEpubItemChildNodes | undefined }
     * @protected
     */
    getInformationEpubItemChildNodes;
}

Parser.WEB_TO_EPUB_CLASS_NAME = "webToEpubContent";
