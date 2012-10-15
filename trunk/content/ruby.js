"use strict";

var EXPORTED_SYMBOLS = ["HiraganaComplex", "KatakanaComplex", "RomajiComplex",
"Keywords", "setKeywords", "RomajiSimple", "HiraganaSimple", "KatakanaSimple"];

Components.utils["import"]("resource://furiganainserter/utilities.js");

var prefs = new Preferences("extensions.furiganainserter.");

var keywords = null;

function setKeywords (table) {
    keywords = table;
}

function loadKeywords () {
    var file = getKeywordsFile();
    if (!file.exists()) return;
    var text = read(file, "UTF-8");
    keywords = getKeywordsObject(text);
}

function Simple () {
}

Simple.prototype.createRuby = function (data, readings) {
    var pos = 0;
    var textWithRuby = "";
    var that = this
    readings.forEach(function (reading) {
        reading.children.forEach(function (child) {
            textWithRuby += escapeHTML(data.substring(pos, child.start));
            textWithRuby += that.createRubyHtml(child);
            pos = child.start + child.word.length;
        });
    });
    textWithRuby += escapeHTML(data.substring(pos, data.length));
    return textWithRuby;
}

Simple.prototype.createRubyHtml = function (reading) {
    return "<ruby class='fi'><rb>".concat(reading.word, "</rb><rp>(</rp><rt>",
    reading.reading, "</rt><rp>)</rp></ruby>");
}

var HiraganaSimple = Simple;

function KatakanaSimple () {
}

KatakanaSimple.prototype = new Simple()

KatakanaSimple.prototype.createRubyHtml = function (reading) {
    return "<ruby class='fi'><rb>".concat(reading.word, "</rb><rp>(</rp><rt>",
    hiraganaToKatakana(reading.reading), "</rt><rp>)</rp></ruby>");
}

function RomajiSimple () {
}

RomajiSimple.prototype = new Simple()

RomajiSimple.prototype.createRuby = function (data, readings) {
    var pos = 0;
    var textWithRuby = "";
    var that = this;
    readings.forEach(function (reading) {
        reading.reading = katakanaToRomaji(hiraganaToKatakana(reading.reading));
        textWithRuby += escapeHTML(data.substring(pos, reading.start));
        textWithRuby += that.createRubyHtml(reading);
        pos = reading.start + reading.word.length;
    });
    textWithRuby += escapeHTML(data.substring(pos, data.length));
    return textWithRuby;
}

function Complex () {
}

Complex.prototype = new Simple()

Complex.prototype.createRuby = function (data, readings) {
    var margin = prefs.getPref("margin");
    var style = "";
    if (margin > 0)
        style = " style='padding-left:".concat(margin, "em; padding-right:",
            margin, "em'");

    var tag = "<span class='fi'".concat(style, " bf='");
    var pos = 0;
    var textWithRuby = "";
    var that = this;
    readings.forEach(function (reading) {
        // push everything before start
        textWithRuby += escapeHTML(data.substring(pos, reading.start));
        // go to start
        pos = reading.start;
        var spanText = tag.concat(reading.basicForm, "'>");
        var end = pos + reading.word.length;
        // push all children
        reading.children.forEach(function (child) {
            spanText += escapeHTML(data.substring(pos, child.start));
            spanText += that.createRubyHtml(child);
            pos = child.start + child.word.length;
        });
        //
        spanText += escapeHTML(data.substring(pos, end));
        pos = end;
        spanText += "</span>";
        textWithRuby += spanText;
    });
    // push rest
    textWithRuby += escapeHTML(data.substring(pos, data.length));
    return textWithRuby;
}

Complex.prototype.createRubyHtml = function (reading) {
    return "<ruby class='fi'><rb>".concat(reading.word, "</rb><rp>(</rp><rt>",
    reading.reading, "</rt><rp>)</rp></ruby>");
}

var HiraganaComplex = Complex;

function KatakanaComplex () {
}

KatakanaComplex.prototype = new Complex()

KatakanaComplex.prototype.createRubyHtml = function (reading) {
    return "<ruby class='fi'><rb>".concat(reading.word, "</rb><rp>(</rp><rt>",
    hiraganaToKatakana(reading.reading), "</rt><rp>)</rp></ruby>");
}

function RomajiComplex () {
}

RomajiComplex.prototype = new Complex();

RomajiComplex.prototype.createRuby = function (data, readings) {
    readings.forEach(function (r) {
        r.reading = katakanaToRomaji(hiraganaToKatakana(r.reading));
        r.children = [r];
    })
    return Complex.prototype.createRuby.call(this, data, readings);
}

function Keywords () {
}

Keywords.prototype = new Complex()

Keywords.prototype.createRubyHtml = function (reading) {
    var rt = "";
    if (reading.isName)
        rt = reading.reading;
    else rt = this.toKeywords(reading.word, keywords);
    return "<ruby class='fi'><rb>".concat(reading.word,
        "</rb><rp>(</rp><rt lang='en' title='", reading.reading, "'>", rt,
        "</rt><rp>)</rp></ruby>");
}

Keywords.prototype.toKeywords = function (word, table) {
    if (!table) return "";
    var res = [];
    var chars = word.split("");
    chars.forEach(function (c) {
        if (table.hasOwnProperty(c))
            res.push(table[c]);
        else res.push("?");
    })
    return res.join(" ");
}

loadKeywords()
