"use strict";

let EXPORTED_SYMBOLS = ["RangeNodeIterator", "getStartTextOffset", "getEndTextOffset",
"splitTextNode", "getTextNodesFromRange"];

let Ci = Components.interfaces;
let Cc = Components.classes;
let XPathResult = Ci.nsIDOMXPathResult;
let Node = Ci.nsIDOMNode;
let NodeFilter = Ci.nsIDOMNodeFilter;

function* RangeNodeIterator (range) {
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
            for (let temp2 of down(temp)) {
                yield temp2;
                if (temp2 === end) {
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

function* upAndRightBroken(node) {
    let tw = node.ownerDocument.createTreeWalker(node,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (true) {
        if (tw.nextSibling()) {
            yield [tw.currentNode, true];
        } else {
            if (!tw.parentNode()) {
                return;
            }
            yield [tw.currentNode, false];
        }
    };
}

function* upAndRight(node) {
    let temp;
    while (true) {
        if ((temp = node.nextSibling)) {
            node = temp;
            yield [node, true];
        } else {
            temp = node.parentNode;
            node = temp;
            if (!temp) {
                return;
            }
            yield [node, false];
        }
    }
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

function getTextNodesFromRange (range, pred) {
    let nodes = [];
    for (let node of RangeNodeIterator(range)) {
        if (!pred(node)) {
            continue;
        }
        nodes.push({
            node : node,
            start : getStartTextOffset(node, range),
            end : getEndTextOffset(node, range)
        });
    }
    return nodes;
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
