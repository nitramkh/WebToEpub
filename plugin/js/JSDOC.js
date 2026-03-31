/**
 * @typedef { string } UrlString
 */

/**
 * @typedef { string } HostnameString
 */

/**
 * @typedef { string } FilenameString
 */

/**
 * @typedef { string } ParserNameString
 */

/**
 * @typedef { HTMLElement["id"] } HTMLIDString
 */

/**
 * @typedef { string } UserPreferenceKeyString
 */

/**
 * @typedef { object } ChapterLink
 * @property { UrlString } sourceUrl
 * @property { string } title
 * @property { string | null } [newArc]
 * @property { Set<UrlString> } [nextPrevChapters]
 * @property { boolean } [isIncludeable]
 * @property { boolean } [previousDownload]
 * @property { Document } [rawDom]
 * @property { HTMLElement } [row]
 * @property { Parser } [parser]
 * @property { Error } [error]
 */

/**
 * @typedef { object } RetryBehavior
 * @property { number[] } retryDelay
 * @property { boolean } promptUser
 * @property { number } [HTTP]
 */

/**
 * @typedef { object } WrapFetchOptions
 * @property { FetchResponseHandler } responseHandler
 * @property { FetchErrorHandler } errorHandler
 * @property { (response: Response) => TextDecoder } [makeTextDecoder]
 * @property { Parser } [parser]
 * @property { RequestInit } fetchOptions
 * @property { RetryBehavior } [retry]
 */

/**
 * @typedef { object } CustomErrorResponse
 * @property { UrlString } url
 * @property { WrapFetchOptions } wrapOptions
 * @property { Response } response
 * @property { string } [errorMessage]
 */

/**
 * @callback ParserConstructor
 * @param { UrlString } [url]
 * @returns { Parser | undefined }
 */

/**
 * @callback ParserRuleTestFunction
 * @param { UrlString } url
 * @param { Document } dom
 * @returns { number } 
 */

/**
 * @callback ParserUrlRuleTestFunction
 * @param { UrlString } url
 * @returns { number }
 */

/**
 * @typedef { object } ParserRule
 * @property { ParserRuleTestFunction } test
 * @property { ParserConstructor } constructor
 */

/**
 * @typedef { object } ParserUrlRule
 * @property { ParserUrlRuleTestFunction } test
 * @property { ParserConstructor } constructor
 */

/**
 * @typedef { object } ParserManualSelect
 * @property { ParserNameString } name
 * @property { ParserConstructor } constructor
 */

/**
 * @typedef { object } CustomErrorMessage
 * @property { (() => void) | undefined } retryAction
 * @property { (() => void) | undefined } cancelAction
 * @property { string } cancelLabel
 * @property { UrlString | undefined } openurl
 * @property { UrlString | undefined } blockurl
 */

/**
 * @callback UserPreferencesUpdateHandler
 * @param { UserPreferences } userPreferences
 */

/**
 * @typedef { object } UserPreferencesObserver
 * @property { UserPreferencesUpdateHandler } onUserPreferencesUpdate
 */

/**
 * FIXME: This is not great; and usages should use [""] accessors instead of
 *        needing this.
 * @typedef { object } DatasetContext
 * @property { DOMStringMap } dataset
 * @property { string } [dataset.libclick]
 */

/**
 * @typedef { object } TOCChapterInfo
 * @property { number } depth
 * @property { string } title
 * @property { UrlString } src
 */

/**
 * @typedef { ReadingListEpubLastUrl | ReadingListHistory } ReadingListEpub
 */

/**
 * @typedef { object } ReadingListEpubLastUrl
 * @property { UrlString } toc
 * @property { UrlString } lastUrl
 * @property { UrlString[] } [history]
 */

/**
 * @typedef { object } ReadingListHistory
 * @property { UrlString } toc
 * @property { UrlString[] } history
 * @property { UrlString } [lastUrl]
 */

/**
 * @typedef { FileReader & {
 *     LibStorageValueURL: UrlString | undefined
 *     LibStorageValueFilename: FilenameString | undefined
 *     LibStorageValueId: string | number | undefined
 *     NewChapterCount: number | undefined
 * } } LibFileReader
 */

/**
 * @typedef { Pick<browser.downloads._DownloadOptions, Extract<keyof browser.downloads._DownloadOptions, keyof chrome.downloads.DownloadOptions>> } CommonDownloadOptions
 */

/**
 * @typedef { Pick<browser.downloads._OnChangedDownloadDelta, Extract<keyof browser.downloads._OnChangedDownloadDelta, keyof chrome.downloads.DownloadDelta>> } CommonDownloadDelta
 */

/**
 * @typedef { object } DefaultParserConfig
 * @property { UrlString } testUrl
 * @property { string } contentCss
 * @property { string } titleCss
 * @property { string } removeCss
 */

/**
 * @typedef { object } DefaultParserLogic
 * @property { (dom: Document) => Element } findContent
 * @property { (dom: Document) => Element | string | null } findChapterTitle
 * @property { (element: Element) => void } removeUnwanted
 */

/**
 * @typedef { object } ChapterFilter
 * @property { HTMLTableRowElement } row
 * @property { string[] } values
 * @property { string } valueString
 */

/**
 * @typedef { object } ChapterFilterTerm
 * @property { string } key
 * @property { number } value
 */

/**
 * @typedef { object } ChapterFilters
 * @property { {} | ChapterFilterTerm[] } filterTermsFrequency
 * @property { {} | ChapterFilter[] } chapterList
 * @property { () => void } init
 * @property { () => void } Filter
 * @property { () => HTMLTableElement } generateFiltersTable
 */

/**
 * @typedef { object } ChapterFormResult
 * @property { string } key
 * @property { FormDataEntryValue } searchType
 * @property { FormDataEntryValue } value
 */