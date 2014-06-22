"use strict";

let EXPORTED_SYMBOLS = ["escapeHTML", "time", "getNodesByXPath", "Preferences",
"PreferencesObserver", "ClipboardMonitor", "katakanaToRomaji",
"katakanaToHiragana", "hiraganaToKatakana", "read", "write",
"getDictionaryPath", "getOS", "getExtension", "getUserDictionaryPath",
"getDllFile", "readUri", "getMecabWorker", "groupBy", "getMecabDictIndexFile",
"copyTextToClipboard", "getTextFromClipboard", "getChromeWindow", "getSessionStore",
"runMecabDictIndex", "getUserDictionaryFile"];

Components.utils["import"]("resource://gre/modules/PrivateBrowsingUtils.jsm");
Components.utils["import"]("resource://gre/modules/Task.jsm");
Components.utils["import"]("resource://gre/modules/Promise.jsm");
Components.utils["import"]("resource://gre/modules/NetUtil.jsm");
Components.utils["import"]("resource://gre/modules/osfile.jsm");
Components.utils["import"]("resource://gre/modules/devtools/Console.jsm");
Components.utils["import"]("resource://gre/modules/Services.jsm");
Components.utils["import"]("resource://gre/modules/FileUtils.jsm");

Components.utils["import"]("resource://furiganainserter/MecabWorker.js");

let Ci = Components.interfaces;
let Cc = Components.classes;
let XPathResult = Ci.nsIDOMXPathResult;
let Node = Ci.nsIDOMNode;
let NodeFilter = Ci.nsIDOMNodeFilter;

let mecabWorkerInstance = null;

function groupBy (list, func) {
    let group = [], result = [];
    list.forEach(function (element) {
        if (group.length === 0) {
            group.push(element);
        }
        else if (func(group[0]) === func(element)) {
            group.push(element);
        }
        else {
            result.push(group);
            group = [element];
        }
    });
    if (group.length > 0) {
        result.push(group);
    }
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
    let retval = "";
    let len = str.length;
    for (let i = 0; i < len; ++i) {
        let c = str.charAt(i);
        let code = c.charCodeAt(0);
        if (code < 0x30A1 || code > 0x30F6) {
            retval += c;
        }
        else {
            retval += String.fromCharCode(code - 0x60);
        }
    }
    return retval;
}

function hiraganaToKatakana (str) {
    let retval = "";
    let len = str.length;
    for (let i = 0; i < len; ++i) {
        let c = str.charAt(i);
        let code = str.charCodeAt(i);
        if (code < 0x3041 || code > 0x3096) {
            retval += c;
        }
        else {
            retval += String.fromCharCode(code + 0x60);
        }
    }
    return retval;
}

let loadRomaji = (function () {
    let romajiTable = null;
    return function () {
        if (romajiTable) {
            return romajiTable;
        }
        let string = readUri("chrome://furiganainserter/content/romaji.json",
            "UTF-8");
        romajiTable = JSON.parse(string);
        return romajiTable;
    };
})();

function katakanaToRomaji (string) {
    let table = loadRomaji();
    let j = 0;
    let result = "";
    let substring = "";
    let len = string.length;

    for (let i = 0; i < len;) {
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

function chromeUrlStringToFile(chromeUrl) {
    let chromeRegistry = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
    .getService(Components.interfaces.nsIChromeRegistry);
    let url = chromeRegistry.convertChromeURL(NetUtil.newURI(chromeUrl));
    let fileUrl = url.QueryInterface(Components.interfaces.nsIFileURL);
    return fileUrl.file;
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

function write (file, data, charset, append) {
    let fos = Cc['@mozilla.org/network/file-output-stream;1']
    .createInstance(Ci.nsIFileOutputStream);
    let flags = 0x02 | 0x08 | 0x20; // wronly | create | truncate
    if (append) flags = 0x02 | 0x10; // wronly | append
    fos.init(file, flags, -1, 0);
    let cos = Cc["@mozilla.org/intl/converter-output-stream;1"]
    .createInstance(Ci.nsIConverterOutputStream);
    cos.init(fos, charset, -1, 0x0000);
    cos.writeString(data);
    cos.close();
}

function readUri (uri, charset) {
    let inp = Services.io.newChannel(uri, null, null).open();
    return readStream(inp, charset);
}

function read (file, charset) {
    let fis = Cc['@mozilla.org/network/file-input-stream;1']
    .createInstance(Ci.nsIFileInputStream);
    fis.init(file, -1, -1, 0);
    return readStream(fis, charset);
}

function readStream (is, charset) {
    let retval = "";
    let cis = Cc['@mozilla.org/intl/converter-input-stream;1']
    .createInstance(Ci.nsIConverterInputStream);
    cis.init(is, charset, -1, 0x0000);
    let str = {};
    while (cis.readString(-1, str) > 0) {
        retval += str.value;
    }
    cis.close();
    return retval;
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
    this.func = func;
}

// aSubject - The nsIPrefBranch object
// aTopic - The string defined by NS_PREFBRANCH_PREFCHANGE_TOPIC_ID
// aData - The name of the preference which has changed, relative to the |root|
// of the aSubject branch.
PreferencesObserver.prototype.observe = function (subject, topic, data) {
    if (topic !== "nsPref:changed") {
        return;
    }
    this.func({
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
        Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
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
        Services.clipboard.setData(trans, null, Services.clipboard.kGlobalClipboard);
    } catch (e) {
        console.error("error copying text to clipboard: " + e.message);
    }
}

function ClipboardMonitor (interval, callback) {
    let previousText = "";
    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    let notify = function () {
        // get text from clipboard. if text hasn't changed ignore it,
        // otherwise paste it into the document
        let text = getTextFromClipboard();
        if (text !== previousText) {
            previousText = text;
            callback(text);
        }
    }
    this._timer.initWithCallback({
        notify : notify
    }, interval, Ci.nsITimer.TYPE_REPEATING_SLACK);
}

ClipboardMonitor.prototype.cancel = function () {
    this._timer.cancel();
};

function getDictionaryPath () {
    let chromeUrl = "chrome://furiganainserter-dictionary/content/etc/mecabrc";
    try {
        return chromeUrlStringToFile(chromeUrl).path;
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
    if (getOS() === "Darwin") {
        ext = "dylib";
    } else if (getOS() === "Linux") {
        ext = "so";
    } else {
        ext = "dll";
    }
    let file = chromeUrlStringToFile("chrome://furiganainserter/content");
    file = file.parent.parent;
    file.append("mecab");
    file.append("libmecab." + ext);
    return file;
}

function getMecabDictIndexFile() {
    if (getOS() === "WINNT") {
        let file = chromeUrlStringToFile("chrome://furiganainserter/content");
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

function getOS () {
    return Services.appinfo.OS;
}

function getMecabWorker () {
    if (mecabWorkerInstance) {
        return mecabWorkerInstance;
    }
    mecabWorkerInstance = new MecabWorker();
    return mecabWorkerInstance;
}

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

    // 5. create user directory with a tagger
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
