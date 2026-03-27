
"use strict";

/**
 * Track EPUB chapters that have been previously downloaded 
 * 
 * Note, as local storage is limited to 5 Megabytes, 
 * and some stories can have  * 4k or more chapters, 
 * Can't hold all URLs.  So just record last chapter for each story.
*/
class ReadingList {
    /**
     * Keys are the link to the main ToC page used as the parent. Values are the
     * links to the last downloaded chapter related to the main ToC page key.
     * 
     * @type { Map<UrlString, UrlString> }
     * 
     */
    epubs;

    /**
     * @public
     */
    constructor() {
        this.epubs = new Map();
    }

    /**
     * Add an epub (by ToC page url) to the list, unless already present, but
     * **don't** persist yet.
     * 
     * @param { UrlString } url Url to the main ToC page used.
     * @returns { void } Changes are made on state directly.
     * 
     * @public
     */
    addEpub(url) {
        let oldUrl = this.epubs.get(url);
        if (oldUrl == null) {
            this.epubs.set(url, "");
        }
    }

    /**
     * Remove an epub (by ToC page url) to the list, but **don't** persist yet.
     * 
     * @param { UrlString } url Url to the main ToC page used. 
     * @returns { void } Changes are made on state directly.
     * 
     * @public
     */
    deleteEpub(url) {
        this.epubs.delete(url);
    }

    /**
     * Try to delete an epub (by ToC page url) from the list, and persist change
     * to local storage.
     * 
     * @param { UrlString } url Url to the main ToC page used.
     * @returns { boolean } Whether the delete succeeded.
     * 
     * @public
     */
    tryDeleteEpubAndSave(url) {
        if (this.getEpub(url)) {
            this.deleteEpub(url);
            this.writeToLocalStorage();

            return true;
        }

        return false;
    }

    /**
     * @param { UrlString } url Url to the main ToC page used.
     * @param { UrlString } chapterURL Url to the latest chapter downloaded.
     * @returns { void }
     */
    setEpub(url, chapterURL) {
        this.epubs.set(url, chapterURL);
        this.writeToLocalStorage();
    }

    /**
     * Get the latest chapter for epub (by ToC page url).
     * 
     * @param { UrlString } url Url to the main ToC page used.
     * @returns { UrlString | undefined } The found latest "chapter" url for ToC page url key.
     * 
     * @public
     */
    getEpub(url) {
        return this.epubs.get(url);
    }

    /**
     * Exclude all old chapters from `chapterList`.
     * 
     * @param { UrlString } url Url to the main ToC page used.
     * @param { ChapterLink[] } chapterList The chapter list to exclude old chapters from.
     * @returns { Promise<void | undefined> } Changes are made on `chapterList` directly.
     * 
     * @public
     */
    async deselectOldChapters(url, chapterList) {
        let oldUrl = this.epubs.get(url);

        if (oldUrl != null) {
            let foundLastURL = false;

            for (let i = 0; i < chapterList.length; ++i) {
                if (oldUrl === chapterList[i].sourceUrl) {
                    foundLastURL = true;

                    for (let j = 0; j <= i; ++j) {
                        chapterList[j].isIncludeable = false;
                        chapterList[j].previousDownload = true;
                    }

                    break;
                }
            }

            if (!foundLastURL) {
                let SourceChapterList = await Library.LibGetSourceChapterList(url);

                if (SourceChapterList == null) {
                    return;
                }

                for (let i = chapterList.length-1; i >= 0; --i) {
                    for (let j = SourceChapterList.length-1; j >= 0; --j) {
                        if (SourceChapterList[j] === chapterList[i].sourceUrl) {
                            for (let z = 0; z <= i; ++z) {
                                chapterList[z].isIncludeable = false;
                                chapterList[z].previousDownload = true;
                            }

                            return;
                        }
                    }
                }
            }
        }
    }

    /**
     * FIXME: I don't really know what this does. It seems to repeatedly
     * override a key in `epubs` and then maybe persist the changes to local
     * storage?
     * 
     * @param { UrlString } url The main ToC page for the chapters used as a key.
     * @param { ChapterLink[] } chapterList The updated list of chapters.
     * @returns { void } Changes are made on state directly.
     * 
     * @public
     */
    update(url, chapterList) {
        let oldUrl = this.epubs.get(url);
        let chapterListIsIncludeable = [...chapterList].filter(a => a.isIncludeable);

        if (oldUrl != null) {
            let progressBarValue = ProgressBar.getUiElement()?.value;

            if (progressBarValue) {
                let finished = progressBarValue - 1;

                for (let i = 0; i < finished; i++) {
                    this.epubs.set(url, chapterListIsIncludeable[i].sourceUrl);
                }
            } else {
                for (let c of chapterListIsIncludeable) {
                    this.epubs.set(url, c.sourceUrl);
                }
            }

            if (oldUrl !== this.epubs.get(url)) {
                this.writeToLocalStorage();
            }
        }
    }

