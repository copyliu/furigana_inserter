"use strict";

Components.utils["import"]("resource://furiganainserter/utilities.js");
Components.utils["import"]("resource://gre/modules/AddonManager.jsm");

var Cc = Components.classes;
var Ci = Components.interfaces;

var initialized = false;

var sectionNames = {
    "name" : "name",
    "noun" : "noun"
}

function convertToCsv (text) {
    var lines = text.split(/\n/);
    var section = "";
    var retval = [];
    lines.forEach(function (line) {
        line = line.trim();
        var fields, kanji, kana;
        if (sectionNames.hasOwnProperty(line)) {
            section = line;
            return;
        }
        if (section === "name") {
            var match = line.match("(.*)[\uFF08(](.*)[)\uFF09]");
            if (!match || match.length !== 3) return;
            kanji = match[1];
            kana = match[2];
            kanji = kanji.trim().split(/\s+/);
            kana = kana.trim().split(/\s+/);
            if (kana.length !== kanji.length) return;
            if (kana.length === 1) {
                retval.push(createName(kanji[0], kana[0]));
            } else if (kana.length === 2) {
                retval.push(createSurname(kanji[0], kana[0]));
                retval.push(createName(kanji[1], kana[1]));
            } else return;
        } else if (section === "noun") {
            fields = line.split(/\s+/);
            if (fields.length !== 2) return;
            kanji = fields[0];
            kana = fields[1];
            retval.push(createNoun(kanji, kana));
        }
    })
    return retval.join("\n");
}

function createName (kanji, kana) {
    kana = hiraganaToKatakana(kana);
    var id = "1291";
    return kanji.concat(",", id, ",", id, ",1000,名詞,固有名詞,人名,名,*,*,", kanji,
            ",", kana, ",", kana, ",,");
}

function createSurname (kanji, kana) {
    kana = hiraganaToKatakana(kana)
    var id = "1290"
    return kanji.concat(",", id, ",", id, ",1000,名詞,固有名詞,人名,姓,*,*,", kanji,
            ",", kana + ",", kana, ",,")
}

function createNoun (kanji, kana) {
    kana = hiraganaToKatakana(kana);
    var id = "1285";
    return kanji.concat(",", id, ",", id, ",1000,名詞,一般,*,*,*,*,", kanji, ",",
            kana, ",", kana, ",,");
}

function loadDictionary () {
    var textFile = getUserDictionaryFile("txt");
    if (!textFile.exists()) return;
    var text = read(textFile, "UTF-8");
    var textbox = document.getElementById("userDictionaryTextbox");
    textbox.defaultValue = text;
    textbox.reset();
}

function doUpdate () {
    // doOK()
    // 1. get text from textbox
    // 2. convert text to CSV format
    // 3. save text in a CSV file
    // 4. get the dictionary directory from a tagger
    // 5. create user directory with a tagger

    // 1. get text from textbox
    var textbox = document.getElementById("userDictionaryTextbox");
    var text = textbox.value;

    // 2. convert text to CSV format
    var csvText = convertToCsv(text);

    // 3. save text in a CSV file
    var csvFile = getUserDictionaryFile("csv");
    write(csvFile, csvText);

    // 4. get the dictionary directory from a tagger
//    var worker = new MecabWorker(opener.document);
    var worker = getMecabWorker();
    worker.send({
        request : "getDictionaryInfo",
        userDicPath : "",
        dicPath : getDictionaryPath()
    }, runMecabDictIndex)
}

function runMecabDictIndex (data) {
    var csvFile = getUserDictionaryFile("csv");
    var dictionaryInfo = data.info;
    if (dictionaryInfo === "") return;

    var dicFilePath = dictionaryInfo.split(/\n/)[0].split(/;/)[0];
    dicFilePath = dicFilePath.substring("filename=".length);
    var dicFile = open(dicFilePath);
    dicFile.normalize();
    var dicDir = dicFile.parent;

    // 5. create user directory with a tagger
    var userDicFile = getUserDictionaryFile("dic");
    var charset = dictionaryInfo.split(/\n/)[0].split(/;/)[1]
            .substring("charset=".length);
    runMecabDictIndex2(userDicFile, dicDir, csvFile, charset);
}

function runMecabDictIndex2 (userDicFile, dicDir, csvFile, charset) {
    var process = Cc["@mozilla.org/process/util;1"]
            .createInstance(Ci.nsIProcess);
    var file = null;
    if (getOS() === "WINNT") {
        file = getExtension().getResourceURI("mecab/mecab-dict-index.exe");
        file = file.QueryInterface(Ci.nsIFileURL).file;
    } else file = open("/usr/lib/mecab/mecab-dict-index");
    // log(file.path + ["-u", userDicFile.path, "-d", dicDir.path, "-f",
    // "UTF-8", "-t", charset, csvFile.path].join(" "))
    process.init(file);
    var args = ["-u", userDicFile.path, "-d", dicDir.path, "-f", "UTF-8", "-t",
            charset, csvFile.path];
    process.runw(false, args, args.length);
}

function getUserDictionaryFile (extension) {
    var file = Cc["@mozilla.org/file/directory_service;1"].getService(
            Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    file.append("furigana_inserter_user_dictionary." + extension);
    return file;
}

function doOK () {
    var textbox = document.getElementById("userDictionaryTextbox");
    var text = textbox.value;
    var file = getUserDictionaryFile("txt");
    write(file, text);
    textbox.editor.resetModificationCount();
    return true;
}

function doHelp () {
    var ps = Cc["@mozilla.org/embedcomp/prompt-service;1"]
            .getService(Ci.nsIPromptService);
    var win = window.opener;
    var text = win.document.getElementById("furiganainserter-strings")
            .getString("userDictionaryHelp");
    ps.alert(window, "User Dictionary Help", text);
    return true;
}

function onload () {
    if (initialized) return;
    loadDictionary();
    initialized = true;
}

function doCancel () {
    return true;
}

window.addEventListener("load", onload, false);
