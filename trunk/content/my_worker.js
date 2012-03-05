var OS = ""

var mecab = null

var tagger = null

function getOS () {
    return OS
}

function GetACP () {
    return ctypes.open("kernel32").declare("GetACP", ctypes.default_abi,
    ctypes.unsigned_int)()
}

function WideCharToMultiByte (data, cp) {
    var lib = ctypes.open("kernel32")
    var func = lib.declare("WideCharToMultiByte", ctypes.default_abi,
        ctypes["int"],
        ctypes.unsigned_int,
        ctypes.unsigned_long,
        ctypes.jschar.array(),
        ctypes["int"],
        ctypes["char"].ptr,
        ctypes["int"],
        ctypes["char"].ptr,
        ctypes.bool.ptr
    )

    var cdata_length = func(cp, 0, data, -1, null, 0, null, null)
    if (cdata_length === 0) return null
    var cdata = ctypes["char"].array(cdata_length)()
    var error_code = func(cp, 0, data, -1, cdata, cdata_length, null, null)
    if (error_code === 0) return null
    return cdata
}

function MultiByteToWideChar (cdata, cp) {
    var lib = ctypes.open("kernel32")
    var func = lib.declare("MultiByteToWideChar", ctypes.default_abi,
        ctypes["int"],
        ctypes.unsigned_int,
        ctypes.unsigned_long,
        ctypes["char"].ptr,
        ctypes["int"],
        ctypes.jschar.ptr,
        ctypes["int"]
    )

    var data_length = func(cp, 0, cdata, -1, null, 0)
    if (data_length === 0) return null
    var data = ctypes.jschar.array(data_length)()
    var error_code = func(cp, 0, cdata, -1, data, data_length)
    if (error_code === 0) return null
    return data.readString()
}

function convertToUnicode (cdata, charset) {
    if (charset === "UTF-8" || charset === "utf8")
        return cdata.readString()

    var OS = getOS()
    if (OS === "WINNT") {
        if (charset === "utf8" || charset === "UTF-8")
            return MultiByteToWideChar(cdata, 65001)
        if (charset === "SHIFT-JIS")
            return MultiByteToWideChar(cdata, 932)
        else if (charset === "EUC-JP")
            return MultiByteToWideChar(cdata, 20932)
        else throw new Error("unsupported character set")
    }
    throw new Error("unsupported character set: only UTF-8 is supported")
}

function convertFromUnicode (data, charset) {
    if (charset === "UTF-8" || charset === "utf8")
        return ctypes["char"].array()(data)

    if (getOS() === "WINNT") {
        if (charset === "utf8" || charset === "UTF-8")
            return WideCharToMultiByte(data, 65001)
        if (charset === "SHIFT-JIS")
            return WideCharToMultiByte(data, 932)
        else if (charset === "EUC-JP")
            return WideCharToMultiByte(data, 20932)
        else throw new Error("unsupported character set")
    }

    throw new Error("unsupported character set: only UTF-8 is supported")
}

function MeCab () {
    this.lib = null
    this.mecab_dictionary_info_t = null
    this.mecab_new = null
    this.mecab_new2 = null
    this.mecab_sparse_tostr = null
    this.mecab_destroy = null
    this.mecab_dictionary_info = null
    this.mecab_version = null
    this.mecab_strerror = null
}

MeCab.prototype = {
    getError: function () {
        var retval = this.mecab_strerror(null)
        if (retval.isNull()) return ""
        else return retval.readString()
    },
    init: function (dllPath) {
        if (this.lib) return this
        try {
            if (dllPath === "") throw new Error()
            this.lib = ctypes.open(dllPath)
        } catch (e) {
            this.lib = ctypes.open(this.getDllName())
        }

        var mecab_t = ctypes.StructType("mecab_t").ptr

        var mecab_dictionary_info_t = ctypes.StructType("mecab_dictionary_info_t")
        mecab_dictionary_info_t.define([
            {filename: ctypes["char"].ptr},
            {charset: ctypes["char"].ptr},
            {size: ctypes.unsigned_int},
            {type: ctypes["int"]},
            {lsize: ctypes.unsigned_int},
            {rsize: ctypes.unsigned_int},
            {version: ctypes.unsigned_short},
            {next: mecab_dictionary_info_t.ptr}
        ])

        this.mecab_dictionary_info_t = mecab_dictionary_info_t

        this.mecab_new = this.lib.declare("mecab_new",
            ctypes.default_abi, mecab_t, ctypes["int"], ctypes["char"].ptr.array())

        this.mecab_new2 = this.lib.declare("mecab_new2",
            ctypes.default_abi, mecab_t, ctypes["char"].ptr)

        this.mecab_sparse_tostr = this.lib.declare("mecab_sparse_tostr",
            ctypes.default_abi, ctypes["char"].ptr, mecab_t, ctypes["char"].ptr)

        this.mecab_destroy = this.lib.declare("mecab_destroy",
            ctypes.default_abi, ctypes.void_t, mecab_t)

        this.mecab_dictionary_info = this.lib.declare("mecab_dictionary_info",
            ctypes.default_abi, mecab_dictionary_info_t.ptr, mecab_t)

        this.mecab_version = this.lib.declare("mecab_version",
            ctypes.default_abi, ctypes["char"].ptr)

        this.mecab_strerror = this.lib.declare("mecab_strerror",
            ctypes.default_abi, ctypes["char"].ptr, mecab_t)

        return this
    },
    getDllName: function () {
        if (getOS() === "Linux")
            return "libmecab.so.1"
        else if (getOS() === "Darwin")
            return "libmecab.dylib"
        else if (getOS() === "WINNT")
            return "libmecab.dll"
        else throw new Error("unsupported OS: " + getOS())
    },
    createTagger: function (dicPath, userDicPath) {
        if (!this.lib) throw new Error("MeCab not initialized")

        if (getOS() === "WINNT") {
            dicPath = WideCharToMultiByte(dicPath, GetACP())
            userDicPath = WideCharToMultiByte(userDicPath, GetACP())
        }
        else {
            dicPath = ctypes["char"].array()(dicPath)
            userDicPath = ctypes["char"].array()(userDicPath)
        }
        var args = []
        args.push("mecab.exe")
        if (dicPath !== "")
            args.push("-r", dicPath)
        if (userDicPath !== "")
            args.push("-u", userDicPath)
        args.push("-F", "%m\t%H\t%pl\t%pL\n")
        var cargs = ctypes["char"].ptr.array(args.length)()
        for (var i = 0; i < args.length; ++i)
            cargs[i] = ctypes["char"].array()(args[i])
        var tagger = this.mecab_new(args.length, cargs)
        if (tagger.isNull()) {
            var e = this.getError()
            throw new Error(e)
        }
        var retval = new Tagger(this, tagger)
        return retval
    },
    getVersion: function () {
        if (!this.lib) throw new Error("MeCab not initialized")
        return this.mecab_version().readString()
    },
}

