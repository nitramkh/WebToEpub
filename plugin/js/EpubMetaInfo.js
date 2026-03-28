"use strict";

/**
 * Wrapper for EPUB information.
 * 
 * Any EPUB we create should have following info
 * <param name="uuid" type="string">identifier for this EPUB.  (i.e. "origin" URL story was downloaded from)</param>
 * <param name="title" type="string">The Title of the story</param>
 * <param name="author" type="string">The writer of the story</param>
 * <param name="language" type="string">Language code of story. Defaults to "en" (English)</param>
 * <param name="seriesName" type="string">If book is part of series, has name of series.  null if not part of a series</param>
 * <param name="seriesIndex" type="string">If book is part of series, has index of book in series.  null if not part of a series</param>
 */
class EpubMetaInfo {
    /**
     * Unique identifier for EPUB. Usually the URL of the main ToC page, but
     * defaults to a localized string message.
     * 
     * @type { string }
     * @public
     */
    uuid;

    /**
     * The title of the EPUB.
     * 
     * @type { string }
     * @public
     */
    title;

    /**
     * The author of the EPUB/novel; defaults to unknown.
     * 
     * @type { string }
     * @public
     */
    author;

    /**
     * The language the novel is in; defaults to english.
     * 
     * @type { string }
     * @public
     */
    language;

    /**
     * The filename to use for the EPUB; defaults to "web.epub".
     * 
     * @type { FilenameString }
     * @public
     */
    fileName;

    /**
     * The subject/tag line of the EPUB/novel; defaults to empty.
     * 
     * @type { string }
     * @public
     */
    subject;

    /**
     * The description of the EPUB/novel; defaults to empty.
     * 
     * @type { string }
     * @public
     */
    description;

    /**
     * The name of the series, or null if not part of a series.
     * 
     * @type { string | null }
     * @public
     */
    seriesName;

    /**
     * The volume of the series, it is probably a number but doesn't have to be;
     * or null if not set.
     * 
     * @type { string | null }
     * @public
     */
    seriesIndex;

    /**
     * The stylesheet to use in the EPUB as a string; defaults to
     * `EpubMetaInfo.getDefaultStyleSheet`.
     * 
     * @type { string }
     * @public
     */
    styleSheet;

    /**
     * The translator of the EPUB contents, null if unknown or no translator.
     * 
     * @type { string | null }
     * @public
     */
    translator;

    /**
     * The EPUB author fetched from the UI input; or null if not set.
     * 
     * @type { string | null }
     * @public
     */
    fileAuthorAs;

    /**
     * @public
     */
    constructor() {
        this.uuid = UIText.Default.uuid;
        this.title = UIText.Default.title;
        this.author = UIText.Default.author;

        this.language = "en";
        this.fileName = "web.epub";
        this.subject = "";
        this.description = "";
        this.seriesName = null;
        this.seriesIndex = null;
        this.styleSheet = EpubMetaInfo.getDefaultStyleSheet();
        this.translator = null;
        this.fileAuthorAs = null;
    }

    /**
     * Get `this.fileAuthorAs`, or use `this.author` as fallback.
     * 
     * @returns { string } The found author.
     * 
     * @public
     */
    getFileAuthorAs() {
        // FIXME: Should this also check for undefined?
        return (this.fileAuthorAs === null) ? this.author : this.fileAuthorAs;
    }

