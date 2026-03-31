"use strict";

/**
 * Class that handles UI for selecting (chapter) URLs to fetch
 */
class ChapterUrlsUI {
    /**
     * The parser which is currently in use.
     * 
     * @type { Parser }
     * @private
     */
    parser;

    /**
     * Whether the "normal" UI (true) or the "Edit Chapter URLs" UI (false) is
     * showing/to be shown.
     * 
     * @type { boolean | undefined }
     * @private
     */
    usingTable;

    /**
     * @param { Parser } parser The parser which will control the UI.
     * 
     * @public
     */
    constructor(parser) {
        this.parser = parser;

        ChapterUrlsUI.getPleaseWaitMessageRow().hidden = false;

        if (this.parser)
        {
            let nameElement = document.getElementById("spanParserName");
            if (nameElement) nameElement.textContent = this.parser.constructor.name;

            let delayMsElement = document.getElementById("spanDelayMs");
            if (delayMsElement) delayMsElement.textContent = `${this.parser.getRateLimit()} ms`;
        }

        let formElement = document.getElementById("sbFiltersForm");

        if (formElement) {
            document.getElementById("sbFiltersForm").onsubmit = (event) => {
                event.preventDefault();
            };
        }
    }

    /**
     * Setup event handlers for UI.
     * 
     * @returns { void } Changes are made on UI directly.
     * 
     * @public
     */
    connectButtonHandlers() {
        document.getElementById("selectAllUrlsButton").onclick = ChapterUrlsUI.setAllUrlsSelectState.bind(null, true);
        document.getElementById("unselectAllUrlsButton").onclick = ChapterUrlsUI.setAllUrlsSelectState.bind(null, false);
        document.getElementById("reverseChapterUrlsOrderButton").onclick = this.reverseUrls.bind(this);
        document.getElementById("editChaptersUrlsButton").onclick = this.setEditInputMode.bind(this);
        document.getElementById("copyUrlsToClipboardButton").onclick = this.copyUrlsToClipboard.bind(this);
        document.getElementById("showChapterUrlsCheckbox").onclick = this.toggleShowUrlsForChapterRanges.bind(this);
        ChapterUrlsUI.modifyApplyChangesButtons(button => button.onclick = this.setTableMode.bind(this));
    }

    /**
     * Populate the UI with all the chapters.
     * 
     * @param { ChapterLink[] } chapters All the chapters to show in the UI.
     * @returns { void } Changes are made on UI directly.
     * 
     * @public
     */
    populateChapterUrlsTable(chapters) {
        ChapterUrlsUI.getPleaseWaitMessageRow().hidden = true;
        ChapterUrlsUI.clearChapterUrlsTable();

        let linksTable = ChapterUrlsUI.getChapterUrlsTable();
        let index = 0;
        let rangeStart = ChapterUrlsUI.getRangeStartChapterSelect();
        let rangeEnd = ChapterUrlsUI.getRangeEndChapterSelect();
        let memberForTextOption = ChapterUrlsUI.textToShowInRange();

        chapters.forEach((chapter) => {
            let row = document.createElement("tr");
            
            ChapterUrlsUI.appendCheckBoxToRow(row, chapter);
            ChapterUrlsUI.appendInputTextToRow(row, chapter);
            chapter.row = row;

            ChapterUrlsUI.appendColumnDataToRow(row, chapter.sourceUrl);
            linksTable.appendChild(row);

            ChapterUrlsUI.appendOptionToSelect(rangeStart, index, chapter, memberForTextOption);
            ChapterUrlsUI.appendOptionToSelect(rangeEnd, index, chapter, memberForTextOption);

            ++index;
        });

        ChapterUrlsUI.setRangeOptionsToFirstAndLastChapters();
        this.showHideChapterUrlsColumn();
        ChapterUrlsUI.resizeTitleColumnToFit(linksTable);
    }

    /**
     * Update the chapters list UI to show current/partial list of found chapter
     * links.
     * 
     * @param { ChapterLink[] } chapters The currently found chapter links.
     * @returns { void } Changes are made to UI directly.
     * 
     * @public
     */
    showTocProgress(chapters) {
        let linksTable = ChapterUrlsUI.getChapterUrlsTable();

        chapters.forEach((chapter) => {
            let row = document.createElement("tr");
            linksTable.appendChild(row);
            row.appendChild(document.createElement("td"));

            let col = document.createElement("td");
            col.className = "disabled";
            col.appendChild(document.createTextNode(chapter.title));

            row.appendChild(col);
            row.appendChild(document.createElement("td"));
        });
    }

    /**
     * Set the downloading state for the provided chapter.
     * 
     * @param { HTMLElement | null | undefined } row The chapter to set for.
     * @param { number } state The state to set.
     * @returns { void } Changes are made on elements directly.
     * 
     * @public
     */
    static showDownloadState(row, state) {
        if (row != null) {
            let downloadStateDiv = row.querySelector(".downloadStateDiv");

            ChapterUrlsUI.updateDownloadStateImage(downloadStateDiv, state);
        }
    }

