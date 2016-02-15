"use strict";

var EXPORTED_SYMBOLS = ["createInserter"];

Components.utils["import"]("resource://gre/modules/Task.jsm");
Components.utils["import"]("resource://gre/modules/devtools/Console.jsm");

Components.utils["import"]("resource://furiganainserter/utilities.js");
Components.utils["import"]("resource://furiganainserter/ruby.js");
Components.utils["import"]("resource://furiganainserter/getRangeNodes.js");
Components.utils["import"]("resource://furiganainserter/parse.js");

var Ci = Components.interfaces;
var Cc = Components.classes;
var XPathResult = Ci.nsIDOMXPathResult;

function isTextNotInRuby(node) {
    let expr = "self::text() and not(ancestor::ruby)";
    let doc = node.ownerDocument;
    if (!jRegex.test(node.data)) {
        return false;
    } else {
        return doc.evaluate(expr, node, null, XPathResult.BOOLEAN_TYPE, null).booleanValue;
    }
}

function createInserter(alphabet) {
    let inserter = null;
    let tokenize = getPrefs().getPref("tokenize");
    if (alphabet === "hiragana") {
        inserter = new Inserter(tokenize ? new HiraganaComplex() : new HiraganaSimple());
    } else if (alphabet === "katakana") {
        inserter = new Inserter(tokenize ? new KatakanaComplex() : new KatakanaSimple());
    } else if (alphabet === "romaji") {
        inserter = new Inserter(tokenize ? new RomajiComplex() : new RomajiSimple());
    } else {
        throw new Error("unknown alphabet: " + alphabet);
    }
    return inserter;
}

function Inserter(rubyCreator) {
    this._rubyCreator = rubyCreator;
}

Inserter.prototype.doRangeAsync = function (range) {
    let textNodes = [];
    for (let textNode of getTextNodesFromRange(range)) {
        if (isTextNotInRuby(textNode.node)) {
            textNodes.push(textNode);
        }
    }
    let that = this;
    let texts = textNodes.map(function (textNode) {
        return textNode.getText();
    });
    return Task.spawn(function* () {
        // an array of arrays of tagger nodes
        let mecabWorker = getMecabWorker();
        let taggerNodes = yield mecabWorker.getNodesAsync(texts);
        taggerNodes.forEach(function (taggerNodes, i) {
            that.doitRight(taggerNodes, textNodes[i]);
        });
    });
};

// taggerNodes: nodes from Mecab, node: the text node from the document
Inserter.prototype.doitRight = function (taggerNodes, textNode) {
    let text = textNode.getText();
    let node = textNode.node;
    let doc = node.ownerDocument;
    let spans = getSpans(taggerNodes);
    if (spans.length === 0) {
        return;
    }
    let rubyHtml = this._rubyCreator.createSpan(text, spans);
    let div = doc.createElement("div");
    div.innerHTML = rubyHtml;
    let fragment = doc.createDocumentFragment();
    while (div.firstChild) {
        fragment.appendChild(div.firstChild);
    }
    node.parentNode.replaceChild(fragment, textNode.split().node);
};

Inserter.prototype.doElementAsync = function (elem) {
    let range = elem.ownerDocument.createRange();
    range.selectNode(elem);
    return this.doRangeAsync(range);
};
