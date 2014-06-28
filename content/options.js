"use strict";

Components.utils["import"]("resource://furiganainserter/utilities.js");

let keyCodes = {};

function onload () {
    for (let key in KeyEvent) {
        if (KeyEvent.hasOwnProperty(key)) {
            keyCodes[KeyEvent[key]] = key;
        }
    }
}

let keydown = (function () {
    let pressedModifiers = {};
    return function (event) {
        event.preventDefault();
        if (event.target.readOnly) {
            return;
        } else if (pressedModifiers.hasOwnProperty(event.keyCode)) {
            return;
        } else if (!keyCodes.hasOwnProperty(event.keyCode)) {
            return;
        } else if (isModifier(event.keyCode)) {
            // if modifier then add key and wait for the next
            addKey(event.target, getModifierName(event.keyCode));
            pressedModifiers[event.keyCode] = true;
        } else {
            // if normal key then add key and stop
            addKey(event.target, keyCodes[event.keyCode].substring(4));
            event.target.readOnly = true;
            pressedModifiers = {};
        }
    };
})();

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
    if (target.value === "") {
        target.value = key;
    } else {
        target.value += "+" + key;
    }
}

function setKey (event) {
    let textbox = document.getElementById('lookup_key_textbox');
    textbox.reset();
    textbox.readOnly = false;
    textbox.focus();
}

function resetKey (event) {
    let textbox = document.getElementById('lookup_key_textbox');
    textbox.value = getPrefs().getPref("lookup_key");
    textbox.readOnly = true;
}

function deleteKey (event) {
    let textbox = document.getElementById('lookup_key_textbox');
    textbox.reset();
    textbox.readOnly = true;
}

function saveHotkeys (event) {
    let textbox = document.getElementById('lookup_key_textbox');
    getPrefs().setPref("lookup_key", textbox.value);
}

window.addEventListener("load", onload, false);
