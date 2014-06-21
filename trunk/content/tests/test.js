"use strict";

Components.utils["import"]("resource://gre/modules/AddonManager.jsm");
Components.utils["import"]("resource://gre/modules/Task.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");

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

QUnit.test("RangeNodeIterator1", assert => {
    let range = document.createRange();
    let fixture = document.getElementById("qunit-fixture");
    let p = fixture.children[0];
    assert.equal(p.nodeName, "P");
    range.setStart(p, 0);
    range.setEnd(p, 4);
    let n = 0;
    for (let node of RangeNodeIterator(range)) {
//        console.log(node);
        n++;
    }
    assert.equal(n, 6);
});
QUnit.test("RangeNodeIterator2", assert => {
    let range = document.createRange();
    let fixture = document.getElementById("qunit-fixture");
    let p = fixture.children[0];
    let text = p.childNodes[1];
    assert.equal(p.nodeName, "P");
    assert.equal(text.data, "は、信頼されるフリーなオンライン");
    range.setStart(text, 2);
    range.setEnd(text, 7);
    let n = 0;
    for (let node of RangeNodeIterator(range)) {
//        console.log(node);
        n++;
    }
    assert.equal(n, 1);
});
QUnit.test("RangeNodeIterator3", assert => {
    let range = document.createRange();
    let fixture = document.getElementById("qunit-fixture");
    let p1 = fixture.children[1];
    let p2 = fixture.children[2];
    assert.equal(p1.nodeName, "P");
    assert.equal(p2.nodeName, "P");
    let text1 = p1.childNodes[0];
    let text2 = p2.childNodes[0];
    assert.equal(text1.data, "を放棄しているわけではありませんが、記事をCC-BY-SA 3.0に基づいて改変することを認めているのです。");
    assert.equal(text2.data, "記事の引用については、著作権が放棄されているわけではありませんので、");
    range.setStart(text1, 42);
    range.setEnd(text2, 11);
    let n = 0;
    for (let node of RangeNodeIterator(range)) {
//        console.log(node);
        n++;
    }
    assert.equal(n, 5);
});
QUnit.test("RangeNodeIterator4", assert => {
    let range = document.createRange();
    let fixture = document.getElementById("qunit-fixture");
    let p1 = fixture.children[3];
    let p2 = fixture.children[4];
    assert.equal(p1.nodeName, "P");
    assert.equal(p2.nodeName, "P");
    let text1 = p1.childNodes[0];
    let text2 = p2.childNodes[0];
    assert.equal(text1.data, "が行っています。");
    assert.equal(text2.data, "ウィキペディアは、誰もが編集に参加できるため、記事の信頼性が低いのではないかと批判されることもあります。こうした批判に対しては");
    range.setStart(text1, 1);
    range.setEnd(text2, 9);
    let n = 0;
    for (let node of RangeNodeIterator(range)) {
//        console.log(node);
        n++;
    }
    assert.equal(n, 5);
});
QUnit.test("getDllPath", assert => {
    let path = getDllPath();
    assert.ok(/C:\\.*?libmecab.dll$/.test(path));
});
QUnit.test("getDictionaryPath", assert => {
//    assert.ok(/C:\\.*?mecabrc$/.test(getDictionaryPath()));
    assert.equal(getDictionaryPath(), "");
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
        assert.equal(version, "0.996");
        QUnit.start();
    }).then(null, onQUnitError);
});
QUnit.asyncTest("getNodesAsync1", function (assert) {
    expect(4);
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["現在、ウィキペディア日本語版には約本の記事があります。"]);
        let nodes = data[0];
        assert.equal(nodes.length, 16);
        let node0 = nodes[0];
        assert.equal(node0.feature, "名詞,副詞可能,*,*,*,*,現在,ゲンザイ,ゲンザイ");
        assert.equal(node0.length, 0);
        assert.equal(node0.surface, "現在");
        QUnit.start();
    }).then(null, onQUnitError);
});
QUnit.asyncTest("getNodesAsync2", function (assert) {
    expect(4);
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典を、"]);
        let nodes = data[0];
        assert.equal(nodes.length, 13);
        let node0 = nodes[0];
        assert.equal(node0.feature, "名詞,代名詞,一般,*,*,*,それ,ソレ,ソレ");
        assert.equal(node0.length, 0);
        assert.equal(node0.surface, "それ");
        QUnit.start();
    }).then(null, onQUnitError);
});
QUnit.asyncTest("getNodesAsyncSerial", function (assert) {
    expect(4);
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典を、"]);
        let nodes = data[0];
        assert.equal(nodes.length, 13);
        data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典を、"]);
        nodes = data[0];
        assert.equal(nodes.length, 13);
        data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典を、"]);
        nodes = data[0];
        assert.equal(nodes.length, 13);
        data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典を、"]);
        nodes = data[0];
        assert.equal(nodes.length, 13);
        QUnit.start();
    }).then(null, onQUnitError);
});
QUnit.asyncTest("getNodesAsyncParallel", function (assert) {
    expect(5);
    let promises = [Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典を、"]);
        let nodes = data[0];
        assert.equal(nodes.length, 13);
    }).then(null, onQUnitError),
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科事典、"]);
        let nodes = data[0];
        assert.equal(nodes.length, 12);
    }).then(null, onQUnitError),
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大の百科、"]);
        let nodes = data[0];
        assert.equal(nodes.length, 11);
    }).then(null, onQUnitError),
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大の、"]);
        let nodes = data[0];
        assert.equal(nodes.length, 10);
    }).then(null, onQUnitError),
    Task.spawn(function* () {
        let data = yield mw.getNodesAsync(["それも質量ともに史上最大、"]);
        let nodes = data[0];
        assert.equal(nodes.length, 9);
    }).then(null, onQUnitError)
    ];
    Task.spawn(function* () {
        yield Promise.all(promises);
        QUnit.start();
    }).then(null, onQUnitError);
});
