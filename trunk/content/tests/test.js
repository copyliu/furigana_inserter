"use strict";

Components.utils["import"]("resource://gre/modules/Task.jsm");
Components.utils["import"]("resource://gre/modules/FileUtils.jsm");
Components.utils["import"]("resource://gre/modules/NetUtil.jsm");

let mw = null;

function* range(from, to) {
    for (let i = from; i < to; ++i) {
        yield i;
    }
}

function onQUnitError(e) {
    console.error(e);
    QUnit.start();
}

/*
let range = document.getSelection().getRangeAt(0);
range.startContainer;
range.startOffset;
range.endContainer;
range.endOffset;
*/
QUnit.module("getRangeNodes");
QUnit.test("getRangeNodes1", assert => {
    let range = document.createRange();
    let div = document.getElementById("getRangeNodes1");
    let p = div.children[0];
    assert.strictEqual(p.nodeName, "P");
    range.setStart(p, 0);
    range.setEnd(p, 4);
    let n = 0;
    for (let node of getRangeNodes(range)) {
//        console.log(node);
        n++;
    }
    assert.strictEqual(n, 6);
});
QUnit.test("getRangeNodes2", assert => {
    let range = document.createRange();
    let div = document.getElementById("getRangeNodes1");
    let p = div.children[0];
    let text = p.childNodes[1];
    assert.strictEqual(p.nodeName, "P");
    assert.strictEqual(text.data, "は、信頼されるフリーなオンライン");
    range.setStart(text, 2);
    range.setEnd(text, 7);
    let n = 0;
    for (let node of getRangeNodes(range)) {
//        console.log(node);
        n++;
    }
    assert.strictEqual(n, 1);
});
QUnit.test("getRangeNodes3", assert => {
    let range = document.createRange();
    let div = document.getElementById("getRangeNodes2");
    let p1 = div.children[0];
    let p2 = div.children[1];
    assert.strictEqual(p1.nodeName, "P");
    assert.strictEqual(p2.nodeName, "P");
    let text1 = p1.childNodes[0];
    let text2 = p2.childNodes[0];
    assert.strictEqual(text1.data, "を放棄しているわけではありませんが、記事をCC-BY-SA 3.0に基づいて改変することを認めているのです。");
    assert.strictEqual(text2.data, "記事の引用については、著作権が放棄されているわけではありませんので、");
    range.setStart(text1, 42);
    range.setEnd(text2, 11);
    let n = 0;
    for (let node of getRangeNodes(range)) {
//        console.log(node);
        n++;
    }
    assert.strictEqual(n, 5);
});
QUnit.test("getRangeNodes4", assert => {
    let range = document.createRange();
    let div = document.getElementById("getRangeNodes3");
    let p1 = div.children[0];
    let p2 = div.children[1];
    assert.strictEqual(p1.nodeName, "P");
    assert.strictEqual(p2.nodeName, "P");
    let text1 = p1.childNodes[0];
    let text2 = p2.childNodes[0];
    assert.strictEqual(text1.data, "が行っています。");
    assert.strictEqual(text2.data, "ウィキペディアは、誰もが編集に参加できるため、記事の信頼性が低いのではないかと批判されることもあります。こうした批判に対しては");
    range.setStart(text1, 1);
    range.setEnd(text2, 9);
    let n = 0;
    for (let node of getRangeNodes(range)) {
//        console.log(node);
        n++;
    }
    assert.strictEqual(n, 5);
});
QUnit.module("miscellaneous");
QUnit.test("Preferences", assert => {
    let prefs = new Preferences("extensions.furiganainserter.");
    let alphabet = prefs.getPref("furigana_alphabet");
    let popupDelay = prefs.getPref("popup_delay");
    let tbAdded = prefs.getPref("toolbar_button_added");
    try {
        prefs.resetPref("furigana_alphabet");
        prefs.resetPref("popup_delay");
        prefs.resetPref("toolbar_button_added");

        assert.strictEqual(prefs.getPref("furigana_alphabet"), "hiragana");
        assert.strictEqual(prefs.getPref("popup_delay"), 150);
        assert.strictEqual(prefs.getPref("toolbar_button_added"), false);

        prefs.setPref("furigana_alphabet", "katakana");
        assert.strictEqual(prefs.getPref("furigana_alphabet"), "katakana");
        prefs.setPref("popup_delay", 200);
        assert.strictEqual(prefs.getPref("popup_delay"), 200);
        prefs.setPref("toolbar_button_added", true);
        assert.ok(prefs.getPref("toolbar_button_added"));
    } finally {
        prefs.setPref("furigana_alphabet", alphabet);
        prefs.setPref("popup_delay", popupDelay);
        prefs.setPref("toolbar_button_added", tbAdded);
    }
});
QUnit.test("getDllFile", assert => {
    let file = getDllFile();
    //console.log(file.path);
    assert.ok(/C:\\.*?libmecab.dll$/.test(file.path));
});
QUnit.test("groupBy", assert => {
    let list = [for (i of range(1, 11)) i];
    let actual = groupBy(list, (a, b) => {
        return a === b;
    });
    assert.strictEqual(actual.length, 10);
    assert.strictEqual(actual[0].length, 1);

    let list2 = [1, 1, 2, 2];
    let actual2 = groupBy(list2, (a, b) => {
        return a === b;
    });
    assert.strictEqual(actual2.length, 2);
    assert.strictEqual(actual2[0].length, 2);
    assert.strictEqual(actual2[1].length, 2);
});
QUnit.test("getMecabDictIndexFile", assert => {
    let file = getMecabDictIndexFile();
//    console.log(file.path);
    assert.ok(/C:\\.*?mecab-dict-index.exe$/.test(file.path));
});
QUnit.test("getDictionaryPath", assert => {
//    assert.ok(/C:\\.*?mecabrc$/.test(getDictionaryPath()));
    assert.strictEqual(getDictionaryPath(), "");
});
QUnit.module("MeCab", {
    setup: function (assert) {
        mw = getMecabWorker();
    },
    teardown: function (assert) {
        mw = null;
    }
});
QUnit.asyncTest("getDictionaryInfoAsync", function (assert) {
    expect(1);
    Task.spawn(function* () {
        let dictionaryInfo = yield mw.getDictionaryInfoAsync();
        assert.notEqual(dictionaryInfo, "");
        QUnit.start();
    }).then(null, onQUnitError);
});
QUnit.asyncTest("getVersionAsync", function (assert) {
    expect(1);
    Task.spawn(function* () {
        let version = yield mw.getVersionAsync();
        assert.strictEqual(version, "0.996");
        QUnit.start();
    }).then(null, onQUnitError);
});
QUnit.asyncTest("getNodesAsync1", function (assert) {
    expect(4);
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["現在、ウィキペディア日本語版には約本の記事があります。"]);
        let nodes = data[0];
        assert.strictEqual(nodes.length, 16);
        let node0 = nodes[0];
        assert.strictEqual(node0.feature, "名詞,副詞可能,*,*,*,*,現在,ゲンザイ,ゲンザイ");
        assert.strictEqual(node0.length, 0);
        assert.strictEqual(node0.surface, "現在");
        QUnit.start();
    }).then(null, onQUnitError);
});
QUnit.asyncTest("getNodesAsync2", function (assert) {
    expect(4);
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典を、"]);
        let nodes = data[0];
        assert.strictEqual(nodes.length, 13);
        let node0 = nodes[0];
        assert.strictEqual(node0.feature, "名詞,代名詞,一般,*,*,*,それ,ソレ,ソレ");
        assert.strictEqual(node0.length, 0);
        assert.strictEqual(node0.surface, "それ");
        QUnit.start();
    }).then(null, onQUnitError);
});
QUnit.asyncTest("getNodesAsyncSerial", function (assert) {
    expect(4);
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典を、"]);
        let nodes = data[0];
        assert.strictEqual(nodes.length, 13);
        data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典を、"]);
        nodes = data[0];
        assert.strictEqual(nodes.length, 13);
        data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典を、"]);
        nodes = data[0];
        assert.strictEqual(nodes.length, 13);
        data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典を、"]);
        nodes = data[0];
        assert.strictEqual(nodes.length, 13);
        QUnit.start();
    }).then(null, onQUnitError);
});
QUnit.asyncTest("getNodesAsyncParallel", function (assert) {
    expect(5);
    let promises = [Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典を、"]);
        let nodes = data[0];
        assert.strictEqual(nodes.length, 13);
    }).then(null, onQUnitError),
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典、"]);
        let nodes = data[0];
        assert.strictEqual(nodes.length, 12);
    }).then(null, onQUnitError),
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科、"]);
        let nodes = data[0];
        assert.strictEqual(nodes.length, 11);
    }).then(null, onQUnitError),
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大の、"]);
        let nodes = data[0];
        assert.strictEqual(nodes.length, 10);
    }).then(null, onQUnitError),
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大、"]);
        let nodes = data[0];
        assert.strictEqual(nodes.length, 9);
    }).then(null, onQUnitError)
    ];
    Task.spawn(function* () {
        yield Promise.all(promises);
        QUnit.start();
    }).then(null, onQUnitError);
});

