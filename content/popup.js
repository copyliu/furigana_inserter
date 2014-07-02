"use strict";

let EXPORTED_SYMBOLS = ["Popup"];

Components.utils["import"]("resource://furiganainserter/utilities.js");

let XPathResult = Components.interfaces.nsIDOMXPathResult;
let Range = Components.interfaces.nsIDOMRange;
let Node = Components.interfaces.nsIDOMNode;

function Popup(panel, dictSearcher) {
    this._timer = null;
    this._panel = panel;
    this._currentDictionary = 0;
    this._searchResults = [];
    this._word = "";
    this._dictSearcher = dictSearcher;
    this._target = null;
}

Object.defineProperty(Popup.prototype, 'word', {
    get: function () {
        return this._word;
    }
});
Object.defineProperty(Popup.prototype, 'timer', {
    get: function () {
        return this._timer;
    }
});

Popup.prototype.showNext = function () {
    if (this._searchResults.length === 0) {
        return;
    }
    this._currentDictionary++;
    this._currentDictionary %= this._searchResults.length;
    let searchResult = this._searchResults[this._currentDictionary];
    let word = this._word.substring(0, searchResult.matchLen);
    let text = this._dictSearcher.makeHtml(searchResult);
    text += this.kanjiSearch(word);
    if (text === "") {
        return;
    }
    let iframe = this._panel.ownerDocument.getElementById("furigana-inserter-iframe");
    let div = iframe.contentDocument.getElementById("furigana-inserter-window");
    div.innerHTML = text;
};

Popup.prototype.show = function (event) {
    if (event.shiftKey || event.ctrlKey) {
        return;
    }
    if (!this._dictSearcher) {
        return;
    }
    if (this.isSameElement(event) || this.isInRange(event)) {
        return;
    }
    let that = this;
    this._target = event.target;
    let window = this._panel.ownerDocument.defaultView;
    if (this._timer) {
        window.clearTimeout(this._timer);
    }
    this._timer = window.setTimeout(function () {
        let text = that.getBasicForm(event.target);
        that.lookupAndShowAt(text, event.screenX, event.screenY);
    }, getPrefs().getPref("popup_delay"));
};

Popup.prototype.isInRange = function (event) {
    let win = event.view;
    let selection = win.getSelection();
    if (selection.rangeCount === 0 || selection.isCollapsed) {
        return false;
    }
    let curRange = selection.getRangeAt(0);
    let newRange = win.document.createRange();
    newRange.setStart(event.rangeParent, event.rangeOffset);
    newRange.setEnd(event.rangeParent, event.rangeOffset);
    return (newRange.compareBoundaryPoints(Range.START_TO_START, curRange) >= 0 &&
        newRange.compareBoundaryPoints(Range.END_TO_END, curRange) < 0);
};

Popup.prototype.kanjiSearch = function (word) {
    let text = "", searchResult = null;
    for (let i = 0; i < word.length; ++i) {
        let c = word.charAt(i);
        if (c < "\u3400" || c > "\u9FCF") {
            continue;
        }
        let result = this._dictSearcher.kanjiSearch(c);
        if (searchResult) {
            searchResult.entries.push(...result.entries);
        } else {
            searchResult = result;
        }
    }
    if (searchResult) {
        text = this._dictSearcher.makeHtml(searchResult);
    }
    return text;
};

Popup.prototype.isVisible = function () {
    return this._panel.state === "open";
};

Popup.prototype.getBasicForm = function (target) {
    let doc = target.ownerDocument;
    let expr = "ancestor-or-self::rt";
    let type = XPathResult.BOOLEAN_TYPE;
    let isInRT = doc.evaluate(expr, target, null, type, null).booleanValue;
    if (isInRT) {
        return "";
    }
    expr = "ancestor-or-self::*[(self::ruby or self::span) and @data-bf and @class='fi']";
    type = XPathResult.FIRST_ORDERED_NODE_TYPE;
    let node = doc.evaluate(expr, target, null, type, null).singleNodeValue;
    return node ? node.getAttribute("data-bf") : "";
};

Popup.prototype.isSameElement = function (event) {
    return (this._target === event.target);
};

Popup.prototype.hide = function () {
    if (this._panel.hasAttribute("noautohide")) {
        return;
    }
    if (this._panel.state === "open") {
        this._panel.hidePopup();
    }
    this._dictSearcher.moveToTop(this._currentDictionary);
    this._currentDictionary = 0;
};

Popup.prototype.lookupAndShowAt = function (word, screenX, screenY) {
    this._word = word;
    this.hide();
    if (word === "") {
        return;
    }
    let text = "";
    let searchResult = null;
    this._searchResults = this._dictSearcher.wordSearch(word);
    if (this._searchResults.length > 0) {
        searchResult = this._searchResults[0];
        text += this._dictSearcher.makeHtml(searchResult);
    }
    text += this.kanjiSearch(word);
    this.showTextAt(text, screenX, screenY);
};

Popup.prototype.showTextAt = function (text, screenX, screenY) {
    if (text === "") {
        return;
    }
    let win = this._panel.ownerDocument.defaultView;
    let iframe = win.document.getElementById("furigana-inserter-iframe");
    iframe.width = "600";
    iframe.height = "400";
    this._panel.width = "600";
    this._panel.height = "400";
    let x = screenX;
    let y = screenY;
    let offset = 25;
    let height = this._panel.boxObject.height;
    let div = iframe.contentDocument.getElementById("furigana-inserter-window");
    div.innerHTML = text;
    if ((y + offset + height) > (win.screen.top + win.screen.height)) {
        this._panel.openPopupAtScreen(x, y - (offset + height), false);
    } else {
        this._panel.openPopupAtScreen(x, y + offset, false);
    }
};
