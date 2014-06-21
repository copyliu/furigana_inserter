"use strict";

let EXPORTED_SYMBOLS = ["revertElement", "revertRange"];

Components.utils["import"]("resource://furiganainserter/utilities.js");
Components.utils["import"]("resource://furiganainserter/RangeNodeIterator.js");

function revertElementSimple (elem) {
    let rubys = getNodesByXPath(elem, ".//ruby[@class='fi']");
    rubys.forEach(revertRuby);
}

function revertRangeSimple (range) {
    let rubys = [];
    for (let node of RangeNodeIterator(range)) {
        if (node.nodeName === "RUBY" && node.getAttribute("class") === 'fi') {
            rubys.push(node);
        }
    }

    // document fragment to hold ruby/rb/* nodes
    rubys.forEach(revertRuby);
}

function revertRuby (ruby) {
    let fragment = ruby.ownerDocument.createDocumentFragment();
    let nodes = getNodesByXPath(ruby, "rb/*|rb/text()");
    nodes.forEach(function (node) {
        fragment.appendChild(node);
    });
    let parentNode = ruby.parentNode;
    parentNode.replaceChild(fragment, ruby);
    parentNode.normalize();
}

function revertElement (elem) {
    let spans = getNodesByXPath(elem, ".//span[@class='fi']");
    spans.forEach(revertSpan);
    revertElementSimple(elem);
}

function revertRange (range) {
    let nodes = [];
    for (let node of RangeNodeIterator(range)) {
        if (node.nodeName === 'SPAN' && node.getAttribute("class") === 'fi') {
            nodes.push(node);
        }
    }
    nodes.forEach(function (node) {
        revertElementSimple(node);
        revertSpan(node);
    });
    revertRangeSimple(range);
}

function revertSpan (span) {
    let range = span.ownerDocument.createRange();
    range.selectNodeContents(span);
    // document fragment to hold span/* nodes
    let fragment = range.extractContents();
    let parentNode = span.parentNode;
    parentNode.replaceChild(fragment, span);
    parentNode.normalize();
}
