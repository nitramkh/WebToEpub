

"use strict";

/*
 * Provides information (and files) that will be packed into an EpubPacker.
 * This implementation is where source Baka-Tsuki.
 */
class EpubItemSupplier { // eslint-disable-line no-unused-vars
    /**
     * @type { Parser }
     */
    parser;

    /**
     * @type { EpubItem[] }
     */
    epubItems;

    /**
     * @type { ImageInfo | null | undefined }
     */
    coverImageInfo;

    /**
     * @type { ImageCollector }
     */
    imageCollector;

    /**
     * Function for getting the id of the cover image.
     * 
     * @type { () => string }
     */
    coverImageId;

    /**
     * 
     * @param { Parser } parser 
     * @param { EpubItem[] } epubItems 
     * @param { ImageCollector } imageCollector 
     */
    constructor(parser, epubItems, imageCollector) {
        this.parser = parser;
        this.epubItems = [];
        this.coverImageInfo = imageCollector.coverImageInfo;
        this.imageCollector = imageCollector;
        imageCollector.imagesToPackInEpub().forEach(image => this.epubItems.push(image));
        epubItems.forEach(item => this.epubItems.push(item));
        this.coverImageId = () => this.coverImageInfo.getId();
    }


    /**
     * Get all epub items for this supplier, used to populate manifest.
     * 
     * @returns { EpubItem[] } All epub items for this supplier.
     */
    manifestItems() {
        return this.epubItems;
    }

    /**
     * Used to populate spine.
     * 
     * @returns { EpubItem[] } The epub items which should go in the spine.
     */
    spineItems() {
        return this.epubItems.filter(item => item.isInSpine);
    }

    /**
     * Used to populate Zip file itself.
     * 
     * @returns { EpubItem[] } All the epub items.
     */
    files() {
        return this.epubItems;
    }

    /**
     * Yields the {@link TOCChapterInfo} for all constituent {@link EpubItem}s
     * for this supplier.
     * 
     * @returns { Generator<TOCChapterInfo, void, unknown> }
     */
    *chapterInfo() {
        for (let epubItem of this.epubItems) {
            yield* epubItem.chapterInfo();
        }
    }

    /**
     * Create a cover image document.
     * 
     * @param { () => Document } emptyDocFactory Factory for empty document to put cover image in.
     * @param { string } [title] Optional title to put on the created tocument.
     * @returns { string } The created cover image document as a string.
     */
    makeCoverImageXhtmlFile(emptyDocFactory, title) {
        let doc = emptyDocFactory();
        let body = doc.getElementsByTagName("body")[0];
        let userPreferences = this.imageCollector.userPreferences;
        body.appendChild(this.coverImageInfo.createImageElement(userPreferences));

        if (title) {
            doc.querySelector("title").text = title;
        }

        return util.xmlToString(doc);
    }

    /**
     * Check whether this supplier has or should have a cover image file.
     * 
     * @returns { boolean } Whether this supplier has or should have a cover image file.
     */
    hasCoverImageFile() {
        return (this.coverImageInfo != null);
    }
}
