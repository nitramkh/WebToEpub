"use strict";

/** 
 * Functions for packing an EPUB file
 * 
 * For our purposes, an EPUB only contains two types of content file: XHTML and image.
 *  - The HTML files are in reading order (i.e. Appear in same order as spine and table of contents (ToC))
 *  - If an HTML file entry has a "title" element, it will appear in the ToC
 *  - Stand-alone images (e.g. Cover) will have an XHTML entry that points to the image.
 *  - First image, (if there are any) will be the cover image
 * 
 * <param name="uuid" type="string">identifier for this EPUB.  (i.e. "origin" URL story was downloaded from)</param>
 * <param name="title" type="string">The Title of the story</param>
 * <param name="author" type="string">The writer of the story</param>
 */
class EpubPacker {
    /**
     * The metadata to put into the epub.
     * 
     * @type { EpubMetaInfo }
     */
    metaInfo;

    /**
     * The epub version to use; defaults to {@link EpubPacker.EPUB_VERSION_2}.
     * 
     * @see {@link EpubPacker.EPUB_VERSION_2}
     * @see {@link EpubPacker.EPUB_VERSION_3}
     * 
     * @type { string }
     */
    version;

    /**
     * Function for creating a empty document.
     * 
     * FIXME: This returns XMLDocument if epub 2; but Document if epub 3; could
     * be represented with types based on {@link EpubPacker.version}.
     * 
     * @type { () => Document }
     */
    emptyDocFactory;


    /**
     * Function for validating xml.
     * 
     * @type { (xml: string) => (string | null) }
     */
    contentValidator;

    /**
     * @param { EpubMetaInfo } metaInfo The metadata to put into the epub.
     * @param { string } [version] The epub version to use; defaults to {@link EpubPacker.EPUB_VERSION_2}
     */
    constructor(metaInfo, version = EpubPacker.EPUB_VERSION_2) {
        this.metaInfo = metaInfo;
        this.version = version;

        this.emptyDocFactory = util.createEmptyXhtmlDoc;
        let contentType = EpubPacker.XHTML_MIME_TYPE;
        if (version === EpubPacker.EPUB_VERSION_3) {
            this.emptyDocFactory = util.createEmptyHtmlDoc;
            contentType = EpubPacker.HTML_MIME_TYPE;
        }
        this.contentValidator = xml => util.isXhtmlInvalid(xml, contentType);
    }

    /**
     * Get "internal" link to cover.
     * 
     * @returns { UrlString } The "internal" url to the cover.
     */
    static coverImageXhtmlHref() {
        return "OEBPS/Text/Cover.xhtml";
    }

    /**
     * Get the id for the cover image.
     * 
     * @returns { string } The id for the cover image.
     */
    static coverImageXhtmlId() {
        return "cover";
    }

    /**
     * Assemble all the gathered epub items into an actual epub zip.
     * 
     * @param { EpubItemSupplier } epubItemSupplier The source of the epub items.
     * @returns { Promise<Blob> } The (future) blob of the entire packed epub.
     */
    assemble(epubItemSupplier) {
        let zipFileWriter = new zip.BlobWriter("application/epub+zip");
        let zipWriter = new zip.ZipWriter(zipFileWriter,{useWebWorkers: false,compressionMethod: 8, extendedTimestamp: false});

        this.addRequiredFiles(zipWriter);

        zipWriter.add("OEBPS/content.opf", new zip.TextReader(this.buildContentOpf(epubItemSupplier)));
        zipWriter.add("OEBPS/toc.ncx", new zip.TextReader(this.buildTableOfContents(epubItemSupplier)));

        if (this.version === EpubPacker.EPUB_VERSION_3) {
            zipWriter.add("OEBPS/toc.xhtml", new zip.TextReader(this.buildNavigationDocument(epubItemSupplier)));
        }

        this.packContentFiles(zipWriter, epubItemSupplier);
        zipWriter.add(util.styleSheetFileName(), new zip.TextReader(this.metaInfo.styleSheet));

        return zipWriter.close();
    }

    /**
     * Add the .epub extension to the filename if not present.
     * 
     * @param { string } fileName Filename which may or many not have an extension.
     * @returns { string } The filename with extension.
     */
    static addExtensionIfMissing(fileName) {
        let extension = ".epub";
        return (fileName.endsWith(extension)) ? fileName : fileName + extension;
    }

