"use strict";

class Download {
    /**
     * @type { typeof Download.saveOnFirefox | typeof Download.saveOnChrome | undefined}
     * @private
     */
    static saveOn;

    /**
     * @private
     */
    constructor() {  }

    /**
     * Initialize the `Download` "singleton-ish".
     * 
     * FIXME: This can be done with a nice closure; and then you can yeet this
     *        entire function.
     * 
     * @returns { void } Changes are made on state directly.
     * 
     * @public
     */
    static init() {
        Download.saveOn = util.isFirefox() ? Download.saveOnFirefox : Download.saveOnChrome;

        if (util.isFirefox()) {
            Download.saveOn = Download.saveOnFirefox;
            browser.downloads.onChanged.addListener(Download.onChanged);
        } else {
            Download.saveOn = Download.saveOnChrome;
            chrome.downloads.onChanged.addListener(Download.onChanged);
        }
    }

    /**
     * Check whether a filename is illegal on windows.
     * 
     * @param { FilenameString } fileName The filename to check.
     * @returns { boolean } Whether the filename is illegal.
     * 
     * @public
     */
    static isFileNameIllegalOnWindows(fileName) {
        for (let c of Download.illegalWindowsFileNameChars) {
            if (fileName.includes(c)) {
                return true;
            }
        }

        if (fileName.trim() == "") {
            return true;
        }
        
        return false;
    }

    /**
     * Create/parse epub filename based on user input.
     * 
     * @returns { FilenameString } The created filename with epub extension.
     * 
     * @public
     */
    static CustomFilename() {
        let CustomFilename = /** @type { HTMLInputElement | null } */ (document.getElementById("CustomFilenameInput")).value;

        let ToReplace = {
            "%URL_hostname%": (new URL(/** @type { HTMLInputElement | null } */ (document.getElementById("startingUrlInput")).value))?.hostname,
            "%Title%": /** @type { HTMLInputElement | null } */ (document.getElementById("titleInput")).value,
            "%Author%": /** @type { HTMLInputElement | null } */ (document.getElementById("authorInput")).value,
            "%Language%": /** @type { HTMLInputElement | null } */ (document.getElementById("languageInput")).value,
            "%Chapters_Count%": /** @type { HTMLSpanElement | null } */ (document.getElementById("spanChapterCount")).innerHTML,
            "%Chapters_Downloaded%": /** @type { HTMLProgressElement | null } */ (document.getElementById("fetchProgress")).value - 1,
            "%Filename%": /** @type { HTMLInputElement | null } */ (document.getElementById("fileNameInput")).value,
        };

        for (const [key, value] of Object.entries(ToReplace)) {
            CustomFilename = CustomFilename.replaceAll(key, value);
        }

        if (Download.isFileNameIllegalOnWindows(CustomFilename)) {
            ErrorLog.showErrorMessage(UIText.Error.errorIllegalFileName(CustomFilename, Download.illegalWindowsFileNameChars));
            return EpubPacker.addExtensionIfMissing("IllegalFileName");
        }
        
        return EpubPacker.addExtensionIfMissing(CustomFilename);
    }

    /**
     * Write blob to "Downloads" directory.
     * 
     * @param { Blob } blob The blob (zip/epub data most likely) to write.
     * @param { FilenameString } fileName The name of the file including extension, but not a full url/path.
     * @param { boolean } overwriteExisting Whether to overwrite an existing file with same name.
     * @param { boolean } backgroundDownload Whether to show a "Save As" popup to user.
     * @returns { Promise<void> } Promise which resolves once the download is complete.
     * 
     * @public
     */
    static save(blob, fileName, overwriteExisting, backgroundDownload) {
        /** @type { CommonDownloadOptions } */
        let options = {
            url: URL.createObjectURL(blob),
            filename: fileName,
            saveAs: !backgroundDownload,
        };

        if (overwriteExisting) {
            options.conflictAction = "overwrite";
        }

        let cleanup = () => { URL.revokeObjectURL(options.url); };

        return Download.saveOn(options, cleanup);
    }

    /**
     * Sub-function for performing a download on Chrome.
     * 
     * @param { chrome.downloads.DownloadOptions } options The download details.
     * @param { () => void } cleanup Action to be performed once the download has completed.
     * @returns { Promise<void> } Changes are made on state directly.
     * 
     * @private
     */
    static saveOnChrome(options, cleanup) {
        /*
         * On Chrome call to download() will resolve when "Save As" dialog OPENS
         * so we need to delay return until after file is actually saved.
         * Otherwise, we get multiple Save As Dialogs open. 
         */
        return new Promise((resolve,reject) => {
            chrome.downloads.download(options, 
                downloadId => Download.downloadCallback(downloadId, cleanup, resolve, reject)
            );
        });
    }

