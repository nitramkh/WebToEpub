/*
    Fetches the image files
*/

"use strict";

/** class that handles image tags 
 * urlIndex - track URLs associated with an ImageInfo
 * bitmapIndex - hashes of the image bitmaps, to allow us to eliminate duplicate images
 * imagesToFetch - images that need to be fetched from internet
 * imagesToPack - images to pack into epub
*/
class ImageCollector {
    /** @type { UserPreferences | null } */
    userPreferences;

    /** @type { ImageInfo[] | undefined } */
    imageInfoList;

    /** @type { Map<UrlString, number> | undefined } */
    urlIndex;

    /** @type { Map<unknown, unknown> | undefined } */
    bitmapIndex;

    /** @type { ImageInfo[] | undefined } */
    imagesToFetch;

    /** @type { ImageInfo[] | undefined } */
    imagesToPack;

    /** @type { ImageInfo | null | undefined } */
    coverImageInfo;

    constructor() {
        this.reset();
        this.userPreferences = null;
    }

    // An "image collector" with no images
    // used by parsers for source with no images.
    static StubCollector() {
        return {
            coverImageInfo: null,
            imagesToPackInEpub: function() { return []; }
        };
    }

    /**
     * Reset full state of the image collector.
     * 
     * @returns { void } Changes are made on internal state.
     */
    reset() {
        this.imageInfoList = [];
        this.urlIndex = new Map();
        this.bitmapIndex = new Map();
        this.imagesToFetch = [];
        this.imagesToPack = [];
        this.coverImageInfo = null;
    }

    copyState(otherImageCollector) {
        this.imageInfoList = otherImageCollector.imageInfoList;
        this.urlIndex = otherImageCollector.urlIndex;
        this.bitmapIndex = otherImageCollector.bitmapIndex;
        this.imagesToFetch = otherImageCollector.imagesToFetch;
        this.imagesToPack = otherImageCollector.imagesToPack;
        this.coverImageInfo = otherImageCollector.coverImageInfo;
        this.userPreferences = otherImageCollector.userPreferences;
    }

    /**
     * 
     * @param { UrlString } wrappingUrl 
     * @param { UrlString } sourceUrl 
     * @param { UrlString | null } dataOrigFileUrl The image file url based on "data-orig-file" attribute.
     * @param {*} fetchFirst 
     * @returns 
     */
    addImageInfo(wrappingUrl, sourceUrl, dataOrigFileUrl, fetchFirst) {
        let imageInfo = null;

        let index = this.urlIndex.get(sourceUrl);

        if (index === undefined) {
            index = this.urlIndex.get(wrappingUrl);
        }

        if (index === undefined) {
            index = this.urlIndex.get(dataOrigFileUrl);
        }

        if (index !== undefined) {
            imageInfo = this.imageInfoList[index];
        } else {
            index = this.imageInfoList.length;

            imageInfo = new ImageInfo(wrappingUrl, index, sourceUrl, dataOrigFileUrl);

            this.imageInfoList.push(imageInfo);

            if (fetchFirst) {
                this.imagesToFetch = [imageInfo].concat(this.imagesToFetch);
            } else {
                this.imagesToFetch.push(imageInfo);
            }
        }

        this.urlIndex.set(wrappingUrl, index);
        this.urlIndex.set(sourceUrl, index);

        if (dataOrigFileUrl != null) {
            this.urlIndex.set(dataOrigFileUrl, index);
        }

        return imageInfo;
    }

    /**
     * Set the cover image.
     * 
     * @param { UrlString | null | undefined } url The url of the image; does nothing if null or empty.
     * @returns { void } Changes are made on the state directly.
     */
    setCoverImageUrl(url) {
        // Note, this can be called in two cases.
        // 1. Baka-Tsuki, where images have already been loaded, so image may already be present
        // 2. Other Parsers, so image is not present.
        if (!util.isNullOrEmpty(url)) {
            let info = this.imageInfoByUrl(/** @type { UrlString } */ (url));

            if (info === null) {
                info = this.addImageInfo(/** @type { UrlString } */ (url), /** @type { UrlString } */ (url), null, true);
            }

            info.isCover = true;
            this.coverImageInfo = info;
        }
    }