    /**
     * Sets the displayed image and tooltip state to provided.
     * 
     * @param { Element } downloadStateDiv The div container of the state image.
     * @param { number } state The new state to get image for.
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static updateDownloadStateImage(downloadStateDiv, state) {
        let img = downloadStateDiv.querySelector("img");
        
        if (img) {
            img.src = ChapterUrlsUI.ImageForState[state];

            // Update tooltip
            let tooltipText = ChapterUrlsUI.TooltipForSate[state];
            let tooltipTextSpan = downloadStateDiv.querySelector(".tooltipText");

            if (tooltipText && !tooltipTextSpan) {
                tooltipTextSpan = document.createElement("span");
                tooltipTextSpan.className = "tooltipText";
                tooltipTextSpan.textContent = tooltipText;
                downloadStateDiv.appendChild(tooltipTextSpan);
            } else if (tooltipText) {
                tooltipTextSpan.textContent = tooltipText;
            } else if (tooltipTextSpan) {
                // Remove tooltip text if there is no text to display
                downloadStateDiv.removeChild(tooltipTextSpan);
            }
        }
    }

    /**
     * Resets the images and tooltips for all chapter downloads.
     * 
     * @returns { void } Changes are made on UI directly.
     * 
     * @public
     */
    static resetDownloadStateImages() {
        let linksTable = ChapterUrlsUI.getChapterUrlsTable();
        let prevDownload = ChapterUrlsUI.ImageForState[ChapterUrlsUI.DOWNLOAD_STATE_PREVIOUS];
        let downloaded = ChapterUrlsUI.ImageForState[ChapterUrlsUI.DOWNLOAD_STATE_LOADED];

        for (let downloadStateDiv of linksTable.querySelectorAll(".downloadStateDiv")) {
            let state = ChapterUrlsUI.DOWNLOAD_STATE_NONE;
            let imgSrc = downloadStateDiv.querySelector("img")?.src;

            if (imgSrc) {
                const imagesIndex = imgSrc.indexOf("images/");

                if (imagesIndex !== -1) {
                    imgSrc = imgSrc.substring(imagesIndex);
                }
            }

            if (imgSrc === prevDownload || imgSrc === downloaded) {
                state = ChapterUrlsUI.DOWNLOAD_STATE_PREVIOUS;
            }

            ChapterUrlsUI.updateDownloadStateImage(downloadStateDiv, state);
        }
    }

    /**
     * Reset the chapter urls table to a blank state.
     * 
     * @returns { void } Changes are made on UI directly.
     * 
     * @public
     */
    static clearChapterUrlsTable() {
        util.removeElements(ChapterUrlsUI.getTableRowsWithChapters());
        util.removeElements([...ChapterUrlsUI.getRangeStartChapterSelect().options]);
        util.removeElements([...ChapterUrlsUI.getRangeEndChapterSelect().options]);
    }

    /**
     * Unchecks all chapters which exceed the maximum chapter count.
     * 
     * @param { string } [maxChapters] The maximum number of chapters allowed, may contain comma delimiters; defaults to 10000.
     * @returns { void } Changes are made on UI directly.
     * 
     * @public
     */
    static limitNumOfChapterS(maxChapters) {
        let max = util.isNullOrEmpty(maxChapters) ? 10000 : parseInt(maxChapters.replace(",", ""));

        let selectedRows = [...ChapterUrlsUI.getChapterUrlsTable().querySelectorAll("[type='checkbox'")]
            .filter(c => c.checked)
            .map(c => c.parentElement.parentElement);
        
        if (max < selectedRows.length) {
            let message = UIText.Chapter.maxChaptersSelected(selectedRows.length, max);

            if (confirm(message) === false) {
                for (let row of selectedRows.slice(max)) {
                    ChapterUrlsUI.setRowCheckboxState(row, false);
                }
            }
        }
    }