    /**
     * Add required files for a valid epub to zip.
     * 
     * @param { zip.ZipWriter<Blob> } zipFile 
     * @returns { void } Changes are made on the {@link zipFile} directly.
     */
    addRequiredFiles(zipFile) {
        zipFile.add("mimetype",  new zip.TextReader("application/epub+zip"),{compressionMethod: 0});
        zipFile.add("META-INF/container.xml",
            new zip.TextReader("<?xml version=\"1.0\"?>" +
            "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">" +
                "<rootfiles>" +
                    "<rootfile full-path=\"OEBPS/content.opf\" media-type=\"application/oebps-package+xml\"/>" +
                "</rootfiles>" +
            "</container>")
        );
    }

    /**
     * Create the content opf for the epub.
     * 
     * @param { EpubItemSupplier } epubItemSupplier The source of the epub items.
     * @returns { string } The created opf as a string. 
     */
    buildContentOpf(epubItemSupplier) {
        let ns = "http://www.idpf.org/2007/opf";

        let opf = document.implementation.createDocument(ns, "package", null);
        opf.documentElement.setAttributeNS(null, "version", this.version);
        opf.documentElement.setAttributeNS(null, "unique-identifier", "BookId");

        this.buildMetaData(opf, epubItemSupplier);
        this.buildManifest(opf, ns, epubItemSupplier);
        this.buildSpine(opf, ns, epubItemSupplier);
        this.buildGuide(opf, ns, epubItemSupplier);

        return util.xmlToString(opf);
    }

    /**
     * Build out the metadata of the {@link opf} document.
     * 
     * @param { Document } opf The metadata document to append.
     * @param { EpubItemSupplier } epubItemSupplier The source of epup item metadata.
     * @returns { void } Changes are made on the provided {@link opf} object directly.
     */
    buildMetaData(opf, epubItemSupplier) {
        let opf_ns = "http://www.idpf.org/2007/opf";
        let dc_ns = "http://purl.org/dc/elements/1.1/";

        let metadata = opf.createElementNS(opf_ns, "metadata");
        metadata.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:dc", dc_ns);
        metadata.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:opf", opf_ns);
        opf.documentElement.appendChild(metadata);

        this.createAndAppendChildNS(metadata, dc_ns, "dc:title", this.metaInfo.title);
        this.createAndAppendChildNS(metadata, dc_ns, "dc:language", this.metaInfo.language);
        this.createAndAppendChildNS(metadata, dc_ns, "dc:date", this.getDateForMetaData());

        if (!util.isNullOrEmpty(this.metaInfo.subject)) {
            this.createAndAppendChildNS(metadata, dc_ns, "dc:subject", this.metaInfo.subject);
        }

        if (!util.isNullOrEmpty(this.metaInfo.description)) {
            this.createAndAppendChildNS(metadata, dc_ns, "dc:description", this.metaInfo.description);
        }

        let author = this.createAndAppendChildNS(metadata, dc_ns, "dc:creator", this.metaInfo.author);
        this.addMetaProperty(metadata, author, "file-as", "creator", this.metaInfo.getFileAuthorAs());
        this.addMetaProperty(metadata, author, "role", "creator", "aut");

        if (this.metaInfo.translator !== null) {
            let translator = this.createAndAppendChildNS(metadata, dc_ns, "dc:contributor", this.metaInfo.translator);
            this.addMetaProperty(metadata, translator, "file-as", "translator", this.metaInfo.translator);
            this.addMetaProperty(metadata, translator, "role", "translator", "trl");
        }

        let idText = (this.version === EpubPacker.EPUB_VERSION_3 ? "uri:" : "") + this.metaInfo.uuid;
        let identifier = this.createAndAppendChildNS(metadata, dc_ns, "dc:identifier", idText);
        identifier.setAttributeNS(null, "id", "BookId");

        if (this.version === EpubPacker.EPUB_VERSION_2) {
            identifier.setAttributeNS(opf_ns, "opf:scheme", "URI");
        } else {
            this.addMetaProperty(metadata, identifier, "identifier-type", "BookId", "URI");
            let meta = this.createAndAppendChildNS(metadata, opf_ns, "meta");
            meta.setAttributeNS(null, "property", "dcterms:modified");
            let dateWithoutMillisecond = this.getDateForMetaData().substring(0, 19) + "Z";
            meta.textContent = dateWithoutMillisecond;
        }

        let webToEpubVersion = `[https://github.com/dteviot/WebToEpub] (ver. ${util.extensionVersion()})`;
        let contributor = this.createAndAppendChildNS(metadata, dc_ns, "dc:contributor", webToEpubVersion);
        this.addMetaProperty(metadata, contributor, "role", "packingTool", "bkp");

        if (epubItemSupplier.hasCoverImageFile()) {
            this.appendMetaContent(metadata, opf_ns, "cover", epubItemSupplier.coverImageId());
        }

        if (this.metaInfo.seriesName !== null) {
            this.appendMetaContent(metadata, opf_ns, "calibre:series", this.metaInfo.seriesName);
            this.appendMetaContent(metadata, opf_ns, "calibre:series_index", this.metaInfo.seriesIndex);
        }

        for (let i of epubItemSupplier.manifestItems()) {
            let sourceUrl = util.clearIfDataUri(i.sourceUrl);

            if (sourceUrl) {  // Only add dc:source if we have a valid URL
                let source = this.createAndAppendChildNS(metadata, dc_ns, "dc:source", sourceUrl);
                source.setAttributeNS(null, "id", "id." + i.getId());
            }
        }
    }

