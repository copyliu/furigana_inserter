"use strict";

let EXPORTED_SYMBOLS = ["escapeHTML", "time", "getNodesByXPath", "Preferences",
"PreferencesObserver", "ClipboardMonitor", "katakanaToRomaji", "getPrefs",
"katakanaToHiragana", "hiraganaToKatakana", "read", "write",
"getDictionaryPath", "getUserDictionaryPath",
"getDllFile", "readUri", "getMecabWorker", "groupBy", "getMecabDictIndexFile",
"copyTextToClipboard", "getTextFromClipboard", "getChromeWindow", "getSessionStore",
"runMecabDictIndex", "getUserDictionaryFile", "setInterval", "clearInterval",
"getRikaichanDictionaryFileFromChromeURL"];

Components.utils["import"]("resource://gre/modules/PrivateBrowsingUtils.jsm");
Components.utils["import"]("resource://gre/modules/Task.jsm");
Components.utils["import"]("resource://gre/modules/NetUtil.jsm");
Components.utils["import"]("resource://gre/modules/Promise.jsm");
Components.utils["import"]("resource://gre/modules/devtools/Console.jsm");
Components.utils["import"]("resource://gre/modules/Services.jsm");
Components.utils["import"]("resource://gre/modules/FileUtils.jsm");

Components.utils["import"]("resource://furiganainserter/MecabWorker.js");

let Ci = Components.interfaces;
let Cc = Components.classes;
let XPathResult = Ci.nsIDOMXPathResult;
let Node = Ci.nsIDOMNode;
let NodeFilter = Ci.nsIDOMNodeFilter;

function groupBy(list, equal) {
    let group = [], result = [];
    list.forEach(function (element) {
        if (group.length === 0) {
            group.push(element);
        } else if (equal(group[0], element)) {
            group.push(element);
        } else {
            result.push(group);
            group = [element];
        }
    });
    if (group.length > 0) {
        result.push(group);
    }
    return result;
}

function getChromeWindow(win) {
    return win.QueryInterface(Ci.nsIInterfaceRequestor)
    .getInterface(Ci.nsIWebNavigation)
    .QueryInterface(Ci.nsIDocShellTreeItem)
    .rootTreeItem
    .QueryInterface(Ci.nsIInterfaceRequestor)
    .getInterface(Ci.nsIDOMWindow);
}

function katakanaToHiragana(str) {
    let retval = "";
    for (let i = 0; i < str.length; ++i) {
        let c = str.charAt(i);
        let code = c.charCodeAt(0);
        if (code < 0x30A1 || code > 0x30F6) {
            retval += c;
        } else {
            retval += String.fromCharCode(code - 0x60);
        }
    }
    return retval;
}

function hiraganaToKatakana(str) {
    let retval = "";
    for (let i = 0; i < str.length; ++i) {
        let c = str.charAt(i);
        let code = str.charCodeAt(i);
        if (code < 0x3041 || code > 0x3096) {
            retval += c;
        } else {
            retval += String.fromCharCode(code + 0x60);
        }
    }
    return retval;
}

let loadRomaji = (function () {
    let romajiTable = null;
    return function () {
        if (romajiTable == null) {
            let uri = NetUtil.newURI("chrome://furiganainserter/content/romaji.json");
            let string = read(uri, "UTF-8");
            romajiTable = JSON.parse(string);
        }
        return romajiTable;
    };
})();

