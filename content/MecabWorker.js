var EXPORTED_SYMBOLS = ["MecabWorker"];

Components.utils["import"]("resource://gre/modules/Promise.jsm");
Components.utils["import"]("resource://gre/modules/devtools/Console.jsm");
Components.utils["import"]("resource://gre/modules/Services.jsm");

Components.utils["import"]("resource://furiganainserter/utilities.js");

var Ci = Components.interfaces;
var Cc = Components.classes;

function MecabWorker () {
    this.queue = [];
//    this.worker = new ChromeWorker("chrome://furiganainserter/content/my_worker.js");
    this.worker = new ChromeWorker("../my_worker.js");
    this.worker.onmessage = (event) => {
        let d = this.queue.shift();
        d.resolve(event.data);
    };
    this.worker.onerror = (event) => {
        let d = this.queue.shift();
        let err = new Error(event.message, event.filename, event.lineno);
        if (d) {
            d.reject(err);
        } else {
            console.error(err);
        }
    };
    this.worker.postMessage({
        type: "init",
        data: {
            OS: Services.appinfo.OS,
            dllPath: getDllFile().path
        }
    });
}

MecabWorker.prototype._send = function (data) {
    let p = new Promise((resolve, reject) => {
        this.queue.push({resolve: resolve, reject: reject});
    });
    this.worker.postMessage(data);
    return p;
};

MecabWorker.prototype.getVersionAsync = function () {
    return this._send({
        type: "getVersion",
        data: null
    });
}

MecabWorker.prototype.getDictionaryInfoAsync = function (userDicPath = getUserDictionaryPath(),
    dicPath = getDictionaryPath()) {
    return this._send({
        type: "getDictionaryInfo",
        data: {
            userDicPath: userDicPath,
            dicPath: dicPath
        }
    });
}

MecabWorker.prototype.getNodesAsync = function (text,
    userDicPath = getUserDictionaryPath(),
    dicPath = getDictionaryPath()) {
    return this._send({
        type: "getNodes",
        data: {
            text: text,
            userDicPath: userDicPath,
            dicPath: dicPath
        }
    });
}
