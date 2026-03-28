"use strict";

/**
 * This holds code for transforming an Imgur gallery into content image
 * collector can handle.
 */
class Imgur { // eslint-disable-line no-unused-vars
    /**
     * @private
     */
    constructor() {}

    /**
     * Replace image links with actual images.
     * 
     * @param { Element } content The element containing the images.
     * @param { UrlString } parentPageUrl The url of the page the images are originally on.
     * @returns { Promise<Element> } The content with the revised images.
     * 
     * @public
     */
    static async expandGalleries(content, parentPageUrl) {
        for (let link of Imgur.getGalleryLinksToReplace(content)) {
            let href = Imgur.fixupImgurGalleryUrl(link.href);

            try { 
                let xhr = await HttpClient.wrapFetch(href);
                Imgur.replaceGalleryHyperlinkWithImages(link, xhr.responseXML);
            } catch (err) {
                let errorMsg = UIText.Error.imgurFetchFailed(link.href, parentPageUrl, err);
                ErrorLog.log(errorMsg);
            }
        }

        return content; 
    }

    /**
     * Check whether a dom is an imgur gallery.
     * 
     * @param { Document } dom The dom to check.
     * @returns { boolean } Whether the dom is of a imgur library.
     * 
     * @private
     */
    static isImgurGallery(dom) {
        let host = util.extractHostName(dom.baseURI).toLowerCase();
        return Imgur.isImgurHostName(host);
    }

    /**
     * Check whether a hostname matches Imgur.
     * 
     * @param { HostnameString } host The hostname to check.
     * @returns { boolean } Whether the hostname matches Imgur.
     * 
     * @private
     */
    static isImgurHostName(host) {
        return (host === "imgur.com") || (host.endsWith(".imgur.com"));
    }

    /**
     * Convert a gallery to standardized view.
     * 
     * @param { Document } dom The dom of the gallery to convert.
     * @returns { HTMLDivElement | null } A div containing image elements for each found image in the gallery.
     * 
     * @private
     */
    static convertGalleryToConventionalForm(dom) {
        let imagesList = Imgur.findImagesList(dom);

        return (imagesList == null) ? null : Imgur.constructStandardHtmForImgur(imagesList);
    }

    /**
     * Turn list of images into div containing them.
     * 
     * @param { { hash: string, ext: string }[] } imagesList List of the images to convert.
     * @returns { HTMLDivElement } Container for found images.
     * 
     * @private
     */
    static constructStandardHtmForImgur(imagesList) {
        let doc = document.implementation.createHTMLDocument();
        let div = doc.createElement("div");
        doc.body.appendChild(div);

        for (let item of imagesList) {
            let img = doc.createElement("img");

            // ToDo: use real image to build URI
            img.src = "http://i.imgur.com/" + item.hash + item.ext;
            div.appendChild(img);
        }

        return div;
    }

    /**
     * Attempt to find the list of images to get.
     * 
     * FIXME: The return type here is complete guesswork.
     * 
     * @param { Document } dom The dom to extract images from.
     * @returns { { hash: string, ext: string }[] | undefined } The found data.
     * 
     * @private
     */
    static findImagesList(dom) {
        let json = Imgur.findImagesJson(dom);

        if (json != null) {
            if (json.album_images != null) {
                return json.album_images.images;
            } else {
                return [ json ];
            }
        }
    }

    /**
     * Find and parse image json.
     * 
     * @param { Document } dom The dom to extract images from.
     * @returns { unknown } The found parsed JSON.
     * 
     * @private
     */
    static findImagesJson(dom) {
        // Ugly hack, need to find the list of images as image links are created dynamically in HTML.
        // Obviously this will break each time imgur change their scripts.
        for (let text of Imgur.scriptsWithRunSlots(dom)) {
            let json = util.locateAndExtractJson(text, "item:");

            if (json != null) {
                return json;
            }
        }

        return null;
    }

    /**
     * Find script tags with containing "window.runSlots".
     * 
     * @param { Document } dom The dom to extract from.
     * @returns { string[] } InnerHTML of found scripts.
     * 
     * @private
     */
    static scriptsWithRunSlots(dom) {
        return [...dom.querySelectorAll("script")]
            .map(s => s.innerHTML)
            .filter(i => (0 <= i.indexOf("window.runSlots")));
    }

    /**
     * Check whether an anchor leads to a gallery.
     * 
     * @param { HTMLAnchorElement } hyperlink The link to check.
     * @returns { boolean } Whether the link leads to a gallery.
     * 
     * @private
     */
    static isHyperlinkToImgurGallery(hyperlink) {
        return Imgur.isImgurHostName(hyperlink.hostname)
          && !ImageCollector.linkContainsImageTag(hyperlink)
          && Imgur.isLinkToGallery(hyperlink);
    }

    /**
     * A Hack, assume if no extension, it's a gallery.
     * 
     * @param { HTMLAnchorElement } hyperlink The anchor to check.
     * @returns { boolean } Whether anchor is a link to a gallery.
     * 
     * @private 
     */
    static isLinkToGallery(hyperlink) {
        return !util.extractFilename(hyperlink).includes(".");
    }

    /**
     * Swap out image links with image tags in gallery dom.
     * 
     * @param { HTMLAnchorElement } link The anchor leading to the gallery.
     * @param { Document } galleryDom The dom of the gallery.
     * @returns { void } Changes are made on {@link galleryDom}.
     * 
     * @private
     */
    static replaceGalleryHyperlinkWithImages(link, galleryDom) {
        if (Imgur.isImgurGallery(galleryDom)) {
            let images =  Imgur.convertGalleryToConventionalForm(galleryDom);
            link.replaceWith(images);
        }       
    }

    /**
     * Get anchors leading to galleries.
     * 
     * @param { Element } dom The element containing the anchors.
     * @returns { HTMLAnchorElement[] }
     * 
     * @private
     */
    static getGalleryLinksToReplace(dom) {
        return util.getElements(dom, "a", Imgur.isHyperlinkToImgurGallery);
    }

    /**
     * Preprocess gallery link before use.
     * 
     * @param { UrlString } url The url to fix.
     * @returns { UrlString } The fixed url.
     * 
     * @public
     */
    static fixupImgurGalleryUrl(url) {
        let link = document.createElement("a");
        link.href = url;

        if (Imgur.isHyperlinkToImgurGallery(link) && !url.endsWith("?grid")) {
            return url + "?grid";
        }

        return url;
    }
}