    /**
     * Initialize the first and last chapter selects using all chapters.
     * 
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static setRangeOptionsToFirstAndLastChapters()
    {
        let rangeStart = ChapterUrlsUI.getRangeStartChapterSelect();
        let rangeEnd = ChapterUrlsUI.getRangeEndChapterSelect();

        rangeStart.onchange = null;
        rangeEnd.onchange = null;
        
        rangeStart.selectedIndex = 0;
        rangeEnd.selectedIndex = rangeEnd.length - 1;
        ChapterUrlsUI.setChapterCount(rangeStart.selectedIndex, rangeEnd.selectedIndex);
        
        rangeStart.onchange = ChapterUrlsUI.onRangeChanged;
        rangeEnd.onchange = ChapterUrlsUI.onRangeChanged;
    }
 
    /**
     * Handler for when a change occurs on either the first or last chapter
     * select elements.
     * 
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static onRangeChanged() {
        let startIndex = ChapterUrlsUI.selectionToRowIndex(ChapterUrlsUI.getRangeStartChapterSelect());
        let endIndex = ChapterUrlsUI.selectionToRowIndex(ChapterUrlsUI.getRangeEndChapterSelect());
        let rc = new ChapterUrlsUI.RangeCalculator();

        for (let row of ChapterUrlsUI.getTableRowsWithChapters()) {
            let inRange = rc.rowInRange(row);
            ChapterUrlsUI.setRowCheckboxState(row, rc.rowInRange(row));
            row.hidden = !inRange;
        }

        ChapterUrlsUI.setChapterCount(startIndex, endIndex);
    }

    /**
     * Get the row index for the currently selected option.
     * 
     * @param { HTMLSelectElement } selectElement The select element to check.
     * @returns { number } The row index to which the selected option corresponds.
     * 
     * @public
     */
    static selectionToRowIndex(selectElement) {
        let selectedIndex = selectElement.selectedIndex;
        return selectedIndex + 1;
    }

    /**
     * Calculate the chapter count and display it in the UI.
     * 
     * @param { number } startIndex The index of the first chapter.
     * @param { number } endIndex The index of the last chapter.
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static setChapterCount(startIndex, endIndex) {
        let count = Math.max(0, 1 + endIndex - startIndex);

        document.getElementById("spanChapterCount").textContent = count;
    }
    
    /** 
     * Get the container table for all the individual chapters.
     * 
     * @returns { HTMLTableElement | null } The found element.
     * 
     * @private
     */
    static getChapterUrlsTable() {
        return /** @type { HTMLTableElement } */ (document.getElementById("chapterUrlsTable"));
    }

    /**
     * Get the first chapter select element.
     * 
     * @returns { HTMLSelectElement | null } The found element.
     * 
     * @public
     */
    static getRangeStartChapterSelect() {
        return /** @type { HTMLSelectElement | null } */ (document.getElementById("selectRangeStartChapter"));
    }

    /**
     * Get the last chapter select element.
     * 
     * @returns { HTMLSelectElement | null } The found element.
     * 
     * @public
     */
    static getRangeEndChapterSelect() {
        return /** @type { HTMLSelectElement | null } */ (document.getElementById("selectRangeEndChapter"));
    }

    /**
     * Check whether user wants the source url or title to be used for chapter
     * displays.
     * 
     * @returns { "sourceUrl" | "title" } Whether to use title or source URL.
     * 
     * @private
     */
    static textToShowInRange() {
        return document.getElementById("showChapterUrlsCheckbox").checked
            ? "sourceUrl"
            : "title";
    }

    /** 
     * Execute a mutator function on all apply buttons.
     * 
     * @param { (button: HTMLButtonElement) => void } mutator Mutator function which is run upon the buttons.
     * @returns { void } Changes are made on UI directly.
     * 
     * @public
     */
    static modifyApplyChangesButtons(mutator) {
        mutator(document.getElementById("applyChangesButton"));
        mutator(document.getElementById("applyChangesButton2"));
    }

    /** 
     * Get chapter urls editing textbox element.
     * 
     * @returns { HTMLTextAreaElement | null } The edit chapter urls input element.
     * 
     * @private
     */
    static getEditChaptersUrlsInput() {
        return /** @type { HTMLTextAreaElement | null } */ (document.getElementById("editChaptersUrlsInput"));
    }

    /**
     * Get please wait message box element.
     * 
     * @returns { HTMLDivElement | null } The wait message container element.
     * 
     * @private
     */
    static getPleaseWaitMessageRow() {
        return /** @type { HTMLDivElement | null } */ (document.getElementById("findingChapterUrlsMessageRow"));
    }

    /**
     * Update the state of all chapter checkboxes to `select`.
     * 
     * @param { boolean } select The new checked state to set.
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static setAllUrlsSelectState(select) {
        for (let row of ChapterUrlsUI.getTableRowsWithChapters()) {
            ChapterUrlsUI.setRowCheckboxState(row, select);
            row.hidden = false;
        }
        ChapterUrlsUI.setRangeOptionsToFirstAndLastChapters();
    }

    /**
     * Set the checkbox state for `row` to `checked`, and trigger click event if
     * changed.
     * 
     * @param { HTMLTableRowElement } row The row to get checkbox from.
     * @param { boolean } checked State to set the checkbox to.
     * 
     * @private
     */
    static setRowCheckboxState(row, checked) {
        let input = /** @type { HTMLInputElement } */ (row.querySelector("input[type='checkbox']"));

        if (input.checked !== checked) {
            input.checked = checked;
            input.onclick();
        }
    }