    /**
     * FIXME: I don't fully understand what this does; it creates and links
     * metadata elements.
     * 
     * @param { Element } metadata The metadata container element.
     * @param { Element } element FIXME: I don't know
     * @param { string } propName The name of the property.
     * @param { string } id FIXME: I don't know.
     * @param { string } value FIXME: I don't know.
     * @returns { void } Changes are made directly on the provided {@link metadata} and {@link element} objects.
     */
    addMetaProperty(metadata, element, propName, id, value) {
        let opf_ns = "http://www.idpf.org/2007/opf";

        if (this.version === EpubPacker.EPUB_VERSION_3) {
            element.setAttributeNS(null, "id", id);

            let meta = this.createAndAppendChildNS(metadata, opf_ns, "meta");

            meta.setAttributeNS(null, "refines", "#" + id);
            meta.setAttributeNS(null, "property", propName);
            meta.textContent = value;
        } else {
            element.setAttributeNS(opf_ns, "opf:" + propName, value);
        }
    }

    /**
     * Set metadata content attribute.
     * 
     * @param { Element } parent The metadata container element.
     * @param { string } opf_ns The namespace.
     * @param { string } name The attribute name.
     * @param { string } content The content/value.
     * @returns { void } Changes are made on the provided {@link parent} directly.
     */
    appendMetaContent(parent, opf_ns, name, content) {
        let meta = this.createAndAppendChildNS(parent, opf_ns, "meta");

        // Some e-book readers such as the Nook fail to recognize covers if the content
        // attribute comes before the name attribute. For maximum compatibility move
        // the name attribute before the content attribute.
        meta.setAttributeNS(null, "name", name);
        meta.setAttributeNS(null, "content", content);
    }
    
    /**
     * Build the manifest and append it into {@link opf}.
     * 
     * @param { Document } opf The document to put the manifest in.
     * @param { string } ns The namespace to create items in.
     * @param { EpubItemSupplier } epubItemSupplier The source of epub items.
     * @returns { void } Changes are made directly on the provided {@link opf} document.
     */
    buildManifest(opf, ns, epubItemSupplier) {
        let manifest = this.createAndAppendChildNS(opf.documentElement, ns, "manifest");

        for (let i of epubItemSupplier.manifestItems()) {
            let item = this.addManifestItem(manifest, ns, i.getZipHref(), i.getId(), i.getMediaType());
            this.setSvgPropertyForManifestItem(item, i.hasSvg());
        }

        this.addManifestItem(manifest, ns, util.styleSheetFileName(), "stylesheet", "text/css");
        this.addManifestItem(manifest, ns, "OEBPS/toc.ncx", "ncx", "application/x-dtbncx+xml");

        if (epubItemSupplier.hasCoverImageFile()) {
            let item = this.addManifestItem(manifest, ns, EpubPacker.coverImageXhtmlHref(), EpubPacker.coverImageXhtmlId(), "application/xhtml+xml");
            this.setSvgPropertyForManifestItem(item, this.doesCoverHaveSvg(epubItemSupplier));
        }

        if (this.version === EpubPacker.EPUB_VERSION_3) {
            let item = this.addManifestItem(manifest, ns, "OEBPS/toc.xhtml", "nav", "application/xhtml+xml");
            item.setAttributeNS(null, "properties", "nav");
        }
    }

