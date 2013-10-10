/* global io, ace, sharejs, $, editor, socket, userId, userColor, markups, documentId, escape, 
FileReader, sharedDocument, currentFilename, defaultFile, Blob, saveAs */
'use strict';

window.userId = null;
window.userColor = null;
window.markups = {};
window.editor = null;
window.currentFilename = null;
window.documentId = null;
window.sharedDocument = null;

var modeHelper = function () {

    var aceModes = {
        coffee: ["CoffeeScript", "coffee"],
        coldfusion: ["ColdFusion", "cfm"],
        csharp: ["C#", "cs"],
        css: ["CSS", "css"],
        diff: ["Diff", "diff|patch"],
        golang: ["Go", "go"],
        groovy: ["Groovy", "groovy"],
        haxe: ["haXe", "hx"],
        html: ["HTML", "htm|html|xhtml"],
        c_cpp: ["C/C++", "c|cc|cpp|cxx|h|hh|hpp"],
        clojure: ["Clojure", "clj"],
        java: ["Java", "java"],
        javascript: ["JavaScript", "js"],
        json: ["JSON", "json"],
        latex: ["LaTeX", "latex|tex|ltx|bib"],
        less: ["LESS", "less"],
        liquid: ["Liquid", "liquid"],
        lua: ["Lua", "lua"],
        markdown: ["Markdown", "md|markdown"],
        ocaml: ["OCaml", "ml|mli"],
        perl: ["Perl", "pl|pm"],
        pgsql: ["pgSQL", "pgsql"],
        php: ["PHP", "php|phtml"],
        powershell: ["Powershell", "ps1"],
        python: ["Python", "py"],
        ruby: ["Ruby", "ru|gemspec|rake|rb"],
        scad: ["OpenSCAD", "scad"],
        scala: ["Scala", "scala"],
        scss: ["SCSS", "scss|sass"],
        sh: ["SH", "sh|bash|bat"],
        sql: ["SQL", "sql"],
        svg: ["SVG", "svg"],
        text: ["Text", "txt"],
        textile: ["Textile", "textile"],
        xml: ["XML", "xml|rdf|rss|wsdl|xslt|atom|mathml|mml|xul|xbl"],
        xquery: ["XQuery", "xq"],
        yaml: ["YAML", "yaml"]
    };

    var ext2mode = {};
    Object.keys(aceModes).forEach(function (key) {
        var value = aceModes[key];
        var extensions = value[1].split('|');
        extensions.forEach(function (extension) {
            ext2mode[extension] = key;
        });
    });

    return {
        getAceModeForExtension: function (extension) {
            if (ext2mode[extension] !== undefined) {
                return 'ace/mode/' + ext2mode[extension];
            }
            return 'ace/mode/text';
        }
    };
}();

var makeMarkupForUser = function () {

    var Markup = function (editor, userId) {
        this._editor = editor;
        this._userId = userId;

        this.$markup = $('<div id="collaboration-selection-' + userId + '" class="collaboration-selection-wrapper">' +
            '<div class="collaboration-selection"></div>' +
            '<div class="collaboration-selection-tooltip">' + userId + '</div>' +
            '</div>');
        this._location = {
            row: -1,
            column: -1
        };
        this._timeout = null;

        var _this = this;
        this.$markup.on('mouseenter', function () {
            _this.showTooltip();
        });
        this.$markup.on('mouseleave', function () {
            _this.showTooltip(500);
        });
    };

    Markup.prototype.remove = function () {
        this.$markup.remove();
    };

    Markup.prototype.setColor = function (color) {
        this.$markup.children('.collaboration-selection').css('background-color', color);
        this.$markup.children('.collaboration-selection-tooltip').css('background-color', color);
    };

    Markup.prototype.setLocation = function (location) {
        this._location = location;
        this.updateLocation();
    };

    Markup.prototype.getLocation = function () {
        return this._location;
    };

    Markup.prototype.updateLocation = function () {
        var screenCoordinates = this._editor.renderer
            .textToScreenCoordinates(this._location.row,
                this._location.column);

        this.$markup.css({
            left: screenCoordinates.pageX,
            top: screenCoordinates.pageY
        });
    };

    Markup.prototype.hideTooltip = function () {
        this.$markup.children('.collaboration-selection-tooltip').fadeOut('fast');
        this._timeout = null;
    };

    /* Show the markup tooltip. If duration is defined, the
     * tooltip is automaticaly hidden when the time is elapsed. */
    Markup.prototype.showTooltip = function (duration) {
        if (this._timeout !== null) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }

        this.$markup.children('.collaboration-selection-tooltip').fadeIn('fast');

        if (duration !== undefined) {
            var _this = this;
            this._timeout = setTimeout(function () {
                _this.hideTooltip();
            }, duration);
        }
    };

    return function (editor, userId) {
        return new Markup(editor, userId);
    };
}();

var makeRandomHash = function (length) {
    var chars, x;
    if (!length) {
        length = 10;
    }
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var name = [];
    for (x = 0; x < length; x++) {
        name.push(chars[Math.floor(Math.random() * chars.length)]);
    }
    return name.join('');
};

var peekRandomColor = function () {
    var colors = [
        '#ff7567',
        '#5bdd92',
        '#61b8f3'
    ];
    return function () {
        return colors[Math.floor(Math.random() * colors.length)];
    };
}();

