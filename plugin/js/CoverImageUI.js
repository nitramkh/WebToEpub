"use strict";

/**
 * Class that handles UI for selecting cover image
 */
class CoverImageUI { // eslint-disable-line no-unused-vars
    /**
     * @private
     */
    constructor() {}

    /**
     * Get the image container table.
     * 
     * @returns { HTMLTableElement | null } The element or null if not present.
     * 
     * @private
     */
    static getImageTableElement() {
        return /** @type { HTMLTableElement | null } */ (document.getElementById("imagesTable"));
    }

    /**
     * Return URL of image to use for cover, or NULL if no cover
     * 
     * @returns { UrlString | null } The urls for the cover image; or null if not found.
     * 
     * @public
     */
    static getCoverImageUrl() {
        let url = CoverImageUI.getCoverImageUrlInput().value;
        
        return util.isNullOrEmpty(url) ? null : url;
    }

    /**
     * Toggle visibility of the Cover Image URL input control.
     * 
     * @param { boolean } visible Whether to show/hide controls.
     * @returns { void } Changes are made on elements directly.
     * 
     * @public
     */
    static showCoverImageUrlInput(visible) {
        document.getElementById("coverUrlSection").hidden = !visible;
        document.getElementById("imagesTableDiv").hidden = visible;
    }

    /**
     * Clear all UI elements associated with selecting the Cover Image.
     * 
     * @returns { void } Changes are made on UI directly.
     * 
     * @public
     */
    static clearUI() {
        CoverImageUI.clearImageTable();
        CoverImageUI.setCoverImageUrl("");
    }

    /**
     * Remove all images from the table of images to pick from.
     * 
     * @returns { void } Changes are made on elements directly.
     * 
     * @private
     */
    static clearImageTable() {
        let imagesTable = CoverImageUI.getImageTableElement();

        while (imagesTable.children.length > 0) {
            imagesTable.removeChild(imagesTable.children[imagesTable.children.length - 1]);
        }
    }

    /**
     * Create table of images for user to pick from.
     * 
     * @param { ImageInfo[] } images The images to populate the table with.
     * @returns { void } Changes are made on elements directly.
     * 
     * @private
     */
    static populateImageTable(images) {
        CoverImageUI.clearImageTable();

        let imagesTable = CoverImageUI.getImageTableElement();
        let checkBoxIndex = 0;

        if (0 === images.length) {
            imagesTable.parentElement.appendChild(document.createTextNode(UIText.CoverImage.noImagesFoundLabel));
        } else {
            images.forEach((imageInfo) => {
                let row = document.createElement("tr");
        
                // add checkbox
                let checkbox = CoverImageUI.createCheckBoxAndLabel(imageInfo.sourceUrl, checkBoxIndex);
                CoverImageUI.appendColumnToRow(row, checkbox);

                // add image
                let img = document.createElement("img");
                img.setAttribute("style", "max-height: 120px; width: auto; ");
                img.src = imageInfo.sourceUrl;
                CoverImageUI.appendColumnToRow(row, img);
                imagesTable.appendChild(row);

                ++checkBoxIndex;
            });
        }
    }

    /**
     * Adds row to the images table.
     * 
     * @param { UrlString } sourceUrl The URL of the image to which the checkbox corresponds.
     * @param { number } checkBoxIndex The index of the checkbox used as part of it's ID.
     * @returns { HTMLLabelElement } The label element which contains the created checkbox. 
     * 
     * @private
     */
    static createCheckBoxAndLabel(sourceUrl, checkBoxIndex) {
        let label = document.createElement("label");
        let checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.id = "setCoverCheckBox" + checkBoxIndex;

        checkbox.onclick = () => { CoverImageUI.onImageClicked(checkbox.id, sourceUrl); };

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(UIText.CoverImage.setCover));

        // default to first image as cover image
        if (checkBoxIndex === 0) {
            CoverImageUI.setCoverImageUrl(sourceUrl);
            checkbox.checked = true;
        }

        return label;
    }

    /**
     * User has selected/unselected an image for cover.
     * 
     * FIXME: I'm pretty sure the `onclick` provides a reference to the clicked
     *        checkbox element.
     * 
     * @param { HTMLIDString } checkboxId The HTML id of the checkbox which was clicked.
     * @param { UrlString } sourceUrl The URL of the image which was clicked.
     * 
     * @private
     */
    static onImageClicked(checkboxId, sourceUrl) {
        let checkbox = document.getElementById(checkboxId);

        if (checkbox.checked === true) {
            CoverImageUI.setCoverImageUrl(sourceUrl);

            // uncheck any other checked boxes
            let imagesTable = CoverImageUI.getImageTableElement();

            for (let box of imagesTable.querySelectorAll("input")) {
                if (box.id !== checkboxId) {
                    box.checked = false;
                }
            }
        } else {
            CoverImageUI.setCoverImageUrl(null);
        }
    } 

    /**
     * Create and append a column to `row` adding `element` as it's child.
     * 
     * @param { HTMLTableRowElement } row The row to add the column to.
     * @param { HTMLElement } element The element to add as the column's child.
     * @returns { HTMLTableCellElement } The created column.
     * 
     * @private
     */
    static appendColumnToRow(row, element) {
        let col = document.createElement("td");

        col.appendChild(element);
        col.style.whiteSpace = "nowrap";
        row.appendChild(col);

        return col;
    }

    /**
     * Set whether cover image should be taken from URL input or image table.
     * 
     * @todo this should be moved to Baka-Tsuki, this logic is specific to B-T
     * 
     * @param { boolean } enable Whether to take image from URL input; or from image table.
     * @param { ImageInfo[] } images The images to show.
     * @returns { void }
     * 
     * @public
     */
    static onCoverFromUrlClick(enable, images) {
        if (enable) {
            CoverImageUI.setCoverImageUrl(null);
            CoverImageUI.clearImageTable();
            CoverImageUI.showCoverImageUrlInput(true);
        } else {
            CoverImageUI.showCoverImageUrlInput(false);
            CoverImageUI.populateImageTable(images);
        }
    }

    /**
     * Get the input element containing the provided cover image url.
     * 
     * @returns { HTMLInputElement | null } Returns the input or null if not present.
     * 
     * @private
     */
    static getCoverImageUrlInput() {
        return /** @type { HTMLInputElement | null } */ (document.getElementById("coverImageUrlInput"));
    }

    /**
     * Get the preview image display element.
     * 
     * @returns { HTMLImageElement | null } The element or null if not present.
     * 
     * @private
     */
    static getSampleCoverImg() {
        return /** @type { HTMLImageElement | null } */ (document.getElementById("sampleCoverImg"));
    }

    /**
     * Set URL of image to use for cover, or NULL if no cover.
     * 
     * @param { UrlString } url The image url to set; or null to remove.
     * @returns { void } Changes are made on elements directly.
     * 
     * @public
     */
    static setCoverImageUrl(url) {
        let inputUrl = CoverImageUI.getCoverImageUrlInput();

        if (inputUrl.onchange == null) {
            inputUrl.onchange = CoverImageUI.showSampleImg;
        }

        inputUrl.value = url;
        CoverImageUI.getSampleCoverImg().src = url;
    }

    /**
     * Use the current contents of the image url input to show sample image.
     * 
     * @returns { void } Changes are made on elements directly.
     * 
     * @private
     */
    static showSampleImg() {
        let url = CoverImageUI.getCoverImageUrlInput().value;
        let sampleImg = CoverImageUI.getSampleCoverImg();
        sampleImg.src = url;
    }
}