    /**
     * Get cached image info for url.
     * 
     * @param { UrlString } url The url of the image.
     * @returns { ImageInfo | null } The cached image or null if not cached.
     */
    imageInfoByUrl(url) {
        let index = this.urlIndex.get(url);
        return (index === undefined) ? null : this.imageInfoList[index];
    }

    /**
     * Update internal reference of preferences to provided one.
     * 
     * @param { UserPreferences } userPreferences The updated user preferences.
     * @returns { void } Changes are made on internal properties directly.
     */
    onUserPreferencesUpdate(userPreferences) {
        this.userPreferences = userPreferences;
    }

    numberOfImagesToFetch() {
        return this.imagesToFetch.length;
    }

    async fetchImages(progressIndicator, parentPageUrl) {
        for (let imageInfo of this.imagesToFetch) {
            if (!imageInfo.queuedForFetch) {
                imageInfo.queuedForFetch = true;
                await this.fetchImage(imageInfo, progressIndicator, parentPageUrl);
            }
        }
        this.imagesToFetch = [];
    }

    /**
     * 
     * 
     * @param { ImageInfo } imageInfo
     * @returns { void }
     * @private
     */
    addToPackList(imageInfo) {
        let hash = ImageCollector.calculateHash(imageInfo.arraybuffer);
        let index = this.bitmapIndex.get(hash);
        if (index === undefined) {
            // first time we've seen the bitmap, so all OK
            this.bitmapIndex.set(hash, imageInfo.index);
            this.imagesToPack.push(imageInfo);
        } else {
            // duplicate bitmap, use previous version
            let wrongIndex = imageInfo.index;
            for (let [key, value] of this.urlIndex) {
                if (value === wrongIndex) {
                    this.urlIndex.set(key, index);
                }
            }
        }
    }

    /**
     * @private
     */
    static calculateHash(arraybuffer) {
        let hash = 0;
        let byteArray = new Uint8Array(arraybuffer);
        if (byteArray.length !== 0) {
            for (let i = 0; i < byteArray.length; ++i) {
                hash = ((hash << 5) - hash) + byteArray[i];
                hash |= 0;
            }
        }
        return ImageCollector.toHex(byteArray.length) + ImageCollector.toHex(hash);
    }

    
    /** Convert integer to 8 character Hex value
    * @private
    */
    static toHex(i) {
        let s = "00000000" + i.toString(16);
        return s.substring(s.length - 8);
    }

    /*
    *  Hook point for Baka-Tsuki to select image to fetch
    */
    selectImageUrlFromHtmlImagesPage(html) {  // eslint-disable-line no-unused-vars
        return null;
    }


    /**
     * Get URL of page that holds all copies of this image.
     * 
     * @param { HTMLElement } element The element to take from.
     * @returns { UrlString } The found url.
     */
    extractWrappingUrl(element) {
        if (element.tagName.toLowerCase() === "img") {
            return /** @type { HTMLImageElement } */ (element).src;
        }

        // FIXME: Ts/eslint dont scream, but the [0] will throw if no hrefs are found.
        return (element.tagName.toLowerCase() === "a") ? /** @type { HTMLAnchorElement } */ (element).href : element.getElementsByTagName("a")[0].href;
    }

    /**
     * Create a replacer for a specific image element.
     * 
     * @param { HTMLImageElement } element The image to create a replacer for.
     * @returns { ImageTagReplacer } The created tag replacer.
     */
    makeImageTagReplacer(element) {
        let wrappingElement = this.findImageWrappingElement(element);
        let wrappingUrl = this.extractWrappingUrl(wrappingElement);

        return new ImageTagReplacer(wrappingElement, wrappingUrl, this.userPreferences);
    }

