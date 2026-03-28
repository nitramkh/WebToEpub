
"use strict";

/**
 * Code to manipulate the Progress Bar on the UI.
 */
class ProgressBar { // eslint-disable-line no-unused-vars
    /**
     * @private
     */
    constructor() {}

    /**
     * Get the progress bar element.
     * 
     * @returns { HTMLProgressElement | null } The progress bar element; or null if not found.
     * 
     * @public
     */
    static getUiElement() {
        return /** @type { HTMLProgressElement | null } */ (document.getElementById("fetchProgress"));
    }

    /**
     * Set the current progress value, e.g. X in "X / Y"
     * 
     * @param { number } value The new value.
     * @returns { void } Changes are made on element directly.
     */
    static setValue(value) {
        ProgressBar.getUiElement().value = value;
        ProgressBar.updateText();
    }

    /**
     * Increment the current progress value, e.g, X in "X / Y".
     * 
     * @param { number } increment Amount to increment by.
     * @returns { void } Changes are made on element directly.
     * 
     * @public
     */
    static updateValue(increment) {
        ProgressBar.getUiElement().value += increment;
        ProgressBar.updateText();
    }

    /**
     * Set the max value of the progress, e.g, Y in "X / Y".
     * 
     * @param { number } max The new max value.
     * @returns { void } Changes are made on the element directly.
     * 
     * @public
     */
    static setMax(max) {
        ProgressBar.getUiElement().max = max;
        ProgressBar.updateText();
    }

    /**
     * Updates to the text on the progress bar element based on the set value
     * and max properties.
     * 
     * @returns { void } Changes are made on the element directly.
     * 
     * @private
     */
    static updateText() {
        let element = ProgressBar.getUiElement();
        let text = "";

        if (1 < element.max) {
            text = `${element.value}/${element.max}`;
            ProgressBar.updateTabTitle(element.value, element.max);
        }

        document.getElementById("progressString").textContent = text;
    }

    /**
     * Update the tab title with new progress.
     * 
     * @param { number } value The current progress, e.g. X in "X / Y".
     * @param { number } max The max progress, e.g. Y in "X / Y".
     * @returns { void } Changes are made on document directly.
     * 
     * @private
     */
    static updateTabTitle(value, max) {
        value = (value*100/max).toFixed(1);

        if (value == "100.0") {
            value = "100";
        }

        document.title = value + "% WebToEpub";
    }
}
