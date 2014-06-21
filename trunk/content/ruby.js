"use strict";

let EXPORTED_SYMBOLS = ["HiraganaComplex", "KatakanaComplex", "RomajiComplex",
"RomajiSimple", "HiraganaSimple", "KatakanaSimple"];

Components.utils["import"]("resource://furiganainserter/utilities.js");

let prefs = new Preferences("extensions.furiganainserter.");

function Simple () {
}

Simple.prototype.createRuby = function (data, readings) {
    let pos = 0;
    let textWithRuby = "";
    let that = this;
    readings.forEach(function (reading) {
        reading.children.forEach(function (child) {
            textWithRuby += escapeHTML(data.substring(pos, child.start));
            textWithRuby += that.createRubyHtml(child);
            pos = child.start + child.word.length;
        });
    });
    textWithRuby += escapeHTML(data.substring(pos, data.length));
    return textWithRuby;
};

Simple.prototype.createRubyHtml = function (reading) {
    return "<ruby class='fi'><rb>".concat(reading.word, "</rb><rp>(</rp><rt>",
    reading.reading, "</rt><rp>)</rp></ruby>");
};

let HiraganaSimple = Simple;

function KatakanaSimple () {
}

KatakanaSimple.prototype = new Simple();

KatakanaSimple.prototype.createRubyHtml = function (reading) {
    return "<ruby class='fi'><rb>".concat(reading.word, "</rb><rp>(</rp><rt>",
    hiraganaToKatakana(reading.reading), "</rt><rp>)</rp></ruby>");
};

function RomajiSimple () {
}

RomajiSimple.prototype = new Simple();

RomajiSimple.prototype.createRuby = function (data, readings) {
    let pos = 0;
    let textWithRuby = "";
    let that = this;
    readings.forEach(function (reading) {
        reading.reading = katakanaToRomaji(hiraganaToKatakana(reading.reading));
        textWithRuby += escapeHTML(data.substring(pos, reading.start));
        textWithRuby += that.createRubyHtml(reading);
        pos = reading.start + reading.word.length;
    });
    textWithRuby += escapeHTML(data.substring(pos, data.length));
    return textWithRuby;
};

function Complex () {
}

Complex.prototype = new Simple();

Complex.prototype.createRuby = function(data, readings) {
    let margin = prefs.getPref("margin");
    let style = "";
    if (margin > 0) {
        style = " style='padding-left:".concat(margin, "em; padding-right:", margin, "em'");
    }

    let tag = "<span class='fi'".concat(style, " bf='");
    let pos = 0;
    let textWithRuby = "";
    let that = this;
    readings.forEach(function(reading) {
        // push everything before start
        textWithRuby += escapeHTML(data.substring(pos, reading.start));
        // go to start
        pos = reading.start;
        let spanText = tag.concat(reading.basicForm, "'>");
        let end = pos + reading.word.length;
        // push all children
        reading.children.forEach(function(child) {
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
};

Complex.prototype.createRubyHtml = function (reading) {
    return "<ruby class='fi'><rb>".concat(reading.word, "</rb><rp>(</rp><rt>",
    reading.reading, "</rt><rp>)</rp></ruby>");
};

let HiraganaComplex = Complex;

function KatakanaComplex () {
}

KatakanaComplex.prototype = new Complex();

KatakanaComplex.prototype.createRubyHtml = function (reading) {
    return "<ruby class='fi'><rb>".concat(reading.word, "</rb><rp>(</rp><rt>",
    hiraganaToKatakana(reading.reading), "</rt><rp>)</rp></ruby>");
};

function RomajiComplex () {
}

RomajiComplex.prototype = new Complex();

RomajiComplex.prototype.createRuby = function (data, readings) {
    readings.forEach(function (r) {
        r.reading = katakanaToRomaji(hiraganaToKatakana(r.reading));
        r.children = [r];
    });
    return Complex.prototype.createRuby.call(this, data, readings);
};