QUnit.module("parse.js");
QUnit.test("getSpans", assert => {
    let nodes = [{
        surface: "百科",
        feature: "名詞,一般,*,*,*,*,百科,ヒャッカ,ヒャッカ",
        length: 0
    },
    {
        surface: "事典",
        feature: "名詞,一般,*,*,*,*,事典,ジテン,ジテン",
        length: 0
    }];
    let spans = getSpans(nodes);
    assert.strictEqual(spans.length, 2);
//    console.log(spans[0], spans[1]);
});
// [\u3005\u3400-\u9FCF]+
QUnit.test("parseSpan: kanji", assert => {
    let span = {
        word: "百科",
        reading: "ひゃっか",
        start: 0
    }
    let result = parseSpan(span);
//    console.log(result);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].reading, "ひゃっか");
    assert.strictEqual(result[0].word, "百科");
    assert.strictEqual(result[0].start, 0);
});
// [\u3041-\u3096]+
QUnit.test("parseSpan: hiragana", assert => {
    let span = {
        word: "ください",
        reading: "ください",
        start: 0
    }
    let result = parseSpan(span);
//    console.log(result);
    assert.strictEqual(result.length, 0);
});
// [\u3005\u3400-\u9FCF]+[\u3041-\u3096]+
QUnit.test("parseSpan: KH", assert => {
    let span = {
        word: "上げる",
        reading: "あげる",
        start: 0
    }
    let result = parseSpan(span);
//    console.log(result);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].reading, "あ");
    assert.strictEqual(result[0].word, "上");
    assert.strictEqual(result[0].start, 0);
});
// [\u3041-\u3096]+[\u3005\u3400-\u9FCF]+
QUnit.test("parseSpan: HK", assert => {
    let span = {
        word: "ご覧",
        reading: "ごらん",
        start: 0
    }
    let result = parseSpan(span);
//    console.log(result);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].reading, "らん");
    assert.strictEqual(result[0].word, "覧");
    assert.strictEqual(result[0].start, 1);
});
// [\u3041-\u3096]+[\u3005\u3400-\u9FCF]+[\u3041-\u3096]+
QUnit.test("parseSpan: HKH", assert => {
    let span = {
        word: "に対して",
        reading: "にたいして",
        start: 0
    }
    let result = parseSpan(span);
//    console.log(result);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].word, "対");
    assert.strictEqual(result[0].reading, "たい");
    assert.strictEqual(result[0].start, 1);
});
// [\u3005\u3400-\u9FCF]+[\u3041-\u3096]+[\u3005\u3400-\u9FCF]+
QUnit.test("parseSpan: KHK", assert => {
    let span = {
        word: "我が国",
        reading: "わがくに",
        start: 0
    }
    let result = parseSpan(span);
//    console.log(result);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].word, "我");
    assert.strictEqual(result[0].reading, "わ");
    assert.strictEqual(result[0].start, 0);
    assert.strictEqual(result[1].word, "国");
    assert.strictEqual(result[1].reading, "くに");
    assert.strictEqual(result[1].start, 2);
});
// [\u3005\u3400-\u9FCF]+[\u3041-\u3096]+[\u3005\u3400-\u9FCF]+[\u3041-\u3096]+
QUnit.test("parseSpan: KHKH", assert => {
    let span = {
        word: "話し合い",
        reading: "はなしあい",
        start: 0
    }
    let result = parseSpan(span);
//    console.log(result);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].word, "話");
    assert.strictEqual(result[0].reading, "はな");
    assert.strictEqual(result[0].start, 0);
    assert.strictEqual(result[1].word, "合");
    assert.strictEqual(result[1].reading, "あ");
    assert.strictEqual(result[1].start, 2);
});
// [\u3041-\u3096]+[\u3005\u3400-\u9FCF]+[\u3041-\u3096]+[\u3005\u3400-\u9FCF]+
QUnit.test("parseSpan: HKHK", assert => {
    let span = {
        word: "お茶の水",
        reading: "おちゃのみず",
        start: 0
    }
    let result = parseSpan(span);
//    console.log(result);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].word, "茶");
    assert.strictEqual(result[0].reading, "ちゃ");
    assert.strictEqual(result[0].start, 1);
    assert.strictEqual(result[1].word, "水");
    assert.strictEqual(result[1].reading, "みず");
    assert.strictEqual(result[1].start, 3);
});
QUnit.test("parseSpan: KHKHK", assert => {
    let span = {
        word: "盤の沢町桜が丘",
        reading: "ばんのさわちょうさくらがおか",
        start: 0
    }
    let result = parseSpan(span);
//    console.log(result);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].word, "盤");
    assert.strictEqual(result[0].reading, "ばん");
    assert.strictEqual(result[0].start, 0);
    assert.strictEqual(result[1].word, "沢町桜");
    assert.strictEqual(result[1].reading, "さわちょうさくら");
    assert.strictEqual(result[1].start, 2);
    assert.strictEqual(result[2].word, "丘");
    assert.strictEqual(result[2].reading, "おか");
    assert.strictEqual(result[2].start, 6);
});
// [\u3041-\u3096]+[\u3005\u3400-\u9FCF]+[\u3041-\u3096]+[\u3005\u3400-\u9FCF]+[\u3041-\u3096]+
QUnit.test("parseSpan: HKHKH", assert => {
    let span = {
        word: "お祭り騒ぎ",
        reading: "おまつりさわぎ",
        start: 0
    }
    let result = parseSpan(span);
//    console.log(result);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].word, "祭");
    assert.strictEqual(result[0].reading, "まつ");
    assert.strictEqual(result[0].start, 1);
    assert.strictEqual(result[1].word, "騒");
    assert.strictEqual(result[1].reading, "さわ");
    assert.strictEqual(result[1].start, 3);
});
// [\u3041-\u3096]+[\u3005\u3400-\u9FCF]+[\u3041-\u3096]+[\u3005\u3400-\u9FCF]+[\u3041-\u3096]+[\u3005\u3400-\u9FCF]+
QUnit.test("parseSpan: KHKHKHK", assert => {
    //抜き 足 差 し 足  忍  び 足
    //ぬき あし さ し あし しの び あし
    let span = {
        word:    "抜き足差し足忍び足",
        reading: "ぬきあしさしあししのびあし",
        start: 0
    }
    let result = parseSpan(span);
//    console.log(result);
    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[0].word, "抜");
    assert.strictEqual(result[0].reading, "ぬ");
    assert.strictEqual(result[0].start, 0);
    assert.strictEqual(result[1].word, "足差");
    assert.strictEqual(result[1].reading, "あしさ");
    assert.strictEqual(result[1].start, 2);
    assert.strictEqual(result[2].word, "足忍");
    assert.strictEqual(result[2].reading, "あししの");
    assert.strictEqual(result[2].start, 5);
    assert.strictEqual(result[3].word, "足");
    assert.strictEqual(result[3].reading, "あし");
    assert.strictEqual(result[3].start, 8);
});
QUnit.test("parseSpan: KHKHKHKH", assert => {
    let span = {
        word:    "入れ代わり立ち代わり",
        reading: "いれかわりたちかわり",
        start: 0
    }
    let result = parseSpan(span);
//    console.log(result);
    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[0].word, "入");
    assert.strictEqual(result[0].reading, "い");
    assert.strictEqual(result[0].start, 0);
    assert.strictEqual(result[1].word, "代");
    assert.strictEqual(result[1].reading, "か");
    assert.strictEqual(result[1].start, 2);
    assert.strictEqual(result[2].word, "立");
    assert.strictEqual(result[2].reading, "た");
    assert.strictEqual(result[2].start, 5);
    assert.strictEqual(result[3].word, "代");
    assert.strictEqual(result[3].reading, "か");
    assert.strictEqual(result[3].start, 7);
});