    /**
     * Find "highest" element that is wrapping an image element.
     * 
     * @param { HTMLImageElement } element The image to find the wrapper for.
     * @returns { HTMLElement } The found highest wrapper.
     */
    findImageWrappingElement(element) {
        
        let link = this.findWrappingLink(element);

        if (link === null) {
            // image not wrapped in hyperlink, so just return the image itself
            return element;
        }

        /** @type { HTMLElement | null } */
        let parent = link;

        while (parent != null) {
            if (this.isImageWrapperElement(parent)) {
                return parent;
            }

            parent = parent.parentElement;
        }

        // assume all images are wrapped in at least a href
        return link;
    }

    /**
     * Find the nearest anchor wrapping the provided image.
     * 
     * @param { HTMLImageElement } element The image to find wrapper for.
     * @returns { HTMLAnchorElement | null } The nearest wrapper, or null if none found.
     */
    findWrappingLink(element) {
        let link = element.parentElement;

        while (link !== null) {
            if (link.tagName.toLowerCase() === "a") {
                return /** @type { HTMLAnchorElement } */ (link);
            }

            link = link.parentElement;
        }

        return link;
    }

    /**
     * Check if an element is an image wrapper?
     * 
     * FIXME: What? This doesn't feel like a ImageCollector type implementation?
     * 
     * @param { HTMLElement } element The element to check
     * @returns { boolean } Whether the element is an image wrapper.
     */
    isImageWrapperElement(element) {
        return ((element.tagName.toLowerCase() === "div") &&
            ((element.className === "thumb tright") || (element.className === "floatright") ||
            (element.className === "thumb") || (element.className === "floatleft")));
    }

    /**
     * 
     * 
     * @param { Element } content 
     * @returns { void }
     */
    findImagesUsedInDocument(content) {
        for (let imageElement of content.querySelectorAll("img")) {
            this.fixLazyLoadImageSource(imageElement);

            let src = this.findHighestResImage(imageElement);

            let wrappingElement = this.findImageWrappingElement(imageElement);

            let wrappingUrl = this.extractWrappingUrl(wrappingElement);

            let existing = this.imageInfoByUrl(wrappingUrl);

            if (existing == null) {
                let dataOrigFileUrl = this.findDataOrigFileUrl(imageElement, wrappingUrl);
                this.addImageInfo(wrappingUrl, src, dataOrigFileUrl, false);
            } else {
                existing.isOutsideGallery = true;
            }
        }
    }

    
    /**
     * Look through source and srcset and return the highest res image url.
     * 
     * @param { HTMLImageElement } img The element to look in.
     * @returns { UrlString } The higest res image url found.
     */
    findHighestResImage(img) {
        let srcset = img.getAttribute("srcset");

        if (srcset != null) {
            let src = this.findHighestResInSrcset(srcset);

            if (src != null) {
                img.src = this.findHighestResInSrcset(srcset);
            }
        }

        return img.src;
    }

    /**
     * Find the highest res image in set.
     * 
     * @param { string } srcset The "srcset" attribute of an image element.p
     * @returns { UrlString | null } The url pointing to the highest res image.
     */
    findHighestResInSrcset(srcset) {
        let max = -1;
        let url = null;

        let pairs = srcset.split(",")
            .map(o => o.trim().split(" "))
            .filter(o => (o.length == 2) && o[0].startsWith("http"));

        for (let pair of pairs) {
            let size = parseInt(pair[1]);

            if (max < size) {
                max = size;
                url = pair[0];
            }
        }

        return url;
    }