function Tagger (mecab, tagger) {
    this.tagger = tagger
    this.mecab = mecab
    this.node = null
}

Tagger.prototype = {
    getError: function () {
        var retval = this.mecab.mecab_strerror(this.tagger)
        if (retval.isNull()) return ""
        else return retval.readString()
    },
    destroyTagger: function () {
        if (this.tagger) {
            this.mecab.mecab_destroy(this.tagger)
            this.tagger = null
        }
    },
    getDictionaryInfo: function () {
        if (!this.tagger)
            throw new Error("tagger not initialized")
        var info, filename
        var retval = ""
        info = this.mecab.mecab_dictionary_info(this.tagger)
        while (!info.isNull()) {
            if (getOS() === "WINNT")
                filename = MultiByteToWideChar(info.contents.filename, GetACP())
            else
                filename = info.contents.filename.readString()
            retval += "filename=" + filename +
                ";charset=" + info.contents.charset.readString() +
                ";size=" + info.contents.size + ";type=" + info.contents.type +
                ";lsize=" + info.contents.lsize +
                ";rsize=" + info.contents.rsize + ";version=" + info.contents.version + "\n"
            info = info.contents.next
        }
        return retval
    },
    getAll: function (text) {
        if (!this.tagger) throw new Error("tagger not initialized")

        var info = this.mecab.mecab_dictionary_info(this.tagger)
        if (info.isNull()) throw new Error("couldn't get dictionary information")

        var charset = info.contents.charset.readString()
        var ctext = null
        ctext = convertFromUnicode(text, charset)
        ctext = this.mecab.mecab_sparse_tostr(this.tagger, ctext)
        text = convertToUnicode(ctext, charset)
        var lines = text.split("\n")
        var nodes = []
        lines.forEach(function (line) {
            if (line === "") return
            var fields = line.split("\t")
            var EOS = (line === "EOS")
            var pl = parseInt(fields[2])
            var pL = parseInt(fields[3])
            nodes.push({
                surface: fields[0],
                feature: EOS ? "" : fields[1],
                length: EOS ? 0 : pL - pl
            })
        })
        return nodes
    }
}

function createTagger (dicPath, userDicPath) {
    if (!mecab)
        throw new Error("MeCab not initialized")
    try {
        tagger = mecab.createTagger(dicPath, userDicPath)
        return tagger
    } catch (e) {
        tagger = mecab.createTagger(dicPath, "")
        return tagger
    }
    return null // unreachable
}

function init (data) {
    OS = data.OS
    mecab = new MeCab().init(data.dllPath)
}

function getNodes (data) {
    var tagger, texts, nodes = []
    tagger = createTagger(data.dicPath, data.userDicPath)
    if (!tagger)
        throw new Error("couldn't create tagger")
    texts = data.text
    texts.forEach(function (text) {
        var taggerNodes = tagger.getAll(text)
        nodes.push(taggerNodes)
    })
    tagger.destroyTagger()
    postMessage({
        reply: "getNodes",
        nodes: nodes
    })
}

function getDictionaryInfo (data) {
    var tagger, info
    tagger = createTagger(data.dicPath, data.userDicPath)
    if (!tagger)
        throw new Error("couldn't create tagger")
    info = tagger.getDictionaryInfo()
    tagger.destroyTagger()
    postMessage({
        reply: "getDictionaryInfo",
        info: info
    })
}

onmessage = function (event) {
    switch (event.data.request) {
        case "init": {
             init(event.data)
             break
        }
        case "getNodes": {
            getNodes(event.data)
            break
        }
        case "getDictionaryInfo": {
            getDictionaryInfo(event.data)
            break
        }
        case "getVersion": {
            postMessage({
                reply: "getVersion", 
                version: mecab.getVersion()
            })
            break
        }
        default:
            throw new Error("unknown request: " + event.data.request)
    }
}
