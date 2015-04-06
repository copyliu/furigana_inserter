Components.utils["import"]("resource://furiganainserter/utilities.js");
Components.utils["import"]("resource://gre/modules/Task.jsm");
Components.utils["import"]("resource://gre/modules/osfile.jsm");

let Ci = Components.interfaces;
let Cc = Components.classes;

let worker = null;

function showStatus (msg) {
    document.getElementById("status").innerHTML = msg;
}

function addRow (cells) {
    let doc = document;
    let row = doc.createElement("tr");
    cells.forEach(function (cell) {
        let td = doc.createElement("td");
        let text = doc.createTextNode(cell);
        td.appendChild(text);
        row.appendChild(td);
    });
    doc.getElementById("tbody1").appendChild(row);
}

function doit () {
    clearPage();
    let text = document.getElementById("textarea1").value;
    text = text.trim();
    if (text === "") {
        return false;
    }
    Task.spawn(function* () {
        let data = yield worker.getNodesAsync([text]);
        let nodes = data[0];
        for (let node of nodes) {
            addRow([node.surface, getReading(node.feature), node.length]);
        }
    }).catch(err => console.error(err));
    return false;
}

function getReading (feature) {
    let fields = feature.split(/,/);
    if (fields.length >= 8) {
        return katakanaToHiragana(fields[7]);
    } else {
        return "";
    }
}

function getVersion () {
    Task.spawn(function* () {
        let version = yield worker.getVersionAsync();
        alert(version);
    }).catch(err => console.error(err));
    return false;
}

function getDictionaryInfo () {
    Task.spawn(function* () {
        let info = yield worker.getDictionaryInfoAsync();
        alert(info);
    }).catch(err => console.error(err));
    return false;
}

function toArray (nodeList) {
    let retval = [];
    for (let i = 0; i < nodeList.length; ++i) {
        retval.push(nodeList[i]);
    }
    return retval;
}

function clearPage () {
    let table = document.getElementById("tbody1");
    let rows = toArray(table.getElementsByTagName("tr"));
    rows.forEach((row) => {
        table.removeChild(row);
    });
}

window.addEventListener("load", function (event) {
    worker = getMecabWorker();
}, false);
