let EXPORTED_SYMBOLS = ["MecabWorker"];

Components.utils["import"]("resource://gre/modules/Promise.jsm");
Components.utils["import"]("resource://gre/modules/devtools/Console.jsm");

Components.utils["import"]("resource://furiganainserter/utilities.js");

let Ci = Components.interfaces;
let Cc = Components.classes;

function MecabWorker () {
    this.queue = [];
//    this.worker = new ChromeWorker("chrome://furiganainserter/content/my_worker.js");
    this.worker = new ChromeWorker("../my_worker.js");
    this.worker.onmessage = (event) => {
//        let {resolve, reject} = this.queue.shift();
        let d = this.queue.shift();
        d.resolve(event.data);
    };
    this.worker.onerror = (event) => {
//        let {resolve, reject} = this.queue.shift();
        let d = this.queue.shift();
        let err = new Error(event.message, event.filename, event.lineno);
        console.error(err);
        d.reject(err);
    };
    this.worker.postMessage({
        type: "init",
        data: {
            OS: getOS(),
            dllPath: getDllFile().path
        }
    });
}

MecabWorker.prototype._send = function (data) {
//    let p = new Promise((resolve, reject) => {
//        this.queue.push({resolve:resolve, reject:reject});
//    });
    let d = Promise.defer();
    this.queue.push(d);
    this.worker.postMessage(data);
    return d.promise;
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
