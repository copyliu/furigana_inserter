"use strict";

let EXPORTED_SYMBOLS = ["getSpans", "jRegex"];

Components.utils["import"]("resource://furiganainserter/utilities.js");

let kPat = "\u3005\u3400-\u9FCF"; // "\u3005" is "々" - CJK iteration mark
let hPat = "\u3041-\u3096"; // Hiragana
let katPat = "\u30A1-\u30FA"; // Katakana
let jRegex = new RegExp('[' + kPat + hPat + katPat + ']');
let kRegex = new RegExp("[" + kPat + "]");
let katRegex = new RegExp("[" + katPat + "]");
let hRegex = new RegExp("[" + hPat + "]");
let hkRegex = new RegExp("^([" + hPat + "]*)([" + kPat + "]+)");
let khRegex = new RegExp("^([" + kPat + "]+)([" + hPat + "]*)");

function Span() {
    this.reading = "";
    this.word = "";
    this.start = 0;
    this.basicForm = "";
    this.isName = false;
    this.children = []; // List<Ruby>
}

function Ruby() {
    this.reading = "";
    this.word = "";
    this.start = 0;
    this.isName = false;
}

function getSpans(nodes) {
    let spans = [];
    let start = 0;
    nodes.forEach(function (node) {
        let span = featureToSpan(node.feature);
        // skip spans without reading
        if (span.reading === "") {
            start += node.length + node.surface.length;
            return;
        }
        // skip whitespace
        start += node.length;
        span.word = node.surface;
        span.start = start;
        let children = parseSpan(span);
        if (span.isName) {
            children.forEach(function (child) {
                child.isName = true;
            });
        }
        span.children = children;
        spans.push(span);
        // move to the end of the surface
        start += node.surface.length;
    });
    return spans;
}

// Juman:  (現在) (名詞,時相名詞,*,*,現在,げんざい,代表表記:現在)
// IPADic: (現在) (名詞,副詞可能,*,*,*,*,現在,ゲンザイ,ゲンザイ)
function featureToSpan (feature) {
    let span = new Span();
    let fields = feature.split(",");
    if (fields.length > 7 && (katRegex.test(fields[7]))
        && !/[\uFF01-\uFF5E]/.test(fields[6])) // not an ASCII char
        {
        // IPADic
        span.reading = katakanaToHiragana(fields[7]);
        span.basicForm = fields[6];
        span.isName = (fields[2] === "人名");
    } else if (fields.length === 7 && hRegex.test(fields[5])) {
        // JRuby
        span.reading = fields[5];
        span.basicForm = fields[4];
        span.isName = (fields[2] === "人名");
    }
    return span;
}

// @return List<Ruby>
function parseSpan(span) {
    let result = [];
    parseWord(span.word, span.reading, span.start, result);
    return result;
}

// PEG grammar
// Word := Hiragana? KanjiHiragana
// KanjiHiragana := Kanji !Hiragana | Kanji Word
// Kanji := [\u3005\u3400-\u9FCF]+
// Hiragana := [\u3040-\u309F]+
function parseWord (word, reading, start, result) {
    let match = word.match(hkRegex);
    if (!match) {
        return;
    }
    let hiragana = match[1];
    // Hiragana KanjiHiragana
    if (hiragana === "") {
        parseKanjiHiragana(word, reading, start, result);
    } else {
        // KanjiHiragana
        word = word.substring(hiragana.length);
        reading = reading.substring(hiragana.length);
        start = start + hiragana.length;
        parseKanjiHiragana(word, reading, start, result);
    }
}

function parseKanjiHiragana (word, reading, start, result) {
    let match = word.match(khRegex);
    let kanji = match[1];
    let hiragana = match[2];
    // Kanji !Hiragana
    if (hiragana === "") {
        let r = new Ruby();
        r.word = word;
        r.reading = reading;
        r.start = start;
        result.push(r);
    } else {
        // Kanji Word
        let i = reading.indexOf(hiragana, kanji.length);
        let r = new Ruby();
        r.word = kanji;
        r.reading = reading.substring(0, i);
        r.start = start;
        result.push(r);
        word = word.substring(match[0].length);
        reading = reading.substring(i + hiragana.length);
        start = start + match[0].length;
        parseWord(word, reading, start, result);
    }
}