    /**
     * Get the default stylesheet for a created epub.
     * 
     * @returns { string } The stylesheet as a literal string.
     * 
     * @public
     */
    static getDefaultStyleSheet() {
        return ""+
        // Style for svg images. I got this from BTE-Gen epunbs. Works nicely.
        "div.svg_outer {\r"+
        "   display: block;\r"+
        "   margin-bottom: 0;\r"+
        "   margin-left: 0;\r"+
        "   margin-right: 0;\r"+
        "   margin-top: 0;\r"+
        "   padding-bottom: 0;\r"+
        "   padding-left: 0;\r"+
        "   padding-right: 0;\r"+
        "   padding-top: 0;\r"+
        "   text-align: left;\r"+
        "}\r"+
        "div.svg_inner {\r"+
        "   display: block;\r"+
        "   text-align: center;\r"+
        "}\r"+

        // Centered headings and some margin to make sure it's not too close to the content.
        "h1, h2 {\r"+
        "   text-align: center;\r"+
        "   margin-bottom: 10%;\r"+
        "   margin-top: 10%;\r"+
        "}\r"+
        "h3, h4, h5, h6 {\r"+
        "   text-align: center;\r"+
        "   margin-bottom: 15%;\r"+
        "   margin-top: 10%;\r"+
        "}\r"+

        // Style for lists. Calibre sometimes has issues with the placement of lists, this fixes it.
        "ol, ul {\r"+
        "   padding-left: 8%;\r"+
        "}\r"+

        "body {\r"+
        "  margin: 2%;\r"+
        "}\r"+

        //Breaks extremely long words, screams, wails etc to fit viewer window.
        "p {\r"+
        "  overflow-wrap: break-word;\r"+
        "}\r"+

        // Prevent texts inside mutliple definition list tags going outside viewer window.
        // Example https://www.baka-tsuki.org/project/index.php?title=The_Unexplored_Summon_Blood_Sign:Volume2_Opening2
        // It looks okay in a browser but in devices with small screen, it's almost unreadable.
        "dd, dt, dl {\r"+
        "  padding: 0;\r"+
        "  margin: 0;\r"+
        "}\r"+

        "img {\r"+
        "   display: block;\r"+
        "   min-height: 1em;\r"+
        "   max-height: 100%;\r"+
        "   max-width: 100%;\r"+
        "   padding-bottom: 0;\r"+
        "   padding-left: 0;\r"+
        "   padding-right: 0;\r"+
        "   padding-top: 0;\r"+
        "   margin-left: auto;\r"+
        "   margin-right: auto;\r"+
        "   margin-bottom: 2%;\r"+
        "   margin-top: 2%;\r"+
        "}\r"+

        // images embedded in sentances (e.g. Emoji)
        "img.inline {\r"+
        "   display: inline;\r"+
        "   min-height: 1em;\r"+
        "   margin-bottom: 0;\r"+
        "   margin-top: 0;\r"+
        "}\r"+

        // differentiate caption text from body text 
       ".thumbcaption {\r"+
       "  display: block;\r"+
       "  font-size: 0.9em;\r"+
       "  padding-right: 5%;\r"+
       "  padding-left: 5%;\r"+
       "}\r"+
       
        // To make hr tags more visible. BT doesn't use them very often but other sites might.
        "hr {\r"+
        "   color: black;\r"+
        "   background-color: black;\r"+
        "   height: 2px;\r"+
        "}\r"+

        // Styling all links.
        "a:link {\r"+
        "   text-decoration: none;\r"+
        "   color: #0B0080;\r"+
        "}\r"+
        "a:visited {\r"+
        "   text-decoration: none;\r"+
        "}\r"+
        "a:hover {\r"+
        "   text-decoration: underline;\r"+
        "}\r"+
        "a:active {\r"+
        "   text-decoration: underline;\r"+
        "}"+

        "table {\r"+
        "   width: 90%;\r"+
        "   border-collapse: collapse;\r"+
        "}\r"+
        "table, th, td {\r"+
        "   border: 1px solid black;\r"+
        "}\r"+

        // Box around author notes
        ".webToEpub-author-note {\r" +
        "    border: 1px solid black; padding: 0.5em\r" +
        "}";
    }

    /**
     * Generate `EpubAddMetaInfo` from novel updates or error out.
     * 
     * NOTE: This kinda throws by calling out to `ErrorLog` if the url
     *       isn't novelupdates.
     * 
     * @param { ParentNode } dom The dom to extract information from. 
     * @param { UrlString } url The url to use to look for info.
     * @param { boolean } allTags Whether to look for all tags.
     * @returns { EpubAddMetaInfo } The found information.
     * 
     * @public
     */
    static getEpubMetaAddInfo(dom, url, allTags) {
        let metaAddInfo = new EpubAddMetaInfo();

        //novelupdates
        if (url.includes("novelupdates.com") == true) {
            metaAddInfo.subject = EpubMetaInfo.addSubjectNovelupdate(dom, allTags);
            metaAddInfo.description = EpubMetaInfo.addDescriptionNovelupdate(dom);
            metaAddInfo.author = EpubMetaInfo.addAuthorNovelupdate(dom);
        } else {
            let test = "Error: Fetch of URL '" + url + "' failed to fetch please check if website is novelupdates.com";
            ErrorLog.showErrorMessage(test);
        }

        return metaAddInfo;
    }