    /**
     * Get all chapter rows from chapter urls table.
     * 
     * @returns { HTMLTableRowElement[] } The found chapter rows.
     * 
     * @private
     */
    static getTableRowsWithChapters() {
        let linksTable = ChapterUrlsUI.getChapterUrlsTable();
        return [...linksTable.querySelectorAll("tr")]
            .filter(r => r.querySelector("th") === null);
    }

    /** 
     * Add the selection checkbox and download(ed) state image to chapter row.
     * 
     * @param { HTMLTableRowElement } row The row to insert into.
     * @param { ChapterLink } chapter The chapter which the row is for.
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static appendCheckBoxToRow(row, chapter) {
        chapter.isIncludeable = chapter.isIncludeable ?? true;
        chapter.previousDownload = chapter.previousDownload ?? false;

        const col = document.createElement("td");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = chapter.isIncludeable;
        checkbox.onclick = (event) => { 
            chapter.isIncludeable = checkbox.checked;
            if (!event) return;

            ChapterUrlsUI.tellUserAboutShiftClick(event, row);

            if (event.shiftKey && (ChapterUrlsUI.lastSelectedRow !== null)) {
                ChapterUrlsUI.updateRange(ChapterUrlsUI.lastSelectedRow, row.rowIndex, checkbox.checked);
            } else {
                ChapterUrlsUI.lastSelectedRow = row.rowIndex;
            }
        };

        col.appendChild(checkbox);
        ChapterUrlsUI.addDownloadStateToCheckboxColumn(col, chapter.previousDownload);
        row.appendChild(col);
    }

    /**
     * Insert the download(ed) state image into a chapter entry element.
     * 
     * @param { HTMLTableCellElement } col The element to insert the image into.
     * @param { boolean } previousDownload Whether the chapter/link has been downloaded previously.
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static addDownloadStateToCheckboxColumn(col, previousDownload) {
        let downloadStateDiv = document.createElement("div");
        downloadStateDiv.className = "downloadStateDiv";

        let img = document.createElement("img");
        img.className = "downloadState";

        downloadStateDiv.appendChild(img);

        ChapterUrlsUI.updateDownloadStateImage(downloadStateDiv,
            previousDownload ? ChapterUrlsUI.DOWNLOAD_STATE_PREVIOUS : ChapterUrlsUI.DOWNLOAD_STATE_NONE
        );

        col.appendChild(downloadStateDiv);
    }

    /** 
     * Insert the chapter title input into the provided chapter row, and hook it
     * up to automatically update the provided `chapter` object with it's
     * content.
     * 
     * @param { HTMLTableRowElement } row The row to insert into.
     * @param { ChapterLink } chapter The chapter the row belongs to.
     * @returns { void } Changes are made on the UI directly.
     * 
     * @private
     */
    static appendInputTextToRow(row, chapter) {
        let col = document.createElement("td");

        let input = document.createElement("input");
        input.type = "text";
        input.value = chapter.title;
        input.className = "fullWidth";
        input.addEventListener("blur", () => { chapter.title = input.value; },  true);

        col.appendChild(input);
        row.appendChild(col);
    }

    /**
     * Add chapter option to select element.
     * 
     * @param { HTMLSelectElement } select The select element to insert into.
     * @param { number } value The index for the created option element.
     * @param { ChapterLink } chapter The chapter the option is for.
     * @param { "title" | "sourceUrl" } memberForTextOption Which chapter property to show in UI.
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static appendOptionToSelect(select, value, chapter, memberForTextOption) {
        let option = new Option(chapter[memberForTextOption], value);
        select.add(option);
    }

    /**
     * Set the width of all input elements to the same width as the widest one.
     * 
     * @param { HTMLTableElement } linksTable The chapter links table.
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static resizeTitleColumnToFit(linksTable) {
        let inputs = /** @type { HTMLInputElement[] } */ ([...linksTable.querySelectorAll("input[type='text']")]);
        let width = inputs.reduce((acc, element) => Math.max(acc, element.value.length), 0);

