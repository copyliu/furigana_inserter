"use strict";

var EXPORTED_SYMBOLS = ["escapeHTML", "log", "time", "printOwnProperties",
"printProperties", "getNodesByXPath", "Timer", "Extension", "Preferences",
"PreferencesObserver", "Clipboard", "getURI", "RangeNodeIterator", "splitTextNode",
"katakanaToRomaji", "katakanaToHiragana", "hiraganaToKatakana", "open", "read",
"write", "getDictionaryPath", "getMeCab", "logError", "getOS", "getExtension",
"getKeywordsFile", "getFilterFile", "getFilterFunction", "getKeywordsObject",
"getFilterArray", "getUserDictionaryPath", "getDllPath", "toKeywords", "MecabWorker",
"readUri", "getMecabWorker"]

Components.utils["import"]("resource://gre/modules/ctypes.jsm")
Components.utils["import"]("resource://gre/modules/AddonManager.jsm")

const XPathResult = Components.interfaces.nsIDOMXPathResult
const Node = Components.interfaces.nsIDOMNode
const NodeFilter = Components.interfaces.nsIDOMNodeFilter

function toKeywords (word, table) {
        var res = []
        var chars = word.split("")
        chars.forEach(function (c) {
            if (table.hasOwnProperty(c))
                res.push(table[c])
            else res.push(c)
        })
        return res.join(" ")
    }

function katakanaToHiragana (str) {
    var retval = []
    var len = str.length
    for (var i = 0; i < len; ++i) {
        var c = str.charAt(i)
        var code = c.charCodeAt(0)
        if (code < 0x30A1 || code > 0x30F6)
            retval.push(c)
        else retval.push(String.fromCharCode(code - 0x60))
    }
    return retval.join("")
}

function hiraganaToKatakana (str) {
    var retval = []
    var len = str.length
    for (var i = 0; i < len; ++i) {
        var c = str.charAt(i)
        var code = str.charCodeAt(i)
        if (code < 0x3041 || code > 0x3096)
            retval.push(c)
        else retval.push(String.fromCharCode(code + 0x60))
    }
    return retval.join("")
}

function katakanaToRomaji (string, table) {
    var j = 0
    var result = []
    var substring = ""
    var len = string.length

    for (var i = 0; i < len; ) {
        for (j = 3; j > 0; --j) {
            substring = string.substring(i, i + j)
            if (table.hasOwnProperty(substring)) {
                result.push(table[substring])
                i += j
                break
            }
        }
        if (j === 0) result.push(string.charAt(i++))
    }
    return result.join("")
}

function getURI (spec) {
    return Components.classes['@mozilla.org/network/io-service;1'].
    getService(Components.interfaces.nsIIOService).
    newURI(spec, null, null)
}

