
"use strict";


/**
 * Functions to help debugging.  Not included in release product
 */
class DebugUtil { // eslint-disable-line no-unused-vars
    /**
     * @private
     */
    constructor() {}

    /**
     * Convert a byte to hex.
     * 
     * @param { number } e The byte.
     * @returns { string } The byte as hex.
     * 
     * @public
     */
    static byteToHex(e) {
        let temp = "0" + e.toString(16);

        return temp.substring(temp.length - 2);
    }

    /**
     * Convert an array/buffer into a hex string.
     * 
     * @param { ArrayBuffer | ArrayLike<number> } buf The buffer to convert.
     * @returns { string } The buffer as a hex string.
     * 
     * @public
     */
    static bufToHex(buf) {
        return new Uint8Array(buf)
            .reduce((p, c) => p + DebugUtil.byteToHex(c), "");
    }
}