        if (0 < width) {
            inputs.forEach(i => i.size = width); 
        }
    }

    /** 
     * Add data (likely chapter URL) column to chapter row.
     * 
     * @param { HTMLTableRowElement } row The chapter row to insert into.
     * @param { string } textData The data (likely chapter URL) to add.
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static appendColumnDataToRow(row, textData) {
        let col = document.createElement("td");
        col.innerText = textData;
        col.style.whiteSpace = "nowrap";
        row.appendChild(col);

        return col;
    }

    /** 
     * Set the visibility state of the "normal" chapter URLs UI, **and** the
     * visibility of the "Edit Chapter URLs" section to the opposite.
     * 
     * @param { boolean } toTable Whether "normal" chapter URLs UI should be visible.
     * @returns { void } Changes are made to UI directly.
     * 
     * @public
     */
    static setVisibleUI(toTable) {
        // toggle mode
        ChapterUrlsUI.getEditChaptersUrlsInput().hidden = toTable;
        ChapterUrlsUI.getChapterUrlsTable().hidden = !toTable;
        document.getElementById("inputSection").hidden = !toTable;
        document.getElementById("coverUrlSection").hidden = !toTable;
        document.getElementById("chapterSelectControlsDiv").hidden = !toTable;
        ChapterUrlsUI.modifyApplyChangesButtons(button => button.hidden = toTable);
        document.getElementById("editURLsHint").hidden = toTable;
    }

    /** 
     * Effectively a handler for updating the chapters list to the value
     * currently contained in the "Edit Chapter URLs" input. It also toggles the
     * UI state to show the "normal" UI after chapters have been updated.
     * 
     * @returns { void } Changes are made to UI directly.
     * 
     * @private
     */
    setTableMode() {
        try {
            let inputvalue = ChapterUrlsUI.getEditChaptersUrlsInput().value;
            let chapters;

            let lines = inputvalue.split("\n");
            lines = lines.filter(a => a.trim() != "").map(a => a.trim());

            if (URL.canParse(lines[0])) {
                chapters = this.URLsToChapters(lines);
            } else {
                chapters = this.htmlToChapters(inputvalue);
            }

            this.parser.setPagesToFetch(chapters);
            this.populateChapterUrlsTable(chapters);
            this.usingTable = true;

            ChapterUrlsUI.setVisibleUI(this.usingTable);
        } catch (err) {
            ErrorLog.showErrorMessage(err);
        }
    }

    /**
     * Reverse the order of the chapters, and propagate the changes back to the
     * parser.
     * 
     * @returns { void } Changes are made to UI directly.
     * 
     * @private
     */
    reverseUrls() {
        try {
            let chapters = [...this.parser.getPagesToFetch().values()];
            chapters.reverse();

            this.populateChapterUrlsTable(chapters);
            this.parser.setPagesToFetch(chapters);
        } catch (err) {
            ErrorLog.showErrorMessage(err);
        }
    }

    /** 
     * Parse the value contained in the edit chapter urls input box. Should be
     * just a string of raw <a> tags.
     * 
     * @param { string } innerHtml HTML string containing the chapter link anchors.
     * @returns { ChapterLink[] } The found chapter links.
     * 
     * @private
     */
    htmlToChapters(innerHtml) {
        let html = "<html><head><title></title><body>" + innerHtml + "</body></html>";
        let doc = util.sanitize(html);
        return [...doc.body.querySelectorAll("a")].map(a => util.hyperLinkToChapter(a));
    }

    /**
     * Parse an array of url strings into chapter links.
     * 
     * @param { UrlString[] } URLs The urls to parse.
     * @returns { ChapterLink[] } Chapter links with placeholder titles.
     * 
     * @private
     */
    URLsToChapters(URLs) {
        let returnchapters = URLs.map(e => ({
            sourceUrl: e,
            title: "[placeholder]"
        }));

        return returnchapters;
    }

    /**
     * Copy the current chapters as an HTML string to the clipboard.
     * 
     * @returns { void } Changes are made to navigator state directly.
     * 
     * @private
     */
    copyUrlsToClipboard() {
        let text = this.chaptersToHTML([...this.parser.getPagesToFetch().values()]);
        navigator.clipboard.writeText(text);
    }

    /**
     * Toggle whether to show chapter titles or urls in select elements. Note
     * that this isn't technically a toggle, instead it determines which to show
     * based on a downstream call to `ChapterUrlsUI.textToShowInRange`.
     * 
     * @returns { void } Changes are made to UI directly.
     * 
     * @private
     */
    toggleShowUrlsForChapterRanges() {
        let chapters = [...this.parser.getPagesToFetch().values()];
        this.toggleShowUrlsForChapterRange(ChapterUrlsUI.getRangeStartChapterSelect(), chapters);
        this.toggleShowUrlsForChapterRange(ChapterUrlsUI.getRangeEndChapterSelect(), chapters);
        this.showHideChapterUrlsColumn();
    }
    
    /**
     * Update the visibility state of the chapter urls based on whether the
     * "show chapter urls" checkbox state.
     * 
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    showHideChapterUrlsColumn() {
        let hidden = !document.getElementById("showChapterUrlsCheckbox").checked;
        let table = ChapterUrlsUI.getChapterUrlsTable();

        for (let t of table.querySelectorAll("th:nth-of-type(3), td:nth-of-type(3)")) {
            t.hidden = hidden;
        }
    }

    /**
     * Toggle whether to show chapter title or source url for all options in the
     * provided `select` based on `ChapterUrlsUI.textToShowInRange`.
     * 
     * @param { HTMLSelectElement } select The select element to (potentially) modify options of.
     * @param { ChapterLink[] } chapters Array of chapters which corresponds to the indexes of the select's options.
     * @returns { void } Changes are made to UI directly.
     * 
     * @private
     */
    toggleShowUrlsForChapterRange(select, chapters) {
        select.onchange = null;
        let memberForTextOption = ChapterUrlsUI.textToShowInRange();

        // FIXME: Should be lowercase o.
        for (let o of [...select.querySelectorAll("Option")]) { 
            o.text = chapters[o.index][memberForTextOption];
        }

        let selectedIndex = select.selectedIndex;
        select.selectedIndex = selectedIndex;
        select.onchange = ChapterUrlsUI.onRangeChanged;
    }

    /**
     * Show the "Edit Chapter URLs" UI, insert current chapters to be edited,
     * and hide the "normal" UI.
     * 
     * @returns { void } Changes are made to UI directly.
     * 
     * @private
     */
    setEditInputMode() {
        this.usingTable = false;
        ChapterUrlsUI.setVisibleUI(this.usingTable);

        let input = ChapterUrlsUI.getEditChaptersUrlsInput();
        input.rows = Math.max(this.parser.getPagesToFetch().size, 20);
        input.value = this.chaptersToHTML([...this.parser.getPagesToFetch().values()]);
    }

    /**
     * Turn an array of chapters into a HTML string with a link anchor for each
     * chapter.
     * 
     * @param { ChapterLink[] } chapters The chapters to turn into HTML.
     * @returns { string } The chapters HTML as a string.
     * 
     * @private
     */
    chaptersToHTML(chapters) {
        let doc = util.sanitize("<html><head><title></title><body></body></html>");

        for (let chapter of chapters.filter(c => c.isIncludeable)) {
            doc.body.appendChild(this.makeLink(doc, chapter));
            doc.body.appendChild(doc.createTextNode("\r"));
        }

        return doc.body.innerHTML;
    }

    /**
     * Create a link anchor for the given `chapter`.
     * 
     * @param { Document } doc The document to create the anchor in.
     * @param { ChapterLink } chapter The chapter to create the anchor for.
     * @returns { HTMLAnchorElement } The created anchor element.
     * 
     * @private
     */
    makeLink(doc, chapter) {
        let link = doc.createElement("a");
        link.href = chapter.sourceUrl;
        link.appendChild(doc.createTextNode(chapter.title));

        return link;
    }

    /**
     * Update which chapters/rows are checked in between two row indexes
     * (inclusive). The indexes do not have to be in the "correct" order, I.E.
     * `startRowIndex` can be higher than `endRowIndex`.
     * 
     * @param { number } startRowIndex The index of the first row.
     * @param { number } endRowIndex The index of the second row.
     * @param { boolean } state Whether to check/uncheck the selected rows.
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static updateRange(startRowIndex, endRowIndex, state) {
        let direction = startRowIndex < endRowIndex ? 1 : -1;
        let linkTable = ChapterUrlsUI.getChapterUrlsTable();

        for (let rowIndex = startRowIndex; rowIndex != endRowIndex; rowIndex += direction) {
            let row = linkTable.rows[rowIndex];

            ChapterUrlsUI.setRowCheckboxState(row, state);
        }
    }

    /**
     * Find the real intended target row by walking the parents of `target`
     * until it finds a `HTMLTableRowElement` or null parent.
     * 
     * @param { HTMLElement } target The original target.
     * @returns { HTMLElement } The actual target row ancestor.
     * 
     * @private
     */
    static getTargetRow(target) {
        while ((target.tagName.toLowerCase() !== "tr") && (target.parentElement !== null)) {
            target = target.parentElement;
        }

        return target;
    }

    /**
     * Click event handler which shows an alert with chapter shift-click
     * mechanics if conditions are satisfied.
     * 
     * @param { MouseEvent } event The click event.
     * @param { HTMLTableRowElement } row The row/chapter which was clicked.
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static tellUserAboutShiftClick(event, row) {
        let userPreferences = main.getUserPreferences();
        if (userPreferences?.disableShiftClickAlert?.value) {
            return;
        }

        if (event.shiftKey || (ChapterUrlsUI.lastSelectedRow === null)) {
            return;
        }

        if (ChapterUrlsUI.ConsecutiveRowClicks == 5) {
            return;
        }

        let distance = Math.abs(row.rowIndex - ChapterUrlsUI.lastSelectedRow);
        if (distance !== 1) {
            ChapterUrlsUI.ConsecutiveRowClicks = 0;
            return;
        }

        ++ChapterUrlsUI.ConsecutiveRowClicks;

        if (ChapterUrlsUI.ConsecutiveRowClicks == 5) {
            alert(UIText.Chapter.shiftClickMessage);
        }
    }

    /** @type { ChapterFilters } */
    static Filters = {
        filterTermsFrequency: {},
        chapterList: {},
        init() {
            let rc = new ChapterUrlsUI.RangeCalculator();

            /** @type { { [key: string]: number } | ChapterFilterTerm[] } */
            var filterTermsFrequency = {};

            /** @type { false | string[] } */
            let constantTerms = false; // To become a collection of all terms used in every link.¨

            var chapterList = ChapterUrlsUI.getTableRowsWithChapters().filter(item => rc.rowInRange(item)).map(item => {
                /** @type { ChapterFilter } */
                let filterObj = { 
                    row: item, 
                    values: Array.from(item.querySelectorAll("td"))
                        .map(item => item.innerText)
                        .join("/")
                        .split("/"),
                    valueString: ""
                };
                filterObj.values.push(item.querySelector("input[type='text']").value);
                filterObj.values = filterObj.values.filter(item => item.length > 3 && !item.startsWith("http"));
                filterObj.valueString = filterObj.values.join(" ");
                
                let recordFilterTerms = filterObj.valueString.toLowerCase().split(" ");
                recordFilterTerms.forEach(item => {
                    filterTermsFrequency[item] = (parseInt(filterTermsFrequency[item]) || 0) + 1;
                });

                if (!constantTerms)
                {
                    constantTerms = recordFilterTerms;
                }
                else
                {
                    constantTerms.filter(item => recordFilterTerms.indexOf(item) == -1).forEach(item => {
                        /** @type { string[] } */ (constantTerms).splice(/** @type { string[] } */ (constantTerms).indexOf(item), 1);
                    });
                }

                return filterObj;
            });

            let minFilterTermCount = Math.min( 3, chapterList.length * 0.10 );
            filterTermsFrequency = Object.keys(filterTermsFrequency)
                .filter(key => constantTerms.indexOf(key) == -1 && filterTermsFrequency[key] > minFilterTermCount)
                .map(key => ({ key: key, value: filterTermsFrequency[key] }));

            /**
             * @param { ChapterFilterTerm } filterTerm 
             * @returns { number }
             */
            var calcValue = (filterTerm) => { return filterTerm.value * filterTerm.key.length; };

            this.filterTermsFrequency = filterTermsFrequency.sort((a, b) => {
                var hasHigherValue = calcValue(a) < calcValue(b);
                var hasEqualValue = calcValue(a) == calcValue(b);

                return hasHigherValue ? 1 : hasEqualValue ? 0 : -1;
            });

            this.chapterList = chapterList;
        },
        Filter() {
            let rc = new ChapterUrlsUI.RangeCalculator();

            /** @type { { [k: string]: FormDataEntryValue } | ChapterFormResult[] } */
            let formResults = Object.fromEntries(new FormData(document.getElementById("sbFiltersForm")));

            let formKeys = Object.keys(formResults);

            formResults = formKeys.filter(key => key.indexOf("Hidden") == -1)
                .map(key => {
                    return {
                        key: key,
                        searchType: formResults[key],
                        value: formResults[`${key}Hidden`]
                    };
                });

            let includeChaps = null;
            let excludeChaps = null;

            if (formResults.filter(item => item.searchType == 1).length > 0) {
                includeChaps = new RegExp(formResults.filter(item => item.searchType == 1).map(item => item.value).join("|"), "i");
            }

            if (formResults.filter(item => item.searchType == -1).length > 0) {
                excludeChaps = new RegExp(formResults.filter(item => item.searchType == -1).map(item => item.value).join("|"), "i");
            }

            ChapterUrlsUI.Filters.chapterList.forEach(item =>{
                let showChapter = rc.rowInRange(item.row);

                if (includeChaps) {
                    showChapter = showChapter && includeChaps.test(item.valueString);
                }

                if (excludeChaps) {
                    showChapter = showChapter && !excludeChaps.test(item.valueString);
                }

                ChapterUrlsUI.setRowCheckboxState(item.row, showChapter);
                item.row.hidden = !showChapter;
            });

            document.getElementById("spanChapterCount").textContent = ChapterUrlsUI.Filters.chapterList.filter(item => !item.row.hidden).length;
        },
        generateFiltersTable() {
            let retVal = document.createElement("table");

            let onClickEvent = (event) => {
                if (event == undefined || event == null) {
                    return;
                }

                if (event.target.classList.contains("exclude")) {
                    event.target.checked = false;
                    event.target.classList.remove("exclude");
                    event.target.value = 1;
                } else if (!event.target.indeterminate && !event.target.checked) {
                    event.target.value = -1;
                    event.target.checked = true;
                    event.target.indeterminate = true;
                    event.target.classList.add("exclude");
                }

                ChapterUrlsUI.Filters.Filter();
            };

            let row = document.createElement("tr");
            let col = document.createElement("td");
            let checkboxId = "chkFilterText";

            let el = document.createElement("input");
            el.type = "checkbox";
            el.name = checkboxId;
            el.id = checkboxId;
            el.value = 1;
            el.onclick = onClickEvent;
            el.onchange = (event) => {
                if (event == undefined || event == null) {
                    return;
                }
                event.target.parentElement.nextElementSibling.firstChild.disabled = !event.target.checked;
                ChapterUrlsUI.Filters.Filter();
            };
            col.appendChild(el);
            row.appendChild(col);

            col = document.createElement("td");
            el = document.createElement("input");
            el.type = "text";
            el.disabled = true;
            el.id = checkboxId + "Text";
            el.onchange = (event) => { event.target.nextElementSibling.value = event.target.value; ChapterUrlsUI.Filters.Filter(); };
            col.appendChild(el);
            el = document.createElement("input");
            el.type = "hidden";
            el.id = checkboxId + "Hidden";
            el.name = checkboxId + "Hidden";
            col.appendChild(el);
            row.appendChild(col);

            retVal.appendChild(row);

            ChapterUrlsUI.Filters.filterTermsFrequency.forEach((value, id) => {
                row = document.createElement("tr");
                col = document.createElement("td");
                col.setAttribute("width", "10px");
                
                checkboxId = "chkFilter" + id;
                let el = document.createElement("input");
                el.type = "checkbox";
                el.name = checkboxId;
                el.id = checkboxId;
                el.value = 1;
                el.onclick = onClickEvent;
                col.appendChild(el);
                
                el = document.createElement("input");
                el.type = "hidden";
                el.name = checkboxId+"Hidden";
                el.value = RegExp.escape(value.key);
                col.appendChild(el);
                row.appendChild(col);

                col = document.createElement("td");
                el = document.createElement("label");
                el.innerText = value.key;
                el.id = checkboxId + "Label";
                el.setAttribute("for", checkboxId);
                el.setAttribute("width", "100%");
                col.appendChild(el);
                row.appendChild(col);

                retVal.appendChild(row);
            });

            retVal.setAttribute("width", "100%");

            return retVal;
        }
    };
}

