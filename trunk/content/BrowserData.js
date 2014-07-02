"use strict";

let EXPORTED_SYMBOLS = ["BrowserData"];

Components.utils["import"]("resource://furiganainserter/utilities.js");

function BrowserData (tab) {
    this._ss = getSessionStore();
    this._tab = tab;
}

Object.defineProperty(BrowserData.prototype, 'isClipboardMonitoringEnabled', {
    get: function () {
        return this._ss.getTabValue(this._tab, "fiIsClipboardMonitoringEnabled") === "true";
    },
    set: function (value) {
        this._ss.setTabValue(this._tab, "fiIsClipboardMonitoringEnabled", value.toString());
    }
});

Object.defineProperty(BrowserData.prototype, 'isPopupEnabled', {
    get: function () {
        return this._ss.getTabValue(this._tab, "fiIsPopupEnabled") === "true";
    },
    set: function (value) {
        this._ss.setTabValue(this._tab, "fiIsPopupEnabled", value.toString());
    }
});

Object.defineProperty(BrowserData.prototype, 'alphabet', {
    get: function () {
        return this._ss.getTabValue(this._tab, "fiFuriganaAlphabet");
    },
    set: function (value) {
        this._ss.setTabValue(this._tab, "fiFuriganaAlphabet", value);
    }
});

BrowserData.prototype.toString = function () {
    return JSON.stringify(this);
};
