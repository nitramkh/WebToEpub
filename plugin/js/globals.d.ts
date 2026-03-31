import * as _zip from "@zip.js/zip.js";
import * as _DOMPurify from "dompurify";

declare global {
    export { _zip as zip };
    export { _DOMPurify as DOMPurify };

    export interface Navigator {
        brave?: {
            isBrave?: () => Promise<boolean>;
        };
    };

    export namespace browser.runtime {
        const PlatformNaclArch: "arm" | "x86-32" | "x86-64" | undefined;
    }
}