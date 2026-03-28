"use strict";

/**
 * Keep track of how to user tells us to parse different sites.
 */
class DefaultParserSiteSettings {
    /**
     * The currently configs in memory.
     * 
     * @type { Map<HostnameString, DefaultParserConfig> | undefined }
     * @private
     */
    configs;

    /**
     * @public
     */
    constructor() {
        this.loadSiteConfigs();
    }

    /**
     * Load site configs from local storage into `this.configs`.
     * 
     * @returns { void } Changes are made on state directly.
     * 
     * @private
     */
    loadSiteConfigs() {
        let config = window.localStorage.getItem(DefaultParserSiteSettings.storageName);
        this.configs = new Map();

        if (config != null) {
            for (let e of JSON.parse(config)) {
                let selectors = e[1];

                if (DefaultParserSiteSettings.isConfigValid(selectors)) {
                    this.configs.set(e[0], selectors);
                }
            }
        }
    }

    /**
     * Check whether an object is a valid `DefaultParserSiteConfig`.
     * 
     * @param { object } selectors The object to check.
     * @returns { boolean } Whether it is a valid config.
     * 
     * @public
     */
    static isConfigValid(selectors) {
        return (selectors.contentCss !== undefined)
            && !util.isNullOrEmpty(selectors.contentCss);
    }

    /**
     * Update the config for given hostname if it has changed and persist it to
     * local storage.
     * 
     * @param { HostnameString } hostname The hostname to set the config for.
     * @param { string } contentCss The new content css.
     * @param { string } titleCss The new title css.
     * @param { string } removeCss The new removal css.
     * @param { string } testUrl The new test url.
     * @returns { void } Changes are made on state directly.
     * 
     * @public
     */
    saveSiteConfig(hostname, contentCss, titleCss, removeCss, testUrl) {
        if (this.isConfigChanged(hostname, contentCss, titleCss, removeCss, testUrl)) {
            this.configs.set(
                hostname, { 
                    contentCss: contentCss, 
                    titleCss: titleCss, 
                    removeCss: removeCss,
                    testUrl: testUrl 
                }
            );

            let serialized = JSON.stringify(Array.from(this.configs.entries()));
            window.localStorage.setItem(DefaultParserSiteSettings.storageName, serialized);
        }
    }

    /**
     * Check whether the configuration for a give hostname has changed compared
     * to the current config values.
     * 
     * @param { HostnameString } hostname The hostname to check config for.
     * @param { string } contentCss The new content css.
     * @param { string } titleCss The new title css.
     * @param { string } removeCss The new removal css.
     * @param { string } testUrl The new test url.
     * @returns { boolean } Whether the config for hostname has changed.
     * 
     * @private
     */
    isConfigChanged(hostname, contentCss, titleCss, removeCss, testUrl) {
        let config = this.configs.get(hostname);

        return (config === undefined) || 
            (contentCss !== config.contentCss) ||
            (titleCss !== config.titleCss) || 
            (removeCss !== config.removeCss) ||
            (testUrl !== config.testUrl);
    }

    /**
     * Fetch the current config for the provided hostname.
     * 
     * @param { HostnameString } hostname The hostname to get config for.
     * @returns { DefaultParserConfig | undefined } The found config.
     * 
     * @public
     */
    getConfigForSite(hostname) {
        return this.configs.get(hostname);
    }

    /**
     * Create logic functions for the given `hostname` taken from config, or
     * using defaults.
     * 
     * @param { HostnameString } hostname The hostname to create logic functions for.
     * @returns { DefaultParserLogic } The created logic functions.
     * 
     * @public
     */
    constructFindContentLogicForSite(hostname) {
        /** @type { DefaultParserLogic } */
        let logic = {
            findContent: dom => dom.querySelector("body"),
            findChapterTitle: () => null,
            removeUnwanted: () => null
        };

        let config = this.getConfigForSite(hostname);

        if (config != null) {
            logic.findContent = dom => dom.querySelector(config.contentCss);

            if (!util.isNullOrEmpty(config.titleCss))
            {
                logic.findChapterTitle = dom => dom.querySelector(config.titleCss);
            }

            if (!util.isNullOrEmpty(config.removeCss))
            {
                logic.removeUnwanted = (element) => {
                    for (let e of element.querySelectorAll(config.removeCss)) {
                        e.remove();
                    }
                };
            }
        }

        return logic;
    }
}

