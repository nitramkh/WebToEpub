"use strict";

parserFactory.registerManualSelect(
    "Default", 
    () => new DefaultParser()
);

/*
 * Parser used when can't match a parser for the document.
 */
class DefaultParser extends Parser {
    /**
     * The current site specific configs.
     * 
     * @type { DefaultParserSiteSettings }
     * @public
     */
    siteConfigs;

    /**
     * Callbacks for the main parser methods to be used.
     * 
     * @type { DefaultParserLogic | null }
     * @private
     */
    logic;

    /**
     * @public
     */
    constructor() {
        super();
        this.siteConfigs = new DefaultParserSiteSettings();
        this.logic = null;
    }

    /**
     * @inheritdoc
     * 
     * @override
     * @param { Document } dom The DOM of the main/first page.
     * @returns { Promise<ChapterLink[]> } The found chapters.
     * 
     * @protected
     */
    getChapterUrls(dom) {
        return Promise.resolve(util.hyperlinksToChapterList(dom.body));
    }

    /**
     * @inheritdoc
     * 
     * @override
     * @param { Document } dom The dom of the chapter page.
     * @returns { Element } The element holding the content.
     * 
     * @protected
     */
    findContent(dom) {
        let hostName = util.extractHostName(dom.baseURI);
        this.logic = this.siteConfigs.constructFindContentLogicForSite(hostName);
        return this.logic.findContent(dom); 
    }

    /**
     * @inheritdoc
     * 
     * @override
     * @param { Document } dom The DOM of the first page; e.g. chapter list container page.
     * @returns { void }  Changes are made on UI directly.
     * 
     * @public
     */
    populateUI(dom) {
        super.populateUI(dom);
        let hostname = util.extractHostName(dom.baseURI);
        DefaultParserUI.setupDefaultParserUI(hostname, this);
    }

    /**
     * Override default (keep nearly everything, may be wanted)
     * 
     * ***
     * 
     * @inheritdoc
     * 
     * @override
     * @param { Element } element The element to remove from.
     * @returns { void } Changes are made on the provided `element` object.
     * 
     * @protected
     */
    removeUnwantedElementsFromContentElement(element) {
        util.removeElements(element.querySelectorAll("script[src], iframe"));
        util.removeComments(element);
        util.removeUnwantedWordpressElements(element);
        util.removeMicrosoftWordCrapElements(element);
        this.logic.removeUnwanted(element);
    }

    /**
     * @inheritdoc
     * 
     * @override
     * @param { Document } dom The full dom of the chapter page.
     * @returns { Element | string | null } The found title or null if unable.
     * 
     * @protected
     */
    findChapterTitle(dom) {
        return this.logic.findChapterTitle(dom);
    }
}