var notifySelection = function () {
    var selection = editor.getSelection().getRange();
    socket.emit('notifySelection', {
        userId: userId,
        userColor: userColor,
        selection: selection
    });
};

var getAceMode = function (filename) {
    var fileExtension = 'unknown';
    if (filename.indexOf('.') !== -1) {
        fileExtension = filename.split('.').pop();
    }
    return modeHelper.getAceModeForExtension(fileExtension);
};

var setFilename = function (filename) {
    if (filename !== currentFilename) {
        /* Update document. */
        filename = escape(filename);
        $('#filename .text').html(filename);
        document.title = 'µGlark.io - ' + filename;

        /* Update ace mode. */
        var mode = getAceMode(filename);
        editor.getSession().setMode(mode);

        /* Save filename.*/
        window.currentFilename = filename;
    }
};

var handleFileSelect = function (evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var files = evt.dataTransfer.files;
    var file = files[0];
    var filename = escape(file.name);
    setFilename(filename);

    /* Notify. */
    socket.emit('notifyFilename', filename);

    /* Update contents. */
    var reader = new FileReader();
    reader.onload = function (evt) {
        var content = evt.target.result;

        editor.setReadOnly(true);
        sharedDocument.detach_ace();
        editor.setValue(content);

        /* Attach the editor back, while keeping its new content. */
        sharedDocument.attach_ace(editor, true);
        editor.session.setScrollTop(0);
        editor.setReadOnly(false);
    };
    reader.readAsText(file);
};

var handleDragOver = function (evt) {
    evt.stopPropagation();
    evt.preventDefault();
    /* Explicitly show this is a copy. */
    evt.dataTransfer.dropEffect = 'copy';
};

var downloadDocument = function () {
    var blob = new Blob([editor.getValue()], {
        type: 'text/plain;charset=utf-8'
    });
    saveAs(blob, currentFilename);
};

$(function () {
    window.userId = makeRandomHash(5);
    window.userColor = peekRandomColor();

    /* Get or make docummentId. */
    if (!document.location.hash) {
        document.location.hash = '#' + makeRandomHash();
    }
    window.documentId = document.location.hash.slice(1);

    /* Initialize socket.io */
    window.socket = io.connect();

    /* Initialize ace. */
    var editor = window.editor = ace.edit("editor");
    editor.setReadOnly(true);
    editor.setShowPrintMargin(false);
    editor.getSession().setUseWrapMode(true);
    editor.getSession().setUseSoftTabs(true);
    editor.getSession().setTabSize(4);
    editor.setTheme("ace/theme/glarkio_black");

    /* Initialize sharejs. */
    sharejs.open(documentId, 'text', function (error, doc) {
        if (error) {
            console.error(error);
            return;
        }
        if (doc.created) {
            doc.insert(0, defaultFile.getContent());
            setFilename(defaultFile.filename);
        } else {
            socket.emit('requestFilename');
        }
        doc.attach_ace(editor);
        editor.session.setScrollTop(0);
        editor.setReadOnly(false);

        window.sharedDocument = doc;

        editor.getSelection().on('changeCursor', notifySelection);
        editor.getSelection().on('changeSelection', notifySelection);

        socket.emit('requestSelection');
    });

    /* Socket.io events. */
    socket.on('connect', function () {
        socket.emit('join', {
            documentId: documentId,
            userId: userId
        });
    });

    socket.on('notifySelection', function (data) {

        /* Update the selection css to the correct position. */
        var markup = markups[data.userId];
        if (markup === undefined) {
            /* The markup for the selection of this user does not
             * exist yet. Append it to the dom. */
            markup = makeMarkupForUser(editor, data.userId);
            markup.setColor(data.userColor);
            $('body').append(markup.$markup);
            markups[data.userId] = markup;
        }

        /* Check if the selection has changed. */
        var location = markup.getLocation();
        if (location.row !== data.selection.start.row ||
            location.column !== data.selection.start.column) {

            markup.setLocation({
                row: data.selection.start.row,
                column: data.selection.start.column
            });
            markup.showTooltip(500);
        }

    });

    socket.on('notifyFilename', function (filename) {
        setFilename(filename);
    });

    socket.on('requestFilename', function () {
        if (currentFilename) {
            socket.emit('notifyFilename', currentFilename);
        }
    });

    socket.on('requestSelection', function () {
        notifySelection();
    });

    socket.on('collaboratorDisconnect', function (userId) {
        /* Remove the collaborator selection. */
        var markup = markups[userId];
        if (markup !== undefined) {
            markup.remove();
            markups[userId] = undefined;
        }
    });

    /* Bind some ui events. */
    $(window).resize(function () {
        Object.keys(markups).forEach(function (userId) {
            var markup = markups[userId];
            markup.updateLocation();
        });
    });

    $('#download').click(function (event) {
        event.preventDefault();
        downloadDocument();
    });

    $('#filename .text').blur(function () {
        var filename = $(this).html();
        setFilename(filename);
        socket.emit('notifyFilename', filename);
    });

    $('#filename .text').keypress(function (event) {
        if (event.which === 13) {
            event.preventDefault();
            var filename = $(this).html();
            setFilename(filename);
            socket.emit('notifyFilename', filename);
            editor.focus();
        }
    });

    /* Make the body a drop zone. */
    var body = document.body;
    body.addEventListener('dragover', handleDragOver, false);
    body.addEventListener('drop', handleFileSelect, false);
});