/**
 * The key used to store information in local storage.
 * 
 * @type { string }
 * @public
 */
DefaultParserSiteSettings.storageName = "DefaultParserConfigs";

/**
 * Class that handles UI for configuring the `DefaultParser`.
 */
class DefaultParserUI { // eslint-disable-line no-unused-vars
    /**
     * @private
     */
    constructor() {}

    /**
     * Configure/setup default parser for use with provided hostname.
     * 
     * @param { HostnameString } hostname The hostname to get/set parser config for.
     * @param { DefaultParser } parser The default parser instance.
     * @returns { void } Changes are made on state directly.
     * 
     * @public
     */
    static setupDefaultParserUI(hostname, parser) {
        DefaultParserUI.copyInstructions();
        DefaultParserUI.setDefaultParserUiVisibility(true);
        DefaultParserUI.populateDefaultParserUI(hostname, parser);
        document.getElementById("testDefaultParserButton").onclick = DefaultParserUI.testDefaultParser.bind(null, parser);
        document.getElementById("finisheddefaultParserButton").onclick = DefaultParserUI.onFinishedClicked.bind(null, parser);
    }

    /**
     * Handler for when the user clicks the "finished" button for the default
     * parser.
     * 
     * @param { DefaultParser } parser The default parser instance.
     * @returns { void } Changes are made on state and UI directly.
     * 
     * @private
     */
    static onFinishedClicked(parser) {
        DefaultParserUI.AddConfiguration(parser);
        DefaultParserUI.setDefaultParserUiVisibility(false);
    }

    /**
     * Save current configuration in UI to local storage.
     * 
     * @param { DefaultParser } parser The default parser instance.
     * @returns { void } Changes are made on local storage directly.
     * 
     * @private
     */
    static AddConfiguration(parser) {
        let hostname = DefaultParserUI.getDefaultParserHostnameInput().value;
        let contentCss = DefaultParserUI.getContentCssInput().value;
        let titleCss = DefaultParserUI.getChapterTitleCssInput().value;
        let removeCss = DefaultParserUI.getUnwantedElementsCssInput().value.trim();
        let testUrl = DefaultParserUI.getTestChapterUrlInput().value.trim();

        parser.siteConfigs.saveSiteConfig(hostname, contentCss, titleCss, removeCss, testUrl);
    }

    /**
     * Populate default parser UI with relevant information.
     * 
     * @param { HostnameString } hostname The hostname the parser is being used on.
     * @param { DefaultParser } parser The default parser instance.
     * 
     * @private
     */
    static populateDefaultParserUI(hostname, parser) {
        DefaultParserUI.getDefaultParserHostnameInput().value = hostname;

        DefaultParserUI.getContentCssInput().value = "body";
        DefaultParserUI.getChapterTitleCssInput().value = "";
        DefaultParserUI.getUnwantedElementsCssInput().value = "";
        DefaultParserUI.getTestChapterUrlInput().value = "";

        let config = parser.siteConfigs.getConfigForSite(hostname);
        if (config != null) {
            DefaultParserUI.getContentCssInput().value = config.contentCss;
            DefaultParserUI.getChapterTitleCssInput().value = config.titleCss;
            DefaultParserUI.getUnwantedElementsCssInput().value = config.removeCss;
            DefaultParserUI.getTestChapterUrlInput().value = config.testUrl;
        }
    }