    /**
     * If present, shift any lazy sources to normal source attributes.
     * 
     * @param { HTMLImageElement } img The image to fix.
     * @returns { UrlString } The url of the image.
     */
    fixLazyLoadImageSource(img) {
        for (let attrib of ["data-lazy-srcset", "data-srcset"]) {
            let lazySrcset = img.getAttribute(attrib);
            if (lazySrcset != null) {
                img.setAttribute("srcset", lazySrcset);
                break;
            }
        }

        for (let attrib of ["data-lazy-src", "data-src"]) {
            let lazySrc = img.getAttribute(attrib);
            if (lazySrc != null) {
                img.src = lazySrc;
                break;
            }
        }

        return img.src;
    }

    /**
     * Extract image file url based on "data-orig-file" attribute.
     * 
     * @param { HTMLImageElement } imageElement The image to extract from.
     * @param { UrlString } wrappingUrl The base url to use if the found file is relative.
     * @returns { UrlString | null} The found url or null.
     */
    findDataOrigFileUrl(imageElement, wrappingUrl) {
        let dataOrigFile = imageElement.getAttribute("data-orig-file");

        if ((dataOrigFile != null) && (dataOrigFile != imageElement.src)
            && (dataOrigFile != wrappingUrl)) {
            let baseUrl = imageElement.ownerDocument.baseURI;

            return util.resolveRelativeUrl(baseUrl, dataOrigFile);
        }

        return null;
    }
    
    /**
     * Update image tags, point to image file in epub.
     * 
     * @param { Element } element containing <img> tags to update
     * @returns { void } Changes are made on the provided {@link element} object.
     */
    replaceImageTags(element) {
        let converters = [];

        for (let currentNode of element.querySelectorAll("img")) {
            converters.push(this.makeImageTagReplacer(currentNode));
        }

        converters.forEach(c => c.replaceTag(this.imageInfoByUrl(c.wrappingUrl)));
    }