    /**
     * Create a manifest item as child of {@link manifest} with provided
     * attributes.
     * 
     * @param { Element } manifest The element to add item in.
     * @param { string } ns The namespace of the created item element.
     * @param { UrlString } href The link/href attribute of the created item.
     * @param { string } id The id attribute of the created element.
     * @param { string } mediaType The media type attribute of the created element.
     * @returns { Element } The created element.
     */
    addManifestItem(manifest, ns, href, id, mediaType) {
        let item = this.createAndAppendChildNS(manifest, ns, "item");
        let relativeHref = this.makeRelative(href);

        if (mediaType === "image/webp") {
            let userPreferences = main.getUserPreferences();
            if (!userPreferences?.disableWebpImageFormatError?.value) {
                let errorMsg = UIText.Warning.warningWebpImage(relativeHref);
                ErrorLog.log(errorMsg);
            }
        }

        item.setAttributeNS(null, "href", relativeHref);
        item.setAttributeNS(null, "id", id);
        item.setAttributeNS(null, "media-type", mediaType);

        return item;
    }

    /**
     * If item is/has an svg, set the appropriate attributes.
     * 
     * @param { Element } item The item to potentially modify.
     * @param { boolean } hasSvg Whether the item has/is an svg.
     * @returns { void } Changes are made directly on {@link item}.
     */
    setSvgPropertyForManifestItem(item, hasSvg) {
        if (hasSvg && (this.version === EpubPacker.EPUB_VERSION_3)) {
            item.setAttributeNS(null, "properties", "svg");
        }
    }

    /**
     * Check whether {@link epubItemSupplier} has an SVG for a cover.
     * 
     * @param { EpubItemSupplier } epubItemSupplier The supplier to check.
     * @returns { boolean } Whether {@link epubItemSupplier} has a SVG cover image.
     */
    doesCoverHaveSvg(epubItemSupplier) {
        let fileContent = epubItemSupplier.makeCoverImageXhtmlFile(util.createEmptyXhtmlDoc);
        let doc = new DOMParser().parseFromString(fileContent, "application/xml");

        return (doc.querySelector("svg") != null);
    }

    /**
     * Create and append spine items to {@link opf}.
     * 
     * @param { Document } opf The document to add items to.
     * @param { string } ns The namespace to create items in.
     * @param { EpubItemSupplier } epubItemSupplier The source of epub items.
     * @returns { void } Changes are made on {@link opf} directly.
     */
    buildSpine(opf, ns, epubItemSupplier) {
        let spine = this.createAndAppendChildNS(opf.documentElement, ns, "spine");
        spine.setAttributeNS(null, "toc", "ncx");

        if (epubItemSupplier.hasCoverImageFile()) {
            this.addSpineItemRef(spine, ns, EpubPacker.coverImageXhtmlId());
        }

        for (let item of epubItemSupplier.spineItems()) {
            this.addSpineItemRef(spine, ns, item.getId());
        }
    }

    /**
     * Create a spine item and insert it into {@link spine}.
     * 
     * @param { Element } spine The parent element to insert created element in.
     * @param { string } ns The namespace to create new element with.
     * @param { string } idref The value of the idref attribute to set on created element.
     * @returns { void } Changes are made on the provided {@link spine} directly.
     */
    addSpineItemRef(spine, ns, idref) {
        this.createAndAppendChildNS(spine, ns, "itemref").setAttributeNS(null, "idref", idref);
    }

    /**
     * Add guide to {@link opf} if it has a cover image.
     * 
     * @param { Document} opf The document to insert the created element(s) into.
     * @param { string } ns The namespace to create the children with.
     * @param { EpubItemSupplier } epubItemSupplier The source of the epub items.
     * @returns { void } Changes are made directly on the provided {@link opf} object.
     */
    buildGuide(opf, ns, epubItemSupplier) {
        if (epubItemSupplier.hasCoverImageFile()) {
            let guide = this.createAndAppendChildNS(opf.documentElement, ns, "guide");
            let reference = this.createAndAppendChildNS(guide, ns, "reference");
            reference.setAttributeNS(null, "href", this.makeRelative(EpubPacker.coverImageXhtmlHref()));
            reference.setAttributeNS(null, "title", "Cover");
            reference.setAttributeNS(null, "type", "cover");
        }
    }