/**
 * FIXME: This can be a closure.
 */
ChapterUrlsUI.RangeCalculator = class {
    /**
     * The first index to use for calculations.
     * 
     * @type { number }
     * @private
     */
    startIndex;

    /**
     * The last index to use for calculations.
     * 
     * @type { number }
     * @private
     */
    endIndex;

    /**
     * @public
     */
    constructor()
    {
        this.startIndex = ChapterUrlsUI.selectionToRowIndex(ChapterUrlsUI.getRangeStartChapterSelect());
        this.endIndex = ChapterUrlsUI.selectionToRowIndex(ChapterUrlsUI.getRangeEndChapterSelect());
    }

    /**
     * Check whether a row is inside the allowable range.
     * 
     * @param { HTMLTableRowElement } row The row to check.
     * @returns { boolean } Whether the `row` is inside the range.
     * 
     * @public
     */
    rowInRange(row) {
        let index = row.rowIndex;
        return (this.startIndex <= index) && (index <= this.endIndex);
    }
};


/*
 * FIXME: Enum up these types or something. Also they can live inside the class
 * now.
 */

ChapterUrlsUI.DOWNLOAD_STATE_NONE = 0;
ChapterUrlsUI.DOWNLOAD_STATE_DOWNLOADING = 1;
ChapterUrlsUI.DOWNLOAD_STATE_LOADED = 2;
ChapterUrlsUI.DOWNLOAD_STATE_SLEEPING = 3;
ChapterUrlsUI.DOWNLOAD_STATE_PREVIOUS = 4;

