"use strict";

var EXPORTED_SYMBOLS = ["revertElement", "revertRange"];

Components.utils["import"]("resource://furiganainserter/utilities.js");

function revertElementSimple (elem) {
    var rubys = getNodesByXPath(elem, ".//ruby[@class='fi']");
    rubys.forEach(revertRuby);
}

function revertRangeSimple (range) {
    var rubys = [], node;
    var iter = new RangeNodeIterator(range);
    while ((node = iter.nextNode()))
        if (node.nodeName === "RUBY" && node.getAttribute("class") === 'fi')
            rubys.push(node);

    // document fragment to hold ruby/rb/* nodes
    rubys.forEach(revertRuby);
}

function revertRuby (ruby) {
    var fragment = ruby.ownerDocument.createDocumentFragment();
    var nodes = getNodesByXPath(ruby, "rb/*|rb/text()");
    nodes.forEach(function (node) {
        fragment.appendChild(node);
    });
    var parentNode = ruby.parentNode;
    parentNode.replaceChild(fragment, ruby);
    parentNode.normalize();
}

function revertElement (elem) {
    var spans = getNodesByXPath(elem, ".//span[@class='fi']");
    spans.forEach(revertSpan);
    revertElementSimple(elem);
}

function revertRange (range) {
    var nodes = [], node;
    var iter = new RangeNodeIterator(range);
    while ((node = iter.nextNode()))
        if (node.nodeName === 'SPAN' && node.getAttribute("class") === 'fi')
            nodes.push(node);
    nodes.forEach(function (node) {
        revertElementSimple(node);
        revertSpan(node);
    });
    revertRangeSimple(range);
}

function revertSpan (span) {
    var range = span.ownerDocument.createRange();
    range.selectNodeContents(span);
    // document fragment to hold span/* nodes
    var fragment = range.extractContents();
    var parentNode = span.parentNode;
    parentNode.replaceChild(fragment, span);
    parentNode.normalize();
}