    /**
     * Extract tags based on novelupdates specific selectors.
     * 
     * @param { ParentNode } dom The node to look for tags in.
     * @param { boolean } allTags Whether to look for all tags.
     * @returns { string } The found tags as a comma separated string.
     * 
     * @private
     */
    static addSubjectNovelupdate(dom, allTags) {
        let selector = "#seriesgenre .genre";

        if (allTags) {
            selector += ", #showtags .genre";
        }

        return EpubMetaInfo.buildSubjectFromTags(dom, selector);
    }

    /**
     * Try to find and clean up description from `dom`.
     * 
     * @param { ParentNode } dom The node to look for the description in.
     * @returns { string } The found description.
     * 
     * @private
     */
    static addDescriptionNovelupdate(dom) {
        return dom.querySelector("#editdescription").textContent.replace(/\n+/g, "\n").replace(/\n/g, "\n\n");
    }
    
    /**
     * Extract author from novelupdates node.
     * 
     * @param { ParentNode } dom The node to extract author from.
     * @returns { string } The found author.
     * 
     * @private
     */
    static addAuthorNovelupdate(dom) {
        return dom.querySelector("#authtag").textContent;
    }

    /**
     * Extract tags and compile them into a single comma separated string.
     * 
     * @param { ParentNode } dom The node to look for the tags in.
     * @param { string } selector The selector to use to find tags.
     * @returns { string } Comma separated string of all found tags.
     * 
     * @private
     */
    static buildSubjectFromTags(dom, selector) {
        return [...dom.querySelectorAll(selector)]
            .map(e => EpubMetaInfo.decensor(e.textContent.trim()))
            .join(", ");
    }

    /**
     * Get uncensored version of known tags.
     * 
     * @param { string } tag The potentially censored tag.
     * @returns { string } The uncensored tag, or unchanged if it wasn't censored.
     * 
     * @private
     */
    static decensor(tag) {
        if (tag.includes("*")) {
            for (let j = 0; j < EpubMetaInfo.decensorList.length; j += 2) {
                let cyphertext = EpubMetaInfo.decensorList[j];
                let cleartext = EpubMetaInfo.decensorList[j + 1];

                if (tag.includes(cyphertext)) {
                    tag = tag.replace(cyphertext, cleartext);
                }
            }
        }

        return tag;
    }
}

/**
 * Pairs of terms, first being the censored term, and second being the
 * corresponding uncensored term.
 * 
 * @type { string[] }
 * @public
 */
EpubMetaInfo.decensorList = [
    "Ab*se", "Abuse",
    "An*l", "Anal",
    "B*tch", "Bitch",
    "C*astity", "Chastity",
    "C*ck", "Cock",
    "C*nnilingus", "Cunnilingus",
    "C*otch", "Crotch",
    "E*oge", "Eroge",
    "Ens*aved", "Enslaved",
    "Erot*c", "Erotic",
    "F**anari", "Futanari",
    "F**k", "Fuck",
    "F*llatio", "Fellatio",
    "H**ny", "Horny",
    "H*ndjob", "Handjob",
    "Imp**gnation", "Impregnation",
    "In*est", "Incest",
    "Interc**rse", "Intercourse",
    "M*sturbation", "Masturbation",
    "N*dist", "Nudist",
    "On**ole", "Onahole",
    "Or*y", "Orgy",
    "P**is", "Penis",
    "P*rnographic", "Pornographic",
    "Pe*vert", "Pervert",
    "Prostit**es", "Prostitutes",
    "R*pe", "Rape",
    "S**ked", "Sucked",
    "S**tty", "Slutty",
    "S*ave", "Slave",
    "S*men", "Semen",
    "S*um", "Scum",
    "S*x", "Sex",
    "s*x", "sex",
    "Su*cide", "Suicide",
    "Tr*sh", "Trash",
    "Virg*n", "Virgin"
];

/**
 * Class container for additional meta information, such as from Novelupdates.
 */
class EpubAddMetaInfo {
    /**
     * The epub/novel subject or tag line.
     * 
     * @type { string }
     * @public
     */
    subject;

    /**
     * The epub/novel description.
     * 
     * @type { string }
     * @public
     */
    description;

    /**
     * The author(s) name.
     * 
     * @type { string }
     * @public
     */
    author;

    /**
     * @public
     */
    constructor() {
        this.subject = "";
        this.description = "";
        this.author = "";
    }
}