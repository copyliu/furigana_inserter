Components.utils["import"]("resource://gre/modules/AddonManager.jsm");
Components.utils["import"]("resource://furiganainserter/utilities.js");

var worker = null;
var initalized = false;

function showStatus (msg) {
    document.getElementById("status").innerHTML = msg;
}

function parse (tagger) {
    var text = document.getElementById("textbox1").value;
    text = text.trim();
    if (text !== "") tagger.parseToNode(text);
}

function addRow (cells) {
    var doc = document;
    var row = doc.createElement("tr");
    cells.forEach(function (cell) {
        var td = doc.createElement("td");
        var text = doc.createTextNode(cell);
        td.appendChild(text);
        row.appendChild(td);
    })
    doc.getElementById("tbody1").appendChild(row);
}

function getVersion (event) {
    initWorker();
    worker.postMessage({
        request: "getVersion"
    });
}

function getDictionaryInfo (event) {
    initWorker();
    worker.postMessage({
        request: "getDictionaryInfo",
        userDicPath: getUserDictionaryPath(),
        dicPath: getDictionaryPath()
    });
}

function initWorker () {
    if (initalized) return;
    worker.postMessage({
        request: "init",
        OS: getOS(),
        dllPath: getDllPath()
    });
    initalized = true;
}

function parseAndGetAll () {
    var text;
    clearPage();
    text = document.getElementById("textarea1").value;
    text = text.trim();
    if (text === "") return;
    worker.postMessage({
        request: "getNodes",
        text: [text],
        userDicPath: getUserDictionaryPath(),
        dicPath: getDictionaryPath()
    });
}

function doit (event) {
    initWorker();
    parseAndGetAll();
    return false;
}

function toArray (nodeList) {
    var retval = [];
    for (var i = 0; i < nodeList.length; ++i)
        retval.push(nodeList[i]);
    return retval;
}

function clearPage () {
    var table = document.getElementById("tbody1");
    var rows = toArray(table.getElementsByTagName("tr"));
    rows.forEach(function (row) {
        table.removeChild(row);
    })
}

window.addEventListener("load", function (event) {
    worker = new ChromeWorker("../my_worker.js");
    worker.onerror = function (event) {
        throw new Error("worker error: " + event.message);
    }
    worker.onmessage = function (event) {
        var nodes;
        switch (event.data.reply) {
            case "getNodes":
                nodes = event.data.nodes[0];
                nodes.forEach(function (node) {
                    addRow([node.surface, node.feature, node.length]);
                });
                break;
            case "getDictionaryInfo":
                alert(event.data.info);
                break;
            case "getVersion":
                alert(event.data.version);
                break;
            default:
                throw new Error("unknown message: " + event.data.reply);
        }
    }
}, false)