function escapeHTML (text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function log (msg) {
    Components.classes["@mozilla.org/consoleservice;1"].
    getService(Components.interfaces.nsIConsoleService).logStringMessage(msg);
}

function logError (e) {
    var str = e.message + ", file name: " + e.fileName + ", line number: " + e.lineNumber
    Components.utils.reportError(str)
}

function time (f) {
    var start = new Date().getTime();
    var result = f();
    var end = new Date().getTime();
    log("time: " + (end - start) + " ms");
    return result;
}

function printProperties (obj) {
    var props = []
    for (var prop in obj)
        props.push(prop)
    log(props.join(", "))
}

function printOwnProperties (obj) {
    var props = []
    for (var prop in obj)
        if(obj.hasOwnProperty(prop))
            props.push(prop)
    log(props.join(", "))
}

function getNodesByXPath (elem, expr) {
    var doc = elem.ownerDocument
    var nodes = [];
    var node;
    var result = doc.evaluate(expr, elem, null, XPathResult.
        ORDERED_NODE_ITERATOR_TYPE, null);
    while ((node = result.iterateNext())) nodes.push(node);
    return nodes;
}

function splitTextNode (node, startOffset, endOffset) {
    if (startOffset === 0 && endOffset === node.data.length)
        return node
    else if (startOffset > 0 && endOffset < node.data.length) {
        node = node.splitText(endOffset)
        node = node.previousSibling
        node = node.splitText(startOffset)
        return node
    }
    else if (startOffset > 0) {
        node = node.splitText(startOffset)
        return node
    }
    else { // (endOffset < node.data.length)
        node = node.splitText(endOffset).previousSibling
        return node
    }
}

function write (file, data, charset, append) {
    var fos = Components.classes['@mozilla.org/network/file-output-stream;1']
    .createInstance(Components.interfaces.nsIFileOutputStream)
    var flags = 0x02 | 0x08 | 0x20 // wronly | create | truncate
    if (append) flags = 0x02 | 0x10 // wronly | append
    fos.init(file, flags, -1, 0)
    var cos = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
    .createInstance(Components.interfaces.nsIConverterOutputStream)
    cos.init(fos, charset, -1, 0x0000)
    cos.writeString(data)
    cos.close();
}

function readUri (uri, charset) {
    var inp = Components.classes["@mozilla.org/network/io-service;1"]
    .getService(Components.interfaces.nsIIOService)
    .newChannel(uri, null, null)
    .open();
    
    return readStream (inp, charset)
}

function read (file, charset) {
    var fis = Components.classes['@mozilla.org/network/file-input-stream;1'].
    createInstance(Components.interfaces.nsIFileInputStream);
    fis.init(file, -1, -1, 0);
    return readStream(fis, charset)
}

function readStream (is, charset) {
    var retval = "";
    var cis = Components.classes['@mozilla.org/intl/converter-input-stream;1']
    .createInstance(Components.interfaces.nsIConverterInputStream);
    cis.init(is, charset, -1, 0x0000);
    var str = {};
    while (cis.readString(-1, str) > 0)
        retval += str.value;
    cis.close();
    return retval;
}

function open (path) {
    var file = Components.classes['@mozilla.org/file/local;1'].
    createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(path);
    return file;
}

function RangeNodeIterator (range) {
    var start = range.startContainer
    var startOffset = start.nodeType === Node.TEXT_NODE ? range.startOffset : -1
    var end  = range.endContainer
    var endOffset = end.nodeType === Node.TEXT_NODE ? range.endOffset : -1

    if (!range.collapsed && start.nodeType === Node.ELEMENT_NODE) {
        if (range.startOffset === start.childNodes.length)
            start = start.childNodes[range.startOffset - 1]
        else start = start.childNodes[range.startOffset]
        while (start.firstChild) start = start.firstChild
        startOffset = (start.nodeType === Node.TEXT_NODE) ? 0 : -1
    }
    if (!range.collapsed && end.nodeType === Node.ELEMENT_NODE) {
        if (range.endOffset === 0)
            end = end.childNodes[0]
        else end = end.childNodes[range.endOffset - 1]
        while (end.lastChild) end = end.lastChild
        endOffset = (end.nodeType === Node.TEXT_NODE) ? end.data.length : -1
    }

    this._start = start
    // The top node of the iterator. It is only updated when the iterator moves
    // to the right or up.
    this._topNode = start
    // The current node is updated in each iteration. It is the node, that is currently
    // visited by the iterator.
    this._currentNode = null
    this._end = end
    this._startOffset = startOffset
    this._endOffset = endOffset
    this._state = 0 // START

    var doc = start.ownerDocument
    this._walker = doc.createTreeWalker(start, NodeFilter.SHOW_ELEMENT |
        NodeFilter.SHOW_TEXT, null, false)
}

RangeNodeIterator.prototype = {
    _START: 0,
    _END: 1,
    _DOWN: 2,
    _RIGHT_OR_UP: 3,

    nextNode: function () {
        if (this._currentNode === this._end) {
            this._currentNode = null
            this._state = this._END
        }

        switch (this._state) {
            case 0: { // START
                this._state = this._DOWN
                this._currentNode = this._start
                return this._currentNode
            }
            case 1: // END
                return null
            case 2: { // DOWN
                this._currentNode = this._walker.nextNode()
                if (!this._currentNode)
                    this._state = this._RIGHT_OR_UP; // fall through!
                else return this._currentNode
            }
            case 3: { // RIGHT_OR_UP
                this._currentNode = this._topNode.nextSibling
                if (!this._currentNode) {
                    this._topNode = this._topNode.parentNode
                    this._currentNode = this._topNode
                    if (!this._currentNode)
                        throw new Error("this shouldn't happen")
                    else
                        return this._currentNode
                }
                else {
                    this._state = this._DOWN
                    this._topNode = this._currentNode
                    this._walker.currentNode = this._topNode
                    return this._currentNode
                }
            }
            default:throw new Error("this shouldn't happen")
        }
    },

    next: function () {
        var node = this.nextNode()
        if (node) return node
        else throw StopIteration
    },

    __iterator__: function () {
        return this
    },

    getStartNode: function () {
        return this._start
    },

    getEndNode: function () {
        return this._end
    },

    getStartTextOffset: function () {
        var node = this._currentNode
        if (!node || node.nodeType !== Node.TEXT_NODE)
            return -1
        // node is a text node
        if (node === this._start)
            return this._startOffset
        else return 0
    },

    getEndTextOffset: function () {
        var node = this._currentNode
        if (!node || node.nodeType !== Node.TEXT_NODE)
            return -1
        // node is a text node
        if (node === this._end)
            return this._endOffset
        else return node.data.length
    },

    isLast: function () {
        return this._currentNode === this._end
    }
}

function Timer () {
    this._timer = Components.classes["@mozilla.org/timer;1"]
    .createInstance(Components.interfaces.nsITimer);
}

Timer.prototype = {
    startRepeating: function(callback, interval) {
        this._timer.initWithCallback({
            notify: callback
        }, interval, this._timer.TYPE_REPEATING_SLACK);
        return this;
    },
    startOneShot: function(callback, interval) {
        this._timer.initWithCallback({
            notify: callback
        }, interval, this._timer.TYPE_ONE_SHOT);
        return this;
    },
    stop: function () {
        this._timer.cancel()
        return this
    }
}

function Preferences(branchName) {
    // nsIPrefBranch
    this._prefs = Components.classes["@mozilla.org/preferences-service;1"].
    getService(Components.interfaces.nsIPrefService).getBranch(branchName)
}

Preferences.prototype = {
    unregister: function(observer) {
        this._prefs.removeObserver("", observer)
    },

    register: function(observer) {
        this._prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
        this._prefs.addObserver("", observer, false);
    },

    setPref: function(name, val) {
        var type = this._prefs.getPrefType(name);
        if (type === this._prefs.PREF_BOOL)
            this._prefs.setBoolPref(name, val);
        else if (type === this._prefs.PREF_INT)
            this._prefs.setIntPref(name, val);
        else {
            var str = Components.classes["@mozilla.org/supports-string;1"].
            createInstance(Components.interfaces.nsISupportsString);
            str.data = val;
            this._prefs.setComplexValue(name, Components.interfaces.nsISupportsString, str);
        }
    },

    getPref: function(name) {
        var type = this._prefs.getPrefType(name);
        if (type === this._prefs.PREF_BOOL)
            return this._prefs.getBoolPref(name);
        else if (type === this._prefs.PREF_INT)
            return this._prefs.getIntPref(name);
        else return this._prefs.getComplexValue(name, Components.interfaces.nsISupportsString).data;
    },

    resetPref: function(name) {
        if (this._prefs.prefHasUserValue(name)) this._prefs.clearUserPref(name)
    }
}

// nsIObserver
function PreferencesObserver(func) {
    this.func = func
}

PreferencesObserver.prototype = {
    /**
      * aSubject - The nsIPrefBranch object (this)
      * aTopic   - The string defined by NS_PREFBRANCH_PREFCHANGE_TOPIC_ID
      * aData    - The name of the preference which has changed, relative to
      * the |root| of the aSubject branch.
      */
    observe: function (subject, topic, data) {
        if (topic !== "nsPref:changed")
            return
        this.func({data: data, subject: subject, topic: topic})
    }
}

function Clipboard() {
    this._timer = null
    this._enabled = false
    this._clip = Components.classes["@mozilla.org/widget/clipboard;1"].
    getService(Components.interfaces.nsIClipboard)
}

Clipboard.prototype = {
    getText: function () {
        try {
            var trans = Components.classes["@mozilla.org/widget/transferable;1"].
            createInstance(Components.interfaces.nsITransferable);
            trans.addDataFlavor("text/unicode");
            this._clip.getData(trans, this._clip.kGlobalClipboard);
            var str = {};
            var strLength = {};
            trans.getTransferData("text/unicode", str, strLength);
            str = str.value.QueryInterface(Components.interfaces.nsISupportsString);
            return str.data.substring(0, strLength.value / 2);
        } catch(e) {
            return "";
        }
    },

    setText: function (text) {
        try {
            var str = Components.classes["@mozilla.org/supports-string;1"].
            createInstance(Components.interfaces.nsISupportsString);
            str.data = text;
            var trans = Components.classes["@mozilla.org/widget/transferable;1"].
            createInstance(Components.interfaces.nsITransferable);
            trans.addDataFlavor("text/unicode");
            trans.setTransferData("text/unicode", str, text.length * 2);
            this._clip.setData(trans, null, this._clip.kGlobalClipboard);
        } catch(e) {
        }
    },

    startMonitoring: function (callback, interval) {
        var previousText = "";
        var that = this;
        this._enabled = true;
        this._timer = new Timer().startRepeating(function () {
            //get text from clipboard. if text hasn't changed ignore it,
            //otherwise paste it into the document
            var text = that.getText();
            if (text !== previousText) {
                previousText = text;
                callback(text);
            }
        }, interval);
    },

    stopMonitoring: function () {
        if (this._timer) this._timer.stop()
        this._enabled = false
    },

    isEnabled: function () {
        return this._enabled
    }
}

var MyExtension = null
var DictionaryExtension = null

function getExtension () {
    return MyExtension
}

function init () {
    AddonManager.getAddonByID("furiganainserter@zorkzero.net", function (addon) {
        MyExtension = addon
    })

    AddonManager.getAddonByID("furiganainserter-dictionary@zorkzero.net", function (addon) {
        DictionaryExtension = addon
    })
}

function getDictionaryPath () {
    if (DictionaryExtension)
        return DictionaryExtension.getResourceURI("chrome/content/etc/mecabrc").
        QueryInterface(Components.interfaces.nsIFileURL).file.path
    else return ""
}

function getUserDictionaryPath () {
    var file = getUserDictionaryFile("dic")
    if (file.exists())
        return file.path
    else return ""
}

function getDllPath () {
    var path
    if (getOS() === "Darwin")
        path = "mecab/libmecab.dylib"
    else
        path = "mecab/libmecab.dll"
    var uri = MyExtension.getResourceURI(path)
    var file = uri.QueryInterface(Components.interfaces.nsIFileURL).file
    return file.path
}

function getUserDictionaryFile (extension) {
    var file = Components.classes["@mozilla.org/file/directory_service;1"].
    getService(Components.interfaces.nsIProperties).
    get("ProfD", Components.interfaces.nsIFile)

    file.append("furigana_inserter_user_dictionary." + extension)
    return file
}

function getLibc () {
    var OS = getOS()
    if (OS === "WINNT")
        return ctypes.open("msvcrt.dll")
    else if (OS === "Linux")
        return ctypes.open("libc.so.6")
    else if (OS === "Darwin")
        return ctypes.open("libc.dylib")
    else throw new Error("unsupported OS")
}

function strlen (cstring) {
    var lib = getLibc()
    var f = lib.declare("strlen", ctypes.default_abi, ctypes.size_t, ctypes["char"].ptr)
    return f(cstring)
}

function memcpy (s, ct, n) {
    var lib = getLibc()
    var f = lib.declare("memcpy", ctypes.default_abi, ctypes.void_t.ptr, ctypes.void_t.ptr, ctypes.void_t.ptr, ctypes.size_t)
    return f(s, ct, n)
}

function getOS () {
    return Components.classes["@mozilla.org/xre/app-info;1"].
    getService(Components.interfaces.nsIXULRuntime).OS
}

function getKeywordsFile () {
    var file = Components.classes["@mozilla.org/file/directory_service;1"].
    getService(Components.interfaces.nsIProperties).
    get("ProfD", Components.interfaces.nsIFile)
    file.append("furigana_inserter_keywords.txt")
    return file
}

function getFilterFile () {
    var file = Components.classes["@mozilla.org/file/directory_service;1"].
    getService(Components.interfaces.nsIProperties).
    get("ProfD", Components.interfaces.nsIFile)

    file.append("furigana_inserter_filter.js")
    return file
}

function getKeywordsObject (text) {
    var table = {}
    var lines = text.split("\n")
    lines.forEach(function (line) {
        var key = line.charAt(0)
        var val = line.substring(1).trim()
        table[key] = val
    })
    return table
}

function getFilterFunction (obj) {
    var obj2 = []
    obj.forEach(function (item) {
        var rx = new RegExp(item[0], "g")
        obj2.push([rx, item[1]])
    })
    var func = function (text) {
        obj2.forEach(function (item) {
            text = text.replace(item[0], item[1])
        })
        return text
    }
    return func
}

function getFilterArray () {
    var JSON = Components.classes["@mozilla.org/dom/json;1"]
    .createInstance(Components.interfaces.nsIJSON)
    var textFile = getFilterFile()
    if (!textFile.exists()) return []
    var text = read(textFile, "UTF-8")
    var obj = null
    try {
        obj = JSON.decode(text)
    } catch (e) {
    }
    return obj
}

function MecabWorker (document) {
    var version
    this.document = document
    this.initialized = false
    this.queue = []
    version = Components.classes["@mozilla.org/xre/app-info;1"].
        getService(Components.interfaces.nsIXULAppInfo).version
    version = parseInt(version.split(".")[0])
    if (version < 8)
        this.worker = Components.classes["@mozilla.org/threads/workerfactory;1"].
        createInstance(Components.interfaces.nsIWorkerFactory).
        newChromeWorker("chrome://furiganainserter/content/my_worker.js")
    else
        this.worker = new ChromeWorker("chrome://furiganainserter/content/my_worker.js")
    var that = this
    this.worker.onmessage = function (event) {
        var JSON = Components.classes["@mozilla.org/dom/json;1"]
        .createInstance(Components.interfaces.nsIJSON)
        var f = that.queue.shift()
        f(event.data)
    }
    this.worker.onerror = function (event) {
        var msg, promptService
        that.queue.shift()
        msg = document.getElementById("furiganainserter-strings").
        getString("createTaggerError")
        promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
            getService(Components.interfaces.nsIPromptService)
        promptService.alert(null, "Furigana Inserter", msg +
            "\nMeCab error message: " + event.message + "\nfile: " + event.filename + " line: " + event.lineno)
    }
}

MecabWorker.prototype.init = function () {
    if (this.initialized) return
    this.worker.postMessage({
        request: "init",
        OS: getOS(),
        dllPath: getDllPath()
    })
    this.initialized = true
}

MecabWorker.prototype.send = function (f, data) {
    this.init()
    this.queue.push(f)
    this.worker.postMessage(data)
}

var MyMecabWorker = null

function getMecabWorker(document) {
    if (MyMecabWorker)
        return MyMecabWorker
    MyMecabWorker = new MecabWorker(document)
    return MyMecabWorker
}

init()