    /**
     * Transformer/replacer used when converting a reading list into JSON.
     * 
     * @see {@link JSON.stringify}
     * 
     * @param { string } key The json key for the value.
     * @param { any } value The current value.
     * @returns { unknown } The transformed value.
     * 
     * @private
     */
    static replacer(key, value) {
        switch (key) {
            case "epubs":
                return [...value].map(v => ({ toc: v[0], lastUrl: v[1] }));
            default:
                return value;
        }
    }

    /**
     * Transformer/reviver used when converting json back into a reading list.
     * 
     * @see {@link JSON.parse}
     * 
     * @param { string } key The json key.
     * @param { any } value The found value.
     * @returns { unknown } The transformed value.
     * 
     * @private
     */
    static reviver(key, value) {
        switch (key) {
            case "epubs":
                return new Map([...value].map(ReadingList.reviveEpub));
            case "history": {
                return value[value.length - 1];
            }
            default:
                return value;
        }
    }

    /**
     * Reformat a generic json object into a recognizable format.
     * 
     * FIXME: My guess is that history is legacy since it is never set; but that
     *        it was an array of url strings; if that is right then this fixme
     *        can be removed.
     * 
     * @param { ReadingListEpub } packedEpub The json containing the epub info.
     * @returns { [ UrlString, UrlString | UrlString[] ] } The unpacked epub information.
     * 
     * @private
     */
    static reviveEpub(packedEpub) {
        return (packedEpub.history == null)
            ? [packedEpub.toc, packedEpub.lastUrl]
            : [packedEpub.toc, packedEpub.history];
    }

    /**
     * Serialize the current state of the reading list into json.
     * 
     * @returns { string } The reading list's state as a json string.
     * 
     * @public
     */
    toJson() {
        return JSON.stringify(this, ReadingList.replacer);
    }

    /**
     * Parser reading list state from json and create a `ReadingList` instance
     * with it.
     * 
     * @param { string } json The json to parse
     * @returns { ReadingList } The created instance.
     * 
     * @public
     */
    static fromJson(json) {
        let rl = new ReadingList();

        rl.epubs = JSON.parse(json, ReadingList.reviver).epubs;

        return rl;
    }

    /**
     * Fetch stored reading list state from local storage and populate this
     * instance.
     * 
     * @returns { void } Changes are made on state directly.
     * 
     * @public
     */
    readFromLocalStorage() {
        let config = window.localStorage.getItem(ReadingList.storageName);

        if (config != null) {
            this.epubs = ReadingList.fromJson(config).epubs;
        }
    }

    /**
     * Write current state to local storage.
     * 
     * @returns { void } Changes are made on local storage directly.
     * 
     * @public
     */
    writeToLocalStorage() {
        window.localStorage.setItem(ReadingList.storageName, this.toJson());
    }

    /**
     * Add or delete epub from storage depending on `checked` and persist to
     * local storage.
     * 
     * @param { boolean } checked Whether to add/delete (true/false) epub.
     * @param { UrlString } url The epub url to modify.
     * @return { void } Changes are made on state directly.
     * 
     * @public
     */
    onReadingListCheckboxClicked(checked, url) {
        if (checked) {
            this.addEpub(url);
        } else {
            this.deleteEpub(url);
        }

        this.writeToLocalStorage();
    }

    /**
     * Show the reading list UI.
     * 
     * @param { HTMLTableElement } table The table element to populate reading list in.
     * @returns { void } Changes are made on UI directly.
     * 
     * @public
     */
    showReadingList(table) {
        util.removeChildElementsMatchingSelector(table, "tr");

        for (let e of this.epubs.keys()) {
            let row = document.createElement("tr");
            table.appendChild(row);
            
            let link = document.createElement("a");
            link.href = e;
            link.textContent = e;
            this.appendColumnToRow(row, link);

            let button = document.createElement("button");
            button.textContent = UIText.Common.remove;
            this.appendColumnToRow(row, button);
        }
    }

    /**
     * Add a column to `row` containing `element`.
     * 
     * @param { HTMLTableRowElement } row The row to insert into.
     * @param { HTMLElement } element The element to add inside the column added to `row`.
     * @returns { void } Changes are made on `row` element directly.
     * 
     * @private
     */
    appendColumnToRow(row, element) {
        let col = document.createElement("td");
        col.appendChild(element);
        row.appendChild(col);
    }

    /**
     * Handler for click event to remove from reading list.
     * 
     * @param { PointerEvent } evt 
     * @returns { void } Changes are made on state directly.
     * 
     * @public
     */
    onClickRemove(evt) {
        if (evt.target.tagName === "BUTTON") {
            let row = evt.target.parentElement.parentElement;
            this.deleteEpub(row.querySelector("a").href);

            this.showReadingList(evt.currentTarget);

            this.writeToLocalStorage();
        }
    }
}

/**
 * The name used to store `ReadingList` data in local storage.
 * 
 * @type { string }
 * @public
 */
ReadingList.storageName = "ReadingList";
