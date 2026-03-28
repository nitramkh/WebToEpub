"use strict";

class ErrorLog {
    /**
     * Whether to prevent any errors from being shown to the user. Note that
     * this is ignored if the error has a retry action.
     * 
     * @type { boolean }
     * @public
     */
    static SuppressErrorLog =  false;

    /**
     * @private
     */
    constructor() {}

    /**
     * Log an error but don't display it to the user in the UI.
     * 
     * @param { string | Error | CustomErrorMessage } error The error.
     * @returns { void } Changes are made on state directly.
     * 
     * @public
     */
    static log(error) {
        ErrorLog.history.push(ErrorLog.getMsgText(error));
    }

    /**
     * Show an error message in the UI, if one is already showing add the new
     * one to the queue to be shown after.
     * 
     * @param { string | Error | CustomErrorMessage } msg The error to show.
     * @returns { void } Changes are made on UI and state directly.
     * 
     * @public
     */
    static showErrorMessage(msg) {
        if (this.SuppressErrorLog && msg.retryAction == null) {
            return;
        }

        ErrorLog.queue.push(msg);

        if (1 < ErrorLog.queue.length) {
            return;
        }

        let sections = ErrorLog.hideAllSectionsSavingVisibility();
        ErrorLog.getErrorSection().hidden = false;

        ErrorLog.setErrorMessageText(msg);
        ErrorLog.setErrorMessageButtons(msg, sections);
    }

    /**
     * Handler for when a "UI-error" is closed, either shows next error in queue
     * or restores UI to it's pre-error visibility state.
     * 
     * @param { Map<HTMLElement, boolean> } sections The sections whose visibility is to be restored after errors are resolved.
     * @returns { void } Changes are made on UI/state directly.
     * 
     * @private
     */
    static onCloseError(sections) {
        ErrorLog.queue.shift();

        if (ErrorLog.queue.length === 0) {
            ErrorLog.restoreSectionVisibility(sections);
        } else {
            ErrorLog.setErrorMessageText(ErrorLog.queue[0]);
            ErrorLog.setErrorMessageButtons(ErrorLog.queue[0], sections);
        }
    }

    /**
     * Show entire error log in UI.
     * 
     * @returns { void } Changes are made on UI directly.
     * 
     * @public
     */
    static showLogToUser() {
        let history = ErrorLog.dumpHistory();

        if (!util.isNullOrEmpty(history)) {
            ErrorLog.showErrorMessage(history);
        }
    }

    /**
     * Clear the entire error history.
     * 
     * @returns { void } Changes are made on state directly.
     * 
     * @public
     */
    static clearHistory() {
        ErrorLog.history = [];
    }

    /**
     * Get the entire error history as a newline separated string.
     * 
     * @returns { string } The error history.
     * 
     * @public
     */
    static dumpHistory() {
        let errors = ErrorLog.history.join("\r\n\r\n");

        return errors;
    }

    /**
     * Get reference to the error section in the UI.
     * 
     * @returns { HTMLElement | null } 
     * 
     * @private
     */
    static getErrorSection() {
        return document.getElementById("errorSection");
    }

    /**
     * Get all <section> tags in UI as keys and hide them, but remember previous
     * visibility state as value.
     * 
     * @returns { Map<HTMLElement, boolean> } Literally all the section elements in the UI, and their "pre-error" visibility state.
     * 
     * @private
     */
    static hideAllSectionsSavingVisibility() {
        /** @type { Map<HTMLElement, boolean> } */
        let sections = new Map();

        for (let section of document.querySelectorAll("section")) {
            sections.set(section, section.hidden);
            section.hidden = true;
        }

        return sections;
    }

    /**
     * Show an error message in the UI.
     * 
     * @param { string | Error | CustomErrorMessage } msg The error to show message for.
     * @returns { void } Changes are made on UI directly.
     * 
     * @private 
     */
    static setErrorMessageText(msg) {
        let textRow = /** @type { HTMLPreElement | null } */ (document.querySelector("#errorMessageText pre"));
        textRow.textContent = ErrorLog.getMsgText(msg);
    }

    /**
     * Get the error text to display in UI for an error.
     * 
     * @param { string | Error | CustomErrorMessage } msg The error to get text for.
     * @returns { string } The error message text.
     * 
     * @private
     */
    static getMsgText(msg) {
        if (typeof (msg) === "string") {
            return msg;
        } else {
            // assume msg is some sort of error object
            let retVal = "" + msg.stack;

            if (!retVal.includes(msg.message)) {
                retVal = msg.message + " " + retVal;
            }

            return retVal;
        }
    }

    /**
     * Set the state of error message buttons according to `msg`.
     * 
     * @param { string | Error | CustomErrorMessage } msg The error/settings to use.
     * @param { Map<HTMLElement, boolean> } sections The sections whose visibility is to be restored after errors are resolved.
     * @returns { void } Changes are made on UI directly.
     * @private 
     */
    static setErrorMessageButtons(msg, sections) {
        let close = () => ErrorLog.onCloseError(sections);

        let okButton = document.getElementById("errorButtonOk");
        let retryButton = document.getElementById("errorButtonRetry");
        let cancelButton = document.getElementById("errorButtonCancel");
        let OpenURLButton = document.getElementById("errorButtonOpenURL");
        let BlockURLButton = document.getElementById("errorButtonBlockURL");

        if (msg.retryAction !== undefined) {
            okButton.hidden = true;

            retryButton.hidden = false;
            retryButton.onclick = function() {
                close();
                msg.retryAction();
            };

            cancelButton.hidden = false;
            cancelButton.onclick = function() {
                close();
                msg.cancelAction();
            };
            cancelButton.textContent = UIText.Common.cancel;

            if (msg.cancelLabel !== undefined) {
                cancelButton.textContent =  msg.cancelLabel;
            }

            if (msg.openurl !== undefined) {
                OpenURLButton.hidden = false;

                OpenURLButton.onclick = function() {
                    //window.open(new URL(msg.openurl), "_blank").focus();
                    //use chrome.tabs.create to prevent auto popup block from browser
                    chrome.tabs.create({ url: msg.openurl});
                };

                BlockURLButton.hidden = false;
                BlockURLButton.onclick = function() {
                    close();
                    BlockedHostNames.add(new URL(msg.blockurl).hostname);
                    msg.cancelAction();
                };
            } else {
                OpenURLButton.hidden = true;
                BlockURLButton.hidden = true;
            }
        } else {
            okButton.hidden = false;
            okButton.onclick = close;
            retryButton.hidden = true;
            cancelButton.hidden = true;
            OpenURLButton.hidden = true;
            BlockURLButton.hidden = true;
        }
    }

    /**
     * Set the visibility state of all key elements to value.
     * 
     * @param { Map<HTMLElement, boolean> } sections The sections to fix visibility for.
     * @returns { void } Changes are made on UI directly.
     * 
     * @private
     */
    static restoreSectionVisibility(sections) {
        for (let [key,value] of sections) {
            key.hidden = value;
        }
    }
}

/**
 * Errors which have yet to be displayed to the user.
 * 
 * @type { (string | Error | CustomErrorMessage)[] }
 */
ErrorLog.queue = [];

/**
 * Record of past errors.
 * 
 * FIXME: Can't this be declared inside the class?
 * 
 * @type { string[] }
 */
ErrorLog.history = [];
