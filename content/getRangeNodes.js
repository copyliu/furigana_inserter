"use strict";

let EXPORTED_SYMBOLS = ["getRangeNodes", "getTextNodesFromRange", "TextNode"];

let Ci = Components.interfaces;
let Cc = Components.classes;
let XPathResult = Ci.nsIDOMXPathResult;
let Node = Ci.nsIDOMNode;
let NodeFilter = Ci.nsIDOMNodeFilter;

function* getRangeNodes(range) {
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

function setup(range) {
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

function getStartOffset(node, range) {
    if (node.nodeType === Node.TEXT_NODE) {
        return (node === range.startContainer) ? range.startOffset : 0;
        return 0;
    } else {
        return -1;
    }
}

function getEndOffset(node, range) {
    if (node.nodeType === Node.TEXT_NODE) {
        return (node === range.endContainer) ? range.endOffset : node.data.length;
        return node.data.length;
    } else {
        return -1;
    }
}

function TextNode(node, range) {
    this._node = node;
    this._startOffset = getStartOffset(node, range);
    this._endOffset = getEndOffset(node, range);
}

Object.defineProperty(TextNode.prototype, 'node', {
    get: function () {
        return this._node;
    }
});

TextNode.prototype.split = function () {
    if (this._startOffset === 0 && this._endOffset === this._node.data.length) {
        // do nothing
    } else if (this._startOffset > 0 && this._endOffset < this._node.data.length) {
        this._node = this._node.splitText(this._endOffset);
        this._node = this._node.previousSibling;
        this._node = this._node.splitText(this._startOffset);
    } else if (this._startOffset > 0) {
        this._node = this._node.splitText(this._startOffset);
    } else { // (_endOffset < _node.data.length)
        this._node = this._node.splitText(this._endOffset).previousSibling;
    }
    this._startOffset = 0;
    this._endOffset = this._node.data.length;
    return this;
}

TextNode.prototype.getText = function() {
    return this._node.data.substring(this._startOffset, this._endOffset);
};

function* getTextNodesFromRange(range) {
    for (let node of getRangeNodes(range)) {
        if (node.nodeType !== Node.TEXT_NODE) {
            continue;
        }
        yield new TextNode(node, range);
    }
}
