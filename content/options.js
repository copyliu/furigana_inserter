"use strict";

Components.utils["import"]("resource://furiganainserter/utilities.js");

var prefs = new Preferences("extensions.furiganainserter.")

var keyCodes = {};

function onload () {
    var key;
    for (key in KeyEvent)
        if (KeyEvent.hasOwnProperty(key))
            keyCodes[KeyEvent[key]] = key;
}

var keydown = makeKeyFunction();

function makeKeyFunction () {
    var pressedModifiers = {};
    return function (event) {
        event.preventDefault();
        if (event.target.readOnly) return;
        if (pressedModifiers.hasOwnProperty(event.keyCode)) return;
        if (!keyCodes.hasOwnProperty(event.keyCode)) return;
        // if modifier then add key and wait for the next
        if (isModifier(event.keyCode)) {
            addKey(event.target, getModifierName(event.keyCode));
            pressedModifiers[event.keyCode] = true;
        }
        // if normal key then add key and stop
        else {
            addKey(event.target, keyCodes[event.keyCode].substring(4));
            event.target.readOnly = true;
            pressedModifiers = {};
        }
    }
}

function isModifier (keyCode) {
    switch (keyCode) {
        case KeyEvent.DOM_VK_SHIFT:
        case KeyEvent.DOM_VK_ALT:
        case KeyEvent.DOM_VK_META:
        case KeyEvent.DOM_VK_CONTROL:
            return true;
        default:
            return false;
    }
}

function getModifierName (keyCode) {
    switch (keyCode) {
        case KeyEvent.DOM_VK_SHIFT:
            return "shift";
        case KeyEvent.DOM_VK_ALT:
            return "alt";
        case KeyEvent.DOM_VK_META:
            return "meta";
        case KeyEvent.DOM_VK_CONTROL:
            return "control";
        default:
            return false;
    }
}

function addKey (target, key) {
    if (target.value === "")
        target.value = key;
    else target.value += "+" + key;
}

function setKey (event) {
    var textbox = document.getElementById('lookup_key_textbox')
    textbox.reset();
    textbox.readOnly = false;
    textbox.focus();
}

function resetKey (event) {
    var textbox = document.getElementById('lookup_key_textbox');
    textbox.value = prefs.getPref("lookup_key");
}

function deleteKey (event) {
    var textbox = document.getElementById('lookup_key_textbox');
    textbox.reset();
}

function saveHotkeys (event) {
    var textbox = document.getElementById('lookup_key_textbox');
    prefs.setPref("lookup_key", textbox.value);
}

window.addEventListener("load", onload, false);