    getImageDimensions(imageInfo) {
        return new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
            let img = new Image();
            let options = {type: imageInfo.mediaType};
            let blob = new Blob([new Uint8Array(imageInfo.arraybuffer)], options);
            let dataUrl = URL.createObjectURL(blob);
            img.onload = function() {
                imageInfo.height = img.height;
                imageInfo.width = img.width;
                URL.revokeObjectURL(dataUrl);
                resolve(img);
            };
            img.onerror = function() {
                // If the image gives an error then set a general height and width
                imageInfo.height = 1200;
                imageInfo.width = 1600;
                URL.revokeObjectURL(dataUrl);
                reject(img);
            };
            // start downloading image after event handlers are set
            img.src = dataUrl;
        });
    }

    runCompression(imageInfo, img) {
        return new Promise((resolve, reject) => {
            if (this.userPreferences.compressImages.value) 
            {
                let outputType = "image/jpeg";
                switch (this.userPreferences.compressImagesType.value) {
                    case "auto":
                        outputType = util.detectMimeType(imageInfo.getBase64(25));
                        break;
                    case "webp":
                        outputType = "image/webp";
                        break;
                    case "png":
                        outputType = "image/png";
                        break;
                    case "jpg":
                    default:
                        outputType = "image/jpeg";
                        break;
                }

                if (imageInfo.isCover && this.userPreferences.compressImagesJpgCover.value)
                {
                    outputType = "image/jpeg";
                }
                let c = document.createElement("canvas");
                let ctx = c.getContext("2d");
                let maxResolution = this.userPreferences.compressImagesMaxResolution.value;            
                if (imageInfo.height > maxResolution || imageInfo.width > maxResolution)
                {
                    if (imageInfo.height > imageInfo.width)
                    {
                        c.height = maxResolution;
                        c.width = Math.max(1, Math.round((imageInfo.width * 1.0) / ((imageInfo.height * 1.0)/maxResolution)));
                    }
                    else
                    {
                        c.width = maxResolution;
                        c.height = Math.max(1, Math.round((imageInfo.height * 1.0) / ((imageInfo.width * 1.0)/maxResolution)));
                    }
                }
                else
                {
                    c.height = imageInfo.height;
                    c.width = imageInfo.width;
                }
                ctx.drawImage(img, 0, 0, c.width, c.height);
                c.toBlob(async (cBlob) => {
                    try {
                        imageInfo.height = c.height;
                        imageInfo.width = c.width;
                        imageInfo.mediaType = outputType;
                        imageInfo.arraybuffer = await cBlob.arrayBuffer();
                        resolve();
                    } catch (e) {
                        reject();
                    }
                }, outputType, 0.9);
            }
            else
            {
                resolve();
            }
        });
    }

    async fetchImage(imageInfo, progressIndicator, parentPageUrl) {
        try
        {
            let initialUrl = this.initialUrlToTry(imageInfo);
            this.urlIndex.set(initialUrl, imageInfo.index);
            let fetchOptions = {errorHandler: new FetchImageErrorHandler(parentPageUrl) };
            let xhr = await HttpClient.wrapFetch(initialUrl, fetchOptions);
            xhr = await this.findImageFileUrl(xhr, imageInfo, imageInfo.dataOrigFileUrl, fetchOptions);
            imageInfo.mediaType = xhr.contentType;
            imageInfo.arraybuffer = xhr.arrayBuffer;
            this.fixupInvalidMediaType(imageInfo);
            {
                let img = await this.getImageDimensions(imageInfo);
                await this.runCompression(imageInfo, img);
            }
            progressIndicator();
            this.addToPackList(imageInfo);
        }
        catch (error)
        {
            // ToDo, implement error handler.
            this.imagesToPack.push(imageInfo);
            ErrorLog.log(error);
        }
    }

    fixupInvalidMediaType(imageInfo) {
        if (!imageInfo.mediaType?.startsWith("image")) {
            imageInfo.mediaType = util.detectMimeType(imageInfo.getBase64(25));
            if (imageInfo.mediaType == null)
            {
                let path = new URL(imageInfo.sourceUrl).pathname;
                let index = path.lastIndexOf(".");
                let format = (index < 0)
                    ? "jpeg"
                    : path.substring(index + 1);
                imageInfo.mediaType = "image/" + format;
            }
        }
    }

    /**
     * 
     * 
     * @param { FetchResponseHandler } xhr 
     * @param { ImageInfo } imageInfo 
     * @param { UrlString | null } dataOrigFileUrl The image file url based on "data-orig-file" attribute.
     * @param { Partial<Omit<WrapFetchOptions, "responseHandler">> } [fetchOptions] 
     * @returns { Promise<FetchResponseHandler> }
     * 
     * @private
     */
    async findImageFileUrl(xhr, imageInfo, dataOrigFileUrl, fetchOptions) {
        // with Baka-Tsuki, the link wrapping the image will return an HTML
        // page with a set of images.  We need to pick the desired image
        if (xhr.isHtml()) {
            // find URL of wanted image file on html page
            // if we can't find one, just use the original image.
            let temp = this.selectImageUrlFromImagePage(xhr.responseXML);
            if (temp == null) {
                if (dataOrigFileUrl != null) {
                    return await this.findImageFileUrlUsingDataOrigFileUrl(imageInfo);
                }
                if (!this.userPreferences?.disableImageResError?.value) {
                    let baseUri = xhr.responseXML.baseURI;
                    let errorMsg = UIText.Error.gotHtmlExpectedImageWarning(baseUri);
                    ErrorLog.log(errorMsg);
                }
                temp = imageInfo.sourceUrl;
            }
            temp = ImageCollector.removeSizeParamsFromWordPressQuery(temp);
            this.urlIndex.set(temp, imageInfo.index);
            return HttpClient.wrapFetch(temp, fetchOptions);
        } else {
            // page wasn't HTML, so assume is actual image
            imageInfo.sourceUrl = xhr.response.url;
            this.urlIndex.set(xhr.response.url, imageInfo.index);
            return xhr;
        }
    }

    /**
     * 
     * 
     * @param { ImageInfo } imageInfo 
     * @return { Promise<void> }
     * 
     * @private
     */
    async findImageFileUrlUsingDataOrigFileUrl(imageInfo) {
        let xhr = await HttpClient.wrapFetch(imageInfo.dataOrigFileUrl);
        await this.findImageFileUrl(xhr, imageInfo, null);
    }
    
    imagesToPackInEpub() {
        return this.imagesToPack;
    }

    /*
     * Hook point to allow picking between high and low res images.
     */
    initialUrlToTry(imageInfo) {
        let urlToTry = imageInfo.sourceUrl;
        if (!util.isNullOrEmpty(imageInfo.wrappingUrl) 
            && !ImageCollector.urlHasFragment(imageInfo.wrappingUrl)) {
            urlToTry = imageInfo.wrappingUrl;
        }
        return ImageCollector.removeSizeParamsFromWordPressQuery(urlToTry);
    }

    static urlHasFragment(url) {
        try {
            return !util.isNullOrEmpty(new URL(url).hash);
        } catch (error) {
            return false;
        }
    }
    
    static removeSizeParamsFromWordPressQuery(originalUrl) {
        let url = new URL(originalUrl);
        let searchParams = url.searchParams;
        if (!util.isNullOrEmpty(searchParams.toString()) && 
            ImageCollector.isWordPressHostedFile(url.hostname) ) {
            ImageCollector.removeSizeParamsFromSearch(searchParams);
            return url.toString();
        } else {
            return originalUrl;
        }
    }

    static isWordPressHostedFile(hostname) {
        return hostname.endsWith("files.wordpress.com") || hostname.endsWith(".wp.com");
    }

    static removeSizeParamsFromSearch(searchParams) {
        searchParams.delete("w");
        searchParams.delete("h");
        searchParams.delete("resize");
    }

    /**
    *  Derived classes will override
    *  Base version tells user there's a problem
    */
    selectImageUrlFromImagePage(dom) {
        // try MediaWiki format
        let div = dom.querySelector("div.fullMedia");
        if (div !== null) {
            let link = div.querySelector("a");
            return (link === null) ? null : link.href;
        }
        return null;
    }

    /**
     * Prepare content images for epubification.
     * 
     * @param { Element } content The element containing the images.
     * @param { UrlString } parentPageUrl The url of the page the images are originally on.
     * @returns { Promise<Element> } The content with the revised images.
     */
    async preprocessImageTags(content, parentPageUrl) {
        if (this.userPreferences.skipImages.value) {
            util.removeChildElementsMatchingSelector(content, "img, image");
            return content;
        } else {
            return await ImageCollector.replaceHyperlinksToImagesWithImages(content, parentPageUrl);
        }
    }

    /**
     * Replace anchors of images with images.
     * 
     * @param { Element } content The element containing the images.
     * @param { UrlString } parentPageUrl The url of the page the images are originally on.
     * @returns { Promise<Element> } The content with the revised images.
     */
    static async replaceHyperlinksToImagesWithImages(content, parentPageUrl) {
        let toReplace = util.getElements(content, "a", ImageCollector.isHyperlinkToImage);

        for (let hyperlink of toReplace.filter(h => !ImageCollector.linkContainsImageTag(h))) {
            ImageCollector.replaceHyperlinkWithImg(hyperlink);
        }

        return await Imgur.expandGalleries(content, parentPageUrl);
    }

    /**
     * Check whether the url leads to an image.
     * 
     * @param { HTMLAnchorElement } hyperlink The url to check.
     * @returns { boolean } Whether the url leads to an image.
     * @private
     * */
    static isHyperlinkToImage(hyperlink) {
        let extension = ImageCollector.getExtensionFromUrlFilename(hyperlink);

        return extension === "png" ||
        extension === "jpg" ||
        extension === "jpeg" ||
        extension === "gif" ||
        extension === "svg";
    }

    /**
     * Get the link extension from an anchor.
     * 
     * @param { HTMLAnchorElement } hyperlink The anchor to extract from.
     * @returns { string } The filename, or empty if extraction failed. 
     * @private
     */
    static getExtensionFromUrlFilename(hyperlink) {
        let split = util.extractFilename(hyperlink).split(".");

        return (split.length < 2) ? "" : split[split.length - 1];
    }

    /**
     * Check whether a anchor contains an image tag.
     * 
     * @param { HTMLAnchorElement } hyperlink The anchor to check.
     * @returns { boolean } Whether the anchor contains an image tag.
     */
    static linkContainsImageTag(hyperlink) {
        return (hyperlink.querySelector("img") !== null);
    }

    /**
     * Replace an anchor with an image with the anchor href as its source.
     * 
     * @param { HTMLAnchorElement } hyperlink The anchor to replace.
     * @returns { void } The hyperlink is replaced via the `ownerDocument` property.
     * @private
     */
    static replaceHyperlinkWithImg(hyperlink) {
        let img = hyperlink.ownerDocument.createElement("img");
        img.src = hyperlink.href;
        hyperlink.replaceWith(img);
    }
}

