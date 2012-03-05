"use strict";

var FuriganaInserter = {};

(function () {
    var Utilities = {}
    Components.utils["import"]("resource://furiganainserter/utilities.js", Utilities)
    var escapeHTML = Utilities.escapeHTML
    var log = Utilities.log
    var time = Utilities.time
    var getNodesByXPath = Utilities.getNodesByXPath
    var splitTextNode = Utilities.splitTextNode
    var katakanaToHiragana = Utilities.katakanaToHiragana
    var hiraganaToKatakana = Utilities.hiraganaToKatakana
    var katakanaToRomaji = Utilities.katakanaToRomaji
    var Preferences = Utilities.Preferences
    var PreferencesObserver = Utilities.PreferencesObserver
    var Clipboard = Utilities.Clipboard
    var RangeNodeIterator = Utilities.RangeNodeIterator
    var MyMecabWorker = Utilities.getMecabWorker(document)

    var kPat = "\u3005\u3400-\u9FCF" //"\u3005" is "々" - CJK iteration mark
    var hPat = "\u3041-\u3096" //Hiragana
    var katPat = "\u30A1-\u30FA" //Katakana
    var kRegex = new RegExp("[" + kPat + "]")
    var katRegex = new RegExp("[" + katPat + "]")
    var hRegex = new RegExp("[" + hPat + "]")
    var hkRegex = new RegExp("^([" + hPat + "]*)([" + kPat + "]+)")
    var khRegex = new RegExp("^([" + kPat + "]+)([" + hPat + "]*)")
    var jRegex = new RegExp('[' + kPat + hPat + katPat + ']')
    var popup = null
    var prefs = null
    var dict = null
    var mouseDown = false
    var filterFunction = null
    var heisigTable = null

    function getBrowserData () {
        return gBrowser.selectedBrowser.furiganaInserter
    }

    function BrowserData() {
        this.rangeParent = null
        this.rangeOffset = 0
        this.target = null
        this.clipboard = null
        this.popupEnabled = false
        this.inserter = null
    }

    var Main = {
        onTabSelect: function (event) {
            var data
            var browser = gBrowser.selectedBrowser
            if (!browser.hasOwnProperty("furiganaInserter")) {
                data = new BrowserData()
                data.inserter = Main.createInserter()
                browser.furiganaInserter = data

            }
            else data = getBrowserData()

            document.getElementById("fi-auto-lookup-command").setAttribute("checked",
                data.popupEnabled)
            document.getElementById("fi-monitor-clipboard-command").setAttribute("checked",
                data.clipboard &&
                data.clipboard.isEnabled());

            ["keywords", "katakana", "hiragana", "romaji"].forEach(function(alphabet) {
                document.getElementById("fi-" + alphabet + "-cmd").setAttribute("checked", false)
            });
            var alphabet = data.inserter.alphabet
            document.getElementById("fi-" + alphabet + "-cmd").setAttribute("checked", true)
        },

        onload: function () {
            prefs = new Preferences("extensions.furiganainserter.")

            this.onTabSelect()
            gBrowser.tabContainer.addEventListener("TabSelect", this.onTabSelect, false)
            gBrowser.tabContainer.addEventListener("TabClose", this.onTabClose, false)

            // The 'load' event doesn't bubble, so it only works with a capturing event listener.
            // The 'DOMContentLoaded' event bubbles, so it also works with a non-capturing listener.
            gBrowser.addEventListener("DOMContentLoaded", this.onPageLoad, true)
            // If Rikaichan is available replace its method for copying text with one
            // that ignores ruby elements.
            if (window.rcxMain && rcxMain.initDictionary) {
                rcxMain.getSelected = function (win) {
                    var inserter = gBrowser.selectedBrowser.furiganaInserter.inserter
                    return inserter.getTextWithoutFurigana(win)
                }
                dict = new DictV2()
            }

            window.addEventListener("mousedown", this.onMouseDown, false)
            window.addEventListener("mouseup", this.onMouseUp, false)

            document.getElementById("contentAreaContextMenu").
                addEventListener("popupshowing", this.showContextMenu, false)

            this.register()
            popup = this.createPopup()
            this.changePopupStyle()
            this.loadFilter()
            this.loadKeywords()
        },

        onunload: function () {
            var browsers = gBrowser.browsers
            var len = browsers.length
            var i, browser, data
            for (i = 0; i < len; ++i) {
                browser = browsers[i]
                data = browser.furiganaInserter
                if (data.clipboard && data.clipboard.isEnabled())
                    data.clipboard.stopMonitoring()
            }
        },

        onMouseDown: function (event) {
            if (event.button === 0)
                mouseDown = true
        },

        onMouseUp: function (event) {
            if (event.button === 0)
                mouseDown = false
        },

        togglePopup: function () {
            var data = getBrowserData()
            if (!data.popupEnabled) {
                if (!dict) return
                try {
                    dict.init()
                    this.enablePopup(gBrowser.selectedBrowser)
                }
                catch (e) {}
            }
            else this.disablePopup(gBrowser.selectedBrowser)
        },

        onMouseMove: function (event) {
            if (mouseDown) return
            var ev = {
                rangeParent: event.rangeParent,
                rangeOffset: event.rangeOffset,
                clientX: event.clientX,
                clientY: event.clientY,
                pageX: event.pageX,
                pageY: event.pageY,
                target: event.target,
                currentTarget: event.currentTarget,
                view: event.view,
                detail: event.detail,
                screenX: event.screenX,
                screenY: event.screenY,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
                button: event.button,
                relatedTarget: event.relatedTarget
            }
            popup.show(ev)
        },

        enablePopup: function (browser) {
            browser.addEventListener("mousemove", this.onMouseMove, false)
            browser.addEventListener("keydown", this.onKeyDown, false)
            browser.furiganaInserter.popupEnabled = true
            document.getElementById("fi-auto-lookup-command").setAttribute("checked", "true")
        },

        disablePopup: function (browser) {
            browser.removeEventListener("mousemove", this.onMouseMove, false)
            browser.removeEventListener("keydown", this.onKeyDown, false)
            browser.furiganaInserter.popupEnabled = false
            document.getElementById("fi-auto-lookup-command").setAttribute("checked", "false")
        },

        onKeyDown: function (event) {
            if ((event.keyCode === KeyEvent["DOM_VK_SHIFT"] ||
                event.keyCode === KeyEvent["DOM_VK_RETURN"]) &&
                popup.isVisible()) {
                popup.showNext()
            }
        },

        monitorClipboard: function () {
            var data = getBrowserData()
            if (!data.clipboard) data.clipboard = new Clipboard()
            var clipboard = data.clipboard
            var browser = gBrowser.selectedBrowser

            if (!clipboard.isEnabled())
                clipboard.startMonitoring(function (text) {
                    Main.appendText(text, browser)
                }, 150);
            else clipboard.stopMonitoring();
            document.getElementById("fi-monitor-clipboard-command").
            setAttribute("checked", clipboard.isEnabled())
        },

        onTabClose: function () {
            var data = getBrowserData()
            if (data.clipboard && data.clipboard.isEnabled())
                data.clipboard.stopMonitoring()
        },

        createInserter: function (aAlphabet) {
            var inserter = null
            var alphabet = aAlphabet || prefs.getPref("furigana_alphabet")
            var tokenize = prefs.getPref("tokenize")

            if (alphabet === "hiragana")
                inserter = tokenize ? new HiraganaComplex() : new HiraganaSimple()
            else if (alphabet === "katakana")
                inserter = tokenize ? new KatakanaComplex() : new KatakanaSimple()
            else if (alphabet === "romaji")
                inserter = tokenize ? new RomajiComplex() : new RomajiSimple()
            else
                inserter = new Keywords()
            inserter.browser = gBrowser.selectedBrowser
            inserter.alphabet = alphabet
            inserter.worker = MyMecabWorker
            return inserter
        },

        register: function () {
            var observer = new PreferencesObserver (function (event) {
               if (event.data === "use_token")
                    popup = Main.createPopup()
                else if (event.data === "color_scheme")
                    Main.changePopupStyle()
            })

            prefs.register(observer)
        },

        changePopupStyle: function () {
            var css = prefs.getPref("color_scheme")
            var uri = css.indexOf("/") >= 0 ? css : 'chrome://furiganainserter/skin/popup-' + css + '.css'
            var iframe = document.getElementById("furigana-inserter-iframe")
            var link = iframe.contentDocument.getElementById("rikaichan-css")
            link.href = uri
        },

        onPageLoad: function (event) {
            var data = getBrowserData()
            var inserter = data.inserter
            var doc = event.originalTarget
            if (!(doc instanceof HTMLDocument))
                return
            if (prefs.getPref("auto_process_all_pages"))
                inserter.doElement(doc.body)
        },

        createPopup: function () {
            var popup = prefs.getPref("use_token") ? new PopupComplex()
            : new PopupSimple()
            popup.popup.addEventListener("mouseover", function (event) {
                if (popup.timer) {
                    window.clearTimeout(popup.timer)
                    popup.timer = null
                }
            }, false)
            return popup
        },

        copyWithoutFurigana: function (event) {
            var data = getBrowserData()
            var inserter = data.inserter
            inserter.copyWithoutFurigana()
        },

        revertRubys: function () {
            var data = getBrowserData()
            var inserter = data.inserter
            time(function () {
                var doc = content.document
                var range = Main.getSelectedRange()
                if (range)
                    inserter.revertRange(range)
                else inserter.revertElement(doc.body)
            })
        },

        insertRubys: function (event) {
            var data = getBrowserData()
            var inserter = data.inserter

            time(function () {
                var doc = gBrowser.contentDocument
                var range = Main.getSelectedRange()
                if (range) inserter.doRange(range)
                else inserter.doElement(doc.body)
            })
        },

        getSelectedRange: function () {
            var win = content.window
            var selection = win.getSelection()
            if (selection.isCollapsed || selection.rangeCount === 0)
                return null
            else {
                var range = selection.getRangeAt(0)
                selection.removeRange(range)
                return range
            }
        },

        openOptionsWindow: function () {
            window.openDialog("chrome://furiganainserter/content/options.xul",
            "", "centerscreen,modal");
        },

        showContextMenu: function () {
            var menuItem = document.getElementById("fi-copy-without-furigana-cm")
            menuItem.hidden = !gContextMenu.isTextSelected
        },

        openUserDictionary: function () {
            window.openDialog("chrome://furiganainserter/content/userdict.xul",
                "", "resizable")
        },

        openSubstitutions: function () {
            var arg = {filterFunction: null}
            window.openDialog("chrome://furiganainserter/content/subst.xul",
                "", "modal,centerscreen", arg)
            filterFunction = arg.filterFunction
        },

        openKeywords: function () {
            var arg = {heisigTable: null}
            window.openDialog("chrome://furiganainserter/content/keywords.xul",
                "", "modal,centerscreen", arg)
            if (arg.heisigTable)
                heisigTable = arg.heisigTable
        },

        appendText: function (text, browser) {
            if (!jRegex.test(text)) return
            var win = browser.contentWindow
            var doc = win.document
            text = escapeHTML(text)
            if (filterFunction)
                text = filterFunction(text)

            var p = doc.createElement("p");
            var lines = text.split(/\r\n|\n/)
            p.innerHTML = lines.join("<br>");

            doc.body.appendChild(p);
            browser.furiganaInserter.inserter.doElement(p, function () {
                    win.scrollTo(0, win.scrollMaxY);
            })
        },

        loadKeywords: function () {
            if (heisigTable) return

            if (!heisigTable) {
                var file = Utilities.getKeywordsFile()
                if (!file.exists()) return
                var text = Utilities.read(file, "UTF-8")
                heisigTable = Utilities.getKeywordsObject(text)
            }
        },

        switchAlphabet: function (alphabet) {
            var data = getBrowserData()
            data.inserter = Main.createInserter(alphabet);
            ["keywords", "katakana", "hiragana", "romaji"].forEach(function(alphabet) {
                document.getElementById("fi-" + alphabet + "-cmd").setAttribute("checked", false)
            });
            document.getElementById("fi-" + alphabet + "-cmd").setAttribute("checked", true)
        },

        loadFilter: function () {
            var obj = Utilities.getFilterArray()
            filterFunction = Utilities.getFilterFunction(obj)
        },

    }

    function ReadingObject () {
        this.reading = ""
        this.word = ""
        this.start = 0
        this.basicForm = ""
        this.isName = false
        this.children = []
    }

    /**
     * <pre>
     * Hiragana:        Simple <- HiraganaSimple
     * Katakana:        Simple <- KatakanaSimple
     * Romaji:          Simple <- RomajiSimple
     * HiraganaComplex: Simple <- Complex <- HiraganaComplex
     * KatakanaComplex: Simple <- Complex <- KatakanaComplex
     * RomajiComplex:   Simple <- Complex <- RomajiComplex
     * </pre>
     */
    function Simple () {
//        this.browser = null
//        this.alphabet = null
//        this.worker = null
    }

    Simple.prototype = {
        getReadingObjects: function (nodes) {

            var that = this
            var readingObjects = [];
            var start = 0;

            nodes.forEach(function (node) {
                var obj = that.featureToReadingObject(node.feature);
                //skip nodes without reading
                if (obj.reading === "") {
                    start += node.length + node.surface.length;
                    return;
                }
                //skip whitespace
                start += node.length;
                obj.word = node.surface
                obj.start = start
                var children = []
                that.parseReadingObject(obj, children);
                if (obj.isName)
                    children.forEach(function (child) {
                        child.isName = true
                    })
                obj.children = children
                readingObjects.push(obj)
                //move to the end of the surface
                start += node.surface.length;
            })

            return readingObjects;
        },

        // Juman:  (現在) (名詞,時相名詞,*,*,現在,げんざい,代表表記:現在)
        // IPADic: (現在) (名詞,副詞可能,*,*,*,*,現在,ゲンザイ,ゲンザイ)
        featureToReadingObject: function (feature) {
            var obj = new ReadingObject()
            var fields = feature.split(",")
            if (fields.length > 7 &&
                (katRegex.test(fields[7])) &&
                ! /[\uFF01-\uFF5E]/.test(fields[6])) // not an ASCII char
            {
                obj.reading = katakanaToHiragana(fields[7])
                obj.basicForm = fields[6]
                obj.isName = (fields[2] === "人名")
            }
            else if (fields.length === 7 && hRegex.test(fields[5])) {
                obj.reading = fields[5]
                obj.basicForm = fields[4]
                obj.isName = (fields[2] === "人名")
            }
            return obj
        },

        parseReadingObject: function (readingObject, result) {
            this.parseWord(readingObject.word, readingObject.reading,
                readingObject.start, result)
        },

        /**
         * PEG grammar<br>
         * Word          := !Kanji | Hiragana? KanjiHiragana

         * KanjiHiragana := Kanji !Hiragana | Kanji Word
         * Kanji         := [\u3005\u3400-\u9FCF]+
         * Hiragana      := [\u3040-\u309F]+
         */
        parseWord: function (word, reading, start, result) {
            var match = word.match(hkRegex);
            // !Kanji
            if (!match) return
            var hiragana = match[1]
            // Hiragana KanjiHiragana
            if (hiragana === "")
                this.parseKanjiHiragana(word, reading, start, result);
            // KanjiHiragana
            else
                this.parseKanjiHiragana(word.substring(hiragana.length),
                    reading.substring(hiragana.length),
                    start + hiragana.length,
                    result);
        },

        parseKanjiHiragana: function (word, reading, start, result) {
            var match = word.match(khRegex);
            var kanji = match[1]
            var hiragana = match[2]
            // Kanji !Hiragana
            if (hiragana === "")
                result.push( {word: word, reading: reading, start: start} )
            // Kanji Word
            else {
                var i = reading.indexOf(hiragana, 1);
                result.push( {word: kanji, reading: reading.substring(0, i), start: start} )
                this.parseWord(word.substring(match[0].length),
                    reading.substring(i + hiragana.length),
                    start + match[0].length,
                    result);
            }
        },
        
        testNode: function (node) {
            var expr = "self::text() and not(ancestor::ruby)"
            var doc = node.ownerDocument
            if (node.nodeType === Node.TEXT_NODE && node.data === "")
                return false
            return doc.evaluate(expr, node, null, XPathResult.BOOLEAN_TYPE, null).
                booleanValue
        },

        doRange: function (range, k) {
            var node, start, end
            var nodes = []
            var iter = new RangeNodeIterator(range)
            while ((node = iter.nextNode())) {
                if (!this.testNode(node)) continue
                start = iter.getStartTextOffset()
                end = iter.getEndTextOffset()
                nodes.push({
                    node: node,
                    start: start,
                    end: end
                })
            }
            var that = this
            var texts = nodes.map(function (node) {
                return node.node.data.substring(node.start, node.end)
            })
            that.worker.send(function (data) {
                var taggerNodes = data.nodes
                taggerNodes.forEach(function (taggerNode, i) {
                    that.doitRight(taggerNode, nodes[i].node, nodes[i].start, nodes[i].end)
                })
                if (typeof k === "function") k()
            }, {
                request: "getNodes",
                userDicPath: Utilities.getUserDictionaryPath(),
                dicPath: Utilities.getDictionaryPath(),
                text: texts
            })
        },

        doitRight: function (nodes, node, start, end) {
            var data = node.data.substring(start, end)
            if (!jRegex.test(data)) return
            var doc = node.ownerDocument
            var readingObjects = this.getReadingObjects(nodes);
            if (readingObjects.length === 0) return
            var rubyHtml = this.createRuby(data, readingObjects);
            var div = doc.createElement("div")
            div.innerHTML = rubyHtml
            var fragment = doc.createDocumentFragment()
            while (div.firstChild)
                fragment.appendChild(div.firstChild)
            node.parentNode.replaceChild(fragment,
                splitTextNode(node, start, end));
        },

        doElement: function (elem, k) {
            var doc = elem.ownerDocument
            var range = doc.createRange()
            range.setStartBefore(elem)
            range.setEndAfter(elem)
            this.doRange(range, k)
        },

        copyWithoutFurigana: function () {
            var content = this.browser.contentWindow
            new Clipboard().setText(this.getTextWithoutFurigana(content));
        },

        getTextWithoutFurigana: function (win) {
            var selection = win.getSelection();
            var doc = win.document
            if (selection.rangeCount === 0 || selection.isCollapsed) return "";
            var range = selection.getRangeAt(0)
            var node
            var text = ""
            var iter = new RangeNodeIterator(range)
            while ((node = iter.nextNode())) {
                var start = iter.getStartTextOffset()
                var end = iter.getEndTextOffset()
                if (pred (node))
                    text += node.data.substring(start, end)
            }
            return text

            function pred (node) {
                var expr = "self::text() and not(parent::rp) and not(ancestor::rt)"
                if (node.nodeType === Node.TEXT_NODE && node.data === "")
                    return false
                return doc.evaluate(expr, node, null, XPathResult.BOOLEAN_TYPE,
                    null).booleanValue
            }
        },

        revertElement: function  (elem) {
            var expr = ".//ruby"
            var rubys = getNodesByXPath(elem, expr)
            this._revertRubys(rubys)
        },

        revertRange: function (range) {
            var rubys = []
            var iter = new RangeNodeIterator(range)
            var node
            while ((node = iter.nextNode()))
                if (node.nodeName === "RUBY") rubys.push(node)
            this._revertRubys(rubys)
        },

        _revertRubys: function (rubys) {
            var content = this.browser.contentWindow
            var doc = content.document
            //document fragment to hold ruby/rb/* nodes
            var fragment = doc.createDocumentFragment();
            var rbExpr = "rb/*|rb/text()"

            rubys.forEach(function (ruby) {
                var nodes = getNodesByXPath(ruby, rbExpr)
                nodes.forEach(function (node) {
                    fragment.appendChild(node);
                });
                var parentNode = ruby.parentNode;
                parentNode.replaceChild(fragment, ruby);
                parentNode.normalize();
            });
        },

        findNonRubyTextNodes: function (elem) {
            return getNodesByXPath(elem, ".//text()[not(ancestor::ruby)]");
        },

        createRuby: function (data, readingObjects) {
            var pos = 0;
            var textWithRuby = [];
            var that = this
            readingObjects.forEach(function (obj) {
                obj.children.forEach(function (child) {
                    textWithRuby.push(escapeHTML(data.substring(pos, child.start)));
                    textWithRuby.push(that.createRubyHtml(child));
                    pos = child.start + child.word.length;
                });
            });
            textWithRuby.push(escapeHTML(data.substring(pos, data.length)));
            return textWithRuby.join("");
        },

        createRubyHtml: function (readingObject) {
            var margin = prefs.getPref("margin")
            return "".concat("<ruby class='fi' style='margin-left:", margin, "em; margin-right:", margin, "em'><rb>", readingObject.word,
            "</rb><rp>(</rp><rt>", readingObject.reading, "</rt><rp>)</rp></ruby>");
        }
    }

    var HiraganaSimple = Simple

    function RomajiSimple () {}

    RomajiSimple.prototype = new Simple()

    RomajiSimple.prototype.parseReadingObject = function (readingObject, result) {
        readingObject.reading = katakanaToRomaji(hiraganaToKatakana(readingObject.reading), FuriganaInserter.hepburnTable)
        result.push(readingObject)
    }

    function KatakanaSimple () {}

    KatakanaSimple.prototype = new Simple()

    KatakanaSimple.prototype.createRubyHtml = function (readingObject) {
        var margin = prefs.getPref("margin")
        return "".concat("<ruby class='fi' style='margin-left:", margin, "em; margin-right:", margin, "em'><rb>", readingObject.word,
        "</rb><rp>(</rp><rt>", hiraganaToKatakana(readingObject.reading),
        "</rt><rp>)</rp></ruby>");
    }

    function Complex () {}

    Complex.prototype = new Simple()

    Complex.prototype.revertElement = function (elem) {
        var expr = ".//span[@class='fi']"
        var nodes = getNodesByXPath(elem, expr)

        this._revertSpans(nodes)
        Simple.prototype.revertElement.call(this, elem)
    }

    Complex.prototype.revertRange = function (range) {
        var nodes = []
        var node
        var iter = new RangeNodeIterator(range)
        while ((node = iter.nextNode()))
            if (node.nodeName === 'SPAN' && node.getAttribute("class") === 'fi')
                nodes.push(node)

        this._revertSpans(nodes)
        Simple.prototype.revertRange.call(this, range)
    }

    Complex.prototype._revertSpans = function (nodes) {
        var content = this.browser.contentWindow
        var doc = content.document
        var range = doc.createRange()
        nodes.forEach(function (span) {
            range.selectNodeContents(span)
            //document fragment to hold span/* nodes
            var fragment = range.extractContents()
            var parentNode = span.parentNode;
            parentNode.replaceChild(fragment, span);
            parentNode.normalize();
        });
    },

    Complex.prototype.createRuby = function (data, readingObjects) {
        var margin = prefs.getPref("margin");
        var tag = "<span class='fi'".concat("style='margin-left:", margin, "em; margin-right:", margin, "em' bf='");
        var pos = 0;
        var textWithRuby = [];
        var that = this;
        readingObjects.forEach(function (obj) {
            // push everything before start
            textWithRuby.push(escapeHTML(data.substring(pos, obj.start)));
            // go to start
            pos = obj.start;
            var spanText = ["".concat(tag, obj.basicForm, "'>")];
            var end = pos + obj.word.length;
            // push all children
            obj.children.forEach(function (child) {
                spanText.push(escapeHTML(data.substring(pos, child.start)));
                spanText.push(that.createRubyHtml(child));
                pos = child.start + child.word.length;
            });
            spanText.push(escapeHTML(data.substring(pos, end)));
            pos = end;
            spanText.push("</span>");
            textWithRuby.push(spanText.join(""))
        });
        // push rest
        textWithRuby.push(escapeHTML(data.substring(pos, data.length)));
        return textWithRuby.join("");
    }

    function HiraganaComplex () {}

    HiraganaComplex.prototype = new Complex()

    HiraganaComplex.prototype.createRubyHtml = function (readingObject) {
        return "".concat("<ruby class='fi'><rb>", readingObject.word,
            "</rb><rp>(</rp><rt>", readingObject.reading, "</rt><rp>)</rp></ruby>");
    }

    function KatakanaComplex () {}

    KatakanaComplex.prototype = new Complex()

    KatakanaComplex.prototype.createRubyHtml = function (readingObject) {
        return "".concat("<ruby class='fi'><rb>", readingObject.word,
        "</rb><rp>(</rp><rt>", hiraganaToKatakana(readingObject.reading),
        "</rt><rp>)</rp></ruby>");
    }

    function RomajiComplex () {}

    RomajiComplex.prototype = new Complex()

    RomajiComplex.prototype.parseReadingObject = function (readingObject, result) {
        readingObject.reading = katakanaToRomaji(hiraganaToKatakana(readingObject.reading), FuriganaInserter.hepburnTable)
    }

    RomajiComplex.prototype.createRuby = function (data, readingObjects) {
        var pos = 0;
        var textWithRuby = [];
        var that = this
        readingObjects.forEach(function (readingObject) {
            textWithRuby.push(escapeHTML(data.substring(pos, readingObject.start)));
            textWithRuby.push(that.createRubyHtml(readingObject));
            pos = readingObject.start + readingObject.word.length;
        });
        textWithRuby.push(escapeHTML(data.substring(pos, data.length)));
        return textWithRuby.join("");
    }

    RomajiComplex.prototype.createRubyHtml = function (readingObject) {
        var data = getBrowserData()
        var margin = prefs.getPref("margin")
        var word = readingObject.word
        return "".concat("<ruby class='fi' style='margin-left:", margin,
        "em; margin-right:", margin, "em' bf='", readingObject.basicForm, "'><rb>",
        word, "</rb><rp>(</rp><rt>", readingObject.reading, "</rt><rp>)</rp></ruby>");
    }

    function Keywords () {}

    Keywords.prototype = new Complex()

    Keywords.prototype.createRubyHtml = function (readingObject) {
        var rt = ""
        if (readingObject.isName)
            rt = readingObject.reading
        else
            rt = this.toKeywords(readingObject.word, heisigTable)

        return "".concat("<ruby class='fi'><rb>", readingObject.word,
        "</rb><rp>(</rp><rt lang='en' title='", readingObject.reading, "'>", rt,
         "</rt><rp>)</rp></ruby>");
    }

    Keywords.prototype.toKeywords = function (word, table) {
        var res = []
        var chars = word.split("")
        chars.forEach(function (c) {
            if (table.hasOwnProperty(c))
                res.push(table[c])
            else res.push("?")
        })
        return res.join(" ")
    }

//------------------------------------------------------------------------------

    function PopupSimple () {
        this.timer = null
        this.popup = document.getElementById("furigana-inserter-popup")
        this.currentDictionary = 0
        this.entries = []
        this.word = ""
        this.event = null
        this.highlight = false
        this.selData = []
    }

    PopupSimple.prototype = {
        showNext: function () {
            if (this.entries.length === 0) return

            this.currentDictionary++
            this.currentDictionary %= this.entries.length
            var entry = this.entries[this.currentDictionary]

            if (this.highlight)
                this.highlightMatch(this.event, entry.matchLen, this.selData)

            var word = this.word.substring(0, entry.matchLen)
            var text = dict.makeHtml(entry)
            text += this.kanjiSearch(word)
            if (text === "") return

            this._show3(text, this.event, false);
        },

        show: function (event) {
            if (event.shiftKey || event.ctrlKey) return
            if (!dict) return
            if (this.sameElement(event) || this.inRange(event)) return

            var that = this
            var data = gBrowser.selectedBrowser.furiganaInserter

            data.rangeParent = event.rangeParent
            data.rangeOffset = event.rangeOffset
            data.target = event.target
            if (this.timer) window.clearTimeout(this.timer)
            this.timer = window.setTimeout(function () {
                that._show1(event)
            }, prefs.getPref("popup_delay"))
        },

        cursorInPopup: function (event) {
            return false
        },

        sameElement: function (event) {
            var data = gBrowser.selectedBrowser.furiganaInserter
            return (data.rangeParent === event.rangeParent &&
                data.rangeOffset === event.rangeOffset &&
                data.target === event.target)
        },

        isInline: function (node) {
            // Rikaichan stops looking for text when it reaches an non-inline element
            var inlineNames = {
                //text node
                "#text": true,

                //fontstyle
                "TT": true,
                "I" : true,
                "B" : true,
                "BIG" : true,
                "SMALL" : true,
                //deprecated
                "STRIKE": true,
                "S": true,
                "U": true,

                //phrase
                "EM": true,
                "STRONG": true,
                "DFN": true,
                "CODE": true,
                "SAMP": true,
                "KBD": true,
                "VAR": true,
                "CITE": true,
                "ABBR": true,
                "ACRONYM": true,

                //special, not included IMG, OBJECT, BR, SCRIPT, MAP, BDO
                "A": true,
                "Q": true,
                "SUB": true,
                "SUP": true,
                "SPAN": true,

                //ruby
                "RUBY": true,
                "RBC": true,
                "RTC": true,
                "RB": true,
                "RT": true,
                "RP": true
            }

            return inlineNames.hasOwnProperty(node.nodeName)
        },

        getTextFromRange: function (rangeParent, offset, selData, maxLength) {
            var text =  ""
            var that = this
            var doc = rangeParent.ownerDocument
            var expr = "self::rp or ancestor-or-self::rt"
            var result = doc.evaluate(expr, rangeParent.parentNode, null,
            XPathResult.BOOLEAN_TYPE, null).booleanValue
            if (result) return ""

            var range = doc.createRange()
            range.setStart(rangeParent, offset)
            range.setEndAfter(doc.body.lastChild)
            if (range.collapsed) return ""

            var node
            var iter = new RangeNodeIterator(range)
            while ((node = iter.nextNode()))
                if (!that.isInline(node) || text.length >= maxLength) break
                else processNode(node)

            return text

            function processNode (node) {
                if (node.nodeType === Node.TEXT_NODE && node.data.length === 0)
                    return
                var doc = node.ownerDocument
                var expr = "self::text() and not(parent::rp) and not(ancestor::rt)"
                var result = doc.evaluate(expr, node, null, XPathResult.BOOLEAN_TYPE,
                    null).booleanValue
                if (result) {
                    var len = Math.min(node.data.length - offset, maxLength - text.length)
                    text += node.data.substr(offset, len)
                    selData.push(node)
                    offset = 0
                }
            }
        },

        inRange: function (event) {
            var win = event.view
            var selection = win.getSelection()
            if (selection.rangeCount === 0 || selection.isCollapsed) return false
            var curRange = selection.getRangeAt(0)
            if (!curRange) return false
            var newRange = win.document.createRange()
            newRange.setStart(event.rangeParent, event.rangeOffset)
            newRange.setEnd(event.rangeParent, event.rangeOffset)

            return (newRange.compareBoundaryPoints(Range.START_TO_START, curRange) >= 0 &&
                newRange.compareBoundaryPoints(Range.END_TO_END, curRange) < 0)
        },

        highlightMatch: function (event, matchLen, selData) {
            if (selData.length === 0) return
            var selEnd
            var offset = matchLen + event.rangeOffset
            // before the loop
            // |----!------------------------!!-------|
            // |(------)(---)(------)(---)(----------)|
            // offset: '!!' lies in the fifth node
            // rangeOffset: '!' lies in the first node
            // both are relative to the first node
            // after the loop
            // |---!!-------|
            // |(----------)|
            // we have found the node in which the offset lies and the offset
            // is now relative to this node
            for (var i = 0; i < selData.length; ++i) {
                selEnd = selData[i]
                if (offset <= selEnd.data.length) break
                offset -= selEnd.data.length
            }
            var win = event.view
            var doc = win.document
            var range = doc.createRange()
            range.setStart(event.rangeParent, event.rangeOffset)
            range.setEnd(selEnd, offset)
            var selection = win.getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
        },

        _show1: function (event) {
            var text = ""
            var selData = []
            if (event.rangeParent &&
                event.rangeParent.nodeType === Node.TEXT_NODE &&
                event.rangeParent.parentNode === event.target) {
                text = this.getTextFromRange(event.rangeParent,
                    event.rangeOffset, selData, 13)
            }

            this._show2(text, event, true, selData)
        },

        _show2: function (word, event, highlightMatch, selData) {
            this.word = word
            this.event = event
            this.highlight = highlightMatch
            this.selData = selData
            this.currentDictionary = 0

            this.hide(event) // hide popup
            if (word === "") return
            this.entries = dict.wordSearch(word)
            if (this.entries.length === 0) return
            var entry = this.entries[0]
            word = word.substring(0, entry.matchLen)
            var text = dict.makeHtml(entry)
            text += this.kanjiSearch(word)
            if (text === "") return

            if (highlightMatch)
                this.highlightMatch(event, entry.matchLen, selData)

            this._show3(text, event);
        },

        kanjiSearch: function (word) {
            var text = ""
            var kentry
            var c
            for (var i = 0; i < word.length; ++i) {
                c = word.charAt(i)
                if (c < "\u3400" || c > "\u9FCF") continue
                kentry = dict.kanjiSearch(c)
                if (kentry) text += dict.makeHtml(kentry)
            }
            return text
        },

        _show3: function (text, event) {
            var win = window
            var popup = this.popup

            popup.x = event.screenX
            popup.y = event.screenY

            var offset = 25
            var height = popup.boxObject.height
            var iframe = document.getElementById("furigana-inserter-iframe")
            var div = iframe.contentDocument.getElementById("furigana-inserter-window")

            div.innerHTML = text
            if ((popup.y + offset + height) > (win.screen.top + win.screen.height))
                popup.openPopupAtScreen(popup.x, popup.y - (offset + height), false)
            else popup.openPopupAtScreen(popup.x, popup.y + offset, false)
            iframe.style.width = "600px"
            iframe.style.height = "400px"
            popup.sizeTo(600,400)
        },

        hide: function (event) {
            var win = event.view
            var popup = this.popup;
            if (popup.state === "open") {
                popup.hidePopup()
                win.getSelection().removeAllRanges()
            }
        },

        isVisible: function () {
            return this.popup.state === "open"
        }
    }

    function PopupComplex () {
        this.timer = null
        this.popup = document.getElementById("furigana-inserter-popup")
        this.currentDictionary = 0
        this.entries = []
        this.word = ""
        this.event = null
        this.highlight = false
        this.selData = []
    }

    PopupComplex.prototype = new PopupSimple()

    PopupComplex.prototype.getBasicForm = function (target) {
        var doc = target.ownerDocument
        var expr = "ancestor-or-self::rt"
        var type = XPathResult.FIRST_ORDERED_NODE_TYPE
        var rt = doc.evaluate(expr, target, null, type, null).singleNodeValue
        if (rt) return ""
        expr = "ancestor-or-self::*[(self::ruby or self::span) and @bf and @class='fi']"
        var node = doc.evaluate(expr, target, null, type, null).singleNodeValue
        return node ? node.getAttribute("bf") : ""
    }

    PopupComplex.prototype.sameElement = function (event) {
        var data = gBrowser.selectedBrowser.furiganaInserter
        return (data.target === event.target)
    }

    PopupComplex.prototype.hide = function (event) {
        var popup = this.popup
        if (popup.state === "open")
            popup.hidePopup()
    }

    PopupComplex.prototype._show1 = function (event) {
        var text = ""
        text = this.getBasicForm(event.target)
        this._show2(text, event, false, [])
    }

    PopupComplex.prototype._show2 = function (word, event, highlightMatch, selData) {
        this.word = word
        this.event = event
        this.highlight = highlightMatch
        this.selData = selData
        this.currentDictionary = 0

        this.hide(event) // hide popup
        if (word === "") return

        var text = ""
        var entry = null

        this.entries = dict.wordSearch(word)
        if (this.entries.length !== 0) {
            entry = this.entries[0]
            text = dict.makeHtml(entry)
        }
        text += this.kanjiSearch(word)
        if (text === "") return

        if (highlightMatch && entry)
            this.highlightMatch(event, entry.matchLen, selData)

        this._show3(text, event);
    }

    function SearchResult () {
        this.data = []
        this.matchLen = 0
        this.more = false
        this.names = false
        this.isHtml = false
    }

    function Variant () {
        this.word = ""
        this.type = 0xFF
        this.reason = ""
    }

    /**
     * from Rikaichan
     */
    function DictV2 () {
        this.dict = null
    }

    DictV2.prototype = {
        init: function ()  {
            var res = rcxMain.initDictionary()
            if (!res) throw new Error()
            this.dict = rcxData
        },

        _wordSearch: function (word, dic) {
            if (!this.dict.ready) this.dict.init();

            var result = new SearchResult()
            result.names = dic.isName
            result.isHtml = dic.isHtml
            var have = [];
            word = katakanaToHiragana(word);

            while (word.length > 0) {
                var variants = dic.isName ? [new Variant()]
                : this.dict.deinflect.go(word);
                for (var i = 0; i < variants.length; ++i) {
                    var variant = variants[i];
                    var entries = dic.findWord(variant.word)
                    for (var j = 0; j < entries.length; ++j) {
                        var dentry = entries[j];
                        if (have[dentry]) continue;
                        // > 0 a de-inflected word
                        if (dic.hasType && this.checkType(variant.type, dentry) ||
                            !dic.hasType) {
                            have[dentry] = true;
                            if (result.matchLen == 0)
                                result.matchLen = word.length;
                            var reason = '';
                            if (variant.reason == '') reason = '';
                            else if (result.data.length == 0)
                                reason = '&lt; ' + variant.reason;
                            else
                                reason = '&lt; ' + variant.reason + ' &lt; ' + word;
                            result.data.push([dentry, reason]);
                        }
                    } // for j < entries.length
                } // for i < variants.length
                if (result.data.length > 0) return result;
                word = word.substr(0, word.length - 1);
            } // while (word.length > 0)
            if (result.data.length == 0) return null;
            return result;
        },

        wordSearch: function (word) {
            var len = this.dict.dicList.length
            var retval = []
            for (var i = 0; i < len; ++i) {
                var dic = this.dict.dicList[i]
                if (dic.isKanji) continue
                var e = this._wordSearch(word, dic)
                if (e) retval.push(e)
            }
            retval.sort(function (a, b) {
                return (b.matchLen - a.matchLen)
            })
            return retval
        },

        checkType: function (type, dentry) {
            if (type === 0xFF) return true

            // ex:
            // /(io) (v5r) to finish/to close/
            // /(v5r) to finish/to close/(P)/
            // /(aux-v,v1) to begin to/(P)/
            // /(adj-na,exp,int) thank you/many thanks/
            // /(adj-i) shrill/
            var dentryParts = dentry.split(/[,()]/);
            for (var i = Math.min(dentryParts.length - 1, 10); i >= 0; --i) {
                var dentryPart = dentryParts[i];
                if ((type & 1)  && (dentryPart === 'v1')) return true;
                if ((type & 4)  && (dentryPart === 'adj-i')) return true;
                if ((type & 2)  && (dentryPart.substr(0, 2) === 'v5')) return true;
                if ((type & 16) && (dentryPart.substr(0, 3) === 'vs-')) return true;
                if ((type & 8)  && (dentryPart === 'vk')) return true;
            }
            return false;
        },

        makeHtml: function (entry) {
            if (entry.isHtml)
                return entry.data.map(function (datum) {return datum[0]}).join("")
            return this.dict.makeHtml(entry)
        },

        kanjiSearch: function (c) {
            return this.dict.kanjiSearch(c)
        }
    }

    FuriganaInserter.Main = Main
})()

window.addEventListener("load", function (e) {
    FuriganaInserter.Main.onload(e);
}, false);

window.addEventListener("unload", function (e) {
    FuriganaInserter.Main.onunload(e);
}, false);