    /**
     * Create the table of contents document for the epub.
     * 
     * @param { EpubItemSupplier } epubItemSupplier The source of the epub items.
     * @returns { string } Created table of contents document as a string.
     */
    buildTableOfContents(epubItemSupplier) {
        let ns = "http://www.daisy.org/z3986/2005/ncx/";
        let ncx = document.implementation.createDocument(ns, "ncx", null);

        ncx.documentElement.setAttribute("version", "2005-1");
        ncx.documentElement.setAttribute("xml:lang", this.metaInfo.language);

        let head = this.createAndAppendChildNS(ncx.documentElement, ns, "head");
        this.buildDocTitle(ncx, ns);

        let depth = this.buildNavMap(ncx, ns, epubItemSupplier);
        this.populateHead(head, ns, depth);

        return util.xmlToString(ncx);
    }

    /**
     * Create a navigation document for the epub.
     * 
     * @param { EpubItemSupplier } epubItemSupplier The source of the epub items to create navigation for.
     * @returns { string } The created nav document as a string.
     */
    buildNavigationDocument(epubItemSupplier) {
        let ns = "http://www.w3.org/1999/xhtml";
        let navDoc = document.implementation.createDocument(ns, "html", null);

        navDoc.documentElement.setAttribute("xml:lang", this.metaInfo.language);
        navDoc.documentElement.setAttribute("xmlns:epub", "http://www.idpf.org/2007/ops");
        navDoc.documentElement.setAttribute("lang", this.metaInfo.language);

        let head = this.createAndAppendChildNS(navDoc.documentElement, ns, "head");

        this.createAndAppendChildNS(head, ns, "title").textContent = "Table of Contents";
        this.addDocType(navDoc);

        let body = this.createAndAppendChildNS(navDoc.documentElement, ns, "body");
        let nav = this.createAndAppendChildNS(body, ns, "nav");

        nav.setAttribute("epub:type", "toc");
        nav.setAttribute("id", "toc");

        this.populateNavElement(nav, ns, epubItemSupplier);

        return util.xmlToString(navDoc);
    }

    /**
     * Add the document type to the provided {@link navDoc}.
     * 
     * @param { Document } navDoc The document to add the type to.
     * @returns { void } Changes are made directly on {@link navDoc}.
     */
    addDocType(navDoc) {
        let docTypeNode = navDoc.implementation.createDocumentType("html", "", "");
        navDoc.insertBefore(docTypeNode, navDoc.childNodes[0]);
    }

    /**
     * Populate the head of a ToC document.
     * 
     * @param { Element } head The head element of the document to populate.
     * @param { string } ns The namespace to create the children with.
     * @param { number } depth The maximum depth of the nav map.
     */
    populateHead(head, ns, depth) {
        this.appendMetaContent(head, ns, "dtb:uid", (this.version === EpubPacker.EPUB_VERSION_3 ? "uri:" : "") + this.metaInfo.uuid);
        this.appendMetaContent(head, ns, "dtb:depth", (depth < 2) ? "2" : depth);
        this.appendMetaContent(head, ns, "dtb:totalPageCount", "0");
        this.appendMetaContent(head, ns, "dtb:maxPageNumber", "0");
    }

    /**
     * Add title to a document.
     * 
     * @param { Document } ncx The document to add title to.
     * @param { string } ns The namespace to use to create the title element.
     * @returns { void } Changes are made directly on {@link ncx}.
     */
    buildDocTitle(ncx, ns) {
        let docTitle = this.createAndAppendChildNS(ncx.documentElement, ns, "docTitle");
        this.createAndAppendChildNS(docTitle, ns, "text", this.metaInfo.title);
    }

    /**
     * Add all required children to the {@link nav} element.
     * 
     * @param { Element } nav The nav element to add children to.
     * @param { string } ns The namespace to create the children with.
     * @param { EpubItemSupplier } epubItemSupplier The source of the epub items.
     * @returns { void } Changes are made on the provided {@link nav} directly.
     */
    populateNavElement(nav, ns, epubItemSupplier) {
        let rootParent = this.createAndAppendChildNS(nav, ns, "ol");
        let parents = new NavPointParentElementsStack(rootParent);

        for (let chapterInfo of epubItemSupplier.chapterInfo()) {
            let parent = parents.findParentElement(chapterInfo.depth);
            let nextLevel = this.buildNavListItem(parent, ns, chapterInfo);
            parents.addElement(chapterInfo.depth, nextLevel);
        }

        this.removeEmptyNavLists(rootParent);
    }

