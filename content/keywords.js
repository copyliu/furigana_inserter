"use strict";

Components.utils["import"]("resource://furiganainserter/utilities.js");

var Cc = Components.classes;
var Ci = Components.interfaces;

function loadKeywords () {
    var file = getKeywordsFile();
    if (!file.exists()) return;
    var text = read(file, "UTF-8");
    var textbox = document.getElementById("keywordsTextbox");
    textbox.value = text;
}

function doOK () {
    var textbox = document.getElementById("keywordsTextbox");
    var text = textbox.value;
    var file = getKeywordsFile();
    write(file, text);
    var arg = window.arguments[0];
    arg.keywords = getKeywordsObject(text);
    return true;
}

function doCancel () {
    return true;
}

function showHelp () {
    var ps = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);
    var win = window.opener;
    var text = win.document.getElementById("furiganainserter-strings")
    .getString("keywordsHelp");
    ps.alert(window, "Keywords Help", text);
}

function onload (event) {
    loadKeywords();
}

window.addEventListener("load", onload, false);

// window.addEventListener("close", onclose, false);
