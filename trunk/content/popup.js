"use strict";

var EXPORTED_SYMBOLS = ["Popup"];

Components.utils["import"]("resource://furiganainserter/utilities.js");
var XPathResult = Components.interfaces.nsIDOMXPathResult;
var Range = Components.interfaces.nsIDOMRange;
var Node = Components.interfaces.nsIDOMNode;

var prefs = new Preferences("extensions.furiganainserter.");

var inlineNames = {
    // text node
    "#text" : true,

    // fontstyle
    "TT" : true,
    "I" : true,
    "B" : true,
    "BIG" : true,
    "SMALL" : true,
    // deprecated
    "STRIKE" : true,
    "S" : true,
    "U" : true,

    // phrase
    "EM" : true,
    "STRONG" : true,
    "DFN" : true,
    "CODE" : true,
    "SAMP" : true,
    "KBD" : true,
    "VAR" : true,
    "CITE" : true,
    "ABBR" : true,
    "ACRONYM" : true,

    // special, not included IMG, OBJECT, BR, SCRIPT, MAP, BDO
    "A" : true,
    "Q" : true,
    "SUB" : true,
    "SUP" : true,
    "SPAN" : true,

    // ruby
    "RUBY" : true,
    "RBC" : true,
    "RTC" : true,
    "RB" : true,
    "RT" : true,
    "RP" : true
}

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
    if (this.searchResults.length === 0)
        return;
    this.currentDictionary++;
    this.currentDictionary %= this.searchResults.length;
    var searchResult = this.searchResults[this.currentDictionary];
    var word = this.word.substring(0, searchResult.matchLen);
    var text = this.dict.makeHtml(searchResult);
    text += this.kanjiSearch(word);
    if (text === "")
        return;
    var iframe = this.panel.ownerDocument.getElementById("furigana-inserter-iframe");
    var div = iframe.contentDocument.getElementById("furigana-inserter-window");
    div.innerHTML = text;
}

Popup.prototype.show = function (event) {
    if (event.shiftKey || event.ctrlKey)
        return;
    if (!this.dict)
        return;
    if (this.sameElement(event) || this.inRange(event))
        return;
    var that = this;
    this.rangeParent = event.rangeParent;
    this.rangeOffset = event.rangeOffset;
    this.target = event.target;
    var window = this.panel.ownerDocument.defaultView;
    if (this.timer)
        window.clearTimeout(this.timer);
    this.timer = window.setTimeout(function () {
        that.show1(event);
    }, prefs.getPref("popup_delay"));
}

Popup.prototype.inRange = function (event) {
    var win = event.view;
    var selection = win.getSelection();
    if (selection.rangeCount === 0 || selection.isCollapsed)
        return false;
    var curRange = selection.getRangeAt(0);
    var newRange = win.document.createRange();
    newRange.setStart(event.rangeParent, event.rangeOffset);
    newRange.setEnd(event.rangeParent, event.rangeOffset);
    return (newRange.compareBoundaryPoints(Range.START_TO_START, curRange) >= 0 && newRange
            .compareBoundaryPoints(Range.END_TO_END, curRange) < 0);
}

Popup.prototype.kanjiSearch = function (word) {
    var text = "", searchResult = null, result, c, i;
    for (i = 0; i < word.length; ++i) {
        c = word.charAt(i);
        if (c < "\u3400" || c > "\u9FCF")
            continue;
        result = this.dict.kanjiSearch(c);
        if (searchResult)
            Array.prototype.push.apply(searchResult.entries, result.entries);
        else searchResult = result;
    }
    if (searchResult)
        text = this.dict.makeHtml(searchResult);
    return text;
}

Popup.prototype.isVisible = function () {
    return this.panel.state === "open";
}

Popup.prototype.getBasicForm = function (target) {
    var doc = target.ownerDocument;
    var expr = "ancestor-or-self::rt";
    var type = XPathResult.BOOLEAN_TYPE;
    var isInRT = doc.evaluate(expr, target, null, type, null).booleanValue;
    if (isInRT)
        return "";
    expr = "ancestor-or-self::*[(self::ruby or self::span) and @bf and @class='fi']";
    type = XPathResult.FIRST_ORDERED_NODE_TYPE;
    var node = doc.evaluate(expr, target, null, type, null).singleNodeValue;
    return node ? node.getAttribute("bf") : "";
}

Popup.prototype.sameElement = function (event) {
    return (this.target === event.target);
}

Popup.prototype.hide = function () {
    var panel = this.panel;
    if (panel.hasAttribute("noautohide")) return;
    if (panel.state === "open") panel.hidePopup();
    this.dict.moveToTop(this.currentDictionary);
    this.currentDictionary = 0;
}

Popup.prototype.show1 = function (event) {
    var text = "";
    text = this.getBasicForm(event.target);
    this.lookupAndShowAt(text, event.screenX, event.screenY);
}

Popup.prototype.lookupAndShowAt = function (word, screenX, screenY) {
    this.word = word;
    this.hide();
    if (word === "")
        return;
    var text = "";
    var searchResult = null;
    this.searchResults = this.dict.wordSearch(word);
    if (this.searchResults.length > 0) {
        searchResult = this.searchResults[0];
        text += this.dict.makeHtml(searchResult);
    }
    text += this.kanjiSearch(word);
    this.showTextAt(text, screenX, screenY);
}

Popup.prototype.showTextAt = function (text, screenX, screenY) {
    if (text === "") return;
    var panel = this.panel;
    var win = panel.ownerDocument.defaultView;
    var iframe = win.document.getElementById("furigana-inserter-iframe");
    iframe.width = "600";
    iframe.height = "400";
    panel.width = "600";
    panel.height = "400";
    var x = screenX;
    var y = screenY;
    var offset = 25;
    var height = panel.boxObject.height;
    var div = iframe.contentDocument.getElementById("furigana-inserter-window");
    div.innerHTML = text;
    if ((y + offset + height) > (win.screen.top + win.screen.height))
        panel.openPopupAtScreen(x, y - (offset + height), false);
    else panel.openPopupAtScreen(x, y + offset, false);
}
