"use strict";

let EXPORTED_SYMBOLS = ["Popup"];

Components.utils["import"]("resource://furiganainserter/utilities.js");
let XPathResult = Components.interfaces.nsIDOMXPathResult;
let Range = Components.interfaces.nsIDOMRange;
let Node = Components.interfaces.nsIDOMNode;

let prefs = new Preferences("extensions.furiganainserter.");

function Popup (panel, dict) {
    this.timer = null;
    this.panel = panel;
    this.currentDictionary = 0;
    this.searchResults = [];
    this.word = "";
    this.dict = dict;
    this.target = null;
}

Popup.prototype.showNext = function () {
    if (this.searchResults.length === 0) {
        return;
    }
    this.currentDictionary++;
    this.currentDictionary %= this.searchResults.length;
    let searchResult = this.searchResults[this.currentDictionary];
    let word = this.word.substring(0, searchResult.matchLen);
    let text = this.dict.makeHtml(searchResult);
    text += this.kanjiSearch(word);
    if (text === "") {
        return;
    }
    let iframe = this.panel.ownerDocument.getElementById("furigana-inserter-iframe");
    let div = iframe.contentDocument.getElementById("furigana-inserter-window");
    div.innerHTML = text;
};

Popup.prototype.show = function (event) {
    if (event.shiftKey || event.ctrlKey) {
        return;
    }
    if (!this.dict) {
        return;
    }
    if (this.sameElement(event) || this.inRange(event)) {
        return;
    }
    let that = this;
    this.rangeParent = event.rangeParent;
    this.rangeOffset = event.rangeOffset;
    this.target = event.target;
    let window = this.panel.ownerDocument.defaultView;
    if (this.timer) {
        window.clearTimeout(this.timer);
    }
    this.timer = window.setTimeout(function () {
        that.show1(event);
    }, prefs.getPref("popup_delay"));
};

Popup.prototype.inRange = function (event) {
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
        let result = this.dict.kanjiSearch(c);
        if (searchResult) {
            searchResult.entries.push(...result.entries);
        } else {
            searchResult = result;
        }
    }
    if (searchResult) {
        text = this.dict.makeHtml(searchResult);
    }
    return text;
};

Popup.prototype.isVisible = function () {
    return this.panel.state === "open";
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

Popup.prototype.sameElement = function (event) {
    return (this.target === event.target);
};

Popup.prototype.hide = function () {
    let panel = this.panel;
    if (panel.hasAttribute("noautohide")) {
        return;
    }
    if (panel.state === "open") {
        panel.hidePopup();
    }
    this.dict.moveToTop(this.currentDictionary);
    this.currentDictionary = 0;
};

Popup.prototype.show1 = function (event) {
    let text = "";
    text = this.getBasicForm(event.target);
    this.lookupAndShowAt(text, event.screenX, event.screenY);
};

Popup.prototype.lookupAndShowAt = function (word, screenX, screenY) {
    this.word = word;
    this.hide();
    if (word === "") {
        return;
    }
    let text = "";
    let searchResult = null;
    this.searchResults = this.dict.wordSearch(word);
    if (this.searchResults.length > 0) {
        searchResult = this.searchResults[0];
        text += this.dict.makeHtml(searchResult);
    }
    text += this.kanjiSearch(word);
    this.showTextAt(text, screenX, screenY);
};

Popup.prototype.showTextAt = function (text, screenX, screenY) {
    if (text === "") {
        return;
    }
    let panel = this.panel;
    let win = panel.ownerDocument.defaultView;
    let iframe = win.document.getElementById("furigana-inserter-iframe");
    iframe.width = "600";
    iframe.height = "400";
    panel.width = "600";
    panel.height = "400";
    let x = screenX;
    let y = screenY;
    let offset = 25;
    let height = panel.boxObject.height;
    let div = iframe.contentDocument.getElementById("furigana-inserter-window");
    div.innerHTML = text;
    if ((y + offset + height) > (win.screen.top + win.screen.height)) {
        panel.openPopupAtScreen(x, y - (offset + height), false);
    } else {
        panel.openPopupAtScreen(x, y + offset, false);
    }
};
