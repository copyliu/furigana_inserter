"use strict";

let FuriganaInserter = {};

(function () {
    let Imports = {};
    Components.utils["import"]("resource://furiganainserter/utilities.js", Imports);
    Components.utils["import"]("resource://furiganainserter/revert.js", Imports);
    Components.utils["import"]("resource://furiganainserter/popup.js", Imports);
    Components.utils["import"]("resource://furiganainserter/dict.js", Imports);
    Components.utils["import"]("resource://furiganainserter/parse.js", Imports);
    Components.utils["import"]("resource://furiganainserter/ruby.js", Imports);
    Components.utils["import"]("resource://furiganainserter/RangeNodeIterator.js", Imports);
    
    let Ci = Components.interfaces;

    let time = Imports.time;
    let splitTextNode = Imports.splitTextNode;
    let escapeHTML = Imports.escapeHTML;
    let Preferences = Imports.Preferences;
    let PreferencesObserver = Imports.PreferencesObserver;
    let ClipboardMonitor = Imports.ClipboardMonitor;
    let RangeNodeIterator = Imports.RangeNodeIterator;
    let MecabWorker = Imports.getMecabWorker(document);
    let DictionarySearcher = Imports.DictionarySearcher;
    let Popup = Imports.Popup;
    let getReadings = Imports.getReadings;
    let HiraganaSimple = Imports.HiraganaSimple;
    let KatakanaSimple = Imports.KatakanaSimple;
    let RomajiSimple = Imports.RomajiSimple;
    let HiraganaComplex = Imports.HiraganaComplex;
    let KatakanaComplex = Imports.KatakanaComplex;
    let RomajiComplex = Imports.RomajiComplex;
    let revertRange = Imports.revertRange;
    let revertElement = Imports.revertElement;
    let copyTextToClipboard = Imports.copyTextToClipboard;
    let getSessionStore = Imports.getSessionStore;
    let getTextNodesFromRange = Imports.getTextNodesFromRange;
    let getStartTextOffset = Imports.getStartTextOffset;
    let getEndTextOffset = Imports.getEndTextOffset;

    let kPat = "\u3005\u3400-\u9FCF"; // "\u3005" is "々" - CJK iteration mark
    let hPat = "\u3041-\u3096"; // Hiragana
    let katPat = "\u30A1-\u30FA"; // Katakana
    let jRegex = new RegExp('[' + kPat + hPat + katPat + ']');
    let prefs = null;
    let mouseDown = false;
    let popup = null;

    function BrowserData (tab = gBrowser.selectedTab) {
        let ss = getSessionStore();
        Object.defineProperty(this, 'isClipboardMonitoringEnabled', {
            get: function () {
                return ss.getTabValue(tab, "fiIsClipboardMonitoringEnabled") === "true";
            },
            set: function (value) {
                ss.setTabValue(tab, "fiIsClipboardMonitoringEnabled", value.toString());
            }
        });
        Object.defineProperty(this, 'isPopupEnabled', {
            get: function () {
                return ss.getTabValue(tab, "fiIsPopupEnabled") === "true";
            },
            set: function (value) {
                ss.setTabValue(tab, "fiIsPopupEnabled", value.toString());
            }
        });
        Object.defineProperty(this, 'alphabet', {
            get: function () {
                return ss.getTabValue(tab, "fiFuriganaAlphabet");
            },
            set: function (value) {
                ss.setTabValue(tab, "fiFuriganaAlphabet", value);
            }
        });
    }

    BrowserData.prototype.toString = function () {
        return JSON.stringify(this);
    };

    function onTabSelect (event) {
//        console.log("onTabSelect");
        initTab(event.target);
    }

    function onTabOpen(event) {
//        console.log("onTabOpen");
        initTab(event.target);
    }

    function initTab(tab) {
        let data = new BrowserData(tab);
        if (data.alphabet === "") {
            data.alphabet = prefs.getPref("furigana_alphabet");
        }

        document.getElementById("fi-auto-lookup-command")
        .setAttribute("checked", data.isPopupEnabled);
        document.getElementById("fi-monitor-clipboard-command")
        .setAttribute("checked", data.isClipboardMonitoringEnabled);

        ["katakana", "hiragana", "romaji"].forEach(function (alphabet) {
            document.getElementById("fi-" + alphabet + "-cmd").setAttribute("checked", false);
        });
        document.getElementById("fi-" + data.alphabet + "-cmd").setAttribute("checked", true);
    }

    function onTabRestored(event) {
//        console.log("onTabRestored");
        let tab = event.target;
        initTab(tab);
        let data = new BrowserData(tab);
        if (data.isClipboardMonitoringEnabled) {
            let monitor = new ClipboardMonitor(150, function (text) {
                appendTextAsync(text, tab);
            });
            addClipboardMonitor(tab, monitor);
        }
        if (data.isPopupEnabled) {
            enablePopup(tab);
        }
    }

    function onLoad (event) {
        prefs = new Preferences("extensions.furiganainserter.");
        let toolbarButtonAdded = prefs.getPref("toolbar_button_added");
        if (!toolbarButtonAdded) {
            installButton("nav-bar", "furigana-inserter-toolbarbutton");
            prefs.setPref("toolbar_button_added", true);
        }

        gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect, false);
        gBrowser.tabContainer.addEventListener("TabOpen", onTabOpen, false);
        gBrowser.tabContainer.addEventListener("TabClose", onTabClose, false);

        document.addEventListener("SSTabRestored", onTabRestored, false);

        // The 'load' event doesn't bubble, so it only works with a capturing
        // event listener.
        // The 'DOMContentLoaded' event bubbles, so it also works with a
        // non-capturing listener.
        gBrowser.addEventListener("DOMContentLoaded", onDOMContentLoaded, false);
        window.addEventListener("mousedown", onMouseDown, false);
        window.addEventListener("mouseup", onMouseUp, false);
        document.getElementById("contentAreaContextMenu")
        .addEventListener("popupshowing", onPopupShowing, false);
        registerPreferencesObserver();
        changePopupStyle();
        let dict = new DictionarySearcher();
        if (!window.rcxDicList) {
            dict.init([]);
        } else {
            dict.init(window.rcxDicList);
        }
        popup = createPopup(dict);
        let panel = document.getElementById("furigana-inserter-popup");
        panel.addEventListener("DOMMouseScroll", panelOnMouseScroll, false);
        changeKeys();
    }

    function changeKeys () {
        let pref = prefs.getPref("lookup_key");
        let keyCodes = pref.split("+");
        let keyCode = keyCodes.pop();
        let modifiers = keyCodes.join(" ");
        let keyElement = document.getElementById("fi-lookup-word-key");
        keyElement.setAttribute("oncommand", "FuriganaInserter.lookupWord(event);");
        // doesn't work for some reason
//        keyelement.addEventListener("command", lookupWord, false);
        keyElement.setAttribute("modifiers", modifiers);
        keyElement.setAttribute("keycode", keyCode);
        // remove the keyset and add it again
        let keySet = keyElement.parentNode;
        let keySetParent = keySet.parentNode;
        keySetParent.removeChild(keySet);
        keySetParent.appendChild(keySet);
    }

    function panelOnMouseScroll (event) {
        let iframe = document.getElementById("furigana-inserter-iframe");
        let contentViewer = iframe.docShell.contentViewer;
        let docViewer = contentViewer.QueryInterface(Ci.nsIMarkupDocumentViewer);
        if (event.axis === event.VERTICAL_AXIS && event.ctrlKey) {
            docViewer.fullZoom += event.detail < 0 ? 0.1 : -0.1;
            event.preventDefault();
            event.stopPropagation();
        }
    }

    function Pair(first, second) {
        this.first = first;
        this.second = second;
    }

    // contains pairs of tab and clipboard monitor
    let clipboardMonitors = [];

    function addClipboardMonitor(tab, monitor) {
        for (let i = 0; i < clipboardMonitors.length; ++i) {
            if (clipboardMonitors[i].first === tab) {
                clipboardMonitors[i].second = monitor;
                return;
            }
        }
        clipboardMonitors.push(new Pair(tab, monitor));
    }

    function getClipboardMonitor(tab) {
        for (let i = 0; i < clipboardMonitors.length; ++i) {
            if (clipboardMonitors[i].first === tab) {
                return clipboardMonitors[i].second;
            }
        }
        return null;
    }

    function onUnload (event) {
        let tabs = gBrowser.tabs;
        for (let i = 0; i < tabs.length; ++i) {
            let tab = tabs[i];
            let data = new BrowserData(tab);
            if (data.isClipboardMonitoringEnabled) {
                getClipboardMonitor(tab).cancel();
            }
            data.isClipboardMonitoringEnabled = false;
        }
    }

    function onMouseDown (event) {
        if (event.button === 0) {
            mouseDown = true;
        }
    }

    function onMouseUp (event) {
        if (event.button === 0) {
            mouseDown = false;
        }
    }

    function onMouseMove (event) {
        if (mouseDown) {
            return;
        }
        let ev = {
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
        if ((event.keyCode === KeyEvent.DOM_VK_SHIFT ||
            event.keyCode === KeyEvent.DOM_VK_RETURN) && popup.isVisible()) {
            popup.showNext();
        }
    }

    function onTabClose (event) {
//        console.log("onTabClose");
        let tab = gBrowser.selectedTab;
        let data = new BrowserData(tab);
        if (data.isClipboardMonitoringEnabled) {
            getClipboardMonitor(tab).cancel();
        }
        data.isClipboardMonitoringEnabled = false;
        data.isPopupEnabled = false;
    }

    function onDOMContentLoaded (event) {
//        console.log("onDOMContentLoaded");
        initTab();
        let data = new BrowserData();
        let alphabet = data.alphabet;
        let inserter = createInserter(alphabet);
        let doc = event.originalTarget;
        if (!(doc instanceof HTMLDocument)) {
            return;
        }
        if (prefs.getPref("auto_process_all_pages")) {
            inserter.doElementAsync(doc.body);
        }
    }

    function togglePopup (event) {
        let tab = gBrowser.selectedTab;
        let data = new BrowserData(tab);
        if (data.isPopupEnabled) {
            disablePopup(tab);
        } else {
            enablePopup(tab);
        }
    }

    function enablePopup (tab) {
        let browser = gBrowser.getBrowserForTab(tab);
        browser.addEventListener("mousemove", onMouseMove, false);
        browser.addEventListener("keydown", onKeyDown, false);
        let data = new BrowserData(tab);
        data.isPopupEnabled = true;
        document.getElementById("fi-auto-lookup-command").setAttribute(
                "checked", "true");
    }

    function disablePopup (tab) {
        let browser = gBrowser.getBrowserForTab(tab);
        browser.removeEventListener("mousemove", onMouseMove, false);
        browser.removeEventListener("keydown", onKeyDown, false);
        let data = new BrowserData(tab);
        data.isPopupEnabled = false;
        document.getElementById("fi-auto-lookup-command").setAttribute(
                "checked", "false");
    }

    function toggleClipboardMonitoring (event) {
        let monitor;
        let tab = gBrowser.selectedTab;
        let data = new BrowserData(tab);
        if (!data.isClipboardMonitoringEnabled) {
            monitor = new ClipboardMonitor(150, function (text) {
                appendTextAsync(text, tab);
            });
            data.isClipboardMonitoringEnabled = true;
            addClipboardMonitor(tab, monitor);
        } else {
            monitor = getClipboardMonitor(tab);
            monitor.cancel();
            data.isClipboardMonitoringEnabled = false;
        }
        document.getElementById("fi-monitor-clipboard-command").
        setAttribute("checked", data.isClipboardMonitoringEnabled);
    }

    function createInserter (alphabet) {
        let inserter = null;
        let tokenize = prefs.getPref("tokenize");
        if (alphabet === "hiragana") {
            inserter = tokenize ? new Inserter(new HiraganaComplex())
            : new Inserter(new HiraganaSimple());
        } else if (alphabet === "katakana") {
            inserter = tokenize ? new Inserter(new KatakanaComplex())
            : new Inserter(new KatakanaSimple());
        } else if (alphabet === "romaji") {
            inserter = tokenize ? new Inserter(new RomajiComplex())
            : new Inserter(new RomajiSimple());
        } else {
            console.error("unknown alphabet: " + alphabet);
        }
        return inserter;
    }

    function registerPreferencesObserver () {
        let observer = new PreferencesObserver(function (event) {
            if (event.data === "color_scheme") {
                changePopupStyle();
            } else if (event.data === "lookup_key") {
                changeKeys();
            }
        });
        prefs.register(observer);
    }

    function changePopupStyle () {
        let css = prefs.getPref("color_scheme");
        let uri = css.indexOf("/") >= 0 ? css
                : 'chrome://furiganainserter/skin/popup-' + css + '.css';
        let iframe = document.getElementById("furigana-inserter-iframe");
        let link = iframe.contentDocument.getElementById("rikaichan-css");
        link.href = uri;
    }

    function createPopup (dict) {
        let panel = document.getElementById("furigana-inserter-popup");
        let popup = new Popup(panel, dict);
        panel.addEventListener("mouseover", function (event) {
            window.clearTimeout(popup.timer);
        }, false);
        return popup;
    }

    function copyWithoutFurigana (event) {
        copyTextToClipboard(getTextWithoutFurigana(), event.view);
    }

    function removeFurigana (event) {
        time(function () {
            let win = getFocusedWindow();
            let doc = win.document;
            let range = getSelectedRange(win);
            if (range) {
                revertRange(range);
            } else {
                revertElement(doc.body);
            }
        });
    }

    function insertFurigana (event) {
        let data = new BrowserData();
        let alphabet = data.alphabet;
        let inserter = createInserter(alphabet);
        return time(function () {
            let win = getFocusedWindow();
            let doc = win.document;
            let range = getSelectedRange(win);
            if (range) {
                return inserter.doRangeAsync(range);
            } else {
                return inserter.doElementAsync(doc.body);
            }
        });
    }

    function openOptionsWindow (event) {
        window.openDialog("chrome://furiganainserter/content/options.xul", "",
                "centerscreen,modal");
    }

    function onPopupShowing (event) {
        let menuItem = document.getElementById("fi-copy-without-furigana-cm");
        menuItem.hidden = !gContextMenu.isTextSelected;
    }

    function openUserDictionary (event) {
        window.openDialog("chrome://furiganainserter/content/userdict.xul", "",
                "resizable");
    }

    function switchAlphabet (event) {
        let id = event.target.id;
        let alphabet = id.substring(3, id.length - 4);
        let data = new BrowserData();
        data.alphabet = alphabet;
        ["katakana", "hiragana", "romaji"].forEach(function (
                alphabet) {
            document.getElementById("fi-" + alphabet + "-cmd").setAttribute(
                    "checked", false);
        });
        document.getElementById("fi-" + alphabet + "-cmd").setAttribute(
                "checked", true);
    }

    function appendTextAsync (text, tab) {
        if (!jRegex.test(text)) {
            return null;
        }
        let browser = gBrowser.getBrowserForTab(tab);
        let win = browser.contentWindow;
        let doc = win.document;
        text = escapeHTML(text);
        let p = doc.createElement("p");
        let lines = text.split(/\r\n|\n/);
        p.innerHTML = lines.join("<br>");
        doc.body.appendChild(p);
        let alphabet = new BrowserData(tab).alphabet;
        let inserter = createInserter(alphabet);
        return Task.spawn(function* () {
            yield inserter.doElementAsync(p);
            win.scrollTo(0, win.scrollMaxY);
        });
    }

    function getSelectedRange (win) {
        let selection = win.getSelection();
        if (selection.isCollapsed || selection.rangeCount === 0) {
            return null;
        } else {
            let range = selection.getRangeAt(0);
            selection.removeRange(range);
            return range;
        }
    }

    function isTextNotInRuby (node) {
        let expr = "self::text() and not(ancestor::ruby)";
        let doc = node.ownerDocument;
        if (node.data === "" || !jRegex.test(node.data)) {
            return false;
        } else {
            return doc.evaluate(expr, node, null, XPathResult.BOOLEAN_TYPE,
            null).booleanValue;
        }
    }

    function isTextNotInRt (node) {
        let expr = "self::text() and not(parent::rp) and not(ancestor::rt)";
        if (node.data === "") {
            return false;
        } else {
            return node.ownerDocument.evaluate(expr, node, null,
            XPathResult.BOOLEAN_TYPE, null).booleanValue;
        }
    }

    function getFocusedWindow () {
        if (content.document.activeElement instanceof HTMLFrameElement) {
            return content.document.activeElement.contentWindow;
        } else {
            return content;
        }
    }

    function getTextWithoutFurigana () {
        let win = getFocusedWindow();
        let selection = win.getSelection();
        if (selection.rangeCount === 0 || selection.isCollapsed) {
            return "";
        }
        let range = selection.getRangeAt(0);
        let text = "";
        for (let node of RangeNodeIterator(range)) {
            let start = getStartTextOffset(node, range);
            let end = getEndTextOffset(node, range);
            if (isTextNotInRt(node)) {
                text += node.data.substring(start, end);
            }
        }
        return text;
    }

    function Inserter (rubyCreator) {
        this.creator = rubyCreator;
    }

    Inserter.prototype.doRangeAsync = function (range) {
        let textNodes = getTextNodesFromRange(range, isTextNotInRuby);
        let that = this;
        let strings = textNodes.map(function (node) {
            return node.node.data.substring(node.start, node.end);
        });
        return Task.spawn(function* () {
            // an array of arrays of tagger nodes
            let taggerNodes = yield MecabWorker.getNodesAsync(strings);
            taggerNodes.forEach(function (taggerNodes, i) {
                that.doitRight(taggerNodes, textNodes[i].node,
                        textNodes[i].start, textNodes[i].end);
            });
        });
    };

    // taggerNodes: nodes from Mecab, node: the text node from the document
    Inserter.prototype.doitRight = function (taggerNodes, node, start, end) {
        let data = node.data.substring(start, end);
        let doc = node.ownerDocument;
        let readings = getReadings(taggerNodes);
        if (readings.length === 0) {
            return;
        }
        let rubyHtml = this.creator.createRuby(data, readings);
        let div = doc.createElement("div");
        div.innerHTML = rubyHtml;
        let fragment = doc.createDocumentFragment();
        while (div.firstChild) {
            fragment.appendChild(div.firstChild);
        }
        node.parentNode.replaceChild(fragment, splitTextNode(node, start, end));
    };

    Inserter.prototype.doElementAsync = function (elem) {
        let range = elem.ownerDocument.createRange();
        range.selectNode(elem);
        return this.doRangeAsync(range);
    };

    function showPopup (word) {
        if (word === "") {
            return;
        }
        if (popup.isVisible() && popup.word === word) {
            popup.showNext();
            return;
        }

        let windowUtils = content.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIDOMWindowUtils);
        let x = content.mozInnerScreenX;
        let y = content.mozInnerScreenY;
        let screenPixelsPerCSSPixel = windowUtils.screenPixelsPerCSSPixel;
        popup.lookupAndShowAt(word, x * screenPixelsPerCSSPixel,
        y * screenPixelsPerCSSPixel);
    }

    function toolbarOnKeyDown (event) {
        let textbox = document.getElementById("fi-toolbar-textbox");
        let win = document.getElementById("furigana-inserter-iframe").contentWindow;
        let windowUtils = win.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIDOMWindowUtils);
        if (event.keyCode === KeyEvent.DOM_VK_RETURN) {
            showPopup(textbox.value);
            textbox.focus();
        }
        else if (event.keyCode === KeyEvent.DOM_VK_ESCAPE) {
            if (popup.isVisible()) {
                popup.hide();
            } else {
                event.currentTarget.hidden = true;
            }
        }
        else if (!popup.isVisible()) {
            return;
        } else if (event.keyCode === KeyEvent.DOM_VK_PAGE_DOWN) {
            windowUtils.sendWheelEvent(0, 0, //X, Y
            0, 1, 0, // deltaX, deltaY, deltaZ
            WheelEvent.DOM_DELTA_PAGE, // deltaMode
            0, // modifiers
            0, 0, // lineOrPageDeltaX, lineOrPageDeltaY
            windowUtils.WHEEL_EVENT_CUSTOMIZED_BY_USER_PREFS); // options
        } else if (event.keyCode === KeyEvent.DOM_VK_PAGE_UP) {
            windowUtils.sendWheelEvent(0, 0, //X, Y
            0, -1, 0, // deltaX, deltaY, deltaZ
            WheelEvent.DOM_DELTA_PAGE, // deltaMode
            0, // modifiers
            0, 0, // lineOrPageDeltaX, lineOrPageDeltaY
            windowUtils.WHEEL_EVENT_CUSTOMIZED_BY_USER_PREFS); // options
        } else if (event.keyCode === KeyEvent.DOM_VK_DOWN) {
            windowUtils.sendWheelEvent(0, 0, //X, Y
            0, 1, 0, // deltaX, deltaY, deltaZ
            WheelEvent.DOM_DELTA_LINE, // deltaMode
            0, // modifiers
            0, 0, // lineOrPageDeltaX, lineOrPageDeltaY
            windowUtils.WHEEL_EVENT_CUSTOMIZED_BY_USER_PREFS); // options
            event.preventDefault();
        } else if (event.keyCode === KeyEvent.DOM_VK_UP) {
            windowUtils.sendWheelEvent(0, 0, //X, Y
            0, -1, 0, // deltaX, deltaY, deltaZ
            WheelEvent.DOM_DELTA_LINE, // deltaMode
            0, // modifiers
            0, 0, // lineOrPageDeltaX, lineOrPageDeltaY
            0); // options
            event.preventDefault();
        }
    }

    function searchButtonOnCommand (event) {
        let textbox = document.getElementById("fi-toolbar-textbox");
        showPopup(textbox.value);
        textbox.focus();
    }

    function closeButtonOnCommand (event) {
        let textbox = document.getElementById("fi-toolbar-textbox");
        textbox.reset();
        document.getElementById('fi-toolbar').hidden = true;
    }

    function lookupWord (event) {
        let text = getTextWithoutFurigana();
        let textbox = document.getElementById("fi-toolbar-textbox");
        textbox.reset();
        if (text !== "") {
            textbox.value = text;
        }
        let toolbar = document.getElementById('fi-toolbar');
        if (toolbar.hidden) {
            toolbar.hidden = false;
        }
        showPopup(text);
        textbox.focus();
    }

    function installButton (toolbarId, id, afterId) {
        let elem, before = null, toolbar;

        if (!document.getElementById(id)) {
            toolbar = document.getElementById(toolbarId);

            // If no afterId is given, then append the item to the toolbar
            if (afterId) {
                elem = document.getElementById(afterId);
                if (elem && elem.parentNode === toolbar) {
                    before = elem.nextElementSibling;
                }
            }

            toolbar.insertItem(id, before);
            toolbar.setAttribute("currentset", toolbar.currentSet);
            document.persist(toolbar.id, "currentset");
        }
    }

    FuriganaInserter.openOptionsWindow = openOptionsWindow;
    FuriganaInserter.togglePopup = togglePopup;
    FuriganaInserter.toggleClipboardMonitoring = toggleClipboardMonitoring;
    FuriganaInserter.openUserDictionary = openUserDictionary;
    FuriganaInserter.switchAlphabet = switchAlphabet;
    FuriganaInserter.openOptionsWindow = openOptionsWindow;
    FuriganaInserter.insertFurigana = insertFurigana;
    FuriganaInserter.removeFurigana = removeFurigana;
    FuriganaInserter.copyWithoutFurigana = copyWithoutFurigana;
    FuriganaInserter.lookupWord = lookupWord;

    FuriganaInserter.toolbarOnKeyDown = toolbarOnKeyDown;
    FuriganaInserter.closeButtonOnCommand = closeButtonOnCommand;
    FuriganaInserter.searchButtonOnCommand = searchButtonOnCommand;

    window.addEventListener("load", onLoad, false);
    window.addEventListener("unload", onUnload, false);

})();
