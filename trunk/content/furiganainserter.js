"use strict";

var FuriganaInserter = {};

(function () {
    var Imports = {};
    Components.utils["import"]("resource://furiganainserter/utilities.js",
            Imports);
    Components.utils["import"]
            ("resource://furiganainserter/revert.js", Imports);
    Components.utils["import"]("resource://furiganainserter/popup.js", Imports);
    Components.utils["import"]("resource://furiganainserter/dict.js", Imports);
    Components.utils["import"]("resource://furiganainserter/parse.js", Imports);
    Components.utils["import"]("resource://furiganainserter/ruby.js", Imports);
    var Ci = Components.interfaces;

    var log = Imports.log;
    var time = Imports.time;
    var splitTextNode = Imports.splitTextNode;
    var escapeHTML = Imports.escapeHTML;
    var Preferences = Imports.Preferences;
    var PreferencesObserver = Imports.PreferencesObserver;
    var ClipboardMonitor = Imports.ClipboardMonitor;
    var RangeNodeIterator = Imports.RangeNodeIterator;
    var MecabWorker = Imports.getMecabWorker(document);
    var DictionarySearcher = Imports.DictionarySearcher;
    var Popup = Imports.Popup;
    var getReadings = Imports.getReadings;
    var HiraganaSimple = Imports.HiraganaSimple;
    var KatakanaSimple = Imports.KatakanaSimple;
    var RomajiSimple = Imports.RomajiSimple;
    var HiraganaComplex = Imports.HiraganaComplex;
    var KatakanaComplex = Imports.KatakanaComplex;
    var RomajiComplex = Imports.RomajiComplex;
    var Keywords = Imports.Keywords;
    var revertRange = Imports.revertRange;
    var revertElement = Imports.revertElement;
    var copyTextToClipboard = Imports.copyTextToClipboard;
    var setKeywords = Imports.setKeywords;

    var kPat = "\u3005\u3400-\u9FCF"; // "\u3005" is "々" - CJK iteration mark
    var hPat = "\u3041-\u3096"; // Hiragana
    var katPat = "\u30A1-\u30FA"; // Katakana
    var jRegex = new RegExp('[' + kPat + hPat + katPat + ']');
    var prefs = null;
    var mouseDown = false;
    var filterFunction = null;
    var popup = null;

    // browser is optional, the default is the selected browser
    function getBrowserData (browser) {
        if (arguments.length === 0) browser = gBrowser.selectedBrowser;
        return browser.furiganaInserter;
    }

    function BrowserData () {
        this.clipboard = null;
        this.popup = false;
        this.alphabet = "";
    }

    function onTabSelect (event) {
        var data;
        var browser = gBrowser.selectedBrowser;
        if (!browser.hasOwnProperty("furiganaInserter")) {
            data = new BrowserData();
            data.alphabet = prefs.getPref("furigana_alphabet");
            browser.furiganaInserter = data;
        } else {
            data = browser.furiganaInserter;
        }

        document.getElementById("fi-auto-lookup-command").setAttribute(
                "checked", data.popup);
        document.getElementById("fi-monitor-clipboard-command").setAttribute(
                "checked", data.clipboard != null);

        ["keywords", "katakana", "hiragana", "romaji"].forEach(function (
                alphabet) {
            document.getElementById("fi-" + alphabet + "-cmd").setAttribute(
                    "checked", false)
        });
        document.getElementById("fi-" + data.alphabet + "-cmd").setAttribute(
                "checked", true);
    }

    function installButton (toolbarId, id, afterId) {
        var elem, before = null, toolbar;

        if (!document.getElementById(id)) {
            toolbar = document.getElementById(toolbarId);

            // If no afterId is given, then append the item to the toolbar
            if (afterId) {
                elem = document.getElementById(afterId);
                if (elem && elem.parentNode == toolbar)
                    before = elem.nextElementSibling;
            }

            toolbar.insertItem(id, before);
            toolbar.setAttribute("currentset", toolbar.currentSet);
            document.persist(toolbar.id, "currentset");
        }
    }

    function onload () {
        prefs = new Preferences("extensions.furiganainserter.");
        var toolbarButtonAdded = prefs.getPref("toolbar_button_added");
        if (!toolbarButtonAdded) {
            installButton("nav-bar", "furigana-inserter-toolbarbutton");
            prefs.setPref("toolbar_button_added", true);
        }

        onTabSelect();
        gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect, false);
        gBrowser.tabContainer.addEventListener("TabClose", onTabClose, false);

        // The 'load' event doesn't bubble, so it only works with a capturing
        // event listener.
        // The 'DOMContentLoaded' event bubbles, so it also works with a
        // non-capturing listener.
        gBrowser.addEventListener("DOMContentLoaded", onPageLoad, true);
        window.addEventListener("mousedown", onMouseDown, false);
        window.addEventListener("mouseup", onMouseUp, false);
        document.getElementById("contentAreaContextMenu").addEventListener(
                "popupshowing", onPopupShowing, false);
        registerPreferencesObserver();
        changePopupStyle();
        loadFilter();
        var dict = new DictionarySearcher();
        dict.init(rcxDicList);
        popup = createPopup(dict);
        var panel = document.getElementById("furigana-inserter-popup");
        panel.addEventListener("DOMMouseScroll", panelOnMouseScroll, false);
        changeKeys();
    }

    function changeKeys () {
        var pref = prefs.getPref("lookup_key");
        var keyCodes = pref.split("+");
        var keyCode = keyCodes.pop();
        var modifiers = keyCodes.join(" ");
        var keyElement = document.getElementById("fi-lookup-word-key");
        keyElement.setAttribute("oncommand", "FuriganaInserter.lookupWord(event);");
        // doesn't work for some reason
//        keyelement.addEventListener("command", lookupWord, false);
        keyElement.setAttribute("modifiers", modifiers);
        keyElement.setAttribute("keycode", keyCode);
        // remove the keyset and add it again
        var keySet = keyElement.parentNode;
        var keySetParent = keySet.parentNode;
        keySetParent.removeChild(keySet);
        keySetParent.appendChild(keySet);
    }

    function panelOnMouseScroll (event) {
        var iframe = document.getElementById("furigana-inserter-iframe");
        var contentViewer = iframe.docShell.contentViewer;
        var docViewer = contentViewer.QueryInterface(Ci.nsIMarkupDocumentViewer);
        if (event.axis === event.VERTICAL_AXIS && event.ctrlKey) {
            docViewer.fullZoom += event.detail < 0 ? 0.1 : -0.1;
            event.preventDefault();
            event.stopPropagation();
        }
    }

    function onunload () {
        var browsers = gBrowser.browsers;
        var i, browser, data;
        for (i = 0; i < browsers.length; ++i) {
            browser = browsers[i];
            data = getBrowserData(browser);
            if (!data) continue;
            if (data.clipboard)
                data.clipboard.cancel();
            data.clipboard = null;
        }
    }

    function onMouseDown (event) {
        if (event.button === 0) mouseDown = true;
    }

    function onMouseUp (event) {
        if (event.button === 0) mouseDown = false;
    }

    function onMouseMove (event) {
        if (mouseDown) return;
        var ev = {
            rangeParent : event.rangeParent,
            rangeOffset : event.rangeOffset,
            clientX : event.clientX,
            clientY : event.clientY,
            pageX : event.pageX,
            pageY : event.pageY,
            target : event.target,
            currentTarget : event.currentTarget,
            view : event.view,
            detail : event.detail,
            screenX : event.screenX,
            screenY : event.screenY,
            ctrlKey : event.ctrlKey,
            shiftKey : event.shiftKey,
            altKey : event.altKey,
            metaKey : event.metaKey,
            button : event.button,
            relatedTarget : event.relatedTarget
        };
        popup.show(ev);
    }

    function onKeyDown (event) {
        //        if (popup.isVisible())
        //            popup.showNext();
        if ((event.keyCode === KeyEvent.DOM_VK_SHIFT ||
            event.keyCode === KeyEvent.DOM_VK_RETURN) &&  popup.isVisible())
            popup.showNext();
    }

    function onTabClose () {
        var data = getBrowserData();
        if (data.clipboard)
            data.clipboard.cancel();
        data.clipboard = null;
        data.popup = null;
    }

    function onPageLoad (event) {
        var data = getBrowserData();
        var alphabet = data.alphabet;
        var inserter = createInserter(alphabet);
        var doc = event.originalTarget;
        if (!(doc instanceof HTMLDocument)) return;
        if (prefs.getPref("auto_process_all_pages"))
            inserter.doElement(doc.body, function () {});
    }

    function togglePopup () {
        var data = getBrowserData();
        if (data.popup)
            disablePopup(gBrowser.selectedBrowser);
        else enablePopup(gBrowser.selectedBrowser);
    }

    function enablePopup (browser) {
        browser.addEventListener("mousemove", onMouseMove, false);
        browser.addEventListener("keydown", onKeyDown, false);
        getBrowserData(browser).popup = true;
        document.getElementById("fi-auto-lookup-command").setAttribute(
                "checked", "true");
    }

    function disablePopup (browser) {
        browser.removeEventListener("mousemove", onMouseMove, false);
        browser.removeEventListener("keydown", onKeyDown, false);
        getBrowserData(browser).popup = false;
        document.getElementById("fi-auto-lookup-command").setAttribute(
                "checked", "false");
    }

    function toggleClipboardMonitoring (event) {
        var data = getBrowserData();
        var browser = gBrowser.selectedBrowser;
        if (!data.clipboard) {
            data.clipboard = new ClipboardMonitor(150, function (text) {
                appendText(text, browser);
            });
        } else {
            data.clipboard.cancel();
            data.clipboard = null;
        }
        document.getElementById("fi-monitor-clipboard-command").setAttribute(
                "checked", data.clipboard != null);
    }

    function createInserter (alphabet) {
        var inserter = null;
        var tokenize = prefs.getPref("tokenize");
        if (alphabet === "hiragana")
            inserter = tokenize ? new Inserter(new HiraganaComplex())
                    : new Inserter(new HiraganaSimple());
        else if (alphabet === "katakana")
            inserter = tokenize ? new Inserter(new KatakanaComplex())
                    : new Inserter(new KatakanaSimple());
        else if (alphabet === "romaji")
            inserter = tokenize ? new Inserter(new RomajiComplex())
                    : new Inserter(new RomajiSimple());
        else inserter = new Inserter(new Keywords());
        return inserter;
    }

    function registerPreferencesObserver () {
        var observer = new PreferencesObserver(function (event) {
            if (event.data === "color_scheme") changePopupStyle();
            else if (event.data === "lookup_key") changeKeys();
        });
        prefs.register(observer);
    }

    function changePopupStyle () {
        var css = prefs.getPref("color_scheme");
        var uri = css.indexOf("/") >= 0 ? css
                : 'chrome://furiganainserter/skin/popup-' + css + '.css';
        var iframe = document.getElementById("furigana-inserter-iframe");
        var link = iframe.contentDocument.getElementById("rikaichan-css");
        link.href = uri;
    }

    function createPopup (dict) {
        var panel = document.getElementById("furigana-inserter-popup");
        var popup = new Popup(panel, dict);
        panel.addEventListener("mouseover", function (event) {
            window.clearTimeout(popup.timer);
        }, false);
        return popup;
    }

    function copyWithoutFurigana (event) {
        copyWithoutFurigana(gBrowser.selectedBrowser);
    }

    function removeFurigana () {
        time(function () {
            var doc = content.document;
            var range = getSelectedRange(content);
            if (range)
                revertRange(range);
            else revertElement(doc.body);
        });
    }

    function insertFurigana (event) {
        var data = getBrowserData();
        var alphabet = data.alphabet;
        var inserter = createInserter(alphabet);
        time(function () {
            var doc = gBrowser.contentDocument;
            var range = getSelectedRange(content);
            if (range)
                inserter.doRange(range, function () {
                });
            else inserter.doElement(doc.body, function () {
            });
        });
    }

    function openOptionsWindow () {
        window.openDialog("chrome://furiganainserter/content/options.xul", "",
                "centerscreen,modal");
    }

    function onPopupShowing () {
        var menuItem = document.getElementById("fi-copy-without-furigana-cm");
        menuItem.hidden = !gContextMenu.isTextSelected;
    }

    function openUserDictionary () {
        window.openDialog("chrome://furiganainserter/content/userdict.xul", "",
                "resizable");
    }

    function openSubstitutions () {
        var arg = {
            filterFunction : null
        };
        window.openDialog("chrome://furiganainserter/content/subst.xul", "",
                "modal,centerscreen", arg);
        if (arg.filterFunction)
            filterFunction = arg.filterFunction;
    }

    function openKeywords () {
        var arg = {
            keywords : null
        };
        window.openDialog("chrome://furiganainserter/content/keywords.xul", "",
                "modal,resizable,centerscreen", arg);
        if (arg.keywords) setKeywords(arg.keywords);
    }

    function switchAlphabet (event) {
        var id = event.target.id;
        var alphabet = id.substring(3, id.length - 4);
        var data = getBrowserData();
        data.alphabet = alphabet;
        ["keywords", "katakana", "hiragana", "romaji"].forEach(function (
                alphabet) {
            document.getElementById("fi-" + alphabet + "-cmd").setAttribute(
                    "checked", false);
        });
        document.getElementById("fi-" + alphabet + "-cmd").setAttribute(
                "checked", true);
    }

    function loadFilter () {
        var obj = Imports.getFilterArray();
        filterFunction = Imports.getFilterFunction(obj);
    }

    function appendText (text, browser) {
        var inserter;
        if (!jRegex.test(text)) return;
        var win = browser.contentWindow;
        var doc = win.document;
        text = escapeHTML(text);
        if (filterFunction) text = filterFunction(text);
        var p = doc.createElement("p");
        var lines = text.split(/\r\n|\n/);
        p.innerHTML = lines.join("<br>");
        doc.body.appendChild(p);
        var alphabet = getBrowserData(browser).alphabet;
        inserter = createInserter(alphabet);
        inserter.doElement(p, function () {
            win.scrollTo(0, win.scrollMaxY);
        });
    }

    function getSelectedRange (win) {
        var selection = win.getSelection();
        if (selection.isCollapsed || selection.rangeCount === 0)
            return null;
        else {
            var range = selection.getRangeAt(0);
            selection.removeRange(range);
            return range;
        }
    }

    function getTextNodesFromRange (range, pred) {
        var node, start, end;
        var nodes = [];
        var iter = new RangeNodeIterator(range);
        while ((node = iter.nextNode())) {
            if (!pred(node)) continue;
            start = iter.getStartTextOffset();
            end = iter.getEndTextOffset();
            nodes.push({
                node : node,
                start : start,
                end : end
            });
        }
        return nodes;
    }

    function copyWithoutFurigana () {
        copyTextToClipboard(getTextWithoutFurigana(content));
    }

    function isTextNotInRuby (node) {
        var expr = "self::text() and not(ancestor::ruby)";
        var doc = node.ownerDocument;
        if (node.data === "" || !jRegex.test(node.data))
            return false;
        else return doc.evaluate(expr, node, null, XPathResult.BOOLEAN_TYPE,
                null).booleanValue;
    }

    function isTextNotInRt (node) {
        var expr = "self::text() and not(parent::rp) and not(ancestor::rt)";
        if (node.data === "")
            return false;
        else return node.ownerDocument.evaluate(expr, node, null,
                XPathResult.BOOLEAN_TYPE, null).booleanValue;
    }

    function getTextWithoutFurigana (win) {
        var selection = win.getSelection();
        if (selection.rangeCount === 0 || selection.isCollapsed) return "";
        var range = selection.getRangeAt(0);
        var node, text = "";
        var iter = new RangeNodeIterator(range);
        while ((node = iter.nextNode())) {
            var start = iter.getStartTextOffset();
            var end = iter.getEndTextOffset();
            if (isTextNotInRt(node))
                text += node.data.substring(start, end);
        }
        return text;
    }

    function Inserter (rubyCreator) {
        this.creator = rubyCreator;
    }

    Inserter.prototype.doRange = function (range, k) {
        var textNodes = getTextNodesFromRange(range, isTextNotInRuby);
        var that = this;
        var strings = textNodes.map(function (node) {
            return node.node.data.substring(node.start, node.end)
        });
        var msg = {
            request : "getNodes",
            userDicPath : Imports.getUserDictionaryPath(),
            dicPath : Imports.getDictionaryPath(),
            text : strings
        };
        MecabWorker.send(msg, function (data) {
            // an array of arrays of tagger nodes
            var taggerNodes = data.nodes;
            taggerNodes.forEach(function (taggerNodes, i) {
                that.doitRight(taggerNodes, textNodes[i].node,
                        textNodes[i].start, textNodes[i].end);
            });
            k();
        });
    }

    // taggerNodes: nodes from Mecab, node: the text node from the document
    Inserter.prototype.doitRight = function (taggerNodes, node, start, end) {
        var data = node.data.substring(start, end);
        var doc = node.ownerDocument;
        var readings = getReadings(taggerNodes);
        if (readings.length === 0) return;
        var rubyHtml = this.creator.createRuby(data, readings);
        var div = doc.createElement("div");
        div.innerHTML = rubyHtml;
        var fragment = doc.createDocumentFragment();
        while (div.firstChild)
            fragment.appendChild(div.firstChild);
        node.parentNode.replaceChild(fragment, splitTextNode(node, start, end));
    }

    Inserter.prototype.doElement = function (elem, k) {
        var doc = elem.ownerDocument;
        var range = doc.createRange();
        range.selectNode(elem);
        this.doRange(range, k);
    }

    function showPopup (word) {
        if (word === "") return;
        if (popup.isVisible() && popup.word === word) {
            popup.showNext();
            return;
        }

        var windowUtils = content.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIDOMWindowUtils);
        var x = content.mozInnerScreenX;
        var y = content.mozInnerScreenY;
        var screenPixelsPerCSSPixel = windowUtils.screenPixelsPerCSSPixel;
        popup.lookupAndShowAt(word, x * screenPixelsPerCSSPixel,
        y * screenPixelsPerCSSPixel);
    }

    function toolbarOnKeyDown (event) {
        var textbox = document.getElementById("fi-toolbar-textbox");
        var win = document.getElementById("furigana-inserter-iframe").contentWindow;
        var windowUtils = win.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIDOMWindowUtils);
        if (event.keyCode === KeyEvent.DOM_VK_RETURN) {
            showPopup(textbox.value);
            textbox.focus();
        }
        else if (event.keyCode === KeyEvent.DOM_VK_ESCAPE) {
            if (popup.isVisible())
                popup.hide();
            else event.currentTarget.hidden = true;
        }
        else if (!popup.isVisible()) return;
        else if (event.keyCode === KeyEvent.DOM_VK_PAGE_DOWN)
            windowUtils.sendMouseScrollEvent("DOMMouseScroll", 0, 0, 0,
                1 /* full page */, 1, 0);
        else if (event.keyCode === KeyEvent.DOM_VK_PAGE_UP)
            windowUtils.sendMouseScrollEvent("DOMMouseScroll", 0, 0, 0,
                1 /* full page */, -1, 0);
        else if (event.keyCode === KeyEvent.DOM_VK_DOWN) {
            windowUtils.sendMouseScrollEvent("DOMMouseScroll", 0, 0, 0,
                0 /* full page */, 1, 0);
            event.preventDefault();
        }
        else if (event.keyCode === KeyEvent.DOM_VK_UP) {
            windowUtils.sendMouseScrollEvent("DOMMouseScroll", 0, 0, 0,
                0 /* full page */, -1, 0);
            event.preventDefault();
        }
    }

    function searchButtonOnCommand (event) {
        var textbox = document.getElementById("fi-toolbar-textbox");
        showPopup(textbox.value);
        textbox.focus();
    }

    function closeButtonOnCommand (event) {
        var textbox = document.getElementById("fi-toolbar-textbox");
        textbox.reset();
        document.getElementById('fi-toolbar').hidden = true;
    }

    function lookupWord (event) {
        var text = getTextWithoutFurigana(content);
        var textbox = document.getElementById("fi-toolbar-textbox");
        textbox.reset();
        if (text !== "") textbox.value = text;
        var toolbar = document.getElementById('fi-toolbar');
        if (toolbar.hidden) toolbar.hidden = false;
        showPopup(text);
        textbox.focus();
    }

    FuriganaInserter.openOptionsWindow = openOptionsWindow;
    FuriganaInserter.togglePopup = togglePopup;
    FuriganaInserter.toggleClipboardMonitoring = toggleClipboardMonitoring;
    FuriganaInserter.openUserDictionary = openUserDictionary;
    FuriganaInserter.openSubstitutions = openSubstitutions;
    FuriganaInserter.openKeywords = openKeywords;
    FuriganaInserter.switchAlphabet = switchAlphabet;
    FuriganaInserter.openOptionsWindow = openOptionsWindow;
    FuriganaInserter.insertFurigana = insertFurigana;
    FuriganaInserter.removeFurigana = removeFurigana;
    FuriganaInserter.copyWithoutFurigana = copyWithoutFurigana;
    FuriganaInserter.lookupWord = lookupWord;

    FuriganaInserter.toolbarOnKeyDown = toolbarOnKeyDown;
    FuriganaInserter.closeButtonOnCommand = closeButtonOnCommand;
    FuriganaInserter.searchButtonOnCommand = searchButtonOnCommand;

    window.addEventListener("load", onload, false);
    window.addEventListener("unload", onunload, false);

})();