//==============================================================

class VariableSizeImageCollector extends ImageCollector { // eslint-disable-line no-unused-vars
    constructor() {
        super();
    }

    onUserPreferencesUpdate(userPreferences) {
        super.onUserPreferencesUpdate(userPreferences);
        if (userPreferences.highestResolutionImages.value) {
            this.initialUrlToTry = (imageInfo) => imageInfo.wrappingUrl;
        } else {
            this.initialUrlToTry = (imageInfo) => imageInfo.sourceUrl;
        }
    }
}

//==============================================================

/**
 * Class to replace an <img> tag.
 */
class ImageTagReplacer {
    /**
     * the outermost parent element of the <img> tag to remove.
     * 
     * @type { Element }
     */
    wrappingElement;

    /**
     * url of image being replaced
     * 
     * @type { UrlString }
     */
    wrappingUrl;

    /**
     * user's configuration options
     * 
     * @type { UserPreferences }
     */
    userPreferences;

    /**
     * Record details of element to replace.
     * 
     * @param { Element } wrappingElement the outermost parent element of the <img> tag to remove.
     * @param { UrlString } wrappingUrl url of image being replaced
     * @param { UserPreferences } userPreferences - user's configuration options
     */
    constructor(wrappingElement, wrappingUrl, userPreferences) {
        this.wrappingElement = wrappingElement;
        this.wrappingUrl = wrappingUrl;
        this.userPreferences = userPreferences;
    }

