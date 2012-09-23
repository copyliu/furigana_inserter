"use strict";

var EXPORTED_SYMBOLS = ["escapeHTML", "log", "time", "printOwnProperties",
"printProperties", "getNodesByXPath", "Timer", "Preferences",
"PreferencesObserver", "ClipboardMonitor", "getURI",
"RangeNodeIterator", "splitTextNode", "katakanaToRomaji",
"katakanaToHiragana", "hiraganaToKatakana", "open", "read", "write",
"getDictionaryPath", "logError", "getOS", "getExtension",
"getKeywordsFile", "getFilterFile", "getFilterFunction",
"getKeywordsObject", "getFilterArray", "getUserDictionaryPath",
"getDllPath", "readUri", "getMecabWorker", "groupBy",
"copyTextToClipboard", "getTextFromClipboard", "getChromeWindow"];

Components.utils["import"]("resource://gre/modules/AddonManager.jsm");

var Ci = Components.interfaces;
var Cc = Components.classes;
var XPathResult = Ci.nsIDOMXPathResult;
var Node = Ci.nsIDOMNode;
var NodeFilter = Ci.nsIDOMNodeFilter;

var MyExtension = null;
var DictionaryExtension = null;
var MecabWorkerInstance = null;

function init () {
    AddonManager.getAddonByID("furiganainserter@zorkzero.net",
        function (addon) {
            MyExtension = addon;
        });
    AddonManager.getAddonByID("furiganainserter-dictionary@zorkzero.net",
        function (addon) {
            DictionaryExtension = addon;
        });
}

function groupBy (list, func) {
    var group = [], result = [];
    list.forEach(function (element) {
        if (group.length === 0)
            group.push(element);
        else if (func(group[0]) === func(element))
            group.push(element);
        else {
            result.push(group);
            group = [element];
        }
    })
    if (group.length > 0)
        result.push(group);
    return result;
}

function getChromeWindow (win) {
    return win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
    .getInterface(Components.interfaces.nsIWebNavigation)
    .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
    .rootTreeItem
    .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
    .getInterface(Components.interfaces.nsIDOMWindow);
}

function katakanaToHiragana (str) {
    var retval = "";
    var len = str.length;
    for ( var i = 0; i < len; ++i) {
        var c = str.charAt(i);
        var code = c.charCodeAt(0);
        if (code < 0x30A1 || code > 0x30F6)
            retval += c;
        else retval += String.fromCharCode(code - 0x60);
    }
    return retval;
}

function hiraganaToKatakana (str) {
    var retval = "";
    var len = str.length;
    for ( var i = 0; i < len; ++i) {
        var c = str.charAt(i);
        var code = str.charCodeAt(i);
        if (code < 0x3041 || code > 0x3096)
            retval += c;
        else retval += String.fromCharCode(code + 0x60);
    }
    return retval;
}

var loadRomaji = (function () {
    var romajiTable = null;
    return function () {
        if (romajiTable)
            return romajiTable;
        var string = readUri("chrome://furiganainserter/content/romaji.json",
            "UTF-8");
        romajiTable = JSON.parse(string);
        return romajiTable;
    }
})();

function katakanaToRomaji (string) {
    var table = loadRomaji();
    var j = 0;
    var result = "";
    var substring = "";
    var len = string.length;

    for ( var i = 0; i < len;) {
        for (j = 3; j > 0; --j) {
            substring = string.substring(i, i + j);
            if (table.hasOwnProperty(substring)) {
                result += table[substring];
                i += j;
                break;
            }
        }
        if (j === 0) {
            result += string.charAt(i);
            i += 1;
        }
    }
    return result;
}

function getURI (spec) {
    return Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService)
    .newURI(spec, null, null);
}

function escapeHTML (text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g,
        '&gt;');
}

function log (msg) {
    Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService)
    .logStringMessage(msg);
}

function logError (e) {
    var str = e.message + ", file name: " + e.fileName + ", line number: "
    + e.lineNumber;
    Components.utils.reportError(str);
}

function time (f) {
    var start = new Date().getTime();
    var result = f();
    var end = new Date().getTime();
    log("time: " + (end - start) + " ms");
    return result;
}

function printProperties (obj) {
    var props = [];
    for ( var prop in obj)
        props.push(prop);
    log(props.join(", "));
}

function printOwnProperties (obj) {
    var props = [];
    for ( var prop in obj)
        if (obj.hasOwnProperty(prop))
            props.push(prop);
    log(props.join(", "));
}

