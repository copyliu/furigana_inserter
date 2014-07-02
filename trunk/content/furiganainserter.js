"use strict";

let FuriganaInserter = {};

(function () {
    let Imports = {};
    Components.utils["import"]("resource://furiganainserter/utilities.js", Imports);
    Components.utils["import"]("resource://furiganainserter/revert.js", Imports);
    Components.utils["import"]("resource://furiganainserter/popup.js", Imports);
    Components.utils["import"]("resource://furiganainserter/dict.js", Imports);
    Components.utils["import"]("resource://furiganainserter/getRangeNodes.js", Imports);
    Components.utils["import"]("resource://furiganainserter/inserter.js", Imports);
    
    let Ci = Components.interfaces;

    let time = Imports.time;
    let escapeHTML = Imports.escapeHTML;
    let Preferences = Imports.Preferences;
    let PreferencesObserver = Imports.PreferencesObserver;
    let ClipboardMonitor = Imports.ClipboardMonitor;
    let getRangeNodes = Imports.getRangeNodes;
    let DictionarySearcher = Imports.DictionarySearcher;
    let Popup = Imports.Popup;
    let revertRange = Imports.revertRange;
    let revertElement = Imports.revertElement;
    let copyTextToClipboard = Imports.copyTextToClipboard;
    let getSessionStore = Imports.getSessionStore;
    let getTextNodesFromRange = Imports.getTextNodesFromRange;
    let getPrefs = Imports.getPrefs;
    let getDeinflector = Imports.getDeinflector;
    let createInserter = Imports.createInserter;

    let kPat = "\u3005\u3400-\u9FCF"; // "\u3005" is "々" - CJK iteration mark
    let hPat = "\u3041-\u3096"; // Hiragana
    let katPat = "\u30A1-\u30FA"; // Katakana
    let jRegex = new RegExp('[' + kPat + hPat + katPat + ']');

    let mouseDown = false;
    // map from tab to clipboard monitor implemented as array of {tab, monitor} objects
    let clipboardMonitors = [];

    function BrowserData (tab) {
        this._ss = getSessionStore();
        this._tab = tab;
    }

    Object.defineProperty(BrowserData.prototype, 'isClipboardMonitoringEnabled', {
        get: function () {
            return this._ss.getTabValue(this._tab, "fiIsClipboardMonitoringEnabled") === "true";
        },
        set: function (value) {
            this._ss.setTabValue(this._tab, "fiIsClipboardMonitoringEnabled", value.toString());
        }
    });

    Object.defineProperty(BrowserData.prototype, 'isPopupEnabled', {
        get: function () {
            return this._ss.getTabValue(this._tab, "fiIsPopupEnabled") === "true";
        },
        set: function (value) {
            this._ss.setTabValue(this._tab, "fiIsPopupEnabled", value.toString());
        }
    });

    Object.defineProperty(BrowserData.prototype, 'alphabet', {
        get: function () {
            return this._ss.getTabValue(this._tab, "fiFuriganaAlphabet");
        },
        set: function (value) {
            this._ss.setTabValue(this._tab, "fiFuriganaAlphabet", value);
        }
    });

    BrowserData.prototype.toString = function () {
        return JSON.stringify(this);
    };

    function onTabSelect(event) {
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
            data.alphabet = getPrefs().getPref("furigana_alphabet");
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

    function onLoad(event) {
        let prefs = getPrefs();
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
        onChangePopupStyle();
        let panel = document.getElementById("furigana-inserter-popup");
        panel.addEventListener("DOMMouseScroll", onDOMMouseScroll, false);
        onChangeKeys();
    }

    function onDOMMouseScroll(event) {
        let iframe = document.getElementById("furigana-inserter-iframe");
        let contentViewer = iframe.docShell.contentViewer;
        let docViewer = contentViewer.QueryInterface(Ci.nsIMarkupDocumentViewer);
        if (event.axis === MouseScrollEvent.VERTICAL_AXIS && event.ctrlKey) {
            docViewer.fullZoom += event.detail < 0 ? 0.1 : -0.1;
            event.preventDefault();
            event.stopPropagation();
        }
    }

    function addClipboardMonitor(tab, monitor) {
        for (let i = 0; i < clipboardMonitors.length; ++i) {
            if (clipboardMonitors[i].tab === tab) {
                clipboardMonitors[i].monitor = monitor;
                return;
            }
        }
        clipboardMonitors.push({
            tab: tab,
            monitor: monitor
        });
    }

    function getClipboardMonitor(tab) {
        for (let i = 0; i < clipboardMonitors.length; ++i) {
            if (clipboardMonitors[i].tab === tab) {
                return clipboardMonitors[i].monitor;
            }
        }
        return null;
    }

    function onUnload(event) {
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

    function onMouseDown(event) {
        if (event.button === 0) {
            mouseDown = true;
        }
    }

    function onMouseUp(event) {
        if (event.button === 0) {
            mouseDown = false;
        }
    }

    function onMouseMove(event) {
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
        getPopup().show(ev);
    }

    function onKeyDown(event) {
        let popup = getPopup();
        if ((event.keyCode === KeyEvent.DOM_VK_SHIFT ||
            event.keyCode === KeyEvent.DOM_VK_RETURN) && popup.isVisible()) {
            popup.showNext();
        }
    }

    function onTabClose(event) {
//        console.log("onTabClose");
        let tab = gBrowser.selectedTab;
        let data = new BrowserData(tab);
        if (data.isClipboardMonitoringEnabled) {
            getClipboardMonitor(tab).cancel();
        }
        data.isClipboardMonitoringEnabled = false;
        data.isPopupEnabled = false;
    }

    function onDOMContentLoaded(event) {
//        console.log("onDOMContentLoaded");
        let tab = gBrowser.selectedTab;
        initTab(tab);
        let data = new BrowserData(tab);
        let alphabet = data.alphabet;
        let inserter = createInserter(alphabet);
        let doc = event.originalTarget;
        if (!(doc instanceof HTMLDocument)) {
            return;
        }
        if (getPrefs().getPref("auto_process_all_pages")) {
            inserter.doElementAsync(doc.body);
        }
    }

    function onTogglePopup(event) {
        let tab = gBrowser.selectedTab;
        let data = new BrowserData(tab);
        if (data.isPopupEnabled) {
            disablePopup(tab);
        } else {
            enablePopup(tab);
        }
    }

    function enablePopup(tab) {
        let browser = gBrowser.getBrowserForTab(tab);
        browser.addEventListener("mousemove", onMouseMove, false);
        browser.addEventListener("keydown", onKeyDown, false);
        let data = new BrowserData(tab);
        data.isPopupEnabled = true;
        document.getElementById("fi-auto-lookup-command").setAttribute(
                "checked", "true");
    }

    function disablePopup(tab) {
        let browser = gBrowser.getBrowserForTab(tab);
        browser.removeEventListener("mousemove", onMouseMove, false);
        browser.removeEventListener("keydown", onKeyDown, false);
        let data = new BrowserData(tab);
        data.isPopupEnabled = false;
        document.getElementById("fi-auto-lookup-command").setAttribute(
                "checked", "false");
    }

    function onToggleClipboardMonitoring(event) {
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

    function registerPreferencesObserver() {
        let observer = new PreferencesObserver(function (event) {
            if (event.data === "color_scheme") {
                onChangePopupStyle();
            } else if (event.data === "lookup_key") {
                onChangeKeys();
            }
        });
        getPrefs().register(observer);
    }

    function onChangePopupStyle() {
        let css = getPrefs().getPref("color_scheme");
        let uri = css.indexOf("/") >= 0 ? css
                : 'chrome://furiganainserter/skin/popup-' + css + '.css';
        let iframe = document.getElementById("furigana-inserter-iframe");
        let link = iframe.contentDocument.getElementById("rikaichan-css");
        link.href = uri;
    }

    function onChangeKeys() {
        let pref = getPrefs().getPref("lookup_key");
        let keyCodes = pref.split("+");
        let keyCode = keyCodes.pop();
        let modifiers = keyCodes.join(" ");
        let keyElement = document.getElementById("fi-lookup-word-key");
        keyElement.setAttribute("modifiers", modifiers);
        keyElement.setAttribute("keycode", keyCode);
        // remove the keyset and add it again
        let keySet = keyElement.parentNode;
        let keySetParent = keySet.parentNode;
        keySetParent.removeChild(keySet);
        keySetParent.appendChild(keySet);
    }

    let getPopup = (function () {
        let popup = null;
        return function () {
            if (popup === null) {
                let deinflector = getDeinflector();
                let dictionaries = JSON.parse(getPrefs().getPref("dictionaries"));
                let dictionarySearcher = new DictionarySearcher(deinflector, dictionaries);
                popup = createPopup(dictionarySearcher);
            }
            return popup;
        }
    })();

    function createPopup(dictionarySearcher) {
        let panel = document.getElementById("furigana-inserter-popup");
        let popup = new Popup(panel, dictionarySearcher);
        panel.addEventListener("mouseover", function (event) {
            window.clearTimeout(popup.timer);
        }, false);
        return popup;
    }

    function onCopyWithoutFurigana(event) {
        copyTextToClipboard(getTextWithoutFurigana(), event.view);
    }

    function onRemoveFurigana(event) {
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

    function onInsertFurigana(event) {
        let tab = gBrowser.selectedTab;
        let data = new BrowserData(tab);
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

    function onOpenOptionsWindow(event) {
        window.openDialog("chrome://furiganainserter/content/options.xul", "",
                "centerscreen,modal");
    }

    function onPopupShowing(event) {
        let menuItem = document.getElementById("fi-copy-without-furigana-cm");
        menuItem.hidden = !gContextMenu.isTextSelected;
    }

    function onOpenUserDictionary(event) {
        window.openDialog("chrome://furiganainserter/content/userdict.xul", "",
                "resizable");
    }

    function onSwitchAlphabet(event) {
        let tab = gBrowser.selectedTab;
        let id = event.target.id;
        let alphabet = id.substring(3, id.length - 4);
        let data = new BrowserData(tab);
        data.alphabet = alphabet;
        ["katakana", "hiragana", "romaji"].forEach(function (alphabet) {
            document.getElementById("fi-" + alphabet + "-cmd").setAttribute(
                    "checked", false);
        });
        document.getElementById("fi-" + alphabet + "-cmd").setAttribute(
                "checked", true);
    }

    function appendTextAsync(text, tab) {
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
        let data = new BrowserData(tab);
        let alphabet = data.alphabet;
        let inserter = createInserter(alphabet);
        return Task.spawn(function* () {
            yield inserter.doElementAsync(p);
            win.scrollTo(0, win.scrollMaxY);
        });
    }

    function getSelectedRange(win) {
        let selection = win.getSelection();
        if (selection.isCollapsed || selection.rangeCount === 0) {
            return null;
        } else {
            let range = selection.getRangeAt(0);
            selection.removeRange(range);
            return range;
        }
    }

    function getFocusedWindow() {
        if (content.document.activeElement instanceof HTMLFrameElement) {
            return content.document.activeElement.contentWindow;
        } else {
            return content;
        }
    }

    function getTextWithoutFurigana() {
        let win = getFocusedWindow();
        let selection = win.getSelection();
        if (selection.rangeCount === 0 || selection.isCollapsed) {
            return "";
        }
        let range = selection.getRangeAt(0);
        let text = "";
        for (let textNode of getTextNodesFromRange(range)) {
            if (isTextNotInRt(textNode.node)) {
                text += textNode.getText();
            }
        }
        return text;
    }

    function isTextNotInRt(node) {
        let expr = "self::text() and not(parent::rp) and not(ancestor::rt)";
        if (node.data === "") {
            return false;
        } else {
            return node.ownerDocument.evaluate(expr, node, null,
            XPathResult.BOOLEAN_TYPE, null).booleanValue;
        }
    }

    function showPopup(word) {
        if (word === "") {
            return;
        }
        let popup = getPopup();
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

    function onToolbarKeyDown(event) {
        let textbox = document.getElementById("fi-toolbar-textbox");
        let win = document.getElementById("furigana-inserter-iframe").contentWindow;
        let windowUtils = win.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIDOMWindowUtils);
        let popup = getPopup();
        if (event.keyCode === KeyEvent.DOM_VK_RETURN) {
            showPopup(textbox.value);
            textbox.focus();
        } else if (event.keyCode === KeyEvent.DOM_VK_ESCAPE) {
            if (popup.isVisible()) {
                popup.hide();
            } else {
                event.currentTarget.hidden = true;
            }
        } else if (!popup.isVisible()) {
            return;
        } else if (event.keyCode === KeyEvent.DOM_VK_PAGE_DOWN) {
            windowUtils.sendWheelEvent(0, 0, //X, Y
            0, 1, 0, // deltaX, deltaY, deltaZ
            WheelEvent.DOM_DELTA_PAGE, // deltaMode
            0, // modifiers
            0, 0, // lineOrPageDeltaX, lineOrPageDeltaY
            Ci.nsIDOMWindowUtils.WHEEL_EVENT_CUSTOMIZED_BY_USER_PREFS); // options
        } else if (event.keyCode === KeyEvent.DOM_VK_PAGE_UP) {
            windowUtils.sendWheelEvent(0, 0, //X, Y
            0, -1, 0, // deltaX, deltaY, deltaZ
            WheelEvent.DOM_DELTA_PAGE, // deltaMode
            0, // modifiers
            0, 0, // lineOrPageDeltaX, lineOrPageDeltaY
            Ci.nsIDOMWindowUtils.WHEEL_EVENT_CUSTOMIZED_BY_USER_PREFS); // options
        } else if (event.keyCode === KeyEvent.DOM_VK_DOWN) {
            windowUtils.sendWheelEvent(0, 0, //X, Y
            0, 1, 0, // deltaX, deltaY, deltaZ
            WheelEvent.DOM_DELTA_LINE, // deltaMode
            0, // modifiers
            0, 0, // lineOrPageDeltaX, lineOrPageDeltaY
            Ci.nsIDOMWindowUtils.WHEEL_EVENT_CUSTOMIZED_BY_USER_PREFS); // options
            event.preventDefault();
        } else if (event.keyCode === KeyEvent.DOM_VK_UP) {
            windowUtils.sendWheelEvent(0, 0, //X, Y
            0, -1, 0, // deltaX, deltaY, deltaZ
            WheelEvent.DOM_DELTA_LINE, // deltaMode
            0, // modifiers
            0, 0, // lineOrPageDeltaX, lineOrPageDeltaY
            Ci.nsIDOMWindowUtils.WHEEL_EVENT_CUSTOMIZED_BY_USER_PREFS); // options
            event.preventDefault();
        }
    }

    function onToolbarSearch(event) {
        let textbox = document.getElementById("fi-toolbar-textbox");
        showPopup(textbox.value);
        textbox.focus();
    }

    function onToolbarClose(event) {
        let textbox = document.getElementById("fi-toolbar-textbox");
        textbox.reset();
        document.getElementById('fi-toolbar').hidden = true;
    }

    function onLookupWord(event) {
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

    function installButton(toolbarId, id, afterId) {
        if (document.getElementById(id)) {
            return;
        }
        let toolbar = document.getElementById(toolbarId);
        // If no afterId is given, then append the item to the toolbar
        let before = null;
        if (afterId) {
            let elem = document.getElementById(afterId);
            if (elem && elem.parentNode === toolbar) {
                before = elem.nextElementSibling;
            }
        }
        toolbar.insertItem(id, before);
        toolbar.setAttribute("currentset", toolbar.currentSet);
        document.persist(toolbar.id, "currentset");
    }

    FuriganaInserter.onOpenOptionsWindow = onOpenOptionsWindow;
    FuriganaInserter.onTogglePopup = onTogglePopup;
    FuriganaInserter.onToggleClipboardMonitoring = onToggleClipboardMonitoring;
    FuriganaInserter.onOpenUserDictionary = onOpenUserDictionary;
    FuriganaInserter.onSwitchAlphabet = onSwitchAlphabet;
    FuriganaInserter.onOpenOptionsWindow = onOpenOptionsWindow;
    FuriganaInserter.onInsertFurigana = onInsertFurigana;
    FuriganaInserter.onRemoveFurigana = onRemoveFurigana;
    FuriganaInserter.onCopyWithoutFurigana = onCopyWithoutFurigana;
    FuriganaInserter.onLookupWord = onLookupWord;
    FuriganaInserter.onToolbarKeyDown = onToolbarKeyDown;
    FuriganaInserter.onToolbarClose = onToolbarClose;
    FuriganaInserter.onToolbarSearch = onToolbarSearch;

    window.addEventListener("load", onLoad, false);
    window.addEventListener("unload", onUnload, false);

})();