QUnit.module("miscellaneous");
QUnit.test("extends", assert => {
    function Sup(x) {
        this.x = x;
    }
    Sup.prototype.toString = function () {
        return "Sup{x=" + this.x + "}";
    }
    Sup.prototype.foo = function () {
        return "foo";
    }

    function Sub (x) {
        Sup.call(this, x);
    }
    __extends(Sub, Sup);
    Sub.prototype.toString = function () {
        return "Sub{x=" + this.x + "}";
    }
    let sup = new Sup(10);
    assert.strictEqual("Sup{x=10}", sup.toString());
    assert.strictEqual(sup.x, 10);
    assert.strictEqual(sup.foo(), "foo");
    assert.strictEqual(sup.constructor, Sup);
    assert.ok(sup instanceof Sup);

    let sub = new Sub(100);
    // override toString()
    assert.strictEqual("Sub{x=100}", sub.toString());
    // call super()
    assert.strictEqual(sub.x, 100);
    // inherit foo()
    assert.strictEqual(sub.foo(), "foo");
    assert.strictEqual(sub.constructor, Sub);
    assert.ok(sub instanceof Sub);
});
QUnit.module("miscellaneous");
/*
QUnit.asyncTest("setInterval", assert => {
    expect(2);
    let n = 0;
    let timer = setInterval(function () {
        n++;
    }, 50);
    setTimeout(function () {
        clearInterval(timer);
        assert.strictEqual(n, 3, "testing setInterval");
    }, 175);
    setTimeout(function () {
        assert.strictEqual(n, 3, "testing clearInterval");
        QUnit.start();
    }, 300);
});
*/
QUnit.test("Deinflector", assert => {
    let d = getDeinflector();
    let variants = d.deinflect("信頼される");
    assert.ok(variants.length > 1);
    assert.strictEqual(variants[0].reason, "");
    assert.strictEqual(variants[0].type, 255);
    assert.strictEqual(variants[0].word, "信頼される");
});

