"use strict";

Components.utils["import"]("resource://furiganainserter/utilities.js");

var initialized = false;

function loadFilter () {
    var obj = getFilterArray();
    obj.forEach(function (item) {
        addRow(item[0], item[1]);
    });
}

function saveFilter () {
    var obj = getListboxAsObj();
    var text = JSON.stringify(obj);
    var file = getFilterFile();
    write(file, text);
}

function getListboxAsObj () {
    var listbox = document.getElementById("substListbox");
    var obj = [];
    var len = listbox.getRowCount();
    for (var i = 0; i < len; ++i) {
        var item = listbox.getItemAtIndex(i);
        obj.push([item.firstChild.getAttribute("label"),
            item.lastChild.getAttribute("label")]);
    }
    return obj;
}

function addSubst () {
    var regexp = document.getElementById("regexpTextbox").value;
    var text = document.getElementById("replacementTextbox").value;
    if (regexp === "")
        return;
    addRow(regexp, text);
}

function addRow (regexp, text) {
    var listbox = document.getElementById("substListbox");
    var item = document.createElement("listitem");
    var cell = document.createElement("listcell");
    cell.setAttribute("label", regexp);
    item.appendChild(cell);
    cell = document.createElement("listcell");
    cell.setAttribute("label", text);
    item.appendChild(cell);
    listbox.appendChild(item);
}

function deleteSubst () {
    var listbox = document.getElementById("substListbox");
    var i = listbox.selectedIndex;
    if (i === -1)
        return;
    listbox.removeItemAt(i);
    if (i === listbox.getRowCount()) i--;
    listbox.selectedIndex = i;
}

function keydown (event) {
    if (event.keyCode === KeyEvent["DOM_VK_DELETE"])
        deleteSubst();
    return true;
}

function select (event) {
    var textbox1 = document.getElementById("regexpTextbox");
    var textbox2 = document.getElementById("replacementTextbox");
    var listbox = document.getElementById("substListbox");
    var item = listbox.selectedItem;
    if (!item)
        return true;
    textbox1.value = item.firstChild.getAttribute("label");
    textbox2.value = item.lastChild.getAttribute("label");
    return true;
}

function onload (event) {
    if (initialized)
        return;
    loadFilter();
    initialized = true;
}

function doOk () {
    var obj = getListboxAsObj();
    var arg = window.arguments[0];
    arg.filterFunction = getFilterFunction(obj);
    saveFilter();
    return true;
}

function doCancel () {
    return true;
}

function doHelp () {
    var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Components.interfaces.nsIPromptService);
    var win = window.opener;
    var text = win.document.getElementById("furiganainserter-strings")
    .getString("filterHelp");
    ps.alert(window, "Filter Help", text);
    return true;
}

window.addEventListener("load", onload, false);
