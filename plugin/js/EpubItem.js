"use strict";

/**
 * An item (file) that will go into an EPUB.
 * 
 * It has the following properties
 *    type:  XHTML or image
 *    sourceUrl: where the html came from
 *    id:  the id value in the content.opf file
 * 
 *    optional members:
 *    nodes:  list of nodes that make up the content (if it's XHTML content)
 * 
 * FIXME: Redo comments for {@link index}; also is index the same as id from above?
 */
class EpubItem {
    /**
     * @type { ChildNode[] | undefined }
     */
    nodes;

    /**
     * Where the html came from.
     * 
     * @type { UrlString | undefined }
     * @public
     */
    sourceUrl;

    /**
     * @type { boolean }
     */
    isInSpine;

    /**
     * @type { unknown | null }
     */
    chapterTitle;

    /**
     * The index of this item; may be used as part of `EpubItem.getId`.
     * 
     * @type { number | undefined }
     */
    index;

    /**
     * @param { UrlString } [sourceUrl] Where the html came from.
     */
    constructor(sourceUrl) {
        this.sourceUrl = sourceUrl;
        this.isInSpine = true;
        this.chapterTitle = null;
    }

    /**
     * Set a new value for {@link index}.
     * 
     * @param { number } index The new index.
     * @returns { void } Change is reflected in {@link index}.
     */
    setIndex(index) {
        this.index = index;
    }

    /**
     * Get/generate the "internal" urls for the item in the epub zip.
     * 
     * @returns { UrlString } The "internal" url.
     */
    getZipHref() {
        return util.makeStorageFileName("OEBPS/Text/", this.index, this.chapterTitle, "xhtml");
    }


    /**
     * Get the internal epub id for this item.
     * 
     * @returns { string } The internal epub id for this item.
     */
    getId() {
        return "xhtml" + util.zeroPad(this.index);
    }

    /**
     * Get the mime type of the item.
     * 
     * FIXME: MimeTypes could easily be an enum for more strictness.
     * 
     * @returns { string } The mime type.
     */
    getMediaType() {
        return "application/xhtml+xml";
    }

