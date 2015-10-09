define([
    'base/js/namespace',
    'notebook/js/cell',
    'codemirror/lib/codemirror',
    'codemirror/keymap/emacs'
], function(IPython, Cell, CodeMirror) {
    console.log('Adding emacs keybindings');
    var load_ipython_extension = function() {
        // this adds these extra keys too the base class, so that
        // all newly created cells will have them.
        var extraKeys = CodeMirror.keyMap.emacs;

        // override Ctrl-Y to not select the whole line, because I
        // don't like that feature
        var ctrl_y_super = extraKeys["Ctrl-Y"];
        extraKeys["Ctrl-Y"] = function(cm) {
            ctrl_y_super(cm);
            cm.setSelection(cm.getCursor(), cm.getCursor());
        };

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
