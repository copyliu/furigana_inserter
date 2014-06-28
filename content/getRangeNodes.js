"use strict";

let EXPORTED_SYMBOLS = ["getRangeNodes", "getStartTextOffset", "getEndTextOffset",
"splitTextNode", "getTextNodesFromRange"];

let Ci = Components.interfaces;
let Cc = Components.classes;
let XPathResult = Ci.nsIDOMXPathResult;
let Node = Ci.nsIDOMNode;
let NodeFilter = Ci.nsIDOMNodeFilter;

function* getRangeNodes (range) {
    let [start, end] = setup(range);
    yield start;
    if (start === end) {
        return;
    }
    for (let [temp, descend] of upAndRight(start)) {
        yield temp;
        if (temp === end) {
            return;
        }
        if (descend) {
            for (let temp of down(temp)) {
                yield temp;
                if (temp === end) {
                    return;
                }
            }
        }
    }
}

function setup (range) {
    let start = range.startContainer;
    let end = range.endContainer;
    if (!range.collapsed && start.nodeType === Node.ELEMENT_NODE) {
        if (range.startOffset < start.childNodes.length) {
            start = start.childNodes[range.startOffset];
        }
        while (start.firstChild) {
            start = start.firstChild;
        }
    }
    if (!range.collapsed && end.nodeType === Node.ELEMENT_NODE) {
        if (range.endOffset > 0) {
            end = end.childNodes[range.endOffset - 1];
        }
        while (end.lastChild) {
             end = end.lastChild;
        }
    }
    return [start, end];
}

function* upAndRight(node) {
    let temp;
    do {
        while ((temp = node.nextSibling)) {
            node = temp;
            yield [node, true];
        }
        if ((node = node.parentNode)) {
            yield [node, false];
        }
    } while (node);
}

function* upAndRightTreeWalker(node) {
    let tw = node.ownerDocument.createTreeWalker(node.ownerDocument.children[0],
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    tw.currentNode = node;
    let temp;
    do {
        while (tw.nextSibling()) {
            yield [tw.currentNode, true];
        }
        if ((temp = tw.parentNode())) {
            yield [tw.currentNode, false];
        }
    } while (temp);
}

function* down(node) {
    let tw = node.ownerDocument.createTreeWalker(node,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let temp;
    while ((temp = tw.nextNode())) {
        yield temp;
    }
}

function getStartTextOffset (node, range) {
    if (node.nodeType === Node.TEXT_NODE) {
        return (node === range.startContainer) ? range.startOffset : 0;
        return 0;
    } else {
        return -1;
    }
}

function getEndTextOffset (node, range) {
    if (node.nodeType === Node.TEXT_NODE) {
        return (node === range.endContainer) ? range.endOffset : node.data.length;
        return node.data.length;
    } else {
        return -1;
    }
}

function TextNode () {
    this.node = null;
    this.start = 0;
    this.end = 0;
}

function getTextNodesFromRange (range) {
    let textNodes = [];
    for (let node of getRangeNodes(range)) {
        if (node.nodeType !== Node.TEXT_NODE) {
            continue;
        }
        let textNode = new TextNode();
        textNode.node = node;
        textNode.start = getStartTextOffset(node, range);
        textNode.end = getEndTextOffset(node, range);
        textNodes.push(textNode);
    }
    return textNodes;
}

function splitTextNode (node, startOffset, endOffset) {
    if (startOffset === 0 && endOffset === node.data.length) {
        return node;
    } else if (startOffset > 0 && endOffset < node.data.length) {
        node = node.splitText(endOffset);
        node = node.previousSibling;
        node = node.splitText(startOffset);
        return node;
    } else if (startOffset > 0) {
        node = node.splitText(startOffset);
        return node;
    } else { // (endOffset < node.data.length)
        node = node.splitText(endOffset).previousSibling;
        return node;
    }
}