function katakanaToRomaji(string) {
    let table = loadRomaji();
    let result = "";
    for (let i = 0; i < string.length;) {
        let j = 0;
        for (j = 3; j > 0; --j) {
            let substring = string.substring(i, i + j);
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

function getFileFromChromeURL(chromeUrl) {
    let chromeRegistry = Cc["@mozilla.org/chrome/chrome-registry;1"]
    .getService(Ci.nsIChromeRegistry);
    let url = chromeRegistry.convertChromeURL(NetUtil.newURI(chromeUrl));
    let fileURL = url.QueryInterface(Ci.nsIFileURL);
    return fileURL.file;
}

function getRikaichanDictionaryFileFromChromeURL(chromeUrl) {
    let chromeRegistry = Cc["@mozilla.org/chrome/chrome-registry;1"]
    .getService(Ci.nsIChromeRegistry);
    let url = chromeRegistry.convertChromeURL(NetUtil.newURI(chromeUrl));
    let fileURL;
    if (url.path.startsWith("file://")) {
       fileURL = NetUtil.newURI(url.path);
    } else {
        fileURL = NetUtil.newURI(url.prePath + url.path);
    }
    fileURL.QueryInterface(Ci.nsIFileURL);
    let file = fileURL.file;
    if (url.path.startsWith("file://")) {
        file = file.parent;
    }
    file = file.parent;
    file = file.parent;
    file = file.parent;
    file.append("dict.sqlite");
    return file;
}

function escapeHTML (text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g,
        '&gt;');
}

function time (f) {
    let start = new Date().getTime();
    let result = f();
    let end = new Date().getTime();
//    console.log("time: " + (end - start) + " ms");
    return result;
}

function getNodesByXPath (elem, expr) {
    let doc = elem.ownerDocument;
    let nodes = [], node;
    let result = doc.evaluate(expr, elem, null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    while ((node = result.iterateNext())) {
        nodes.push(node);
    }
    return nodes;
}

function write(file, data, charset, append) {
    if (!(file instanceof Ci.nsIFile)) {
        throw new TypeError("file must be a nsIFile");
    }
    let fos = null;
    let cos = null;
    try {
        fos = Cc['@mozilla.org/network/file-output-stream;1']
        .createInstance(Ci.nsIFileOutputStream);
        let flags = append ? 0x02 | 0x10 /*wronly,append*/: 0x02 | 0x08 | 0x20 /*wronly,create,truncate*/;
        fos.init(file, flags, -1, 0);
        cos = Cc["@mozilla.org/intl/converter-output-stream;1"]
        .createInstance(Ci.nsIConverterOutputStream);
        cos.init(fos, charset, -1, 0x0000);
        cos.writeString(data);
    } finally {
        if (fos) {
            fos.close();
        }
        if (cos) {
            cos.close();
        }
    }
}

function read(fileOrUri, charset) {
    let is = null;
    let cis = null;
    try {
        if (fileOrUri instanceof Ci.nsIURI) {
            let channel = Services.io.newChannelFromURI(fileOrUri);
            is = channel.open();
        } else if (fileOrUri instanceof Ci.nsIFile) {
            is = Cc['@mozilla.org/network/file-input-stream;1']
            .createInstance(Ci.nsIFileInputStream);
            is.init(fileOrUri, -1, -1, 0);
        } else {
            throw new TypeError("fileOrUri must be an nsIFile or an nsIURI");
        }
        cis = Cc['@mozilla.org/intl/converter-input-stream;1']
        .createInstance(Ci.nsIConverterInputStream);
        cis.init(is, charset, -1, 0x0000);
        let retval = "";
        let str = {};
        while (cis.readString(-1, str) > 0) {
            retval += str.value;
        }
        return retval;
    } finally {
        if (is) {
            is.close();
        }
        if (cis) {
            cis.close();
        }
    }
}

function Preferences (branchName) {
    // nsIPrefBranch
    this._prefs = Services.prefs.getBranch(branchName);
}

Preferences.prototype.unregister = function (observer) {
    this._prefs.removeObserver("", observer);
};

Preferences.prototype.register = function (observer) {
    this._prefs.addObserver("", observer, false);
};

Preferences.prototype.setPref = function (name, val) {
    let type = this._prefs.getPrefType(name);
    switch (type) {
    case Ci.nsIPrefBranch.PREF_BOOL:
        this._prefs.setBoolPref(name, val);
        break;
    case Ci.nsIPrefBranch.PREF_INT:
        this._prefs.setIntPref(name, val);
        break;
    case Ci.nsIPrefBranch.PREF_STRING:
        let str = Cc["@mozilla.org/supports-string;1"]
        .createInstance(Ci.nsISupportsString);
        str.data = val;
        this._prefs.setComplexValue(name, Ci.nsISupportsString, str);
        break;
    default:
        throw new Error("unknown preference type: " + type);
    }
};

Preferences.prototype.getPref = function (name) {
    let type = this._prefs.getPrefType(name);
    switch (type) {
    case Ci.nsIPrefBranch.PREF_BOOL:
        return this._prefs.getBoolPref(name);
    case Ci.nsIPrefBranch.PREF_INT:
        return this._prefs.getIntPref(name);
    case Ci.nsIPrefBranch.PREF_STRING:
        return this._prefs.getComplexValue(name, Ci.nsISupportsString).data;
    default:
        throw new Error("unknown preference type: " + type);
    }
};

Preferences.prototype.resetPref = function (name) {
    this._prefs.clearUserPref(name);
};

// nsIObserver
function PreferencesObserver (func) {
    this._func = func;
}

// aSubject - The nsIPrefBranch object
// aTopic - The string defined by NS_PREFBRANCH_PREFCHANGE_TOPIC_ID
// aData - The name of the preference which has changed, relative to the |root|
// of the aSubject branch.
PreferencesObserver.prototype.observe = function (subject, topic, data) {
    if (topic !== "nsPref:changed") {
        return;
    }
    this._func({
        data : data,
        subject : subject,
        topic : topic
    });
};

function getTextFromClipboard () {
    try {
        let trans = Cc["@mozilla.org/widget/transferable;1"]
        .createInstance(Ci.nsITransferable);
        trans.init(null);
        trans.addDataFlavor("text/unicode");
        Services.clipboard.getData(trans, Ci.nsIClipboard.kGlobalClipboard);
        let str = {};
        let strLength = {};
        trans.getTransferData("text/unicode", str, strLength);
        str = str.value.QueryInterface(Ci.nsISupportsString);
        return str.data.substring(0, strLength.value / 2);
    } catch (e) {
        console.error("error getting text from clipboard: " + e.message);
        return "";
    }
}

function copyTextToClipboard (text, sourceWindow) {
    try {
        let str = Cc["@mozilla.org/supports-string;1"]
        .createInstance(Ci.nsISupportsString);
        str.data = text;
        let trans = Cc["@mozilla.org/widget/transferable;1"]
        .createInstance(Ci.nsITransferable);
        let privacyContext = PrivateBrowsingUtils.privacyContextFromWindow(sourceWindow);
        trans.init(privacyContext);
        trans.addDataFlavor("text/unicode");
        trans.setTransferData("text/unicode", str, text.length * 2);
        Services.clipboard.setData(trans, null, Ci.nsIClipboard.kGlobalClipboard);
    } catch (e) {
        console.error("error copying text to clipboard: " + e.message);
    }
}

function setInterval(func, delay, ...params) {
    if (typeof func !== "function") {
        throw new TypeError("func must be a function");
    }
    if (typeof delay != "number") {
        throw new TypeError("delay must be a number");
    }
    let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    timer.initWithCallback({
        notify : function () {
            func.call(null, ...params);
        }
    }, delay, Ci.nsITimer.TYPE_REPEATING_SLACK);
    return timer;
}

function clearInterval(intervalID) {
    if (!intervalID instanceof Ci.nsITimer) {
        throw new TypeError("intervalID must be a nsITimer");
    }
    intervalID.cancel();
}

function ClipboardMonitor (interval, callback) {
    let previousText = "";
    let notify = function () {
        // get text from clipboard. if text hasn't changed ignore it,
        // otherwise paste it into the document
        let text = getTextFromClipboard();
        if (text !== previousText) {
            previousText = text;
            callback(text);
        }
    }
    this._timer = setInterval(notify, interval);
}

ClipboardMonitor.prototype.cancel = function () {
    clearInterval(this._timer);
};

function getDictionaryPath () {
    let chromeUrl = "chrome://furiganainserter-dictionary/content/etc/mecabrc";
    try {
        return getFileFromChromeURL(chromeUrl).path;
    } catch (e) {
        return "";
    }
}

function getUserDictionaryPath () {
    let file = getUserDictionaryFile("dic");
    if (file.exists()) {
        return file.path;
    } else {
        return "";
    }
}

function getDllFile () {
    let ext;
    if (Services.appinfo.OS === "Darwin") {
        ext = "dylib";
    } else if (Services.appinfo.OS === "Linux") {
        ext = "so";
    } else {
        ext = "dll";
    }
    let file = getFileFromChromeURL("chrome://furiganainserter/content");
    file = file.parent.parent;
    file.append("mecab");
    file.append("libmecab." + ext);
    return file;
}

function getMecabDictIndexFile() {
    if (Services.appinfo.OS === "WINNT") {
        let file = getFileFromChromeURL("chrome://furiganainserter/content");
        file = file.parent.parent;
        file.append("mecab");
        file.append("mecab-dict-index.exe");
        return file;
    } else {
        return new FileUtils.File("/usr/lib/mecab/mecab-dict-index");
    }
}

function getUserDictionaryFile (extension) {
    return FileUtils.getFile("ProfD", ["furigana_inserter_user_dictionary." + extension]);
}

let getMecabWorker = (function () {
    let mecabWorker = null;
    return function () {
        if (mecabWorker === null) {
            mecabWorker = new MecabWorker();
        }
        return mecabWorker;
    }
})();

function getSessionStore() {
    return Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
}

function runMecabDictIndex (dictionaryInfo) {
    if (dictionaryInfo === "") {
        return;
    }
    let csvFile = getUserDictionaryFile("csv");
    let dicFilePath = dictionaryInfo.split(/\n/)[0].split(/;/)[0];
    dicFilePath = dicFilePath.substring("filename=".length);
    let dicFile = new FileUtils.File(dicFilePath);
    dicFile.normalize();
    let dicDir = dicFile.parent;
    let userDicFile = getUserDictionaryFile("dic");
    let charset = dictionaryInfo.split(/\n/)[0].split(/;/)[1]
    .substring("charset=".length);
    runMecabDictIndex2(userDicFile, dicDir, csvFile, charset);
}

function runMecabDictIndex2 (userDicFile, dicDir, csvFile, charset) {
    let process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    let file = getMecabDictIndexFile();
    process.init(file);
//    console.log('"'+[file.path, userDicFile.path, dicDir.path, charset, csvFile.path].join('", "')+'"');
    let args = ["-u", userDicFile.path, "-d", dicDir.path, "-f", "UTF-8", "-t",
    charset, csvFile.path];
    process.runw(false, args, args.length);
}

function __extends(sub, sup) {
//    sup.prototype = Object.create(sup.prototype);
    let F = function () {};
    F.prototype = sup.prototype;
    sub.prototype = new F();
    sub.prototype.constructor = sub;
}

let getPrefs = (function () {
    let prefs = null;
    return function () {
        if (prefs === null) {
             prefs = new Preferences("extensions.furiganainserter.");
        }
        return prefs;
    }
})();

// [from, to), "from" inclusive, "to" not inclusive
function* range(from, to) {
    for (let i = from; i < to; ++i) {
        yield i;
    }
}
function* filter(iterable, func) {
    let iterator;
    if (typeof iterable === "function") {
        iterator = iterable();
        if (!("next" in iterator)) {
            throw new TypeError("not an iterable: " + iterable);
        }
    } else {
        iterator = iterable;
        if (!("length" in iterator || "next" in iterator)) {
            throw new TypeError("not an iterator: " + iterator);
        }
    }
    for (let elem of iterator) {
        if (func(elem)) {
            yield elem;
        }
    }
}