    /**
     * Check whether there are any SVGs contained in {@link (nodes)}.
     * 
     * @returns { boolean } Whether any SVG(s) were found.
     */
    hasSvg() {
        if (this.nodes != null) {
            for (let n of this.nodes) {
                if ((n.nodeType === Node.ELEMENT_NODE) &&
                    (/** @type { Element } */ (n).querySelector("svg") !== null)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Create document for chapter contents, validate it, **delete all
     * items stored in {@link EpubItem.nodes}**, and then return the document
     * as a string.
     * 
     * NOTE: This does kindof throw; if the created document is invalid it calls
     * out to {@link ErrorLog}.
     * 
     * @param { () => Document } emptyDocFactory Maker of empty documents to put items in.
     * @param { (xml: string) => string | null } contentValidator Validator to ensure created items are valid.
     * @returns { string } The created document as a string.
     */
    fileContentForEpub(emptyDocFactory, contentValidator) {
        let xml = util.xmlToString(this.makeChapterDoc(emptyDocFactory));
        let errorMessage = contentValidator(xml);

        if (errorMessage) {
            let errorMsg = UIText.Error.convertToXhtmlWarning(this.chapterTitle, this.sourceUrl, errorMessage);
            ErrorLog.log(errorMsg);
        }

        return xml;
    }

    /**
     * Add the item to the epub.
     * 
     * @param { zip.ZipWriter<Blob> } zipWriter The in progress zip to append.
     * @param { () => Document } emptyDocFactory Maker of empty documents to put items in.
     * @param { (xml: string) => string | null } contentValidator Validator to ensure created items are valid.
     * @returns { void } Changes are made on {@link zipWriter} directly.
     */
    packInEpub(zipWriter, emptyDocFactory, contentValidator) {
        let content = this.fileContentForEpub(emptyDocFactory, contentValidator);
        zipWriter.add(this.getZipHref(), new zip.TextReader(content));
    }

    /**
     * Create a new document and insert the chapter contents, **and delete all
     * items stored in {@link EpubItem.nodes}**.
     * 
     * @param { () => Document } emptyDocFactory Maker of empty documents to put items in.
     * @returns { Document } The created document.
     */
    makeChapterDoc(emptyDocFactory) {
        let doc = emptyDocFactory();
        let body = doc.getElementsByTagName("body")[0];

        for (let node of this.nodes) {
            let clean = util.sanitizeNode(node);

            if (clean) {
                body.appendChild(clean);
            }
        }

        this.populateTitle(doc, body);
        delete(this.nodes);

        return doc;
    }

    /**
     * Sets the title of document, and duplicates it to heading in body if
     * present heading element can be found.
     * 
     * @param { Document } doc The document to modify.
     * @param { HTMLBodyElement } body The body element to modify heading in.
     */
    populateTitle(doc, body) {
        let title = doc.querySelector("title");
        let h1 = body.querySelector("h1");

        if (util.isNullOrEmpty(title.textContent) && (h1 !== null)) {
            title.textContent = h1.textContent;
        }
    }

    /**
     * Convert type of heading element to nesting depth on Table of Contents
     * H1 = 0, H2 = 1, etc
     * 
     * @param { string } tagName H1, H2, H3, ...
     * @returns { number } The corresponding depth for the heading level.
     */
    tagNameToTocDepth(tagName) {
        // ToDo: assert that tagName in range <h1> ... <h4>
        return tagName[1] - "1";
    }

    /**
     * Builds out and yields {@link TOCChapterInfo} objects for each node in
     * {@link nodes}.
     * 
     * @returns { Generator<TOCChapterInfo, void, unknown> }
     */
    *chapterInfo() {
        for (let element of this.nodes) {
            if (util.isHeaderTag(element)) {
                yield {
                    depth: this.tagNameToTocDepth(/** @type { HTMLHeadingElement } */ (element).tagName),
                    title: /** @type { HTMLHeadingElement } */ (element).textContent,
                    src: this.getZipHref()
                };
            }
        }
    }

    /**
     * Get all anchor elements from {@link nodes}.
     * 
     * @returns { HTMLAnchorElement[] } The found anchors.
     */
    getHyperlinks() {
        /** @type { HTMLAnchorElement[] } */
        let links = [];

        for (let element of this.nodes) {
            if (element.nodeType === Node.ELEMENT_NODE) {
                if (element.tagName.toLowerCase() === "a") {
                    links.push(element);
                }

                for (let link of element.querySelectorAll("a")) {
                    links.push(link);
                }
            }
        }

        return links;
    }
}

//==============================================================

/**
 * Construct an Epub item from source where each chapter 
 * was a separate HTML file.
 */
class ChapterEpubItem extends EpubItem { // eslint-disable-line no-unused-vars
    /**
     * @type { string }
     */
    chapterTitle;

    /**
     * @type { string | null | undefined }
     */
    newArc;

    /**
     * @param { ChapterLink } chapter The chapter to construct from.
     * @param { { childNodes: Iterable<ChildNode> } } content The content element.
     * @param { number } index The index; passed up to {@link EpubItem}.
     */
    constructor(chapter, content, index) {
        super(chapter.sourceUrl);
        super.setIndex(index);
        this.nodes = Array.from(content.childNodes);
        this.chapterTitle = chapter.title;
        this.newArc = chapter.newArc;
    }

    /**
     * Yields {@link TOCChapterInfo} for the chapter, and the arc if present.
     * 
     * @returns { Generator<TOCChapterInfo, void, unknown> }
     */
    *chapterInfo() {
        let isStartOfNewArc = ((this.newArc !== null) && (this.newArc !== undefined));

        if (isStartOfNewArc) {
            yield {
                depth: 0,
                title: /** @type { string } */ (this.newArc),
                src: this.getZipHref()
            };
        }

        if (typeof (this.chapterTitle) !== "undefined") {
            yield {
                depth: 1,
                title: this.chapterTitle,
                src: this.getZipHref()
            };
        }
    }
}

//==============================================================

/**
 *  Details of an image in BakaTsuki web page.
 */
class ImageInfo extends EpubItem { // eslint-disable-line no-unused-vars
    /**
     * URL of <a> tag that wraps the <img> (For Baka-Tsuki, is a web page that
     * holds list of versions of the image).
     * 
     * @type { UrlString | undefined }
     */
    wrappingUrl;

    /**
     * jpeg, png, etc.
     * 
     * @type { string }
     */
    mediaType;

    /**
     * the image bytes
     * 
     * @type { ArrayBuffer | null }
     */
    arraybuffer;

    /**
     * use this as the cover image?
     * 
     * @type { boolean }
     */
    isCover;

    /**
     * @type { boolean }
     */
    isOutsideGallery;

    /**
     * "full size" image height 
     * 
     * @type { number | null }
     */
    height;

    /**
     * "full size" image width
     * 
     * @type { number | null }
     */
    width;

    /**
     * The image file url based on "data-orig-file" attribute.
     * 
     * @type { UrlString | null | undefined }
     * @public
     */
    dataOrigFileUrl;

    /**
     * @type { boolean }
     * @protected
     */
    queuedForFetch;

    /**
     * @param { UrlString } [wrappingUrl] URL of <a> tag that wraps the <img>.
     * @param { number } [index] The index of this item; may be used as part of `EpubItem.getId`.
     * @param { UrlString } [sourceUrl] Where the html came from.
     * @param { UrlString | null } [dataOrigFileUrl] The image file url based on "data-orig-file" attribute.
     * 
     * @public
     */
    constructor(wrappingUrl, index, sourceUrl, dataOrigFileUrl) {
        super(sourceUrl);
        super.index = index;
        super.isInSpine = false;
        this.wrappingUrl = wrappingUrl;
        this.mediaType = "image/jpeg";
        this.isCover = false;
        this.isOutsideGallery = false;
        this.arraybuffer = null;
        this.height = null;
        this.width = null;
        this.dataOrigFileUrl = dataOrigFileUrl;
        this.queuedForFetch = false;
    }

    /**
     * Make a link(?) for a zip.
     * 
     * @override
     * @returns { UrlString } The created link(?).
     * 
     * @public
     */
    getZipHref() {
        let suffix = util.getDefaultExtensionByMime(this.mediaType) || this.findImageSuffix(this.wrappingUrl);
        return util.makeStorageFileName("OEBPS/Images/", this.index, this.getImageName(this.wrappingUrl), suffix);
    }

    /**
     * Get {@link arraybuffer} as base64.
     * 
     * FIXME: Literally 0 references.
     * 
     * @param { number } maxLength The maximum number of bytes to convert; 0 for unlimited.
     * @returns { string } The base64:ed {@link arraybuffer}.
     */
    getBase64(maxLength) {
        var binary = "";
        var bytes = new Uint8Array(this.arraybuffer);
        var len = bytes.byteLength;

        if (maxLength > 0) len = Math.min(len, maxLength);

        for (var i = 0; i < len; i++)
        {
            binary += String.fromCharCode(bytes[i]);
        }

        return window.btoa( binary );
    }

    /**
     * @override
     * @inheritdoc
     */
    getId() {
        if (this.isCover) {
            return "cover-image";
        } else {
            return "image" + util.zeroPad(this.index);
        }
    }

    /**
     * @override
     * @inheritdoc
     */
    getMediaType() {
        return this.mediaType;
    }

    /**
     * Add image to the epub.
     * 
     * @param { zip.ZipWriter<Blob> } zipWriter The in progress zip to append.
     * @returns { void } Changes are made on {@link zipWriter} directly.
     */
    packInEpub(zipWriter) {
        zipWriter.add(this.getZipHref(),
            new zip.BlobReader(new Blob([this.arraybuffer])));
    }

    /**
     * Find the image suffix.
     * 
     * @param { UrlString } wrappingUrl The url to extract from.
     * @returns { string } The found suffix.
     * 
     * @private
     */
    findImageSuffix(wrappingUrl) {
        let suffix = "";
        let fileName = this.extractImageFileNameFromUrl(wrappingUrl);

        if (fileName != null) {
            let index = fileName.lastIndexOf(".");
            suffix = fileName.substring(index + 1);
        }

        // if can't find suffix from file, use the media type
        if (fileName == null) {
            let split = this.mediaType.split("/");
            suffix = split[split.length - 1];

            // special case
            if (suffix === "svg+xml") {
                suffix = "svg";
            }
        }

        return suffix;
    }

    /**
     * Assume image URL looks like one one of the following:
     * 
     * https://www.baka-tsuki.org/project/index.php?title=File:HSDxD_v01_cover.jpg
     * https://www.baka-tsuki.org/project/thumb.php?f=HSDxD_v01_cover.gif&width=427
     * https://www.baka-tsuki.org/project/images/7/76/HSDxD_v01_cover.jpg
     * http://sonako.wikia.com/wiki/File:Date4_000c.png
     * http://vignette2.wikia.nocookie.net/sonako/images/d/db/Date4_000c.png/revision/latest?cb=20140821053052
     * http://vignette2.wikia.nocookie.net/sonako/images/d/db/Date4_000c.png/revision/latest/scale-to-width-down/332?cb=20140821053052
     * 
     * @param { UrlString } url The url to extract from.
     * @returns { string | undefined } The found image name; or undefined.
     * 
     * @private
     */
    extractImageFileNameFromUrl(url) {
        let parsedUrl = null;

        try {
            parsedUrl = new URL(url);
        } catch (err) {
            return undefined;
        }

        // examine pathname and query
        let temp = parsedUrl.pathname + parsedUrl.search;
        let fileNames = temp.split(/=|&|:|\/|\?/).filter(s => this.isImageFileNameCandidate(s));

        if (0 < fileNames.length) {
            return fileNames[fileNames.length - 1];
        }
    
        // if get here, nothing found
        return undefined;
    }

    /**
     * Crude. If string has '.' and is not a .php or .html, 
     * and there's at least 3 characters after the '.'
     * assume it's an image filename
     * 
     * @param { string } candidate The string to check.
     * @returns { boolean } Whether the string is a filename candidate.
     * 
     * @private
     */
    isImageFileNameCandidate(candidate) {
        let lowerString = candidate.toLowerCase();

        return (4 < lowerString.length) &&
            (lowerString.indexOf(".") !== -1) &&
            (lowerString.indexOf(".html") === -1) &&
            (lowerString.indexOf(".php") === -1) &&
            (4 <= (lowerString.length - lowerString.lastIndexOf(".")));
    }

    /**
     * Get the image name from a url.
     * 
     * @param { UrlString } page The url to extract from.
     * @returns { string | undefined } The found image name or undefined.
     * 
     * @private
     */
    getImageName(page) {
        if (page) {
            let name = this.extractImageFileNameFromUrl(page);

            if (name) {
                return name.split(/\./gi)[0];
            }
        }

        // This is actually wise to do now.
        return undefined;
    }

    /**
     * Create element for an image.
     * 
     * @param { UserPreferences } userPreferences Preferences used to determine whether to create SVG or not.
     * @returns { HTMLElement } The container of the created image.
     * 
     * @public
     */
    createImageElement(userPreferences) {
        if (this.isSvgImageUsedHere(userPreferences)) {
            return util.createSvgImageElement(this.getZipHref(), this.width, this.height, 
                this.wrappingUrl, userPreferences.includeImageSourceUrl.value);
        } else {
            return this.createImgImageElement("div");
        }
    }

    /**
     * Check whether SVG images should be used.
     * 
     * @param { UserPreferences } userPreferences The user's preferences.
     * @returns { boolean } Whether SVG should be used.
     * 
     * @private
     */
    isSvgImageUsedHere(userPreferences) {
        const MIN_SVG_IMAGE_DIMENSION = 300;

        return userPreferences.useSvgForImages.value &&
            MIN_SVG_IMAGE_DIMENSION <= this.width &&
            MIN_SVG_IMAGE_DIMENSION <= this.height;
    }

    /**
     * Create an image element inside a wrapper.
     * 
     * @template { keyof HTMLElementTagNameMap } T
     * @param { T } wrappingTag The tag of the wrapper.
     * @returns { HTMLElementTagNameMap[T] } Reference to the created wrapper.
     * 
     * @public
     */
    createImgImageElement(wrappingTag) {
        let src = this.getZipHref();
        let origin = this.wrappingUrl;
        let doc = util.createEmptyXhtmlDoc();
        let body = doc.getElementsByTagName("body")[0];

        // We can cast here as long as the namespace remains "http://www.w3.org/1999/xhtml".
        let wrapper = /** @type { HTMLElementTagNameMap[T] } */ (doc.createElementNS(util.XMLNS, wrappingTag));
        body.appendChild(wrapper);

        // We can cast here as long as the namespace remains "http://www.w3.org/1999/xhtml".
        let img = /** @type { HTMLImageElement } */ (doc.createElementNS(util.XMLNS,"img"));

        if (wrappingTag === "span") {
            img.className = "inline";
        }

        img.src = util.makeRelative(src);
        img.alt = "";

        wrapper.appendChild(img);
        wrapper.appendChild(util.createComment(doc, origin));

        return wrapper;
    }

    /**
     * Gives nothing, images do not appear in table of contents.
     * 
     * @override
     * @returns { Generator<never, void, unknown> } Generates nothing as images don't appear in ToC.
     * 
     * @public
     */
    *chapterInfo() {
        // images do not appear in table of contents
    }
}

class FontInfo extends ImageInfo { // eslint-disable-line no-unused-vars
    /**
     * The name of the font which this instance represents.
     * 
     * @type { string }
     * @private
     */
    fontName;
    
    /**
     * @param { string } fontName The name of the font.
     * 
     * @public
     */
    constructor(fontName) {
        super();
        this.fontName = fontName;
    }

    /**
     * Add font to the epub.
     * 
     * @override
     * @param { zip.ZipWriter<Blob> } zipWriter The in progress zip to append.
     * @returns { void } Changes are made on `zipWriter` directly.
     * 
     * @public
     */
    packInEpub(zipWriter) {
        zipWriter.add("OEBPS/Fonts/" + this.fontName,
            new zip.BlobReader(new Blob([this.arraybuffer])));
    }
}