/**
 * The Image to use for tooltip corresponding to
 * `ChapterUrlsUI.DOWNLOAD_STATE_XXX`.
 * 
 * @type { UrlString[] }
 * @public
 */
ChapterUrlsUI.ImageForState = [
    "images/ChapterStateNone.svg",
    "images/ChapterStateDownloading.svg",
    "images/FileEarmarkCheckFill.svg",
    "images/ChapterStateSleeping.svg",
    "images/FileEarmarkCheck.svg"
];

/**
 * The UI text to use for tooltip corresponding to
 * `ChapterUrlsUI.DOWNLOAD_STATE_XXX`.
 * 
 * FIXME: Typo.
 * 
 * @type { (string | null)[] }
 * @public
 */
ChapterUrlsUI.TooltipForSate = [
    null,
    UIText.Chapter.tooltipChapterDownloading,
    UIText.Chapter.tooltipChapterDownloaded,
    UIText.Chapter.tooltipChapterSleeping,
    UIText.Chapter.tooltipChapterPreviouslyDownloaded
];

/**
 * State variable for `ChapterUrlsUI.tellUserAboutShiftClick`.
 * 
 * FIXME: This can be shoved inside a closure for the above function.
 * 
 * @type { number | null }
 * @public
 */
ChapterUrlsUI.lastSelectedRow = null;

/**
 * State variable for `ChapterUrlsUI.tellUserAboutShiftClick`.
 * 
 * FIXME: This can be shoved inside a closure for the above function.
 * 
 * @type { number }
 * @public
 */
ChapterUrlsUI.ConsecutiveRowClicks = 0;
