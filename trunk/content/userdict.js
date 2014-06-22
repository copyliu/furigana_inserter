"use strict";

Components.utils["import"]("resource://gre/modules/Task.jsm");
Components.utils["import"]("resource://gre/modules/devtools/Console.jsm");
Components.utils["import"]("resource://gre/modules/Services.jsm");

Components.utils["import"]("resource://furiganainserter/utilities.js");

let Cc = Components.classes;
let Ci = Components.interfaces;

let initialized = false;

let sectionNames = {
    "name" : "name",
    "noun" : "noun"
};

function convertToCsv (text) {
    let lines = text.split(/\n/);
    let section = "";
    let retval = [];
    lines.forEach(function (line) {
        line = line.trim();
        let fields, kanji, kana;
        if (sectionNames.hasOwnProperty(line)) {
            section = line;
            return;
        }
        if (section === "name") {
            let match = line.match("(.*)[\uFF08(](.*)[)\uFF09]");
            if (!match || match.length !== 3) {
                return;
            }
            kanji = match[1];
            kana = match[2];
            kanji = kanji.trim().split(/\s+/);
            kana = kana.trim().split(/\s+/);
            if (kana.length !== kanji.length) {
                return;
            }
            if (kana.length === 1) {
                retval.push(createName(kanji[0], kana[0]));
            } else if (kana.length === 2) {
                retval.push(createSurname(kanji[0], kana[0]));
                retval.push(createName(kanji[1], kana[1]));
            } else {
                return;
            }
        } else if (section === "noun") {
            fields = line.split(/\s+/);
            if (fields.length !== 2) {
                return;
            }
            kanji = fields[0];
            kana = fields[1];
            retval.push(createNoun(kanji, kana));
        }
    });
    return retval.join("\n");
}

function createName (kanji, kana) {
    kana = hiraganaToKatakana(kana);
    let id = "1291";
    return kanji.concat(",", id, ",", id, ",1000,名詞,固有名詞,人名,名,*,*,", kanji,
        ",", kana, ",", kana, ",,");
}

function createSurname (kanji, kana) {
    kana = hiraganaToKatakana(kana);
    let id = "1290";
    return kanji.concat(",", id, ",", id, ",1000,名詞,固有名詞,人名,姓,*,*,", kanji,
        ",", kana + ",", kana, ",,");
}

function createNoun (kanji, kana) {
    kana = hiraganaToKatakana(kana);
    let id = "1285";
    return kanji.concat(",", id, ",", id, ",1000,名詞,一般,*,*,*,*,", kanji, ",",
        kana, ",", kana, ",,");
}

function loadDictionary () {
    let textFile = getUserDictionaryFile("txt");
    if (!textFile.exists()) {
        return;
    }
    let text = read(textFile, "UTF-8");
    let textbox = document.getElementById("userDictionaryTextbox");
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
    let textbox = document.getElementById("userDictionaryTextbox");
    let text = textbox.value;

    // 2. convert text to CSV format
    let csvText = convertToCsv(text);

    // 3. save text in a CSV file
    let csvFile = getUserDictionaryFile("csv");
    write(csvFile, csvText);

    // 4. get the dictionary directory from a tagger
    //    let mw = new MecabWorker(opener.document);
    let mw = getMecabWorker();
    Task.spawn(function* () {
        let data = yield mw.getDictionaryInfoAsync("", getDictionaryPath());
        runMecabDictIndex(data);
    });
}

function getUserDictionaryFile (extension) {
    let file = Services.dirsvc.get("ProfD", Ci.nsIFile);
    file.append("furigana_inserter_user_dictionary." + extension);
    return file;
}

function doOK () {
    let textbox = document.getElementById("userDictionaryTextbox");
    let text = textbox.value;
    let file = getUserDictionaryFile("txt");
    write(file, text);
    textbox.editor.resetModificationCount();
    return true;
}

function doHelp () {
    let win = window.opener;
    let text = win.document.getElementById("furiganainserter-strings")
    .getString("userDictionaryHelp");
    Services.prompt.alert(window, "User Dictionary Help", text);
    return true;
}

function onload () {
    if (initialized) {
        return;
    }
    loadDictionary();
    initialized = true;
}

function doCancel () {
    return true;
}

window.addEventListener("load", onload, false);