let dictionaries = [];

QUnit.module("DictionarySearcher", {
    setup: function (assert) {
        dictionaries = JSON.parse(getPrefs().getPref("dictionaries"));
    }
})
QUnit.test("getRikaichanDictionaryFileFromChromeURL", assert => {
    let file = getRikaichanDictionaryFileFromChromeURL("chrome://rikaichan-warodai-sqlite/content");
    assert.ok(file.exists());

    let file = getRikaichanDictionaryFileFromChromeURL("chrome://rikaichan-jpen/content");
    assert.ok(file.exists());

    try {
        getRikaichanDictionaryFileFromChromeURL("chrome://foo/content");
        assert.ok(false);
    } catch (e) {
        assert.strictEqual(e.message, "Component returned failure code: 0x80040111 (NS_ERROR_NOT_AVAILABLE) [nsIChromeRegistry.convertChromeURL]");
    }
});
QUnit.test("DictionarySearcher", assert => {
    let ds = new DictionarySearcher(getDeinflector(), []);
    assert.strictEqual(ds.dictionaries.length, 0);
    assert.strictEqual(ds.kanjiDictionaries.length, 0);

    let ds = new DictionarySearcher(getDeinflector(), dictionaries);
    assert.strictEqual(ds.dictionaries.length, 2);
    assert.strictEqual(ds.kanjiDictionaries.length, 1);
});
