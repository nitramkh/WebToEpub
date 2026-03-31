/**
 * Main processing handler for popup.html
 */
var main = (function() {
    "use strict";

    /**
     * this will be called when message listener fires
     * 
     * @param { any } message The recieved message; not yet confirmed from the injected script.
     * @param { chrome.runtime.MessageSender } sender 
     * @param { (response?: any) => void } sendResponse 
     * @returns { void }
     */
    function onMessageListener(message, sender, sendResponse) {  // eslint-disable-line no-unused-vars
        if (message.messageType == "ParseResults") {
            chrome.runtime.onMessage.removeListener(onMessageListener);
            util.log("addListener");
            util.log(message);
            // convert the string returned from content script back into a DOM
            let dom = new DOMParser().parseFromString(message.document, "text/html");
            populateControlsWithDom(message.url, dom);
        }
    }

    /**
     * The DOM of the first page; e.g. chapter list container page.
     * 
    * @type { Document | null }
     */ 
    let initialWebPage = null;

    /**
     * @type { Parser | null | undefined }
     */
    let parser = null;

    /**
     * @type { UserPreferences | null }
     */
    let userPreferences = null;

    /**
     * @type { Library }
     */
    let library = new Library; 

    /**
     * Register listener that is invoked when script injected into HTML sends
     * its results.
     * 
     * @returns { void }
     */
    function addMessageListener() {
        try {
            // note, this will throw if not running as an extension.
            if (!chrome.runtime.onMessage.hasListener(onMessageListener)) {
                chrome.runtime.onMessage.addListener(onMessageListener);
            }
        } catch (chromeError) {
            util.log(chromeError);
        }
    }

    /**
     * Extract urls from DOM and populate control.
     * 
     * @param { UrlString } url Url to the main ToC page used.
     * @param { Document } dom The DOM of the first page; e.g. chapter list container page.
     * @returns { Promise<void> }
     */
    async function processInitialHtml(url, dom) {
        if (setParser(url, dom)) {
            try {
                userPreferences.addObserver(parser);
            } catch (error) {
                ErrorLog.showErrorMessage(error);
                return;
            }
            try {
                await parser.loadEpubMetaInfo(dom);

                let metaInfo = parser.getEpubMetaInfo(dom, userPreferences.useFullTitle.value);

                populateMetaInfo(metaInfo);
                setUiToDefaultState();
                parser.populateUI(dom);
            } catch (error) {
                ErrorLog.showErrorMessage(error);
            }
            try {
                await parser.onLoadFirstPage(url, dom);
            } catch (error) {
                ErrorLog.showErrorMessage(error);
            }
        }
    }

    /**
     * @returns { void }
     */
    function setUiToDefaultState() {
        document.getElementById("highestResolutionImagesRow").hidden = true;
        document.getElementById("unSuperScriptAlternateTranslations").hidden = true; 
        document.getElementById("imageSection").hidden = true;
        document.getElementById("outputSection").hidden = false;
        document.getElementById("translatorRow").hidden = true;
        document.getElementById("fileAuthorAsRow").hidden = true;
        document.getElementById("defaultParserSection").hidden = true;
    }

    /**
     * Displays information from metaInfo in UI.
     * 
     * @param { EpubMetaInfo } metaInfo 
     */
    function populateMetaInfo(metaInfo) {
        setUiFieldToValue("startingUrlInput", metaInfo.uuid);
        setUiFieldToValue("titleInput", metaInfo.title);
        setUiFieldToValue("authorInput", metaInfo.author);
        setUiFieldToValue("languageInput", metaInfo.language);
        setUiFieldToValue("fileNameInput", metaInfo.fileName);
        setUiFieldToValue("subjectInput", metaInfo.subject);
        setUiFieldToValue("descriptionInput", metaInfo.description);
        if (metaInfo.seriesName !== null) {
            document.getElementById("seriesRow").hidden = false;
            document.getElementById("volumeRow").hidden = false;
            setUiFieldToValue("seriesNameInput", metaInfo.seriesName);
            setUiFieldToValue("seriesIndexInput", metaInfo.seriesIndex);
        }

        setUiFieldToValue("translatorInput", metaInfo.translator);
        setUiFieldToValue("fileAuthorAsInput", metaInfo.fileAuthorAs);
    }

    /**
     * Sets the value of a field in the UI.
     * 
     * @param { HTMLIDString } elementId 
     * @param { string | null } value
     * @throws { Error } If the provided id is bad. 
     */
    function setUiFieldToValue(elementId, value) {
        let element = document.getElementById(elementId);
        if (util.isTextInputField(element) || util.isTextAreaField(element)) {
            /** @type { HTMLInputElement | HTMLTextAreaElement } */ (element).value = (value == null) ? "" : value;
        } else {
            throw new Error(UIText.Error.unhandledFieldTypeError);
        }
    }

    /**
     * Builds a new {@link EpubMetaInfo} from the contents of UI.
     * 
     * @returns { EpubMetaInfo }
     */
    function metaInfoFromControls() {
        let metaInfo = new EpubMetaInfo();

        metaInfo.uuid = getValueFromUiField("startingUrlInput");
        metaInfo.title = getValueFromUiField("titleInput");
        metaInfo.author = getValueFromUiField("authorInput");
        metaInfo.language = getValueFromUiField("languageInput");
        metaInfo.fileName = getValueFromUiField("fileNameInput");
        metaInfo.subject = getValueFromUiField("subjectInput");
        metaInfo.description = getValueFromUiField("descriptionInput");

        if (document.getElementById("seriesRow").hidden === false) {
            metaInfo.seriesName = getValueFromUiField("seriesNameInput");
            metaInfo.seriesIndex = getValueFromUiField("seriesIndexInput");
        }

        metaInfo.translator = getValueFromUiField("translatorInput");
        metaInfo.fileAuthorAs = getValueFromUiField("fileAuthorAsInput");
        metaInfo.styleSheet = userPreferences.styleSheet.value;

        return metaInfo;
    }

    /**
     * Fetches a value from a UI field.
     * 
     * @param { HTMLIDString } elementId 
     * @returns { string | null }
     */
    function getValueFromUiField(elementId) {
        let element = document.getElementById(elementId);

        if (element != null && (util.isTextInputField(element) || util.isTextAreaField(element))) {
            const input = /** @type { HTMLInputElement | HTMLTextAreaElement } */ (element);

            // FIXME: This should probably check for pure whitespace as well?
            return (input.value === "") ? null : input.value;
        } else {
            throw new Error(UIText.Error.unhandledFieldTypeError);
        }
    }

    /**
     * The main handler for downloading the chapters and creating the epub.
     * 
     * @this { DatasetContext | undefined }
     * @returns { Promise<void> }
     */
    async function fetchContentAndPackEpub() {
        let libclick = this;

        if (document.getElementById("noAdditionalMetadataCheckbox").checked == true) {
            setUiFieldToValue("subjectInput", "");
            setUiFieldToValue("descriptionInput", "");
        }
        let metaInfo = metaInfoFromControls();

        if ("yes" == libclick.dataset.libclick) {
            if (document.getElementById("chaptersPageInChapterListCheckbox").checked) {
                ErrorLog.showErrorMessage(UIText.Error.errorAddToLibraryLibraryAddPageWithChapters);
                return;
            }
        }

        ChapterUrlsUI.limitNumOfChapterS(userPreferences.maxChaptersPerEpub.value);
        ChapterUrlsUI.resetDownloadStateImages();
        ErrorLog.clearHistory();

        window.workInProgress = true;
        main.getPackEpubButton().disabled = true;
        replaceLibAddToLibrary();

        parser.onStartCollecting();
        await parser.fetchContent();
        let content = await packEpub(metaInfo);
        
        // Enable button here.  If user cancels save dialog
        // the promise never returns
        window.workInProgress = false;
        main.getPackEpubButton().disabled = false;
        replaceLibAddToLibrary();

        let overwriteExisting = userPreferences.overwriteExistingEpub.value;
        let backgroundDownload = userPreferences.noDownloadPopup.value;
        let fileName = Download.CustomFilename();
        if ("yes" == libclick.dataset.libclick || util.sleepController.signal.aborted) {
            await library.LibAddToLibrary(
                content,
                fileName,
                /** @type { HTMLInputElement | null } */ (document.getElementById("startingUrlInput")).value,
                overwriteExisting,
                backgroundDownload
            );
        } else {
            await Download.save(content, fileName, overwriteExisting, backgroundDownload);
        }
        try {
            parser.updateReadingList();
            if (util.sleepController.signal.aborted) {
                util.sleepController = new AbortController;
                resetUI();
            }
            if (libclick.dataset.libsuppressErrorLog == true) {
                return;
            } else {
                ErrorLog.showLogToUser();
                dumpErrorLogToFile();
            }
        } catch (err) {
            window.workInProgress = false;
            main.getPackEpubButton().disabled = false;
            if (util.sleepController.signal.aborted) {
                util.sleepController = new AbortController;
            }
            replaceLibAddToLibrary();
            ErrorLog.showErrorMessage(err);
        }
    }

    /**
     * Swap the library buttons.
     * 
     * @returns { void }
     */
    function replaceLibAddToLibrary() {
        let el = document.getElementById("LibAddToLibrary");
        el.hidden = !el.hidden;
        el = document.getElementById("LibPauseToLibrary");
        el.hidden = !el.hidden;
    }

    function pauseToLibrary() {
        util.sleepController.abort();
    }

    /**
     * Get the preferred epub version.
     * 
     * @returns { string } The preferred version.
     */
    function epubVersionFromPreferences() {
        return userPreferences.createEpub3.value ? 
            EpubPacker.EPUB_VERSION_3 : EpubPacker.EPUB_VERSION_2;
    }

    /**
     * Pack the epub into a zip blob.
     * 
     * @param { EpubMetaInfo } metaInfo The meta info to use inside the epub.
     * @returns { Promise<Blob> } The (future) blob of the entire packed epub.
     */
    function packEpub(metaInfo) {
        let epubVersion = epubVersionFromPreferences();
        let epub = new EpubPacker(metaInfo, epubVersion);

        return epub.assemble(parser.epubItemSupplier());
    }

    function dumpErrorLogToFile() {
        let errors = ErrorLog.dumpHistory();
        if (userPreferences.writeErrorHistoryToFile.value &&
            !util.isNullOrEmpty(errors)) {
            let fileName = metaInfoFromControls().fileName + ".ErrorLog.txt";
            let blob = new Blob([errors], {type : "text"});
            return Download.save(blob, fileName)
                .catch (err => ErrorLog.showErrorMessage(err));
        }
    }

    function getActiveTabDOM(tabId) {
        addMessageListener();
        injectContentScript(tabId);
    }

    function injectContentScript(tabId) {
        if (util.isFirefox()) {
            Firefox.injectContentScript(tabId);
        } else {
            chromeInjectContentScript(tabId);
        }
    }

    function chromeInjectContentScript(tabId) {
        try {
            chrome.scripting.executeScript({
                target: {tabId: tabId},
                files: ["js/ContentScript.js"]
            });
        } catch {
            if (chrome.runtime.lastError) {
                util.log(chrome.runtime.lastError.message);
            }
        }
    }

    function populateControls() {
        loadUserPreferences();
        parserFactory.populateManualParserSelectionTag(getManuallySelectParserTag());
        configureForTabMode();
    }

    function loadUserPreferences() {
        userPreferences = UserPreferences.readFromLocalStorage();
        userPreferences.addObserver(library);
        userPreferences.writeToUi();
        userPreferences.hookupUi();
        BakaTsukiSeriesPageParser.registerBakaParsers(userPreferences.autoSelectBTSeriesPage.value);
    }

    function isRunningInTabMode() {
        // if query string supplied, we're running in Tab mode.
        let search = window.location.search;
        return !util.isNullOrEmpty(search);
    }

    /**
     * @param { UrlString } url Url to the first ToC page.
     * @param { Document } dom The DOM of the first page; e.g. chapter list container page.
     */
    async function populateControlsWithDom(url, dom) {
        initialWebPage = dom;

        // Show the used main ToC page in UI.
        setUiFieldToValue("startingUrlInput", url);

        // set the base tag, in case server did not supply it 
        util.setBaseTag(url, initialWebPage);

        await processInitialHtml(url, initialWebPage);

        if (document.getElementById("autosearchmetadataCheckbox").checked == true) {
            await autosearchadditionalmetadata();
        }
    }

    /**
     * Attempt to find a parser for a page. If one is found it sets
     * {@link parser} to an instance of the found parser.
     * 
     * @param { UrlString } url Url to the main ToC page used.
     * @param { Document } dom The DOM of the first page; e.g. chapter list container page.
     * @returns { boolean } Whether a parser for the page was found.
     */
    function setParser(url, dom) {
        let manualSelect = getManuallySelectParserTag().value;

        if (util.isNullOrEmpty(manualSelect)) {
            parser = parserFactory.fetch(url, dom);
        } else {
            parser = parserFactory.manuallySelectParser(manualSelect);
        }
        if (parser === undefined) {
            ErrorLog.showErrorMessage(UIText.Error.noParserFound);
            return false;
        }

        getLoadAndAnalyseButton().hidden = true;

        let disabledMessage = parser.disabled();
        if (disabledMessage !== null) {
            ErrorLog.showErrorMessage(disabledMessage);
            return false;
        }

        return true;
    }

    // called when the "Diagnostics" check box is ticked or unticked
    function onDiagnosticsClick() {
        let enable = document.getElementById("diagnosticsCheckBoxInput").checked;
        document.getElementById("reloadButton").hidden = !enable;
    }

    function onAdvancedOptionsClick() {
        let section =  getAdvancedOptionsSection();
        section.hidden = !section.hidden;
        section = getAdditionalMetadataSection();
        section.hidden = !userPreferences.ShowMoreMetadataOptions.value;
        section =  getLibrarySection();
        section.hidden = true;
    }

    function onShowMoreMetadataOptionsClick() {
        let section = getAdditionalMetadataSection();
        section.hidden = !section.hidden;
    }

    function onLibraryClick() {
        let section =  getLibrarySection();
        section.hidden = !section.hidden;
        if (!section.hidden) {
            Library.LibRenderSavedEpubs();
        }
        section =  getAdvancedOptionsSection();
        section.hidden = true;
    }

    function onStylesheetToDefaultClick() {
        document.getElementById("stylesheetInput").value = EpubMetaInfo.getDefaultStyleSheet();
        userPreferences.readFromUi();
    }

    async function openTabWindow() {
        // open new tab window, passing ID of open tab with content to convert to epub as query parameter.
        let tabId = await getActiveTab();
        let url = chrome.runtime.getURL("popup.html") + "?id=";
        url += tabId;
        try {
            chrome.tabs.create({ url: url, openerTabId: tabId });
        }
        catch (err) {
            //firefox android catch
            chrome.tabs.create({ url: url});
        }
        window.close();
    }

    function getActiveTab() {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
                if ((tabs != null) && (0 < tabs.length)) {
                    resolve(tabs[0].id);
                } else {
                    reject();
                }
            });
        });
    }

    /**
     * Load first chapter ToC page via XHR request using the url currently
     * provided in the ui.
     * 
     * @this { DatasetContext | undefined } Context from either button; or emulated injectable.
     * @returns { Promise<void> } Changes are made on state directly.
     */
    async function onLoadAndAnalyseButtonClick() {
        // Url to first ToC page from UI field.
        let url = getValueFromUiField("startingUrlInput");
        getLoadAndAnalyseButton().disabled = true;

        try {
            if (url == null || !util.isUrl(url))
                throw new Error("Found url was null or not an url."); // FIXME: Do this better.

            let xhr = await HttpClient.wrapFetch(url);

            await populateControlsWithDom(
                /** @type { UrlString } */ (url),
                xhr.responseXML
            );
            getLoadAndAnalyseButton().disabled = false;
        } catch (error) {
            getLoadAndAnalyseButton().disabled = false;
            ErrorLog.showErrorMessage(error);
        }
    }

    function configureForTabMode() {
        getActiveTabDOM(extractTabIdFromQueryParameter());
    }

    function extractTabIdFromQueryParameter() {
        let windowId = window.location.search.split("=")[1];
        if (!util.isNullOrEmpty(windowId)) {
            return parseInt(windowId, 10);
        }
    }

    /**
     * @returns { HTMLButtonElement | null }
     */
    function getPackEpubButton() {
        return /** @type { HTMLButtonElement | null } */(document.getElementById("packEpubButton"));
    }

    /**
     * @returns { HTMLButtonElement | null }
     */
    function getLoadAndAnalyseButton() {
        return /** @type { HTMLButtonElement | null } */ (document.getElementById("loadAndAnalyseButton"));
    }

    function resetUI() {
        initialWebPage = null;
        parser = null;
        let metaInfo = new EpubMetaInfo();
        metaInfo.uuid = "";
        populateMetaInfo(metaInfo);
        getLoadAndAnalyseButton().hidden = false;
        main.getPackEpubButton().disabled = false;
        document.getElementById("LibAddToLibrary").disabled = false;
        document.getElementById("LibAddToLibrary").hidden = false;
        document.getElementById("LibPauseToLibrary").hidden = true;
        ChapterUrlsUI.clearChapterUrlsTable();
        CoverImageUI.clearUI();
        ProgressBar.setValue(0);
        // Clear the selected value so it doesn't look like a parser is selected
        document.getElementById("manuallySelectParserTag").selectedIndex = -1;
    }

    function localizeHtmlPage() {
        // can't use a single select, because there are buttons in td elements
        for (let selector of ["button, option", "td, th", ".i18n"]) {
            for (let element of [...document.querySelectorAll(selector)]) {
                if (element.textContent.startsWith("__MSG_")) {
                    UIText.localizeElement(element);
                }
            }
        }
    }

    function clearCoverUrl() {
        CoverImageUI.setCoverImageUrl(null);
    }

    function getManuallySelectParserTag() {
        return /** @type { HTMLSelectElement | null } */ (document.getElementById("manuallySelectParserTag"));
    }

    function getAdditionalMetadataSection() {
        return document.getElementById("AdditionalMetadatatable");
    }

    function getAdvancedOptionsSection() {
        return document.getElementById("advancedOptionsSection");
    }

    function getLibrarySection() {
        return document.getElementById("hiddenBibSection");
    }

    function onSeriesPageHelp() {
        chrome.tabs.create({ url: "https://github.com/dteviot/WebToEpub/wiki/FAQ#using-baka-tsuki-series-page-parser" });
    }

    function onCustomFilenameHelp() {
        chrome.tabs.create({ url: "https://github.com/dteviot/WebToEpub/wiki/Advanced-Options#custom-filename" });
    }

    function onDefaultParserHelp() {
        chrome.tabs.create({ url: "https://github.com/dteviot/WebToEpub/wiki/FAQ#how-to-convert-a-new-site-using-the-default-parser" });
    }

    function onReadOptionsFromFile(event) {
        userPreferences.readFromFile(event, populateControls);
    }

    function onReadingListCheckboxClicked() {
        let url = parser.state.chapterListUrl;
        let checked = UserPreferences.getReadingListCheckbox().checked;
        userPreferences.readingList.onReadingListCheckboxClicked(checked, url);
    }

    function sbFiltersShow()
    {
        sbShow();
        ChapterUrlsUI.Filters.init();
        document.getElementById("sbFilters").hidden = false;
        
        let filtersForm = document.getElementById("sbFiltersForm");
        util.removeElements(filtersForm.children);
        filtersForm.appendChild(ChapterUrlsUI.Filters.generateFiltersTable());
        ChapterUrlsUI.Filters.Filter(); //Run reset filters to clear confusion.
    }

    function sbShow() {
        document.getElementById("sbOptions").classList.add("sidebarOpen");
    }

    function sbHide() {
        document.getElementById("sbOptions").classList.remove("sidebarOpen");
        document.getElementById("sbFilters").hidden = true;
    }

    function showReadingList() {
        let sections = new Map(
            [...document.querySelectorAll("section")]
                .map(s =>[s, s.hidden])
        );
        [...sections.keys()].forEach(s => s.hidden = true);

        document.getElementById("readingListSection").hidden = false;
        document.getElementById("closeReadingList").onclick = () => {
            [...sections].forEach(s => s[0].hidden = s[1]);
        };

        let table = document.getElementById("readingListTable");
        userPreferences.readingList.showReadingList(table);
        table.onclick = (event) => userPreferences.readingList.onClickRemove(event);
    }

    /**
     * If work in progress, give user chance to cancel closing the window
     */
    function onUnloadEvent(event) {
        if (window.workInProgress === true) {
            event.preventDefault();
            event.returnValue = "";
        } else {
            delete event["returnValue"];
        }
    }

    function addEventHandlers() {
        getPackEpubButton().onclick = fetchContentAndPackEpub;
        document.getElementById("diagnosticsCheckBoxInput").onclick = onDiagnosticsClick;
        document.getElementById("reloadButton").onclick = populateControls;
        getManuallySelectParserTag().onchange = populateControls;
        document.getElementById("advancedOptionsButton").onclick = onAdvancedOptionsClick;
        document.getElementById("hiddenBibButton").onclick = onLibraryClick;
        document.getElementById("ShowMoreMetadataOptionsCheckbox").addEventListener("change", () => onShowMoreMetadataOptionsClick());
        document.getElementById("LibShowAdvancedOptionsCheckbox").addEventListener("change", () => Library.LibRenderSavedEpubs());
        document.getElementById("LibAddToLibrary").addEventListener("click", fetchContentAndPackEpub);
        document.getElementById("LibPauseToLibrary").addEventListener("click", pauseToLibrary);
        document.getElementById("stylesheetToDefaultButton").onclick = onStylesheetToDefaultClick;
        document.getElementById("resetButton").onclick = resetUI;
        document.getElementById("clearCoverImageUrlButton").onclick = clearCoverUrl;
        document.getElementById("seriesPageHelpButton").onclick = onSeriesPageHelp;
        document.getElementById("CustomFilenameHelpButton").onclick = onCustomFilenameHelp;
        document.getElementById("defaultParserHelpButton").onclick = onDefaultParserHelp;
        getLoadAndAnalyseButton().onclick = onLoadAndAnalyseButtonClick;
        document.getElementById("loadMetadataButton").onclick = onLoadMetadataButtonClick;

        document.getElementById("writeOptionsButton").onclick = () => userPreferences.writeToFile();
        document.getElementById("readOptionsInput").onchange = onReadOptionsFromFile;
        UserPreferences.getReadingListCheckbox().onclick = onReadingListCheckboxClicked;
        document.getElementById("viewFiltersButton").onclick = () => sbFiltersShow();
        document.getElementById("sbClose").onclick = () => sbHide();
        document.getElementById("viewReadingListButton").onclick = () => showReadingList();
        window.addEventListener("beforeunload", onUnloadEvent);
    }
	
	
    /**
     * Additional metadata.
     * 
     * @returns { Promise<void> }
     */
    async function autosearchadditionalmetadata() {
        getPackEpubButton().disabled = true;
        document.getElementById("LibAddToLibrary").disabled = true;
        let titlename = getValueFromUiField("titleInput");
        let url ="https://www.novelupdates.com/series-finder/?sf=1&sh="+titlename;
        if (getValueFromUiField("subjectInput")==null) {
            await autosearchnovelupdates(url, titlename);
        }   
        getPackEpubButton().disabled = false; 
        document.getElementById("LibAddToLibrary").disabled = false;    
    }
	
    async function autosearchnovelupdates(url, titlename) {
        try {
            let xhr = await HttpClient.wrapFetch(url);
            await findnovelupdatesurl(url, xhr.responseXML, titlename);
        } catch (error) {
            getLoadAndAnalyseButton().disabled = false;
            ErrorLog.showErrorMessage(error);
        }
    }

    async function findnovelupdatesurl(url, dom, titlename) {
        try {    
            let searchurl = [...dom.querySelectorAll("a")].filter(a => a.textContent==titlename)[0];
            setUiFieldToValue("metadataUrlInput", searchurl.href);
            url = getValueFromUiField("metadataUrlInput");
            if (url.includes("novelupdates.com") == true) {
                await onLoadMetadataButtonClick();
            }
        } catch {
            //
        }
    }
	
    async function onLoadMetadataButtonClick() {
        getPackEpubButton().disabled = true;
        document.getElementById("LibAddToLibrary").disabled = true;
        let url = getValueFromUiField("metadataUrlInput");
        try {
            let xhr = await HttpClient.wrapFetch(url);
            populateMetadataAddWithDom(url, xhr.responseXML);
        } catch (error) {
            getLoadAndAnalyseButton().disabled = false;
            ErrorLog.showErrorMessage(error);
        }
    }

    function populateMetadataAddWithDom(url, dom) {
        try {
            let allTags = document.getElementById("lesstagsCheckbox").checked == false;
            let metaAddInfo = EpubMetaInfo.getEpubMetaAddInfo(dom, url, allTags);
            setUiFieldToValue("subjectInput", metaAddInfo.subject);
            setUiFieldToValue("descriptionInput", metaAddInfo.description);
            if (getValueFromUiField("authorInput")=="<unknown>") {
                setUiFieldToValue("authorInput", metaAddInfo.author);
            }
            getPackEpubButton().disabled = false;
            document.getElementById("LibAddToLibrary").disabled = false;
        } catch (error) {
            ErrorLog.showErrorMessage(error);
            getPackEpubButton().disabled = false;
            document.getElementById("LibAddToLibrary").disabled = false;
        }
    }

    // actions to do when window opened
    window.onload = async () => {
        userPreferences = UserPreferences.readFromLocalStorage();
        if (isRunningInTabMode()) { 
            ErrorLog.SuppressErrorLog =  false;
            localizeHtmlPage();
            getAdvancedOptionsSection().hidden = !userPreferences.advancedOptionsVisibleByDefault.value;
            getAdditionalMetadataSection().hidden = !userPreferences.ShowMoreMetadataOptions.value;
            addEventHandlers();
            populateControls();
            if (util.isFirefox()) {
                Firefox.startWebRequestListeners();
            }
        } else {
            await openTabWindow();
        }
    };

    return {
        getPackEpubButton: getPackEpubButton,
        onLoadAndAnalyseButtonClick : onLoadAndAnalyseButtonClick,
        fetchContentAndPackEpub: fetchContentAndPackEpub,
        resetUI: resetUI,
        getUserPreferences: () => userPreferences,
    };
})();