    /**
     * Build and append a new nav list item in {@link parent}; returning the
     * element container for any future neste nav list items.
     * 
     * @param { Element } parent The nav list to add the created list item to.
     * @param { string } ns The namespace to create the children in.
     * @param { TOCChapterInfo } chapterInfo The information to create the nav item with.
     * @returns { HTMLOListElement } Container for any deeper nav list items.
     */
    buildNavListItem(parent, ns, chapterInfo) {
        let li = this.createAndAppendChildNS(parent, ns, "li");
        let link = this.createAndAppendChildNS(li, ns, "a");

        link.href = this.makeRelative(chapterInfo.src);
        link.textContent = chapterInfo.title;

        return this.createAndAppendChildNS(li, ns, "ol");
    }

    /**
     * Delete all empty <ol> lists from the {@link rootParent} and all its
     * decendants.
     * 
     * @param { ParentNode } rootParent 
     * @returns { void } Changes are made on {@link rootParent } directly.
     */
    removeEmptyNavLists(rootParent) {
        for (let list of rootParent.querySelectorAll("ol")) {
            if (list.childElementCount === 0) {
                list.remove();
            }
        }
    }

    /**
     * Create a nav map for the table of contents and insert it into the
     * {@link ncx} document; returning the maximum depth of the created nav map.
     * 
     * @param { Document } ncx ToC document. 
     * @param { string } ns The namespace to create child elements with.
     * @param { EpubItemSupplier } epubItemSupplier The source of the epub items.
     * @returns { number } The deepest point in the nav map?
     */
    buildNavMap(ncx, ns, epubItemSupplier) {
        let navMap = this.createAndAppendChildNS(ncx.documentElement, ns, "navMap");
        let parents = new NavPointParentElementsStack(navMap);
        let playOrder = 0;
        let id = 0;
        let lastChapterSrc = null;

        for (let chapterInfo of epubItemSupplier.chapterInfo()) {
            let parent = parents.findParentElement(chapterInfo.depth);

            if (lastChapterSrc !== chapterInfo.src) {
                ++playOrder;
            }
            
            let navPoint = this.buildNavPoint(parent, ns, playOrder, ++id, chapterInfo);
            lastChapterSrc = chapterInfo.src;

            parents.addElement(chapterInfo.depth, navPoint);
        }

        return parents.maxDepth;
    }

    /**
     * Create and append a new nav point element to the parent nav map with the
     * provided attributes.
     * 
     * @param { Element } parent The nav map element to create the nav point child in.
     * @param { string } ns The namespace to create the children in.
     * @param { number } playOrder The value of the playOrder attribute to set on the nav point child.
     * @param { number } id The value of the id attribute to set on the nav point child.
     * @param { TOCChapterInfo } chapterInfo The chapter info to use to populate the nav point.
     * @returns { Element } The created nav point element.
     */
    buildNavPoint(parent, ns, playOrder, id, chapterInfo) {
        let navPoint = this.createAndAppendChildNS(parent, ns, "navPoint");

        navPoint.setAttributeNS(null, "id", this.makeId(util.zeroPad(id)));
        navPoint.setAttributeNS(null, "playOrder", playOrder);

        let navLabel = this.createAndAppendChildNS(navPoint, ns, "navLabel");

        this.createAndAppendChildNS(navLabel, ns, "text", chapterInfo.title);
        this.createAndAppendChildNS(navPoint, ns, "content").setAttributeNS(null, "src", this.makeRelative(chapterInfo.src));

        return navPoint;
    }

    /**
     * Pack all the content into the epub zip.
     * 
     * @param { zip.ZipWriter<Blob> } zipWriter The reciever of the content.
     * @param { EpubItemSupplier } epubItemSupplier The source of the content.
     * @returns { void } Changes are made on {@link zipWriter} directly.
     */
    packContentFiles(zipWriter, epubItemSupplier) {
        for (let file of epubItemSupplier.files()) {
            file.packInEpub(zipWriter, this.emptyDocFactory, this.contentValidator);
        }

        if (epubItemSupplier.hasCoverImageFile()) {
            let fileContent = epubItemSupplier.makeCoverImageXhtmlFile(this.emptyDocFactory, "Cover");
            zipWriter.add(EpubPacker.coverImageXhtmlHref(), new zip.TextReader(fileContent));
        }
    }

