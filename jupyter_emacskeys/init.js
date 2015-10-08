define([
    'base/js/namespace',
    'notebook/js/cell',
    'codemirror/lib/codemirror',
], function(IPython, Cell, CodeMirror) {
    'use strict';
    console.log('Adding emacs keybindings');

    var load_ipython_extension = function() {
        var Pos = CodeMirror.Pos,
	    killRing = [];  // Kill 'ring'

        function posEq(a, b) {
            return a.line == b.line && a.ch == b.ch;
        }

        function addToRing(str) {
            killRing.push(str);
            if (killRing.length > 50) killRing.shift();
        }

        function growRingTop(str) {
            if (!killRing.length) return addToRing(str);
            killRing[killRing.length - 1] += str;
        }

        function getFromRing(n) {
            return killRing[killRing.length - (n ? Math.min(n, 1) : 1)] || "";
        }

        function popFromRing() {
            if (killRing.length > 1) killRing.pop();
            return getFromRing();
        }

        var lastKill = null;

        function kill(cm, from, to, mayGrow, text) {
            if (text == null) text = cm.getRange(from, to);

            if (mayGrow && lastKill && lastKill.cm == cm && posEq(from, lastKill.pos) && cm.isClean(lastKill.gen))
                growRingTop(text);
            else
                addToRing(text);
            cm.replaceRange("", from, to, "+delete");

            if (mayGrow) lastKill = {
                cm: cm,
                pos: from,
                gen: cm.changeGeneration()
            };
            else lastKill = null;
        }

        // Boundaries of various units
        function byChar(cm, pos, dir) {
            return cm.findPosH(pos, dir, "char", true);
        }

        function byWord(cm, pos, dir) {
            return cm.findPosH(pos, dir, "word", true);
        }

        function byLine(cm, pos, dir) {
            return cm.findPosV(pos, dir, "line", cm.doc.sel.goalColumn);
        }

        function byPage(cm, pos, dir) {
            return cm.findPosV(pos, dir, "page", cm.doc.sel.goalColumn);
        }

        function byParagraph(cm, pos, dir) {
            var no = pos.line,
                line = cm.getLine(no);
            var sawText = /\S/.test(dir < 0 ? line.slice(0, pos.ch) : line.slice(pos.ch));
            var fst = cm.firstLine(),
                lst = cm.lastLine();
            for (;;) {
                no += dir;
                if (no < fst || no > lst)
                    return cm.clipPos(Pos(no - dir, dir < 0 ? 0 : null));
                line = cm.getLine(no);
                var hasText = /\S/.test(line);
                if (hasText) sawText = true;
                else if (sawText) return Pos(no, 0);
            }
        }

        function bySentence(cm, pos, dir) {
            var line = pos.line,
                ch = pos.ch;
            var text = cm.getLine(pos.line),
                sawWord = false;
            for (;;) {
                var next = text.charAt(ch + (dir < 0 ? -1 : 0));
                if (!next) { // End/beginning of line reached
                    if (line == (dir < 0 ? cm.firstLine() : cm.lastLine())) return Pos(line, ch);
                    text = cm.getLine(line + dir);
                    if (!/\S/.test(text)) return Pos(line, ch);
                    line += dir;
                    ch = dir < 0 ? text.length : 0;
                    continue;
                }
                if (sawWord && /[!?.]/.test(next)) return Pos(line, ch + (dir > 0 ? 1 : 0));
                if (!sawWord) sawWord = /\w/.test(next);
                ch += dir;
            }
        }

        function byExpr(cm, pos, dir) {
            var wrap;
            if (cm.findMatchingBracket && (wrap = cm.findMatchingBracket(pos, true)) && wrap.match && (wrap.forward ? 1 : -1) == dir)
                return dir > 0 ? Pos(wrap.to.line, wrap.to.ch + 1) : wrap.to;

            for (var first = true;; first = false) {
                var token = cm.getTokenAt(pos);
                var after = Pos(pos.line, dir < 0 ? token.start : token.end);
                if (first && dir > 0 && token.end == pos.ch || !/\w/.test(token.string)) {
                    var newPos = cm.findPosH(after, dir, "char");
                    if (posEq(after, newPos)) return pos;
                    else pos = newPos;
                } else {
                    return after;
                }
            }
        }

        // Prefixes (only crudely supported)
        function getPrefix(cm, precise) {
            var digits = cm.state.emacsPrefix;
            if (!digits) return precise ? null : 1;
            clearPrefix(cm);
            return digits == "-" ? -1 : Number(digits);
        }

        function repeated(cmd) {
            var f = typeof cmd == "string" ? function(cm) {
                cm.execCommand(cmd);
            } : cmd;
            return function(cm) {
                var prefix = getPrefix(cm);
                f(cm);
                for (var i = 1; i < prefix; ++i) f(cm);
            };
        }

        function findEnd(cm, by, dir) {
            var pos = cm.getCursor(),
                prefix = getPrefix(cm);
            if (prefix < 0) {
                dir = -dir;
                prefix = -prefix;
            }
            for (var i = 0; i < prefix; ++i) {
                var newPos = by(cm, pos, dir);
                if (posEq(newPos, pos)) break;
                pos = newPos;
            }
            return pos;
        }

        function move(by, dir) {
            var f = function(cm) {
                cm.extendSelection(findEnd(cm, by, dir));
            };
            f.motion = true;
            return f;
        }

        function killTo(cm, by, dir) {
            kill(cm, cm.getCursor(), findEnd(cm, by, dir), true);
        }

        function addPrefix(cm, digit) {
            if (cm.state.emacsPrefix) {
                if (digit != "-") cm.state.emacsPrefix += digit;
                return;
            }
            // Not active yet
            cm.state.emacsPrefix = digit;
            cm.on("keyHandled", maybeClearPrefix);
            cm.on("inputRead", maybeDuplicateInput);
        }

        var prefixPreservingKeys = {
            "Alt-G": true,
            "Ctrl-X": true,
            "Ctrl-Q": true,
            "Ctrl-U": true
        };

        function maybeClearPrefix(cm, arg) {
            if (!cm.state.emacsPrefixMap && !prefixPreservingKeys.hasOwnProperty(arg))
                clearPrefix(cm);
        }

        function clearPrefix(cm) {
            cm.state.emacsPrefix = null;
            cm.off("keyHandled", maybeClearPrefix);
            cm.off("inputRead", maybeDuplicateInput);
        }

        function maybeDuplicateInput(cm, event) {
            var dup = getPrefix(cm);
            if (dup > 1 && event.origin == "+input") {
                var one = event.text.join("\n"),
                    txt = "";
                for (var i = 1; i < dup; ++i) txt += one;
                cm.replaceSelection(txt);
            }
        }

        function addPrefixMap(cm) {
            cm.state.emacsPrefixMap = true;
            cm.addKeyMap(prefixMap);
            cm.on("keyHandled", maybeRemovePrefixMap);
            cm.on("inputRead", maybeRemovePrefixMap);
        }

        function maybeRemovePrefixMap(cm, arg) {
            if (typeof arg == "string" && (/^\d$/.test(arg) || arg == "Ctrl-U")) return;
            cm.removeKeyMap(prefixMap);
            cm.state.emacsPrefixMap = false;
            cm.off("keyHandled", maybeRemovePrefixMap);
            cm.off("inputRead", maybeRemovePrefixMap);
        }

        // ---------------------------------------------------------
        var extraKeys = {
            'Ctrl-A': 'goLineStart',
            'Ctrl-E': "goLineEnd",
            "Ctrl-W": function(cm) {
                kill(cm, cm.getCursor("start"), cm.getCursor("end"));
            },
            "Ctrl-D": function(cm) {
                killTo(cm, byChar, 1);
            },
            "Ctrl-K": repeated(function(cm) {
                var start = cm.getCursor(),
                    end = cm.clipPos(Pos(start.line));
                var text = cm.getRange(start, end);
                if (!/\S/.test(text)) {
                    text += "\n";
                    end = Pos(start.line + 1, 0);
                }
                kill(cm, start, end, true, text);
            }),
            "Ctrl-Y": function(cm) {
                var start = cm.getCursor();
                cm.replaceRange(getFromRing(getPrefix(cm)), start, start, "paste");
                //cm.setSelection(start, cm.getCursor());
            },
        };

        // this adds these extra keys too the base class, so that
        // all newly created cells will have them.
        Cell.Cell.options_default.cm_config.extraKeys = extraKeys;
        Cell.Cell.options_default.cm_config.lineWrapping = true;

        // but we also need to add them to any existing cells
        var cells = IPython.notebook.get_cells();
        var numCells = cells.length;
        for (var i = 0; i < numCells; i++) {
            var theseExtraKeys = cells[i].code_mirror.getOption('extraKeys');
            for (var k in extraKeys) {
                theseExtraKeys[k] = extraKeys[k];
            }
            cells[i].code_mirror.setOption('extraKeys', theseExtraKeys);
            cells[i].code_mirror.setOption('lineWrapping', true);
        }
    };

    return {
        load_ipython_extension: load_ipython_extension,
    };
});
