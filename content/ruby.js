"use strict";

let EXPORTED_SYMBOLS = ["HiraganaComplex", "KatakanaComplex", "RomajiComplex",
"RomajiSimple", "HiraganaSimple", "KatakanaSimple"];

Components.utils["import"]("resource://furiganainserter/utilities.js");

function Simple () {
}

Simple.prototype.createSpan = function (data, spans) {
    let pos = 0;
    let textWithRuby = "";
    let that = this;
    spans.forEach(function (span) {
        span.children.forEach(function (ruby) {
            textWithRuby += escapeHTML(data.substring(pos, ruby.start));
            textWithRuby += that.createRuby(ruby);
            pos = ruby.start + ruby.word.length;
        });
    });
    textWithRuby += escapeHTML(data.substring(pos, data.length));
    return textWithRuby;
};

Simple.prototype.createRuby = function (ruby) {
    return "<ruby class='fi'><rb>".concat(ruby.word, "</rb><rp>(</rp><rt>",
    ruby.reading, "</rt><rp>)</rp></ruby>");
};

let HiraganaSimple = Simple;

function KatakanaSimple () {
}

KatakanaSimple.prototype = Object.create(Simple.prototype);

KatakanaSimple.prototype.createRuby = function (ruby) {
    return "<ruby class='fi'><rb>".concat(ruby.word, "</rb><rp>(</rp><rt>",
    hiraganaToKatakana(ruby.reading), "</rt><rp>)</rp></ruby>");
};

function RomajiSimple () {
}

RomajiSimple.prototype = Object.create(Simple.prototype);

RomajiSimple.prototype.createSpan = function (data, spans) {
    let pos = 0;
    let textWithRuby = "";
    let that = this;
    spans.forEach(function (span) {
        span.reading = katakanaToRomaji(hiraganaToKatakana(span.reading));
        textWithRuby += escapeHTML(data.substring(pos, span.start));
        textWithRuby += that.createRuby(span);
        pos = span.start + span.word.length;
    });
    textWithRuby += escapeHTML(data.substring(pos, data.length));
    return textWithRuby;
};

function Complex () {
}

Complex.prototype = Object.create(Simple.prototype);

Complex.prototype.createSpan = function(data, spans) {
    let margin = getPrefs().getPref("margin");
    let style = "";
    if (margin > 0) {
        style = " style='padding-left:".concat(margin, "em; padding-right:", margin, "em'");
    }
    let tag = "<span class='fi'".concat(style, " data-bf='");
    let pos = 0;
    let textWithRuby = "";
    let that = this;
    spans.forEach(function(span) {
        // push everything before start
        textWithRuby += escapeHTML(data.substring(pos, span.start));
        // go to start
        pos = span.start;
        let spanText = tag.concat(span.basicForm, "'>");
        let end = pos + span.word.length;
        // push all children
        span.children.forEach(function(ruby) {
            spanText += escapeHTML(data.substring(pos, ruby.start));
            spanText += that.createRuby(ruby);
            pos = ruby.start + ruby.word.length;
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

Complex.prototype.createRuby = function (ruby) {
    return "<ruby class='fi'><rb>".concat(ruby.word, "</rb><rp>(</rp><rt>",
    ruby.reading, "</rt><rp>)</rp></ruby>");
};

let HiraganaComplex = Complex;

function KatakanaComplex () {
}

KatakanaComplex.prototype = Object.create(Complex.prototype);

KatakanaComplex.prototype.createRuby = function (ruby) {
    return "<ruby class='fi'><rb>".concat(ruby.word, "</rb><rp>(</rp><rt>",
    hiraganaToKatakana(ruby.reading), "</rt><rp>)</rp></ruby>");
};

function RomajiComplex () {
}

RomajiComplex.prototype = Object.create(Complex.prototype);

RomajiComplex.prototype.createSpan = function (data, spans) {
    spans.forEach(function (span) {
        span.reading = katakanaToRomaji(hiraganaToKatakana(span.reading));
        span.children = [span];
    });
    return Complex.prototype.createSpan.call(this, data, spans);
};
