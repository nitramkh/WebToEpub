class FootnoteExtractor { // eslint-disable-line no-unused-vars
    /**
     * Extract footnotes from script tags contained in `dom`.
     * 
     * @param { Document } dom The document to extract footnotes from.
     * @returns { HTMLSpanElement[] } The found footnotes contained in spans.
     * 
     * @public
     */
    scriptElementsToFootnotes(dom) {
        let indexedFootnotes = new Map();

        [...dom.querySelectorAll("script")]
            .map(s => s.textContent)
            .filter(s => s.includes("toolTips('.classtoolTips"))
            .forEach(s => indexedFootnotes.set(this.getId(s), this.extractFootnoteText(s)));

        return this.getIdsUsedOnPage(dom)
            .map(id => this.makeSpan(indexedFootnotes.get(id), dom));
    }

    /**
     * FIXME: Find ids of span children by looking for class? I don't know.
     * 
     * @param { ParentNode } dom The node to find ids in.
     * @returns { (string | undefined)[] } The found ids?
     * 
     * @private
     */
    getIdsUsedOnPage(dom) {
        /**
         * 
         * @param { HTMLSpanElement } span 
         * @returns { string | undefined }
         */
        let extractId = (span) => [...span.classList]
            .filter(s => s.startsWith("class"))[0];

        return /** @type { HTMLSpanElement[] } */ ([...dom.querySelectorAll("span.tooltipsall")])
            .map(extractId);
    }

    /**
     * Extract the id from a script.
     * 
     * @param { string } script The script contents.
     * @returns { string } The found id.
     * 
     * @private
     */
    getId(script) {
        return this.extractSubstring(script, "toolTips('.", ",").replace("'", "");
    }

    /**
     * Create a span containing `content` based on `dom`.
     * 
     * @param { string } content The span content.
     * @param { Document } dom The document to create element from.
     * @returns { HTMLSpanElement } The created span.
     * 
     * @private
     */
    makeSpan(content, dom) {
        let span = dom.createElement("span");
        span.textContent = content;

        return span;
    }

    /**
     * Extract the footnote text from raw content.
     * 
     * @param { string } content The string to extract from.
     * @returns { string } The extracted text.
     * 
     * @private
     */
    extractFootnoteText(content) {
        return this.extractSubstring(content, "tt_store_content = \"", "\"; toolTips('");
    }

    /**
     * Extract a section of `content` between `startTag` and `endTag`
     * (exclusive).
     * 
     * @param { string } content The string to extract the substring from.
     * @param { string } startTag The prefix to look for; not included in output.
     * @param { string } endTag The suffix to look for; not included in output.
     * @returns { string } The found substring.
     * 
     * @private
     */
    extractSubstring(content, startTag, endTag) {
        content = content.substring(content.indexOf(startTag) + startTag.length);

        return content.substring(0, content.indexOf(endTag));
    }
}