function getNodesByXPath (elem, expr) {
    var doc = elem.ownerDocument;
    var nodes = [], node;
    var result = doc.evaluate(expr, elem, null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    while ((node = result.iterateNext()))
        nodes.push(node);
    return nodes;
}

function splitTextNode (node, startOffset, endOffset) {
    if (startOffset === 0 && endOffset === node.data.length)
        return node;
    else if (startOffset > 0 && endOffset < node.data.length) {
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

function write (file, data, charset, append) {
    var fos = Cc['@mozilla.org/network/file-output-stream;1']
    .createInstance(Ci.nsIFileOutputStream);
    var flags = 0x02 | 0x08 | 0x20; // wronly | create | truncate
    if (append) flags = 0x02 | 0x10; // wronly | append
    fos.init(file, flags, -1, 0);
    var cos = Cc["@mozilla.org/intl/converter-output-stream;1"]
    .createInstance(Ci.nsIConverterOutputStream);
    cos.init(fos, charset, -1, 0x0000);
    cos.writeString(data);
    cos.close();
}

function readUri (uri, charset) {
    var inp = Cc["@mozilla.org/network/io-service;1"].
    getService(Ci.nsIIOService).newChannel(uri, null, null).open();
    return readStream(inp, charset);
}

function read (file, charset) {
    var fis = Cc['@mozilla.org/network/file-input-stream;1']
    .createInstance(Ci.nsIFileInputStream);
    fis.init(file, -1, -1, 0);
    return readStream(fis, charset);
}

function readStream (is, charset) {
    var retval = "";
    var cis = Cc['@mozilla.org/intl/converter-input-stream;1']
    .createInstance(Ci.nsIConverterInputStream);
    cis.init(is, charset, -1, 0x0000);
    var str = {};
    while (cis.readString(-1, str) > 0)
        retval += str.value;
    cis.close();
    return retval;
}

function open (path) {
    var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
    file.initWithPath(path);
    return file;
}

function RangeNodeIterator (range) {
    var start = range.startContainer;
    var startOffset = start.nodeType === Node.TEXT_NODE ? range.startOffset
    : -1;
    var end = range.endContainer;
    var endOffset = end.nodeType === Node.TEXT_NODE ? range.endOffset : -1;
    if (!range.collapsed && start.nodeType === Node.ELEMENT_NODE) {
        if (range.startOffset < start.childNodes.length)
            start = start.childNodes[range.startOffset];
        while (start.firstChild)
            start = start.firstChild;
        startOffset = (start.nodeType === Node.TEXT_NODE) ? 0 : -1;
    }
    if (!range.collapsed && end.nodeType === Node.ELEMENT_NODE) {
        if (range.endOffset > 0)
            end = end.childNodes[range.endOffset - 1];
        while (end.lastChild)
            end = end.lastChild;
        endOffset = (end.nodeType === Node.TEXT_NODE) ? end.data.length : -1;
    }

    this._start = start;
    // The top node of the iterator. It is only updated when the iterator moves
    // to the right or up.
    this._topNode = start;
    // The current node is updated in each iteration. It is the node, that is
    // currently visited by the iterator.
    this._currentNode = null;
    this._end = end;
    this._startOffset = startOffset;
    this._endOffset = endOffset;
    this._state = 0; // START

    var doc = start.ownerDocument;
    this._walker = doc.createTreeWalker(start, NodeFilter.SHOW_ELEMENT
        | NodeFilter.SHOW_TEXT, null, false);

    this._START = 0;
    this._END = 1;
    this._DOWN = 2;
    this._RIGHT_OR_UP = 3;
}

RangeNodeIterator.prototype.nextNode = function () {
    if (this._currentNode === this._end) {
        this._currentNode = null;
        this._state = this._END;
    }

    switch (this._state) {
        case 0: // START
            this._state = this._DOWN;
            this._currentNode = this._start;
            return this._currentNode;
        case 1: // END
            return null;
        case 2: // DOWN
            this._currentNode = this._walker.nextNode();
            if (!this._currentNode)
                this._state = this._RIGHT_OR_UP; // fall through!
            else return this._currentNode;
        case 3:// RIGHT_OR_UP
            this._currentNode = this._topNode.nextSibling;
            if (!this._currentNode) {
                this._topNode = this._topNode.parentNode;
                this._currentNode = this._topNode;
                if (!this._currentNode)
                    throw new Error("this shouldn't happen");
                else return this._currentNode;
            } else {
                this._state = this._DOWN;
                this._topNode = this._currentNode;
                this._walker.currentNode = this._topNode;
                return this._currentNode;
            }
        default:
            throw new Error("this shouldn't happen");
    }
}

RangeNodeIterator.prototype.next = function () {
    var node = this.nextNode();
    if (node)
        return node;
    else throw StopIteration;
}

RangeNodeIterator.prototype.__iterator__ = function () {
    return this;
}

RangeNodeIterator.prototype.getStartNode = function () {
    return this._start;
}

RangeNodeIterator.prototype.getEndNode = function () {
    return this._end;
}

RangeNodeIterator.prototype.getStartTextOffset = function () {
    var node = this._currentNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) return -1;
    // node is a text node
    if (node === this._start)
        return this._startOffset;
    else return 0;
}

RangeNodeIterator.prototype.getEndTextOffset = function () {
    var node = this._currentNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) return -1;
    // node is a text node
    if (node === this._end)
        return this._endOffset;
    else return node.data.length;
}

RangeNodeIterator.prototype.isLast = function () {
    return this._currentNode === this._end;
}

function RepeatingTimer (interval, callback) {
    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._timer.initWithCallback({
        notify : callback
    }, interval, this._timer.TYPE_REPEATING_SLACK);
}

RepeatingTimer.prototype.cancel = function () {
    this._timer.cancel();
}

function Timer (interval, callback) {
    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._timer.initWithCallback({
        notify : callback
    }, interval, this._timer.TYPE_ONE_SHOT);
}

Timer.prototype.cancel = function () {
    this._timer.cancel();
}

function Preferences (branchName) {
    // nsIPrefBranch
    this._prefs = Cc["@mozilla.org/preferences-service;1"].
    getService(Ci.nsIPrefService).getBranch(branchName);
}

Preferences.prototype.unregister = function (observer) {
    this._prefs.removeObserver("", observer);
}

Preferences.prototype.register = function (observer) {
    this._prefs.QueryInterface(Ci.nsIPrefBranch2);
    this._prefs.addObserver("", observer, false);
}

Preferences.prototype.setPref = function (name, val) {
    var type = this._prefs.getPrefType(name);
    if (type === this._prefs.PREF_BOOL)
        this._prefs.setBoolPref(name, val);
    else if (type === this._prefs.PREF_INT)
        this._prefs.setIntPref(name, val);
    else {
        var str = Cc["@mozilla.org/supports-string;1"]
        .createInstance(Ci.nsISupportsString);
        str.data = val;
        this._prefs.setComplexValue(name, Ci.nsISupportsString, str);
    }
}

Preferences.prototype.getPref = function (name) {
    var type = this._prefs.getPrefType(name);
    if (type === this._prefs.PREF_BOOL)
        return this._prefs.getBoolPref(name);
    else if (type === this._prefs.PREF_INT)
        return this._prefs.getIntPref(name);
    else return this._prefs.getComplexValue(name, Ci.nsISupportsString).data;
}

Preferences.prototype.resetPref = function (name) {
    if (this._prefs.prefHasUserValue(name)) this._prefs.clearUserPref(name);
}

// nsIObserver
function PreferencesObserver (func) {
    this.func = func;
}

// aSubject - The nsIPrefBranch object
// aTopic - The string defined by NS_PREFBRANCH_PREFCHANGE_TOPIC_ID
// aData - The name of the preference which has changed, relative to the |root|
// of the aSubject branch.
PreferencesObserver.prototype.observe = function (subject, topic, data) {
    if (topic !== "nsPref:changed") return;
    this.func({
        data : data,
        subject : subject,
        topic : topic
    });
}

function getTextFromClipboard () {
    try {
        var clip = Cc["@mozilla.org/widget/clipboard;1"]
        .getService(Ci.nsIClipboard);
        var trans = Cc["@mozilla.org/widget/transferable;1"]
        .createInstance(Ci.nsITransferable);
        trans.addDataFlavor("text/unicode");
        clip.getData(trans, clip.kGlobalClipboard);
        var str = {};
        var strLength = {};
        trans.getTransferData("text/unicode", str, strLength);
        str = str.value.QueryInterface(Ci.nsISupportsString);
        return str.data.substring(0, strLength.value / 2);
    } catch (e) {
        return "";
    }
}

function copyTextToClipboard (text) {
    try {
        var clip = Cc["@mozilla.org/widget/clipboard;1"]
        .getService(Ci.nsIClipboard);
        var str = Cc["@mozilla.org/supports-string;1"]
        .createInstance(Ci.nsISupportsString);
        str.data = text;
        var trans = Cc["@mozilla.org/widget/transferable;1"]
        .createInstance(Ci.nsITransferable);
        trans.addDataFlavor("text/unicode");
        trans.setTransferData("text/unicode", str, text.length * 2);
        clip.setData(trans, null, clip.kGlobalClipboard);
    } catch (e) {
    }
}

function ClipboardMonitor (interval, callback) {
    var previousText = "";
    this._timer = new RepeatingTimer(interval, function () {
        // get text from clipboard. if text hasn't changed ignore it,
        // otherwise paste it into the document
        var text = getTextFromClipboard();
        if (text !== previousText) {
            previousText = text;
            callback(text);
        }
    });
}

ClipboardMonitor.prototype.cancel = function () {
    this._timer.cancel();
}

function getExtension () {
    return MyExtension;
}

function getDictionaryPath () {
    if (DictionaryExtension)
        return DictionaryExtension.getResourceURI("chrome/content/etc/mecabrc")
        .QueryInterface(Ci.nsIFileURL).file.path;
    else return "";
}

function getUserDictionaryPath () {
    var file = getUserDictionaryFile("dic");
    if (file.exists())
        return file.path;
    else return "";
}

function getDllPath () {
    var path;
    if (getOS() === "Darwin")
        path = "mecab/libmecab.dylib";
    else path = "mecab/libmecab.dll";
    var uri = MyExtension.getResourceURI(path);
    var file = uri.QueryInterface(Ci.nsIFileURL).file;
    return file.path;
}

function getUserDictionaryFile (extension) {
    var file = Cc["@mozilla.org/file/directory_service;1"].
    getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    file.append("furigana_inserter_user_dictionary." + extension);
    return file;
}

function getOS () {
    return Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
}

function getKeywordsFile () {
    var file = Cc["@mozilla.org/file/directory_service;1"].
    getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    file.append("furigana_inserter_keywords.txt");
    return file;
}

function getFilterFile () {
    var file = Cc["@mozilla.org/file/directory_service;1"].
    getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    file.append("furigana_inserter_filter.js");
    return file;
}

function getKeywordsObject (text) {
    var table = {};
    var lines = text.split("\n");
    lines.forEach(function (line) {
        var key = line.charAt(0);
        var val = line.substring(1).trim();
        table[key] = val;
    });
    return table;
}

function getFilterFunction (obj) {
    var obj2 = [];
    obj.forEach(function (item) {
        var rx = new RegExp(item[0], "g");
        obj2.push([rx, item[1]]);
    })
    var func = function (text) {
        obj2.forEach(function (item) {
            text = text.replace(item[0], item[1]);
        });
        return text;
    }
    return func;
}

function getFilterArray () {
    var textFile = getFilterFile();
    if (!textFile.exists()) return [];
    var text = read(textFile, "UTF-8");
    var obj = null;
    try {
        obj = JSON.parse(text);
    } catch (e) {
    }
    return obj;
}

function showErrorDialog () {
    var msg = document.getElementById("furiganainserter-strings").
    getString("createTaggerError");
    var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);
}

function MecabWorker () {
    var that = this;
    this.initialized = false;
    this.queue = [];
    this.worker = new ChromeWorker("chrome://furiganainserter/content/my_worker.js");
    this.worker.onmessage = function (event) {
        var f = that.queue.shift();
        f(event.data);
    }
    this.worker.onerror = function (event) {
        that.queue.shift();
        logError({
            message: event.message,
            fileName: event.filename,
            lineNumber: event.lineno
        });
    }
}

MecabWorker.prototype.init = function () {
    if (this.initialized)
        return;
    this.worker.postMessage({
        request : "init",
        OS : getOS(),
        dllPath : getDllPath()
    });
    this.initialized = true;
}

MecabWorker.prototype.send = function (data, f) {
    this.init();
    this.queue.push(f);
    this.worker.postMessage(data);
}

function getMecabWorker () {
    if (MecabWorkerInstance) return MecabWorkerInstance;
    MecabWorkerInstance = new MecabWorker();
    return MecabWorkerInstance;
}

init();
