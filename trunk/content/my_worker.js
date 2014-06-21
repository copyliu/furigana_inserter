"use strict";

let OS = "";
let mecab = null;

function getOS() {
    return OS;
}

function WideCharToMultiByte(data, cp) {
    let lib = ctypes.open("kernel32");
    let func = lib.declare("WideCharToMultiByte", ctypes.default_abi,
            ctypes["int"], // return value
            ctypes.unsigned_int,
            ctypes.unsigned_long,
            ctypes.jschar.array(),
            ctypes["int"],
            ctypes["char"].ptr,
            ctypes["int"],
            ctypes["char"].ptr,
            ctypes.bool.ptr);
    let cdata_length = func(cp, 0, data, -1, null, 0, null, null);
    if (cdata_length === 0) {
        return null;
    }
    let cdata = ctypes["char"].array(cdata_length)();
    let error_code = func(cp, 0, data, -1, cdata, cdata_length, null, null);
    if (error_code === 0) {
        return null;
    }
    return cdata;
}

function MultiByteToWideChar(cdata, cp) {
    let lib = ctypes.open("kernel32");
    let func = lib.declare("MultiByteToWideChar", ctypes.default_abi,
            ctypes["int"], // return value
            ctypes.unsigned_int,
            ctypes.unsigned_long,
            ctypes["char"].ptr,
            ctypes["int"],
            ctypes.jschar.ptr,
            ctypes["int"]);
    let data_length = func(cp, 0, cdata, -1, null, 0);
    if (data_length === 0) {
        return null;
    }
    let data = ctypes.jschar.array(data_length)();
    let error_code = func(cp, 0, cdata, -1, data, data_length);
    if (error_code === 0) {
        return null;
    }
    return data.readString();
}

function convertToUnicode(cdata, charset) {
    if (charset === "UTF-8" || charset === "utf8") {
        return cdata.readString();
    }
    if (getOS() === "WINNT") {
        if (charset === "utf8" || charset === "UTF-8") {
            return MultiByteToWideChar(cdata, 65001);
        } else if (charset === "SHIFT-JIS") {
            return MultiByteToWideChar(cdata, 932);
        } else if (charset === "EUC-JP") {
            return MultiByteToWideChar(cdata, 20932);
        } else {
            throw new Error("unsupported character set: " + charset);
        }
    }
    throw new Error("unsupported character set, only UTF-8 is supported: " + charset);
}

function convertFromUnicode(data, charset) {
    if (charset === "UTF-8" || charset === "utf8") {
        return ctypes["char"].array()(data);
    }
    if (getOS() === "WINNT") {
        if (charset === "utf8" || charset === "UTF-8") {
            return WideCharToMultiByte(data, 65001);
        } else if (charset === "SHIFT-JIS") {
            return WideCharToMultiByte(data, 932);
        } else if (charset === "EUC-JP") {
            return WideCharToMultiByte(data, 20932);
        } else {
            throw new Error("unsupported character set: " + charset);
        }
    }
    throw new Error("unsupported character set, only UTF-8 is supported: " + charset);
}

function MeCab() {
    this.lib = null;
    this.mecab_dictionary_info_t = null;
    this.mecab_new = null;
    this.mecab_new2 = null;
    this.mecab_sparse_tostr = null;
    this.mecab_destroy = null;
    this.mecab_dictionary_info = null;
    this.mecab_version = null;
    this.mecab_strerror = null;
}

MeCab.prototype.getError = function() {
    let retval = this.mecab_strerror(null);
    if (retval.isNull()) {
        return "";
    } else {
        return retval.readString();
    }
};

MeCab.prototype.tryOpeningLibrary = function() {
    try {
        return ctypes.open(this.getDllName());
    } catch (e) {
        if (getOS() === "Linux") {
            return ctypes.open("libmecab.so.2");
        } else {
            throw e;
        }
    }
};

MeCab.prototype.init = function(dllPath) {
    if (this.lib) {
        return this;
    }
    try {
        if (dllPath === "") {
            throw new Error("dllPath is empty");
        }
        this.lib = ctypes.open(dllPath);
    } catch (e) {
        this.lib = this.tryOpeningLibrary();
    }
    let mecab_t = ctypes.StructType("mecab_t").ptr;
    let mecab_dictionary_info_t = ctypes.StructType("mecab_dictionary_info_t");
    mecab_dictionary_info_t.define([
        { filename: ctypes["char"].ptr },
        { charset: ctypes["char"].ptr },
        { size: ctypes.unsigned_int },
        { type: ctypes["int"] },
        { lsize: ctypes.unsigned_int },
        { rsize: ctypes.unsigned_int },
        { version: ctypes.unsigned_short },
        { next: mecab_dictionary_info_t.ptr }
        ]);
    this.mecab_dictionary_info_t = mecab_dictionary_info_t;
    this.mecab_new = this.lib.declare("mecab_new", ctypes.default_abi,
            mecab_t,
            ctypes["int"],
            ctypes["char"].ptr.array());
    this.mecab_new2 = this.lib.declare("mecab_new2", ctypes.default_abi,
            mecab_t,
            ctypes["char"].ptr);
    this.mecab_sparse_tostr = this.lib.declare("mecab_sparse_tostr", ctypes.default_abi,
            ctypes["char"].ptr,
            mecab_t,
            ctypes["char"].ptr);
    this.mecab_destroy = this.lib.declare("mecab_destroy", ctypes.default_abi,
            ctypes.void_t,
            mecab_t);
    this.mecab_dictionary_info = this.lib.declare("mecab_dictionary_info", ctypes.default_abi,
            mecab_dictionary_info_t.ptr,
            mecab_t);
    this.mecab_version = this.lib.declare("mecab_version", ctypes.default_abi,
            ctypes["char"].ptr);
    this.mecab_strerror = this.lib.declare("mecab_strerror", ctypes.default_abi,
            ctypes["char"].ptr,
            mecab_t);
    return this;
};