    /**
     * Create image element and insert it into {@link wrappingElement}?
     * 
     * @param { ImageInfo } imageInfo to use to construct replacement tag.
     * @returns { void } Changes are made on the stored {@link wrappingElement} object.
     */
    replaceTag(imageInfo) {
        // replace tag with nested <img> tag, with new <img> tag
        let parent = this.wrappingElement.parentElement;

        if ((imageInfo != null) && (parent != null)) {
            if (this.isDuplicateImageToRemove(imageInfo)) {
                this.wrappingElement.remove();
            } else {
                this.insertImageInLegalParent(parent, imageInfo);
            }
        }
    }

    /**
     * Create an image element and insert it into parent, or one of its
     * ancestors.
     * 
     * @param {} parent The parent element (or descendant of element) to insert the image into.
     * @param { ImageInfo} imageInfo The info to base the created image element on.
     * @returns { void } Changes are made directly on {@link parent} or its ancestor(s).
     * @private
     */
    insertImageInLegalParent(parent, imageInfo) {
        if (this.isImageInline(imageInfo)) {
            this.insertInlineImageInLegalParent(imageInfo);
        } else {
            this.insertBlockImageInLegalParent(parent, imageInfo);
        }
    }

    /**
     * Check if image is inline.
     * 
     * @param { ImageInfo } imageInfo The image to check.
     * @returns { boolean } Whether the image is inline.
     * @private
     */
    isImageInline(imageInfo) {
        const MAX_INLINE_IMAGE_HEIGHT = 200;
        let parent = this.wrappingElement;

        while ((parent != null) && util.isInlineElement(parent)) {
            parent = parent.parentNode;
        }

        return this.isParagraph(parent) &&
            !util.isNullOrEmpty(parent.textContent) &&
            (imageInfo.height <= MAX_INLINE_IMAGE_HEIGHT);
    }

