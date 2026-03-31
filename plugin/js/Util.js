/*
    General dumping ground for misc functions that I can't find a better place for.
    Warning: Don't look at this too closely, or you may lose your sanity.
    Side Note: Putting these all in one place may not have been a good idea.
    I think they're breeding. There seem to be more functions in here that I didn't create.
*/

"use strict";

const util = (function() {
    var sleepController = new AbortController;

    /**
     * Pause execution for specified time.
     * 
     * @param { number } ms Milliseconds to sleep
     * @returns { Promise<void> } Promise which resolves once sleep is completed.
     */
    function sleep(ms) {
        return new Promise(resolve => {
            function finished() {
                resolve();
                sleepController.signal.removeEventListener("abort", finished);
            }
            sleepController.signal.addEventListener("abort", finished);
            setTimeout(finished, ms);
        });
    }

    /**
     * Get a random integer (number type with no decimals).
     * 
     * @param { number } min The minimum possible return value.
     * @param { number } max The maximum possible return value.
     * @returns { number } The generated random integer (number type with no decimals).
     */
    function randomInteger(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Check whether we are currently running on firefox.
     * 
     * @returns { boolean } Whether we are currently running on firefox.
     */
    function isFirefox() {
        if (navigator.brave && navigator.brave.isBrave)
        {
            return false;
        }
        else if (typeof (browser) === "undefined")
        {
            // old version of chrome
            return false;
        }
        else
        {
            // this only works as long as firefox hasn't implemented this 
            // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/PlatformNaclArch
            return (typeof (browser.runtime.PlatformNaclArch) == "undefined");
        }
    }

    /**
     * Get the currently running version of the extension.
     * 
     * @returns { string } The version of the exstion; or "unknown" if unknown.
     */
    function extensionVersion() {
        let runtime = isFirefox() ? browser.runtime : chrome.runtime;

        // when running unit tests, runtime is not available
        return (typeof (runtime) === "undefined") ? "unknown" : runtime.getManifest().version;
    }

    /**
     * Create an empty document; and populate the head for use inside EPUB.
     * 
     * @returns { XMLDocument } The created empty document.
     */
    function createEmptyXhtmlDoc() {
        let doc = document.implementation.createDocument(XMLNS, "", null);
        addXhtmlDocTypeToStart(doc);

        let htmlNode = doc.createElementNS(XMLNS, "html");
        doc.appendChild(htmlNode);

        /**
         * @type { HTMLHeadElement }
         */
        let head = doc.createElementNS(XMLNS, "head");
        htmlNode.appendChild(head);

        head.appendChild(doc.createElementNS(XMLNS, "title"));
        populateHead(doc, head);

        let body = doc.createElementNS(XMLNS, "body");
        htmlNode.appendChild(body);

        return doc;
    }

    /**
     * Add relevant attributes to head.
     * 
     * @param { Document } doc The parent document.
     * @param { HTMLHeadElement } head The head element to modify.
     * @returns { void } Changes are made on the provided {@link doc} and {@link head} elements.
     */
    function populateHead(doc, head) {
        let style = doc.createElementNS(XMLNS, "link");
        head.appendChild(style);
        style.setAttribute("href", makeRelative(styleSheetFileName()));
        style.setAttribute("type", "text/css");
        style.setAttribute("rel", "stylesheet");
    }

    /**
     * Create an empty HTML document.
     * 
     * FIXME: This maybe returns HTMLDocument and could therefore be less
     * generic.
     * 
     * @returns { Document } The created html document.
     */
    function createEmptyHtmlDoc() {
        let doc = document.implementation.createHTMLDocument("");
        populateHead(doc, doc.querySelector("head"));

        return doc;
    }

    /**
     * Create an SVG of based on the provided data.
     * 
     * @param { UrlString } href The href attribute.
     * @param { number } width The width of the created SVG.
     * @param { number } height The height of the created SVG.
     * @param { UrlString } origin The source url of the image.
     * @param { boolean } includeImageSourceUrl Whether to include the image source.
     * @returns { HTMLElement } The container of the created SVG.
     */
    function createSvgImageElement(href, width, height, origin, includeImageSourceUrl) {
        let svg_ns = "http://www.w3.org/2000/svg";
        let xlink_ns = "http://www.w3.org/1999/xlink";
        let doc = createEmptyXhtmlDoc();
        let body = doc.getElementsByTagName("body")[0];
        let div = doc.createElementNS(XMLNS, "div");
        div.className = "svg_outer svg_inner";
        body.appendChild(div);

        const svg = document.createElementNS(svg_ns, "svg");
        svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", xlink_ns);
        div.appendChild(svg);
        svg.setAttributeNS(null, "height", "99%");
        svg.setAttributeNS(null, "width", "100%");
        svg.setAttributeNS(null, "version", "1.1");
        svg.setAttributeNS(null, "preserveAspectRatio", "xMidYMid meet");
        svg.setAttributeNS(null, "viewBox", "0 0 " + width + " " + height);
        let newImage = doc.createElementNS(svg_ns, "image");
        svg.appendChild(newImage);

        newImage.setAttributeNS(xlink_ns, "xlink:href", makeRelative(href));
        newImage.setAttributeNS(null, "width", width);
        newImage.setAttributeNS(null, "height", height);
        origin = clearIfDataUri(origin);
        
        if (includeImageSourceUrl) {
            let desc = doc.createElementNS(svg_ns, "desc");
            svg.appendChild(desc);
            desc.appendChild(document.createTextNode(origin));
        } else {
            svg.appendChild(createComment(doc, origin));
        }

        return div;
    }

    /**
     * Replace data uri with empty; otherwise leave unchanged. Filter out data:
     * URIs to prevent massive base64 content.
     * 
     * @param { UrlString } content The uri tocheck.
     * @returns { string } The original content, or empty if it **was** a data uri.
     */
    function clearIfDataUri(content) {
        return (content && content.startsWith("data:")) ? "" : content;
    }

    /**
     * assumes we're making link from file in OEBPS\Text to OEBPS\Images
     * 
     * @param { UrlString } href The url to modify.
     * @returns { UrlString } The new relative URL.
     */
    function makeRelative(href) {
        return ".." + href.substring(5);
    }

    /**
     * Make `relativeUrl` absolute using `baseUrl`.
     * 
     * @param { UrlString } baseUrl 
     * @param { UrlString } relativeUrl 
     * @returns { UrlString }
     * @throws { TypeError } If any of the urls are invalid.
     */
    function resolveRelativeUrl(baseUrl, relativeUrl) {
        return new URL(relativeUrl, baseUrl).href;
    }

    /**
     * Extract only the hostname from a url.
     * 
     * @param { UrlString } url The url to extract from.
     * @returns { HostnameString } The found hostname.
     * 
     * @throws { TypeError } If the provided url is invalid.
     */
    function extractHostName(url) {
        return new URL(url).hostname;
    }

    /**
     * Extract the filename from an anchor.
     * 
     * @param { HTMLAnchorElement } hyperlink The anchor to extract from.
     * @returns { string } The extracted filename; or empty if unable.
     */
    function extractFilename(hyperlink) {
        let filename = hyperlink.pathname
            .split("/")
            .filter(p => p !== "")
            .pop();
        return filename ?? "";
    }

    function extractFilenameFromUrl(url) {
        return new URL(url).pathname
            .split("/")
            .filter(p => p !== "")
            .pop();
    }

    function getParamFromUrl(url, paramName) {
        return new URL(url).searchParams.get(paramName);
    }

    /**
     * Set the base tag of a DOM to specified URL.
     * 
     * @param { UrlString } url The base url to set.
     * @param { Document } dom The document to set the base-tag on.
     * @returns { void } Changes are made on {@link dom} directly.
     */
    function setBaseTag(url, dom) {
        if (dom != null) {
            let tags = Array.from(dom.getElementsByTagName("base"));

            if (0 < tags.length) {
                tags[0].setAttribute("href", url);
            } else {
                let baseTag = dom.createElement("base");
                baseTag.setAttribute("href", url);
                dom.getElementsByTagName("head")[0].appendChild(baseTag);
            }
        }
    }

    /**
     * refer https://usamaejaz.com/cloudflare-email-decoding/
     * 
     * @param { Element } content The dom to replace the links in.
     * @return { void } Changes are made on the provided {@link content} object.
     */
    function decodeCloudflareProtectedEmails(content) {
        for (let link of [...content.querySelectorAll(".__cf_email__")]) {
            replaceCloudflareProtectedLink(link);
        }
        let links = [...content.querySelectorAll("a")].filter(l => (l.href != null) && l.href.includes("/cdn-cgi/l/email-protection"));
        for (let link of links) {
            replaceCloudflareProtectedLink(link);
        }
    }

    /**
     * Decode and replace any cloudflare protected email from an anchor element.
     * 
     * @param { HTMLAnchorElement } link The anchor element to work on.
     * @returns { void } Changes are made on the provided {@link element}.
     */
    function replaceCloudflareProtectedLink(link) {
        let cyptedEmail = link.getAttribute("data-cfemail");

        if (cyptedEmail == null) {
            cyptedEmail = link.hash;
            if (!isNullOrEmpty(cyptedEmail)) {
                cyptedEmail = cyptedEmail.substring(1);
            }
        }

        if (cyptedEmail != null) {
            let decryptedEmail = decodeEmail(cyptedEmail);
            let textNode = document.createTextNode(decryptedEmail);
            link.parentNode.insertBefore(textNode, link);
            link.remove();
        }
    }

    /**
     * Decode a cloudflare encoded email.
     * 
     * @param { string } encodedString The encoded email.
     * @returns { string } The decoded email.
     */
    function decodeEmail(encodedString) {
        /**
         * @param { number } index 
         * @returns { number }
         */
        let extractHex = (index) => parseInt(encodedString.slice(index, index + 2), 16);

        let key = extractHex(0);
        let email = "";

        for (let index = 2; index < encodedString.length; index += 2) {
            email += String.fromCharCode(extractHex(index) ^ key);
        }

        return email;
    }

    /**
     * Delete all nodes in the supplied iterable.
     * 
     * @param { Iterable<ChildNode> } elements The elements to delete.
     * @returns { void }
     */
    function removeElements(elements) {
        for (let e of elements) {
            e.remove();
        }
    }

    /**
     * Delete all sub-elements matching the provided selector.
     * 
     * @param { ParentNode | null } element The parent to delete from.
     * @param { string } selector The selector to look for.
     * @returns { void } The changes are made on the provided {@link element} object.
     */
    function removeChildElementsMatchingSelector(element, selector) {
        if (element !== null) {
            removeElements(element.querySelectorAll(selector));
        }
    }

    /**
     * Remove any comments from the element.
     * 
     * @param { Node } root 
     * @returns { void } Changes are made on the provided {@link root} object.
     */
    function removeComments(root) {
        let walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);

        /**
         * if we delete currentNode, call to nextNode() fails.
         * 
         * @type { ChildNode[] }
         */
        let nodeList = [];
        
        while (walker.nextNode()) {
            /**
             * We can cast here since we know the returned {@link Node} is a
             * descendant of root; and must therefore implement at the very
             * least the {@link ChildNode} interface.
             */
            nodeList.push(/** @type { ChildNode } */ (walker.currentNode));
        }

        removeElements(nodeList);
    }

    /**
     * Discard empty divs created when moving elements.
     * 
     * @param { Element } element The parent to remove from.
     * @returns { void } Changes are made on {@link element} directly.
     */
    function removeEmptyDivElements(element) {
        removeElements(getElements(element, "div", e => isElementWhiteSpace(e)));
    }

    /**
     * Remove any pure white children from element.
     * 
     * @param { ParentNode } element The element to remove white children from.
     * @returns { void } Changes are made on {@link element} directly.
     */
    function removeTrailingWhiteSpace(element) {
        let children = element.childNodes;

        while ((0 < children.length) && isElementWhiteSpace(children[children.length - 1])) {
            children[children.length - 1].remove();
        }
    }

    /**
     * Remove any whitespace element children from {@link element}.
     * 
     * @param { ParentNode } element The element to remove from.
     * @returns { void } Changes are made on the provided {@link element} object.
     */
    function removeLeadingWhiteSpace(element) {
        let children = element.childNodes;

        while ((0 < children.length) && isElementWhiteSpace(children[0])) {
            children[0].remove();
        }
    }

    function removeHTMLUnknownElement(nodes) {
        let children = nodes.childNodes;
        for (let i = 0; i < children.length; i++) {
            if (children[i] instanceof HTMLUnknownElement) {
                children[i].remove();
            } else {
                removeHTMLUnknownElement(children[i]);
            }
        }
    }

    /**
     * Removes all script and iframes from the provided element.
     * 
     * @param { Element } element The element to delete from.
     * @returns { void } The changes are made on the provided {@link element} object.
     */
    function removeScriptableElements(element) {
        removeChildElementsMatchingSelector(element, "script, iframe");
        removeEventHandlers(element);
    }

    /**
     * Remove microsoft word crap elements.
     * 
     * @param { Element } element The element to remove from.
     * @returns { void } Changes are made on the provided {@link element} object.
     */
    function removeMicrosoftWordCrapElements(element) {
        for (let node of getElements(element, "O:P")) {
            flattenNode(node);
        }
    }

    /**
     * Flattens a node by moving any of its children to the parent, and then
     * deleting itself.
     * 
     * @param { ChildNode } node The node to flatten.
     * @returns { void } Changes are made on the provided {@link node} object.
     */
    function flattenNode(node) {
        while (node.hasChildNodes()) {
            node.parentNode.insertBefore(node.childNodes[0], node);
        }

        node.remove();
    }

    /**
     * Removes any `onclick` handlers from the provided element.
     * 
     * @param { Element } contentElement The element to remove from.
     * @returns { void } Changes are made on the provided {@link contentElement} object.
     * 
     * @todo expand to remove ALL event handlers and figure out if this is actually sufficient; or do you need to use {@link Element.removeEventListener}.
     */
    function removeEventHandlers(contentElement) {
        let walker = contentElement.ownerDocument.createTreeWalker(contentElement, NodeFilter.SHOW_ELEMENT);
        let element = contentElement;

        while (element != null) {
            element.removeAttribute("onclick");
            element = walker.nextNode();
        }
    }

    /**
     * Remove size stling from an element and its parents.
     * 
     * @param { Node } element The element (and its parents) to modify.
     * @returns { void } Changes are made on {@link element} directly.
     */
    function removeHeightAndWidthStyleFromParents(element) {
        let parent = element.parentElement;

        while ((parent != null) && (parent.tagName.toLowerCase() !== "body")) {
            removeHeightAndWidthStyle(parent);

            parent = parent.parentElement;
        }
    }

    /**
     * Remove size styling from element.
     * 
     * @param { HTMLElement } element The element to modify.
     * @returns { void } Changes are made on the {@link element} directly.
     */
    function removeHeightAndWidthStyle(element) {
        let style = element.style;

        if ((style.width !== "") || (style.height !== "")) {
            style.width = null;
            style.height = null;

            if (style.length === 0) {
                // avoid a style="" attribute in element
                element.removeAttribute("style");
            }
        }

        element.removeAttribute("width");
        element.removeAttribute("height");
    }

    /**
     * Removes wordpress specific elements.
     * 
     * @param { ParentNode } element The element to remove from.
     * @returns { void } Changes are made on the provided {@link element} object.
     */
    function removeUnwantedWordpressElements(element) {
        let ccs = "div.sharedaddy, div.wpcnt, ul.post-categories, div.mistape_caption, "
            + "div.wpulike, div.wp-next-post-navi, .ezoic-adpicker-ad, .ezoic-ad, "
            + "ins.adsbygoogle";

        removeChildElementsMatchingSelector(element, ccs);
    }

    /**
     * Remove any sharepost elements.
     * 
     * @param { ParentNode } contentElement The node to delete from.
     * @returns { void } Changes are made on the provided {@link contentElement} object.
     */
    function removeShareLinkElements(contentElement) {
        removeChildElementsMatchingSelector(contentElement, "div.sharepost");
    }

    /**
     * Remove newlines and replace separation by splitting into <p> tags.
     * 
     * @param { Document } dom The document container.
     * @param { HTMLElement } element The container to look for replacement targets.
     * @param { string | RegExp | null | undefined } [splitOn] The selector to split on.
     * @returns { void } Changes are made directly on {@link element}.
     */
    function convertPreTagToPTags(dom, element, splitOn) {
        /**
         * Normalize a string eol characters.
         * 
         * @param { string } s The string to normalize.
         * @returns { string } The normalized string.
         */
        let normalizeEol = (s) => s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        splitOn = splitOn || "\n";

        let strings = normalizeEol(element.innerText).split(splitOn);

        element.innerHTML = "";

        for (let s of strings) {
            let p = dom.createElement("p");
            p.appendChild(dom.createTextNode(s));
            element.appendChild(p);
        }
    }

    /**
     * Replace some tag types with spans and CSS styling.
     * 
     * @param { ParentNode } element The element to modify.
     * @returns { void } Changes are made on {@link element} directly.
     */
    function prepForConvertToXhtml(element) {
        replaceCenterTags(element);
        replaceUnderscoreTags(element);
        replaceSTags(element);
    }

    /**
     * Replace <center> tags with <p>
     * 
     * @param { ParentNode } element The parent element to modify.
     * @returns { void } Changes are made on {@link element} directly.
     */
    function replaceCenterTags(element) {
        for (let center of element.querySelectorAll("center")) {
            let replacement = center.ownerDocument.createElement("p");
            replacement.style.textAlign = "center";
            convertElement(center, replacement);
        }
    }

    /**
     * Replace <u> tags with <span> and CSS underscoring.
     * 
     * @param { ParentNode } element The parent element to modify.
     * @return { void } Changes are made on {@link element} directly.
     */
    function replaceUnderscoreTags(element) {
        for (let underscore of element.querySelectorAll("U")) {
            let replacement = underscore.ownerDocument.createElement("span");

            // ToDo: figure out how to do this by manipulating the style directly
            replacement.setAttribute("style", "text-decoration: underline;");

            convertElement(underscore, replacement);
        }
    }

    /**
     * Replace <u> tags with <span> and CSS line-through.
     * 
     * @param { ParentNode } element The parent element to modify.
     * @returns { void } Changes are made on {@link element} directly.
     */
    function replaceSTags(element) {
        for (let underscore of element.querySelectorAll("s")) {
            let replacement = underscore.ownerDocument.createElement("span");

            // ToDo: figure out how to do this by manipulating the style directly
            replacement.setAttribute("style", "text-decoration: line-through;");

            convertElement(underscore, replacement);
        }
    }

    /**
     * Replace {@link element} with {@link replacement}.
     * 
     * @param { Element } element 
     * @param { Element } replacement 
     * @returns { void } Changes are made directly on the provided parameter objects.
     */
    function convertElement(element, replacement) {
        let parent = element.parentElement;

        parent.insertBefore(replacement, element);
        moveChildElements(element, replacement);
        copyAttributes(element, replacement);

        element.remove();
    }

    /**
     * Move all children from {@link from} to {@link to}.
     * 
     * @param { ParentNode } from The element to take children from.
     * @param { Node } to The recipient parent element.
     * @returns { void } Changes are made directly on the provided parameter objects.
     */
    function moveChildElements(from, to) {
        while (from.firstChild) {
            to.appendChild(from.firstChild);
        }
    }

    /**
     * Copy the attributes from {@link from} to {@link to}.
     * 
     * @param { Element } from The provider of attributes.
     * @param { Element } to The reciever of attributes.
     * @returns { void } Changes are made directly on the {@link to} object.
     */
    function copyAttributes(from, to) {
        for (let i = 0; i < from.attributes.length; ++i) {
            let attr = from.attributes[i];

            try {
                to.setAttribute(attr.localName, attr.value);
            } catch (e) {
                // probably invalid attribute name.  Discard
            }
        }
    }

    function fixDelayLoadedImages(element, delayAttrib) {
        for (let i of element.querySelectorAll("img")) {
            let url = i.getAttribute(delayAttrib);
            if (!isNullOrEmpty(url)) {
                i.src = url;
            }
        }
    }

    /**
     * if an inline tag contains block tags, move contents out of inline tag
     * refer https://github.com/dteviot/WebToEpub/issues/62
     * 
     * @param { Element } contentElement The element to fix.
     * @returns { void } Changes are made on the provided {@link contentElement} object.
     */
    function fixBlockTagsNestedInInlineTags(contentElement) {
        let garbage = [];
        let walker = contentElement.ownerDocument.createTreeWalker(contentElement, NodeFilter.SHOW_ELEMENT);
        let element = contentElement;

        while (element != null) {
            if (isInlineElement(element) && isBlockElementInside(element)) {
                moveElementsOutsideTag(element);
                garbage.push(element);
            }

            element = walker.nextNode();
        }

        for (let g of garbage) {
            g.remove();
        }
    }

    function isBlockElementInside(inlineElement) {
        let walker = inlineElement.ownerDocument.createTreeWalker(inlineElement, NodeFilter.SHOW_ELEMENT);
        let element = null;
        while ((element = walker.nextNode())) {
            if (isBlockElement(element)) {
                return true;
            }
        }

        // if here, no block element found
        return false;
    }

    /**
     * Moves child nodes out of inlineElement and into its parent.
     * 
     * FIXME: The types here can be made more specific. But I can't bring myself to think it matters enough.
     * 
     * @param { Element } inlineElement The inline element to modify.
     * @return { void } Changes are made on the provided {@link inlineElement} object.
     */
    function moveElementsOutsideTag(inlineElement) {
        while (inlineElement.hasChildNodes()) {
            let node = inlineElement.childNodes[0];
            inlineElement.parentNode.insertBefore(node, inlineElement);

            // handle case of <inline><inline><block></block></inline></inline>
            fixBlockTagsNestedInInlineTags(node);
        }
    }

    /**
     * Check whether a node has any of the tags provided.
     * 
     * @param { (keyof HTMLElementTagNameMap | keyof HTMLElementDeprecatedTagNameMap)[] } tags The tags to look for.
     * @param { Node } node The node to check.
     * @returns { boolean } Whether the is of a type in in the provided tags.
     */
    function isNodeInTag(tags, node) {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return false;
        } else {
            let tagName = /** @type { Element } */ (node).tagName.toLowerCase();
            return tags.some(t => t === tagName);
        }
    }

    /**
     * Check if node is an inline element.
     * 
     * @param { Node } node The node to check.
     * @returns { boolean } Whether it is an inline element.
     */
    function isInlineElement(node) {
        return isNodeInTag(INLINE_ELEMENTS, node);
    }

    /**
     * Check whether a node is a block element.
     * 
     * @param { Node } node The node to check.
     * @returns { boolean } Whether the node is a block element.
     */
    function isBlockElement(node) {
        return isNodeInTag(BLOCK_ELEMENTS, node);
    }

    function getFirstImgSrc(dom, selector) {
        return dom.querySelector(selector)?.querySelector("img")?.src ?? null;
    }

    /**
     * Extract the hash from a url if present.
     * 
     * @param { UrlString } uri The url to extract from. 
     * @returns { string | null } The extracted hash or null if unable.
     */
    function extractHashFromUri(uri) {
        let index = uri.indexOf("#");
        return (index === -1) ? null : uri.substring(index + 1);
    }

    function resolveLazyLoadedImages(content, imgCss, attrName) {
        attrName = attrName || "data-src";
        for (let img of content.querySelectorAll(imgCss)) {
            let dataSrc = img.getAttribute(attrName);
            if (dataSrc !== null) {
                img.src = dataSrc.trim();
            }
        }
    }

    /**
     * Make anchors pointing at local resources use relative urls.
     * 
     * @param { UrlString } baseUri The local/base uri used to determine if a resource is local.
     * @param { Element } content The element to look for anchors in.
     * @returns { void } Changes are made directly on the {@link HTMLAnchorElement} decendants of {@link content}.
     */
    function makeHyperlinksRelative(baseUri, content) {
        for (let link of getElements(content, "a", e => isLocalHyperlink(baseUri, e))) {
            // FIXME: HTMLAnchorElement.hash is like perfect here, no?
            link.href = "#" + extractHashFromUri(link.href);
        }
    }

    /**
     * Whether anchor points at a local resource.
     * 
     * @param { UrlString } baseUri The local url.
     * @param { HTMLAnchorElement } link The anchor to check.
     * @returns { boolean } Whehter the anchor points to a local resource.
     */
    function isLocalHyperlink(baseUri, link) {
        return link.href.startsWith(baseUri) && (link.href.indexOf("#") !== -1);
    }

    /**
     * Find the primary style(s) based on {@link styleProperties} in {@link element}.
     * 
     * FIXME: The styleProperties and return types here are not TS correct;
     * look at CSSStyleDeclaration to fix, but it will require some minor code
     * changes.
     * 
     * @param { HTMLElement } element The element to find style of.
     * @param { string[] } styleProperties The keys to look for.
     * @returns { (string | undefined)[] } The found styles, with indexes corresponding to the keys in {@link styleProperties}.
     */
    function findPrimaryStyleSettings(element, styleProperties) {
        /**
         * The total text length of all content inside {@link element}.
         * 
         * @param { Node } element The element to look in.
         * @returns { number } The found count.
         */
        let characterCountForElement = function(element) {
            let count = 0;
            let child = element.firstChild;

            while (child) {
                if (child.nodeType === Node.TEXT_NODE) {
                    count += child.nodeValue.length;
                }

                child = child.nextSibling;
            }
            return count;
        };

        /**
         * @param { Map<string | undefined, number> } map 
         * @returns { string | undefined }
         */
        let findMaxCount = function(map) {
            /** @type { [string | undefined, number] } */
            let maxPair = [undefined, 0];

            for (let pair of map) {
                if (maxPair[1] <= pair[1]) {
                    maxPair = pair;
                }
            }

            return maxPair[0];
        };

        /**
         * @param { string | undefined } parentStyle 
         * @param { CSSStyleDeclaration } currentStyle 
         * @param { string } styleProperty 
         * @returns { string | undefined }
         */
        let mergeStyles = function(parentStyle, currentStyle, styleProperty) {
            if (currentStyle === null || currentStyle === undefined) {
                return parentStyle;
            }

            let c = currentStyle[styleProperty];

            return c !== "" ? c : parentStyle;
        };

        /**
         * @param { Map<string | undefined, number> } map 
         * @param { string | undefined } key 
         * @param { number } count 
         * @returns { void }
         */
        let updateStat = function(map, key, count) {
            let total = map.get(key);
            
            if (total === undefined) {
                total = 0;
            }

            map.set(key, total + count);
        };

        /**
         * @param { HTMLElement } element 
         * @param { Map<string | undefined, number>[] } stats 
         * @param { (string | undefined)[] } parentStyle 
         * @param { string[] } styleProperties 
         * @returns { void }
         */
        let walk = function(element, stats, parentStyle, styleProperties) {
            /** @type { (string | undefined)[] } */
            let mergedStyle = [];
            let count = characterCountForElement(element);

            for (let i = 0; i < styleProperties.length; ++i) {
                let merged = mergeStyles(parentStyle[i], element.style, styleProperties[i]);

                updateStat(stats[i], merged, count);

                mergedStyle.push(merged);
            }

            for (let i = 0; i < element.childElementCount; ++i) {
                walk(element.children[i], stats, mergedStyle, styleProperties);
            }
        };

        /** @type { Map<string | undefined, number>[] } */
        let stats = styleProperties.map(() => new Map());

        /** @type { (string | undefined)[] } */
        let initialStyle = styleProperties.map(() => undefined);

        walk(element, stats, initialStyle, styleProperties);

        return stats.map(s => findMaxCount(s));
    }

    /**
     * Remove specified inline style value from element and its descendants
     * 
     * FIXME: The styleName type is just wrong. Look at CSSStyleDeclaration, but
     * to make that work properly some minor code changes are needed.
     * 
     * @param { HTMLElement } element The element to modify.
     * @param { string } styleName The style key.
     * @param { string | undefined } value The value to look for.
     * @returns { void } Changes are made on {@link element} directly.
     */
    function removeStyleValue(element, styleName, value) {
        if (value === undefined) {
            return;
        }

        let walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);

        do {
            let node = /** @type { HTMLElement } */ (walker.currentNode);
            let style = node.style;

            if (style[styleName] === value) {
                style[styleName] = null;

                if (style.length === 0) {
                    node.removeAttribute("style");
                }
            }
        } while (walker.nextNode());
    }

    /**
     * If web page is using custom font color or size, set to default.
     * 
     * @param { HTMLElement } element The element to modify.
     * @returns { void } Changes are made on {@link element} directly.
     */
    function setStyleToDefault(element) {
        let styleProperties = ["color", "fontSize"];
        let primary = findPrimaryStyleSettings(element, styleProperties);

        for (let i = 0; i < styleProperties.length; ++i) {
            removeStyleValue(element, styleProperties[i], primary[i]);
        }
    }

    /**
     * Move up heading if higher levels are missing, i.e. h2 to h1, h3 to h2 if
     * there's no h1.
     * 
     * @param { ParentNode } contentElement The element to remove headings from.
     * @return { void } Changes are made directly on the provided {@link contentElement}.
     */
    function removeUnusedHeadingLevels(contentElement) {
        let usedHeadings = HEADER_TAGS.map(tag => [...contentElement.querySelectorAll(tag)])
            .filter(headings => 0 < headings.length);

        for (let i = 0; i < usedHeadings.length; ++i) {
            for (let element of usedHeadings[i]) {
                let replacement = element.ownerDocument.createElement(HEADER_TAGS[i]);

                convertElement(element, replacement);
            }
        }
    }

    /**
     * wrap any raw text in <p></p> tags
     */
    function wrapRawTextNode(node) {
        if ((node.nodeType === Node.TEXT_NODE) && !isStringWhiteSpace(node.nodeValue)) {
            let wrapper = node.ownerDocument.createElement("p");
            wrapper.appendChild(node.ownerDocument.createTextNode(node.nodeValue));
            return wrapper;
        } else {
            return node;
        }
    }

    /**
     * Check whether a value is null or empty string.
     * 
     * @param { string | null | undefined } s The value to check.
     * @returns { boolean } Whether the value is null or empty.
     */
    function isNullOrEmpty(s) {
        return ((s == null) || isStringWhiteSpace(s));
    }

    function hyperlinksToChapterList(contentElement, isChapterPredicate, getChapterArc) {
        if (contentElement == null) {
            return [];
        }

        let linkSet = new Set();
        let includeLink = function(link) {
            // ignore links with no name or link
            if (isNullOrEmpty(link.innerText) || isNullOrEmpty(link.href)) {
                return false;
            }

            // ignore duplicate links
            let href = normalizeUrlForCompare(link.href);
            if (linkSet.has(href)) {
                return false;
            }

            linkSet.add(href);
            return isChapterPredicate ? isChapterPredicate(link) : true;
        };

        // only set newArc when arc changes
        let currentArc = null;
        let newArcValueForChapter = function(link) {
            if (getChapterArc) {
                let arc = getChapterArc(link);
                if (arc === currentArc) {
                    return null;
                } else {
                    currentArc = arc;
                    return currentArc;
                }
            }

            return currentArc;
        };

        return getElements(contentElement, "a", a => includeLink(a))
            .map(link => hyperLinkToChapter(link, newArcValueForChapter(link)));
    }

    /**
     * Remove trailing slash from a url if present.
     * 
     * @param { UrlString } url The url to modify.
     * @returns { UrlString } The provided url without trailing /.
     */
    function removeTrailingSlash(url) {
        return url.endsWith("/") ? url.substring(0, url.length - 1) : url;
    }

    /**
     * Remove hash suffix from url if present.
     * 
     * @param { UrlString } url Url to modify.
     * @returns { UrlString } The stripped url.
     */
    function removeAnchor(url) {
        let index = url.indexOf("#");
        return (0 <= index) ? url.substring(0, index) : url;
    }

    /**
     * Normalize an url to make it "safe" to compare against another.
     * 
     * @param { UrlString } url The original url.
     * @returns { UrlString} The normalized url.
     */
    function normalizeUrlForCompare(url) {
        let noTrailingSlash = removeTrailingSlash(removeAnchor(url));

        const protocolSeparator = "://";
        let protocolIndex = noTrailingSlash.indexOf(protocolSeparator);

        return (protocolIndex < 0) ? noTrailingSlash
            : noTrailingSlash.substring(protocolIndex + protocolSeparator.length);
    }

    function hyperLinkToChapter(link, newArc) {
        return {
            sourceUrl: link.href,
            title: link.innerText.trim(),
            newArc: (newArc === undefined) ? null : newArc
        };
    }

    /**
     * Creates a comment and adds it to the {@link doc}.
     * 
     * @param { Document } doc The document to add the comment to.
     * @param { string } content The contents of the comment.
     * @returns { Comment } The created comment.
     */
    function createComment(doc, content) {
        content = clearIfDataUri(content);

        // comments are not allowed to contain a double hyphen
        let escaped = content.replace(/--/g, "%2D%2D");

        return doc.createComment("  " + escaped + "  ");
    }

    /**
     * Declare document as xml.
     * 
     * As JavaScript doesn't support this directly, need to do a dirty hack
     * using a processing instruction.
     * 
     * @see https://bugzilla.mozilla.org/show_bug.cgi?id=318086
     * 
     * @param { Document } dom The document to add the declaration to.
     * @returns { void } Changes are made on {@link dom} directly.
     */
    function addXmlDeclarationToStart(dom) {
        let declaration = dom.createProcessingInstruction("xml", "version=\"1.0\" encoding=\"utf-8\"");

        dom.insertBefore(declaration, dom.childNodes[0]);
    }

    /**
     * So that we don't get weird as hell issues with certain tags we use a
     * dirty hack to add a doctype
     * 
     * @param { XMLDocument } dom The document to add the type to.
     * @returns { void } Changes are made on the provided {@link dom} object.
     */
    function addXhtmlDocTypeToStart(dom) {
        let docType = dom.implementation.createDocumentType("html", "-//W3C//DTD XHTML 1.1//EN", "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd");

        dom.insertBefore(docType, dom.children[0]);
    }

    /**
     * Check whether a contains anything other than whitespace.
     * 
     * @param { string } s The string to check.
     * @returns { boolean } Whether the string is only whitespace.
     */
    function isStringWhiteSpace(s) {
        return !(/\S/.test(s));
    }

    /**
     * Check if an element is just whitespace.
     * 
     * @param { HTMLElement } element The element to check.
     * @returns { boolean } Whether the element is purely whitespace.
     */
    function isElementWhiteSpace(element) {
        switch (element.nodeType) {
            case Node.TEXT_NODE:
                return isStringWhiteSpace( element.textContent);
            case Node.COMMENT_NODE:
                return true;
        }

        // FIXME: Should probably use HTMLElementTagNameMap, and normalized values.
        if ((element.tagName === "IMG") || (element.tagName === "image")) {
            return false;
        }

        if (element.querySelector("img, image") !== null) {
            return false;
        }

        return isStringWhiteSpace(element.innerText);
    }

    /**
     * Check whether a node is a heading element.
     * 
     * @param { Node } node The node to check.
     * @returns { boolean } Whether the node is a heading tag.
     */
    function isHeaderTag(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }

        let tag = node.tagName.toLowerCase();

        return HEADER_TAGS.some(t => tag === t);
    }

    /**
     * Check whether a string is formatted as a valid url. Note that it does not
     * check whether the link is live or working; just that it could be.
     * 
     * @param { string } string The string to check.
     * @returns { boolean } Whether the provided string is in a url format.
     */
    function isUrl(string) {
        try {
            let url = new URL(string);
            return url.protocol.startsWith("http:")
                || url.protocol.startsWith("https:");
        } catch (e) {
            return false;
        }
    }

    /**
     * Get a document represented as an xml string.
     * 
     * @param { Document } dom The document to turn into a string.
     * @returns { string } The dom xml represented as a string.
     */
    function xmlToString(dom) {
        addXmlDeclarationToStart(dom);

        return new XMLSerializer().serializeToString(dom);
    }

    /**
     * Zeropad a number to four digits.
     * 
     * FIXME: This does technically support null/undefined; but it will do so by
     * literally producing "000undefined"/"000null" and stripping it; which
     * doesn't seem right.
     * 
     * @param { number } num The number to pad.
     * @returns { string } The padded number.
     */
    function zeroPad(num) {

        let padded = "000" + num;

        padded = padded.substring(padded.length - 4, padded.length);

        return padded;
    }

    function iterateElements(root, filter, whatToShow = NodeFilter.SHOW_ELEMENT) {
        let iterator = document.createNodeIterator(root,
            whatToShow,
            { acceptNode: filter }
        );
        let elements = [];
        let node = null;
        while ((node = iterator.nextNode()) != null) {
            elements.push(node);
        }
        return elements;
    }

    /**
     * Get all elements of type matching filter from dom.
     * 
     * @template { keyof HTMLElementTagNameMap } T
     * @param { Element } dom The parent element.
     * @param { T } tagName The name of the tag type to look for.
     * @param { ((element: HTMLElementTagNameMap[T]) => boolean) | undefined } filter The filtering function; if not provided all elements will be returned.
     * @returns { HTMLElementTagNameMap[T][] }
     */
    function getElements(dom, tagName, filter) {
        let array = Array.from(dom.getElementsByTagName(tagName));

        return (filter === undefined || typeof filter !== "function")
            ? array : array.filter(filter);
    }

    function getElement(dom, tagName, filter) {
        let elements = getElements(dom, tagName, filter);
        return (elements.length === 0) ? null : elements[0];
    }

    /**
     * Used in removeNextAndPreviousChapterHyperlinks()
     * 
     * Basically, we want to remove all elements related to the hyperlink
     * So we want to remove the parent element. However, need to be careful
     * we don't go so high we wipe out the entire document
     * 
     * NOTE: This could theoretically be generic:ed down to Element; but why?
     * 
     * @param { HTMLElement } element
     * @param { keyof HTMLElementTagNameMap } parentTag
     * @returns { HTMLElement }
     */
    function moveIfParent(element, parentTag) {
        let parent = element.parentNode;

        if ((parent.tagName.toLowerCase() === parentTag) &&
            (parent.textContent.length < 200)) {
            return parent;
        }

        return element;
    }

    function safeForFileName(title, maxLength = 20) {
        if (title) {
            // Allow only a-z regardless of case and numbers as well as hyphens and underscores; replace spaces and no-break spaces with underscores
            title = title.replace(/[ \u00a0]/gi, "_").replace(/([^a-z0-9_-]+)/gi, "");
            // There is technically a 255-character limit in windows for file paths.
            // So we will allow files to have 20 characters and when they go over we split them
            // we then truncate the middle so that the file name is always different
            const ellipsis = "...";
            let splitLength = Math.floor((maxLength - ellipsis.length) / 2);
            return title.length > maxLength
                ? title.slice(0, splitLength) + ellipsis + title.slice(title.length - splitLength)
                : title;
        }
        return "";
    }

    /**
     * Make a filename.
     * 
     * @param { string } subdirectory The subdirectory to put it in.
     * @param { number } index Part of the name.
     * @param { string | null | undefined } title Part of the name.
     * @param { string } extension The extension.n
     * @returns { UrlString } The created filename.
     */
    function makeStorageFileName(subdirectory, index, title, extension) {
        if (title) {
            const safeLengthForNameInZip = 200;
            title = "_" + safeForFileName(title, safeLengthForNameInZip) + ".";
        } else {
            // We don't want issues so just set it to . to prepare for the extension
            title = ".";
        }
        return subdirectory + zeroPad(index) + title + extension;
    }

    function isTextAreaField(element) {
        return (element.tagName === "TEXTAREA");
    }

    function isTextInputField(element) {
        return (element.tagName === "INPUT") &&
            ((element.type === "text") || (element.type === "url"));
    }

    /**
     * Check if a provided string is valid according to {@link mimeType}.
     * 
     * @param { string } xhtmlAsString The string to try to parse.
     * @param { DOMParserSupportedType } [mimeType] The mimetype to look for; defaults to xml.
     * @returns { string | null } String containing the error; or null for valid.
     */
    function isXhtmlInvalid(xhtmlAsString, mimeType = "application/xml") {
        let doc = new DOMParser().parseFromString(xhtmlAsString, mimeType);
        let parserError = doc.querySelector("parsererror");

        return (parserError === null) ? null : parserError.textContent;
    }

    function dctermsToTable(dom) {
        let table = dom.createElement("table");
        let body = dom.createElement("tbody");
        table.appendChild(body);
        for (let term of dom.querySelectorAll("meta[name*='dcterms.']")) {
            let row = dom.createElement("tr");
            body.appendChild(row);
            let td = dom.createElement("td");
            row.appendChild(td);
            td.textContent = term.getAttribute("name").replace("dcterms.", "");
            td = dom.createElement("td");
            row.appendChild(td);
            td.textContent = term.getAttribute("content");
        }
        return table;
    }

    function parseHtmlAndInsertIntoContent(htmlText, content) {
        let parsed = util.sanitize(htmlText);
        while (content.firstChild) {
            content.removeChild(content.firstChild);
        }
        for (const tag of [...parsed.querySelector("body").children]) {
            content.appendChild(tag);
        }
    }

    // allow disabling logging from one place
    function log(arg) { // eslint-disable-line no-unused-vars
        // ToDo: uncomment this for debug logging
        // console.log(arg);
    }

    // This is for Unit Testing only
    function syncLoadSampleDoc(fileName, url) {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", fileName, false);
        xhr.send(null);
        let dom = new DOMParser().parseFromString(xhr.responseText, "text/html");
        setBaseTag(url, dom);
        return dom;
    }

    /**
     * Get the internal EPUB href to the stylesheet.
     * 
     * @returns { UrlString } The href to the stylesheet.
     */
    function styleSheetFileName() {
        return "OEBPS/Styles/stylesheet.css";
    }

    function extractUrlFromBackgroundImage(element) {
        const background = element?.style?.backgroundImage;
        return background?.substring(5, background.length - 2) ?? null;
    }

    function extractSubstring(s, prefix, suffix) {
        if (typeof (prefix) !== "string") {
            let match = s.match(prefix);
            if (match === null) {
                throw new Error("prefix not found");
            } else {
                prefix = match[0];
            }
        }

        let i = s.indexOf(prefix);
        if (i < 0) {
            throw new Error("prefix not found");
        }
        s = s.substring(i + prefix.length);
        i = s.indexOf(suffix);
        if (i < 0) {
            throw new Error("suffix not found");
        }
        return s.substring(0, i);
    }

    function findIndexOfClosingQuote(s, startIndex) {
        let index = startIndex + 1;
        while (index < s.length && (s[index] !== "\"")) {
            index += (s[index] === "\\") ? 2 : 1;
        }
        return index;
    }

    /**
     * Find the matching balanced closing bracket for another.
     * 
     * @param { string } s The string to look in.
     * @param { number } startIndex The index to start looking at.
     * @returns { number } The index in {@link s} containing the closing bracket. Return -1 if the brackets are unbalanced.
     */
    function findIndexOfClosingBracket(s, startIndex) {
        let index = startIndex + 1;
        let depth = 1;
        let c = s[index];
        while (0 < depth && index < s.length) {
            if (c === "]" || c === "}") {
                --depth;
                if (depth === 0) {
                    return index;
                }
            } else if (c === "[" || c === "{") {
                ++depth;
            } else if (c === "\"") {
                index = findIndexOfClosingQuote(s, index);
            }
            ++index;
            c = s[index];
        }
        // unbalanced brackets
        return -1;
    }

    /**
     * Locate and extract JSON that is embedded in a string.
     * 
     * @param { string } s - show/hide control
     * @param { string } prefix - text that precedes the embedded JSON
     * @returns { unknown } The parsed JSON.
     * 
     * @throws { SyntaxError } If parsing JSON fails.
     */
    function locateAndExtractJson(s, prefix) {
        /**
         * @param { string } s 
         * @param { number } index 
         * @returns { number }
         */
        const findOpeningBracket = function(s, index) {
            while (index < s.length) {
                let ch = s[index];

                if ((ch === "[") || (ch === "{")) {
                    return index;
                }

                ++index;
            }

            return -1;
        };

        let index = s.indexOf(prefix);

        if (0 <= index) {
            index = findOpeningBracket(s, index + prefix.length);

            if (0 <= index) {
                let end = findIndexOfClosingBracket(s, index);

                if (index < end) {
                    let jsonString = s.substring(index, end + 1);

                    // FIXME: Should this be try/catch?
                    return JSON.parse(jsonString);
                }
            }
        }
        return null;
    }

    function createChapterTab(url) {
        return new Promise((resolve) => {
            chrome.tabs.create({url: url, active: false}, (tab) => {
                resolve(tab.id);
            });
        });
    }

    function removeAttributes(element, attributeNames) {
        if (!element || attributeNames == null) return;

        // Handle single attribute name as string
        if (typeof attributeNames === "string") {
            element.removeAttribute(attributeNames);
            return;
        }

        // Handle array of attribute names
        if (Array.isArray(attributeNames)) {
            for (const name of attributeNames) {
                if (typeof name === "string") {
                    element.removeAttribute(name);
                }
            }
        }
    }

    /**
     * Strip empty/superflous attributes from {@link content}.
     * 
     * @param { ParentNode } content 
     * @returns { void } Changes are made on {@link content} directly.
     */
    function removeEmptyAttributes(content) {
        const elements = content.querySelectorAll("*");

        for (const element of elements) {
            const attributes = element.attributes;
            const attributesToRemove = [];

            for (let i = 0; i < attributes.length; i++) {
                if (attributes[i].value.trim() === "") {
                    attributesToRemove.push(attributes[i].name);
                }
            }

            for (let i = attributesToRemove.length - 1; i >= 0; i--) {
                element.removeAttribute(attributesToRemove[i]);
            }
        }
    }

    /**
     * Remove span children of <p> or <div> without attributes inside
     * {@link content}.
     * 
     * Within p or div tags, spans with no attributes have no purpose.
     * 
     * @param { ParentNode } content The parent element to remove from.
     * @returns { void } Changes are made on {@link content} directly.
     */
    function removeSpansWithNoAttributes(content) {
        const spans = content.querySelectorAll("p span, div span");

        for (const span of spans) {
            if (span.attributes.length === 0) {
                while (span.firstChild) {
                    span.parentNode.insertBefore(span.firstChild, span);
                }

                span.parentNode.removeChild(span);
            }
        }
    }

    function replaceSemanticInlineStylesWithTags(element, removeLeftoverStyles = false) {
        if (element.hasAttribute("style")) {
            let styleText = element.getAttribute("style");

            // Map of style patterns to their semantic HTML equivalents
            const styleToTag = [
                { regex: /font-style\s*:\s*(italic|oblique)\s*;?/g, tag: "i" },
                { regex: /font-weight\s*:\s*(bold|[7-9]\d\d)\s*;?/g, tag: "b" },
                { regex: /text-decoration\s*:\s*underline\s*;?/g, tag: "u" },
                { regex: /text-decoration\s*:\s*line-through\s*;?/g, tag: "s" }
            ];

            // Apply semantic tags and remove corresponding styles
            for (const style of styleToTag) {
                if (style.regex.test(styleText)) {
                    // Reset lastIndex since test() advances it
                    style.regex.lastIndex = 0;
                    wrapInnerContentInTag(element, style.tag);
                    styleText = styleText.replace(style.regex, "");
                }
            }

            // Remove non-semantic font-weight
            styleText = styleText.replace(/font-weight\s*:\s*(normal|[1-4]\d\d)\s*;?/g, "");
            styleText = styleText.trim();

            if (styleText && (!removeLeftoverStyles || /italic|bold|font-weight|underline|line-through/.test(styleText))) {
                element.setAttribute("style", styleText);
            } else {
                // Remove all remaining styles except text-align:center if present
                element.style.getPropertyValue("text-align") === "center"
                    ? element.setAttribute("style", "text-align: center;")
                    : element.removeAttribute("style");
            }
        }
    }

    function wrapInnerContentInTag(element, tagName) {
        const wrapper = document.createElement(tagName);
        moveChildElements(element, wrapper);
        element.appendChild(wrapper);
    }

    /**
     * Get file extension based on mimetype; or undefined if unknown.
     * 
     * FIXME: Refactor this to make it less type headachy.
     * 
     * @param { string } mimeType The mime type.
     * @returns { string | undefined } The extension; or undefined.
     */
    function getDefaultExtensionByMime(mimeType)
    {
        let retval = MIME_TYPE_EXTENSIONS[mimeType];

        if (retval) retval = retval[0];

        return retval;
    }

    function detectMimeType(b64) {
        let b64b = atob(b64);
        for (var s in MIME_TYPE_SIGNATURES) {
            if (b64b.indexOf(atob(s)) === 0 || b64.indexOf(s) === 0) {
                return MIME_TYPE_SIGNATURES[s][0];
            }
        }
    }

    /**
     * Clean a element by completely recreating it and running DOMPurify.
     * 
     * @param { Node | string } dirty The dirty document.
     * @returns { Document } The cleaned element as a new {@link Document} instance.
     */
    function sanitize(dirty) {
        let savedBaseURI = dirty.baseURI;

        const clean = DOMPurify.sanitize(dirty);

        let html = new DOMParser().parseFromString(clean, "text/html");

        if (savedBaseURI) {
            util.setBaseTag(savedBaseURI, html);
        }

        return html;
    }

    /**
     * Clean up a node.
     * 
     * FIXME: These types could do with some more specificity.
     * 
     * @param { Node } dirty The dirty node.
     * @returns { Node }
     */
    function sanitizeNode(dirty) {
        // don't need to sanitize text nodes
        // and DOMPurify deletes them if they're whitespace
        return (dirty?.nodeType === 3)
            ? dirty.cloneNode(true)
            : sanitize(dirty).body.firstChild;
    }

    // Define constants
    const XMLNS = "http://www.w3.org/1999/xhtml";

    /**
     * ugly, but we're treating <u> and <s> as inline (they are not)
     * 
     * @type { (keyof HTMLElementTagNameMap | keyof HTMLElementDeprecatedTagNameMap)[] }
     */
    const INLINE_ELEMENTS = ["b", "big", "i", "small", "tt", "abbr", "acronym", "cite",
        "code", "dfn", "em", "kbd", "strong", "samp", "time", "var", "a", "bdo",
        "br", "img", "map", "object", "q", "script", "span", "sub", "sup",
        "button", "input", "label", "select", "textarea", "u", "s"];

    /**
     * @type { (keyof HTMLElementTagNameMap)[] }
     */
    const BLOCK_ELEMENTS = ["address", "article", "aside", "blockquote", "canvas",
        "dd", "div", "dl", "fieldset", "figcaption", "figure", "footer",
        "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr",
        "li", "main", "nav", "noscript", "ol", "output", "p", "pre",
        "section", "table", "tfoot", "ul", "video"];

    /**
     * @type { (keyof HTMLElementTagNameMap)[] }
     */
    const HEADER_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"];

    /**
     * @type { { [key: string]: string[] } }
     */
    const MIME_TYPE_EXTENSIONS = {
        "image/jpeg": ["jpg", "jpeg", "jpe"],
        "image/png": ["png"],
        "image/gif": ["gif"],
        "image/webp": ["webp"],
        "image/bmp": ["bmp", "dib"],
        "image/tiff": ["tif", "tiff"],
        "image/svg+xml": ["svg"],
        "image/x-icon": ["ico"],
        "image/vnd.microsoft.icon": ["ico"],
        "image/heif": ["heif"],
        "image/heic": ["heic"],
        "image/x-xbitmap": ["xbm"],
        "image/x-portable-bitmap": ["pbm"],
        "image/x-portable-graymap": ["pgm"],
        "image/x-portable-pixmap": ["ppm"],
        "image/x-portable-anymap": ["pnm"],
        "image/x-cmu-raster": ["ras"],
        "image/x-tga": ["tga"],
        "image/jxr": ["jxr"],
        "image/ktx": ["ktx"],
        "image/apng": ["apng"],
        "image/avif": ["avif"]
    };

    /**
     * @type { { [key: string]: string[] } }
     */
    const MIME_TYPE_SIGNATURES = {
        "/9j/": ["image/jpeg"],
        "iVBORw0KGgo=": ["image/png", "image/apng"],
        "R0lGODdh": ["image/gif"],
        "R0lGODlh": ["image/gif"],
        "UklGRg": ["image/webp"],
        "Qk0=": ["image/bmp"],
        "SUkqAA==": ["image/tiff"],
        "TU0AKg==": ["image/tiff"],
        "PD94bWw=": ["image/svg+xml"],
        "AAABAA==": ["image/x-icon", "image/vnd.microsoft.icon"],
        "ZnR5cGhlaWZj": ["image/heif"],
        "ZnR5cG1pZjE=": ["image/heif"],
        "ZnR5cGhlaWNj": ["image/heic"],
        "SUm8": ["image/jxr"],
        "q0tUWCAxMb0NCgo=": ["image/ktx"],
        "AAACAA==": ["image/x-tga"],
        "ZnR5cGF2aWY=": ["image/avif"],
        "UDAx": ["image/x-portable-bitmap"],
        "UDAy": ["image/x-portable-graymap"],
        "UDAz": ["image/x-portable-pixmap"],
        "UDA0": ["image/x-portable-anymap"],
        "WaZqlQ==": ["image/x-cmu-raster"]
    };

    return {
        XMLNS: XMLNS,
        INLINE_ELEMENTS: INLINE_ELEMENTS,
        BLOCK_ELEMENTS: BLOCK_ELEMENTS,
        HEADER_TAGS: HEADER_TAGS,
        sleep: sleep,
        sleepController: sleepController,
        randomInteger: randomInteger,
        isFirefox: isFirefox,
        extensionVersion: extensionVersion,
        createEmptyXhtmlDoc: createEmptyXhtmlDoc,
        createEmptyHtmlDoc: createEmptyHtmlDoc,
        populateHead: populateHead,
        createSvgImageElement: createSvgImageElement,
        clearIfDataUri: clearIfDataUri,
        resolveRelativeUrl: resolveRelativeUrl,
        log: log,
        extractHostName: extractHostName,
        extractFilename: extractFilename,
        extractFilenameFromUrl: extractFilenameFromUrl,
        getParamFromUrl: getParamFromUrl,
        setBaseTag: setBaseTag,
        decodeCloudflareProtectedEmails: decodeCloudflareProtectedEmails,
        replaceCloudflareProtectedLink: replaceCloudflareProtectedLink,
        decodeEmail: decodeEmail,
        removeElements: removeElements,
        removeChildElementsMatchingSelector: removeChildElementsMatchingSelector,
        removeComments: removeComments,
        removeEmptyDivElements: removeEmptyDivElements,
        removeTrailingWhiteSpace: removeTrailingWhiteSpace,
        removeLeadingWhiteSpace: removeLeadingWhiteSpace,
        removeHTMLUnknownElement: removeHTMLUnknownElement,
        removeScriptableElements: removeScriptableElements,
        removeMicrosoftWordCrapElements: removeMicrosoftWordCrapElements,
        flattenNode: flattenNode,
        removeEventHandlers: removeEventHandlers,
        removeHeightAndWidthStyleFromParents: removeHeightAndWidthStyleFromParents,
        removeHeightAndWidthStyle: removeHeightAndWidthStyle,
        removeUnwantedWordpressElements: removeUnwantedWordpressElements,
        removeShareLinkElements: removeShareLinkElements,
        convertPreTagToPTags: convertPreTagToPTags,
        prepForConvertToXhtml: prepForConvertToXhtml,
        replaceCenterTags: replaceCenterTags,
        replaceUnderscoreTags: replaceUnderscoreTags,
        replaceSTags: replaceSTags,
        convertElement: convertElement,
        moveChildElements: moveChildElements,
        copyAttributes: copyAttributes,
        fixDelayLoadedImages: fixDelayLoadedImages,
        fixBlockTagsNestedInInlineTags: fixBlockTagsNestedInInlineTags,
        isBlockElementInside: isBlockElementInside,
        moveElementsOutsideTag: moveElementsOutsideTag,
        isNodeInTag: isNodeInTag,
        isInlineElement: isInlineElement,
        isBlockElement: isBlockElement,
        getFirstImgSrc: getFirstImgSrc,
        makeRelative: makeRelative,
        makeStorageFileName: makeStorageFileName,
        extractHashFromUri: extractHashFromUri,
        makeHyperlinksRelative: makeHyperlinksRelative,
        resolveLazyLoadedImages: resolveLazyLoadedImages,
        isLocalHyperlink: isLocalHyperlink,
        findPrimaryStyleSettings: findPrimaryStyleSettings,
        removeStyleValue: removeStyleValue,
        setStyleToDefault: setStyleToDefault,
        removeUnusedHeadingLevels: removeUnusedHeadingLevels,
        isNullOrEmpty: isNullOrEmpty,
        wrapRawTextNode: wrapRawTextNode,
        hyperlinksToChapterList: hyperlinksToChapterList,
        removeTrailingSlash: removeTrailingSlash,
        removeAnchor: removeAnchor,
        normalizeUrlForCompare: normalizeUrlForCompare,
        hyperLinkToChapter: hyperLinkToChapter,
        createComment: createComment,
        addXmlDeclarationToStart: addXmlDeclarationToStart,
        addXhtmlDocTypeToStart: addXhtmlDocTypeToStart,
        iterateElements: iterateElements,
        getElement: getElement,
        getElements: getElements,
        moveIfParent: moveIfParent,
        safeForFileName: safeForFileName,
        styleSheetFileName: styleSheetFileName,
        isStringWhiteSpace: isStringWhiteSpace,
        isElementWhiteSpace: isElementWhiteSpace,
        isHeaderTag: isHeaderTag,
        isUrl: isUrl,
        isTextAreaField: isTextAreaField,
        isTextInputField: isTextInputField,
        isXhtmlInvalid: isXhtmlInvalid,
        dctermsToTable: dctermsToTable,
        parseHtmlAndInsertIntoContent: parseHtmlAndInsertIntoContent,
        extractUrlFromBackgroundImage: extractUrlFromBackgroundImage,
        extractSubstring: extractSubstring,
        findIndexOfClosingQuote: findIndexOfClosingQuote,
        findIndexOfClosingBracket: findIndexOfClosingBracket,
        locateAndExtractJson: locateAndExtractJson,
        createChapterTab: createChapterTab,
        syncLoadSampleDoc: syncLoadSampleDoc,
        xmlToString: xmlToString,
        zeroPad: zeroPad,
        sanitize: sanitize,
        sanitizeNode: sanitizeNode,
        removeAttributes: removeAttributes,
        removeEmptyAttributes: removeEmptyAttributes,
        removeSpansWithNoAttributes: removeSpansWithNoAttributes,
        replaceSemanticInlineStylesWithTags: replaceSemanticInlineStylesWithTags,
        wrapInnerContentInTag: wrapInnerContentInTag,
        getDefaultExtensionByMime: getDefaultExtensionByMime,
        detectMimeType: detectMimeType
    };
})();
