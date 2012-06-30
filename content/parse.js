"use strict";

var EXPORTED_SYMBOLS = ["getReadings"];

Components.utils["import"]("resource://furiganainserter/utilities.js");

var kPat = "\u3005\u3400-\u9FCF"; // "\u3005" is "々" - CJK iteration mark
var hPat = "\u3041-\u3096"; // Hiragana
var katPat = "\u30A1-\u30FA"; // Katakana
var jRegex = new RegExp('[' + kPat + hPat + katPat + ']');
var kRegex = new RegExp("[" + kPat + "]");
var katRegex = new RegExp("[" + katPat + "]");
var hRegex = new RegExp("[" + hPat + "]");
var hkRegex = new RegExp("^([" + hPat + "]*)([" + kPat + "]+)");
var khRegex = new RegExp("^([" + kPat + "]+)([" + hPat + "]*)");

function Reading () {
    this.reading = "";
    this.word = "";
    this.start = 0;
    this.basicForm = "";
    this.isName = false;
    this.children = [];
}

function getReadings (nodes) {
    var readings = [];
    var start = 0;
    nodes.forEach(function (node) {
        var reading = featureToReading(node.feature);
        // skip nodes without reading
        if (reading.reading === "") {
            start += node.length + node.surface.length;
            return;
        }
        // skip whitespace
        start += node.length;
        reading.word = node.surface;
        reading.start = start;
        var children = parseReading(reading);
        if (reading.isName) children.forEach(function (child) {
            child.isName = true;
        });
        reading.children = children;
        readings.push(reading);
        // move to the end of the surface
        start += node.surface.length;
    })
    return readings;
}

// Juman: (現在) (名詞,時相名詞,*,*,現在,げんざい,代表表記:現在)
// IPADic: (現在) (名詞,副詞可能,*,*,*,*,現在,ゲンザイ,ゲンザイ)
function featureToReading (feature) {
    var obj = new Reading()
    var fields = feature.split(",")
    if (fields.length > 7 && (katRegex.test(fields[7]))
        && !/[\uFF01-\uFF5E]/.test(fields[6])) // not an ASCII char
        {
        obj.reading = katakanaToHiragana(fields[7])
        obj.basicForm = fields[6];
        obj.isName = (fields[2] === "人名")
    } else if (fields.length === 7 && hRegex.test(fields[5])) {
        obj.reading = fields[5]
        obj.basicForm = fields[4];
        obj.isName = (fields[2] === "人名");
    }
    return obj;
}

function parseReading (reading) {
    var result = [];
    parseWord(reading.word, reading.reading, reading.start, result);
    return result;
}

// PEG grammar Word := !Kanji | Hiragana? KanjiHiragana
// KanjiHiragana := Kanji !Hiragana | Kanji Word
// Kanji := * [\u3005\u3400-\u9FCF]+
// Hiragana := [\u3040-\u309F]+
function parseWord (word, reading, start, result) {
    var match = word.match(hkRegex);
    // !Kanji
    if (!match) return;
    var hiragana = match[1];
    // Hiragana KanjiHiragana
    if (hiragana === "") parseKanjiHiragana(word, reading, start, result);
    // KanjiHiragana
    else {
        word = word.substring(hiragana.length);
        reading = reading.substring(hiragana.length);
        start = start + hiragana.length;
        parseKanjiHiragana(word, reading, start, result);
    }
}

function parseKanjiHiragana (word, reading, start, result) {
    var match = word.match(khRegex);
    var kanji = match[1];
    var hiragana = match[2];
    // Kanji !Hiragana
    if (hiragana === "")
        result.push({
            word : word,
            reading : reading,
            start : start
        });
    // Kanji Word
    else {
        var i = reading.indexOf(hiragana, 1);
        result.push({
            word : kanji,
            reading : reading.substring(0, i),
            start : start
        });
        word = word.substring(match[0].length);
        reading = reading.substring(i + hiragana.length);
        start = start + match[0].length;
        parseWord(word, reading, start, result);
    }
}