    /**
     * Sets whether the default parser UI should be visible; and sets the normal
     * view to the opposite.
     * 
     * @param { boolean } isVisible Whether the default parser UI should be visible.
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static setDefaultParserUiVisibility(isVisible) {
        // toggle mode
        ChapterUrlsUI.setVisibleUI(!isVisible);

        if (isVisible) {
            ChapterUrlsUI.getEditChaptersUrlsInput().hidden = true;
            ChapterUrlsUI.modifyApplyChangesButtons(button => button.hidden = true);
            document.getElementById("editURLsHint").hidden = true;
        }

        document.getElementById("defaultParserSection").hidden = !isVisible;
    }

    /**
     * Test run the default parser with either the stored config or the one
     * provided in the UI.
     * 
     * @param { DefaultParser } parser The default parser instance.
     * @returns { Promise<void> } Result will be shown directly in the UI.
     * 
     * @private
     */
    static async testDefaultParser(parser) {
        DefaultParserUI.AddConfiguration(parser);

        let hostname = DefaultParserUI.getDefaultParserHostnameInput().value;
        let config = parser.siteConfigs.getConfigForSite(hostname);

        if (util.isNullOrEmpty(config.testUrl))
        {
            alert(UIText.Warning.warningNoChapterUrl);
            return;
        }

        try {
            let xhr = await HttpClient.wrapFetch(config.testUrl);
            let webPage = { rawDom: util.sanitize(xhr.responseXML.querySelector("*")) };
            let content = parser.findContent(webPage.rawDom);

            if (content === null) {
                let errorMsg = UIText.Error.errorContentNotFound(config.testUrl);
                throw new Error(errorMsg);
            }

            parser.removeUnwantedElementsFromContentElement(content);
            parser.addTitleToContent(webPage, content);

            DefaultParserUI.showResult(content);
        } catch (err) {
            ErrorLog.showErrorMessage(err);
        }
    }

    /**
     * Reset the results view.
     * 
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static cleanResults() {
        let resultElement = DefaultParserUI.getResultViewElement();
        let children = resultElement.childNodes;

        while (0 < children.length) {
            children[children.length - 1].remove();
        }
    }

    /**
     * Show default instructions in the UI.
     * 
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static copyInstructions() {
        let content = /** @type { HTMLDivElement | null } */ (document.getElementById("defaultParserInstructions"));
        DefaultParserUI.showResult(content);
    }

    /**
     * Take children from `content` and show them in the UI.
     * 
     * @param { ParentNode | null | undefined } content Container node from which to take result children from to display.
     * @returns { void } Changes are made on elements directly.
     * 
     * @private
     */
    static showResult(content) {
        DefaultParserUI.cleanResults();

        if (content != null) {
            let resultElement = DefaultParserUI.getResultViewElement();
            util.moveChildElements(content, resultElement);
        }
    }

    /**
     * Get the input for the page hostname.
     * 
     * @returns { HTMLInputElement | null } The found element.
     * 
     * @private
     */
    static getDefaultParserHostnameInput() {
        return /** @type { HTMLInputElement | null } */ (document.getElementById("defaultParserHostName"));
    }

    /**
     * Get the input for the chapter content css selectors.
     * 
     * @returns { HTMLInputElement | null } The found element.
     * 
     * @private
     */
    static getContentCssInput() {
        return /** @type { HTMLInputElement | null } */ (document.getElementById("defaultParserContentCss"));
    }

    /**
     * Get the input element for the chapter title css selectors.
     * 
     * @returns { HTMLInputElement | null } The found element.
     * 
     * @private
     */
    static getChapterTitleCssInput() {
        return /** @type { HTMLInputElement | null } */ (document.getElementById("defaultParserChapterTitleCss"));
    }

    /**
     * Get the input element for css selectors to remove.
     * 
     * @returns { HTMLInputElement | null } The found element.
     * 
     * @private
     */
    static getUnwantedElementsCssInput() {
        return /** @type { HTMLInputElement | null } */ (document.getElementById("defaultParserUnwantedElementsCss"));
    }

    /**
     * Get the input element for the first chapter url.
     * 
     * @returns { HTMLInputElement | null } The found element.
     * 
     * @private
     */
    static getTestChapterUrlInput() {
        return /** @type { HTMLInputElement | null } */ (document.getElementById("defaultParserTestChapterUrl"));
    }

    /**
     * Get the results view div.
     * 
     * @returns { HTMLDivElement | null } The found element.
     * 
     * @private
     */
    static getResultViewElement() {
        return /** @type { HTMLDivElement | null } */ (document.getElementById("defaultParserVewResult"));
    }
}