    /**
     * Helper to delay resolution of Chrome download promise; waits 10 second
     * before calling `cleanup` then resolves.
     * 
     * @param { number | undefined } downloadId The download id; errors out if undefined.
     * @param { () => void } cleanup Action to perform once the download has completed.
     * @param { () => void } resolve Callback to resolve the Chrome download promise.
     * @param { (reason: Error) => void } reject Callback to reject the Chrome download promise in case of error.
     * @returns { void } Changes are made indirectly on state.
     * 
     * @throws { Error } If `downloadId` is undefined.
     * 
     * @private
     */
    static downloadCallback(downloadId, cleanup, resolve, reject) {
        if (downloadId === undefined) {
            reject(new Error(chrome.runtime.lastError.message));
        } else {
            Download.onDownloadStarted(downloadId, 
                () => { 
                    const tenSeconds = 10 * 1000;
                    setTimeout(cleanup, tenSeconds);
                    resolve();
                }
            );
        }
    }

    /**
     * Sub-function for performing a download on Firefox.
     * 
     * @param { browser.downloads._DownloadOptions } options The download details.
     * @param { () => void } cleanup Action to perform once the download has completed.
     * @returns { Promise<void> } Changes are made on state directly.
     * 
     * @private
     */
    static saveOnFirefox(options, cleanup) {
        return browser.runtime.getPlatformInfo().then(platformInfo => {
            if (Download.isAndroid(platformInfo)) {
                Download.saveOnFirefoxForAndroid(options, cleanup);
            } else {
                return browser.downloads.download(options).then(
                    // on Firefox, resolves when "Save As" dialog CLOSES, so no
                    // need to delay past this point.
                    downloadId => Download.onDownloadStarted(downloadId, cleanup)
                );
            }
        }).catch(cleanup);
    }

    /**
     * Sub-function for performing a download on Android for Firefox.
     * 
     * @param { browser.downloads._DownloadOptions } options The download details.
     * @param { () => void } cleanup Action to perform once the download has completed.
     * @returns { void } Changes are made on state directly.
     * 
     * @private
     */
    static saveOnFirefoxForAndroid(options, cleanup) {
        options.saveAs = false;

        // `browser.downloads.download` isn't implemented in
        // "Firefox for Android" yet, so we starts downloads
        // the same way any normal web page would do it:
        const link = document.createElement("a");
        link.style.display = "hidden";

        link.href = options.url;
        link.download = options.filename;

        document.body.appendChild(link);

        try {
            link.click();
        } finally {
            document.body.removeChild(link);
        }

        cleanup();
    }

    /**
     * Check whether download is taking place on Android.
     * 
     * @param { browser.runtime.PlatformInfo } platformInfo Information to use to determine platform.
     * @returns { boolean } Whether the extension is running on Android.
     * 
     * @private
     */
    static isAndroid(platformInfo) {
        return platformInfo.os.toLowerCase().includes("android");
    }

    /**
     * Triggers when something happens related to downloads, if the change is a
     * completed download; perform cleanup.
     * 
     * @param { CommonDownloadDelta } delta The delta, aka. the HTML Event equivalent for a download.
     * @returns { void } Changes are made on state directly.
     * 
     * @private
     */
    static onChanged(delta) {
        if ((delta.state != null) && (delta.state.current === "complete")) {
            let action = Download.toCleanup.get(delta.id);

            if (action != null) {
                Download.toCleanup.delete(delta.id);
                action();
            }
        }
    }

    /**
     * Save a cleanup action with a download id to be executed on completion of
     * the download.
     * 
     * @param { number | undefined } downloadId The id of the download; if undefined action is executed immediately.
     * @param { () => void } action The action to store or execute.
     */
    static onDownloadStarted(downloadId, action) {
        if (downloadId === undefined) {
            action();
        } else {
            Download.toCleanup.set(downloadId, action);
        }
    }
}

/**
 * Container for cleanup operations to be performed in the future. Key is a
 * `downloadId` for a download; and the value is the cleanup to be executed
 * after completion.
 * 
 * FIXME: Can't this be inside the class?
 * 
 * @type { Map<number, () => void> }
 * @public
 */
Download.toCleanup = new Map();

/**
 * Characters which may not be contained in filenames on windows.
 * 
 * FIXME: Can't this be inside the class?
 * 
 * @type { string }
 * @public
 */
Download.illegalWindowsFileNameChars = "~/?<>\\:*|\"";

// Initialize the `Download` "singleton".
Download.init();