    /**
     * @template { keyof HTMLElementTagNameMap } T
     * @overload
     * @param { Element } element The parent to create the child in.
     * @param { string } ns The namespace of the created child.
     * @param { T } name The name of the child.
     * @param { string } [data] The (text) data to put inside the child.
     * @returns { HTMLElementTagNameMap[T] } The created child
     */

    /**
     * @template { keyof HTMLElementDeprecatedTagNameMap } T
     * @overload
     * @param { Element } element The parent to create the child in.
     * @param { string } ns The namespace of the created child.
     * @param { T } name The name of the child.
     * @param { string } [data] The (text) data to put inside the child.
     * @returns { HTMLElementDeprecatedTagNameMap[T] } The created child
     */

    /**
     * @overload
     * @param { Element } element The parent to create the child in.
     * @param { string } ns The namespace of the created child.
     * @param { string } name The name of the child.
     * @param { string } [data] The (text) data to put inside the child.
     * @returns { Element } The created child
     */

    /**
     * Create a child of inside {@link element} with provided properties.
     * 
     * @param { Element } element The parent to create the child in.
     * @param { string } ns The namespace of the created child.
     * @param { string } name The name of the child.
     * @param { string } [data] The (text) data to put inside the child.
     * @returns { Element } The created child
     */
    createAndAppendChildNS(element, ns, name, data) {
        let child = element.ownerDocument.createElementNS(ns, name);

        /**
         * FIXME: I doubt data should only be string | undefined. Should probably
         * handle null too?
         */
        if (typeof data !== "undefined") {
            child.appendChild(element.ownerDocument.createTextNode(data));
        }

        element.appendChild(child);

        return child;
    }

    /**
     * Create an id based on a partial one.
     * 
     * @param { string } id The id to include in the created id.
     * @returns { string } The created id.
     */
    makeId(id) {
        return "body" + id;
    }

    /**
     * Changes href to be relative to manifest (and toc.ncx)
     * which are in OEBPS.
     * 
     * @param { UrlString } href The not relative url.
     * @returns { UrlString } The relative url.
     */
    makeRelative(href) {
        return href.substr(6);
    }

    /**
     * Hook point for unit testing (because we can't control the actual time)
     * return time string to put into <date> element of metadata.
     *
     * @returns { string } The date represented as a string.
     */
    getDateForMetaData() {
        return new Date().toISOString();
    }
}

/**
 * FIXME: Epubversion can be made like an enum or something to force valid
 * types.
 */

EpubPacker.EPUB_VERSION_2 = "2.0";
EpubPacker.EPUB_VERSION_3 = "3.0";

/** @type { DOMParserSupportedType } */
EpubPacker.XHTML_MIME_TYPE = "application/xml";
/** @type { DOMParserSupportedType } */
EpubPacker.HTML_MIME_TYPE = "text/html";

/**
 * Class to make sure we correctly nest the NavPoint elements
 * in the table of contents.
 */
class NavPointParentElementsStack {
    /**
     * @type { { element: Element, depth: number }[] }
     */
    parents;

    /**
     * @type { number }
     */
    maxDepth;

    /**
     * @param { Element } navMap The nav map element.
     */
    constructor(navMap) {
        this.parents = [];

        this.parents.push({
            element: navMap,
            depth: -1
        });

        this.maxDepth = 0;
    }

    /**
     * Find the parent at the provided depth.
     * 
     * @param { number } depth The depth of the parent to look for.
     * @returns { Element } The found parent.
     */
    findParentElement(depth) {
        let index = this.parents.length - 1;

        while (depth <= this.parents[index].depth) {
            --index;
        }

        return this.parents[index].element;
    }

    /**
     * Add a new element to the stack and delete any existing elements which are
     * deeper (or equal to) than the new one.
     * 
     * @param { number } depth The depth to put the new element at.
     * @param { Element } element The new element to add.
     * @return { void } The changes are made on the {@link parents} property directly.
     */
    addElement(depth, element) {
        // discard any elements that are nested >= this one
        while (depth <= this.parents[this.parents.length - 1].depth) {
            this.parents.pop();
        }

        this.parents.push({
            element: element,
            depth: depth
        });

        if (this.maxDepth < this.parents.length - 1) {
            this.maxDepth = this.parents.length - 1;
        }
    }
}