MeCab.prototype.getDllName = function() {
    if (getOS() === "Linux") {
        return "libmecab.so.1";
    } else if (getOS() === "Darwin") {
        return "libmecab.dylib";
    } else if (getOS() === "WINNT") {
        return "libmecab.dll";
    } else {
        throw new Error("unsupported OS: " + getOS());
    }
};

MeCab.prototype.createTagger = function(mecabrcPath, userDicPath) {
    if (!this.lib) {
        throw new Error("MeCab not initialized");
    }
    let cMecabrcPath = ctypes["char"].array()(mecabrcPath);
    let cUserDicPath = ctypes["char"].array()(userDicPath);
    let args = [];
    args.push("mecab.exe");
    if (mecabrcPath !== "") {
        args.push("-r", cMecabrcPath);
    }
    if (userDicPath !== "") {
        args.push("-u", cUserDicPath);
    }
    args.push("-F", "%m\t%H\t%pl\t%pL\n");
    let cargs = ctypes["char"].ptr.array(args.length)();
    for (let i = 0; i < args.length; ++i)
        cargs[i] = ctypes["char"].array()(args[i]);
    let tagger = this.mecab_new(args.length, cargs);
    if (tagger.isNull()) {
        throw new Error("couldn't create tagger: " + mecabrcPath +", "+ userDicPath);
    }
    let retval = new Tagger(this, tagger);
    return retval;
};

MeCab.prototype.getVersion = function() {
    if (!this.lib) {
        throw new Error("MeCab not initialized");
    }
    return this.mecab_version().readString();
};

function Tagger(mecab, tagger) {
    this.tagger = tagger;
    this.mecab = mecab;
    this.node = null;
}

Tagger.prototype.getError = function() {
    let retval = this.mecab.mecab_strerror(this.tagger);
    if (retval.isNull()) {
        return "";
    } else {
        return retval.readString();
    }
};

Tagger.prototype.destroyTagger = function() {
    if (this.tagger) {
        this.mecab.mecab_destroy(this.tagger);
        this.tagger = null;
    }
};

Tagger.prototype.getDictionaryInfo = function() {
    if (!this.tagger) {
        throw new Error("tagger not initialized");
    }
    let retval = "";
    let info = this.mecab.mecab_dictionary_info(this.tagger);
    while (!info.isNull()) {
        let filename = info.contents.filename.readString();
        retval += "filename=" + filename + ";charset="
                + info.contents.charset.readString() + ";size="
                + info.contents.size + ";type=" + info.contents.type
                + ";lsize=" + info.contents.lsize + ";rsize="
                + info.contents.rsize + ";version=" + info.contents.version
                + "\n";
        info = info.contents.next;
    }
    return retval;
};

Tagger.prototype.getAll = function(text) {
    if (!this.tagger) {
        throw new Error("tagger not initialized");
    }
    let info = this.mecab.mecab_dictionary_info(this.tagger);
    if (info.isNull()) {
        throw new Error("couldn't get the dictionary information");
    }
    let charset = info.contents.charset.readString();
    let ctext = convertFromUnicode(text, charset);
    ctext = this.mecab.mecab_sparse_tostr(this.tagger, ctext);
    text = convertToUnicode(ctext, charset);
    let lines = text.split("\n");
    let nodes = [];
    lines.forEach(function(line) {
        if (line === "") {
            return;
        }
        let node;
        if (line === "EOS") {
            node = {
                surface: "EOS",
                feature: "",
                length: 0
            };
        } else {
            let fields = line.split("\t");
            let pl = parseInt(fields[2]);
            let pL = parseInt(fields[3]);
            node = {
                surface: fields[0],
                feature: fields[1],
                length: pL - pl
            };
        }
        nodes.push(node);
    });
    return nodes;
};

function createTagger(dicPath, userDicPath) {
    if (!mecab) {
        throw new Error("MeCab not initialized");
    }
    try {
        return mecab.createTagger(dicPath, userDicPath);
    } catch (e) {
        return mecab.createTagger(dicPath, "");
    }
    return null; // unreachable
}

function init(data) {
    OS = data.OS;
    mecab = new MeCab().init(data.dllPath);
}

function getNodes(data) {
    let nodes = [];
    let tagger = createTagger(data.dicPath, data.userDicPath);
    if (!tagger) {
        throw new Error("couldn't create a tagger");
    }
    data.text.forEach(function(text) {
        let taggerNodes = tagger.getAll(text);
        nodes.push(taggerNodes);
    });
    tagger.destroyTagger();
    postMessage(nodes);
}

function getDictionaryInfo(data) {
    let tagger = createTagger(data.dicPath, data.userDicPath);
    if (!tagger) {
        throw new Error("couldn't create a tagger");
    }
    let info = tagger.getDictionaryInfo();
    tagger.destroyTagger();
    postMessage(info);
}

onmessage = function(event) {
    let data = event.data;
    switch (data.type) {
        case "init":
            init(data.data);
            break;
        case "getNodes":
            getNodes(data.data);
            break;
        case "getDictionaryInfo":
            getDictionaryInfo(data.data);
            break;
        case "getVersion":
            postMessage(mecab.getVersion());
            break;
        default:
            throw new Error("unknown request: " + data.type);
    }
};