    /**
     * Check whether an element is a paragraph.
     * 
     * FIXME: This should probably just be modified to handle up to Node;
     * instead of forcing downstream to check.
     * 
     * @param { Element | null | undefined } element The element to check.
     * @returns { boolean } Whether the element is a paragraph.
     * @private
     */
    isParagraph(element) {
        return (element != null) && (element.tagName.toLowerCase() === "p");
    }

    /**
     * Create an image element.
     * 
     * @param { ImageInfo } imageInfo The info to base the created image element on.
     * @returns { void } Changes are made directly on {@link wrappingElement}.
     * @private
     */
    insertInlineImageInLegalParent(imageInfo) {
        let newImage = imageInfo.createImgImageElement("span");
        this.wrappingElement.replaceWith(newImage);
    }

    /**
     * Create an image based on {@link imageInfo} and insert it into parent.
     * 
     * Under XHTML, <div> not allowed to be a child of a <p> element,
     * (or <i>, <u>, <s> etc.).
     * 
     * @param { Element } parent The element (or decendant of element) to insert into.
     * @param { ImageInfo } imageInfo The image to insert.
     * @returns { void } Changes are made directly to {@link parent} or its ancestor(s).
     * @private
     */
    insertBlockImageInLegalParent(parent, imageInfo) {
        /** @type { ParentNode } */
        let nodeAfter = this.wrappingElement;

        while (util.isInlineElement(parent) && (parent.parentNode != null)) {
            nodeAfter = parent;
            parent = parent.parentNode;
        }

        if (this.isParagraph(parent)) {
            nodeAfter = parent;
        }

        let newImage = imageInfo.createImageElement(this.userPreferences);
        nodeAfter.parentNode.insertBefore(newImage, nodeAfter);
        util.removeHeightAndWidthStyleFromParents(newImage);
        this.copyCaption(newImage, this.wrappingElement);
        this.wrappingElement.remove();
    }

    /**
     * Copy the caption from oldWrapper to newImage.
     * 
     * @param { Node } newImage Container for the copy recipient.
     * @param { ParentNode } oldWrapper The container of the copy giver.
     * @returns { void } Changes are made on {@link newImage} directly.
     */
    copyCaption(newImage, oldWrapper) {
        let thumbCaption = oldWrapper.querySelector("div.thumbcaption");

        if (thumbCaption != null) {
            for (let magnify of thumbCaption.querySelectorAll("div.magnify")) {
                magnify.remove();
            }

            if (!util.isNullOrEmpty(thumbCaption.textContent)) {
                newImage.appendChild(thumbCaption);
            }
        }
    }

    /**
     * Check whether an image is a duplicate.
     * 
     * @param { ImageInfo } imageInfo The image information.
     * @returns { boolean } Whether the image is a duplicate.
     * @private
     */
    isDuplicateImageToRemove(imageInfo) {
        return this.userPreferences.removeDuplicateImages.value && 
            this.isElementInImageGallery() && (imageInfo.isOutsideGallery || imageInfo.isCover);
    }

    /**
     * Checks whether {@link wrappingElement} is in a gallery.
     * 
     * @returns { boolean } Whether it is in a gallery.
     * @private
     */
    isElementInImageGallery() {
        return (this.wrappingElement.className === "thumb");
    }
}
