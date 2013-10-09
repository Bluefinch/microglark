/* global io, ace, sharejs, $, editor, socket, userId, documentId, escape, 
FileReader, sharedDocument, currentFilename, defaultFile, Blob, saveAs */
'use strict';

window.editor = null;
window.currentFilename = null;
window.documentId = null;
window.sharedDocument = null;

var filetype = function () {
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
        getAceModeFromExtension: function (extension) {
            if (ext2mode[extension] !== undefined) {
                return 'ace/mode/' + ext2mode[extension];
            }
            return 'ace/mode/text';
        }
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

var onSelectionChange = function () {
    var selection = editor.getSelection().getRange();
    socket.emit('selectionChange', {
        userId: userId,
        documentId: documentId,
        selection: selection
    });
};

var getSelectionMarkupForUser = function (userId) {
    return '<div id="collaboration-selection-' + userId + '" class="collaboration-selection-wrapper">' +
        '<div class="collaboration-selection"></div>' +
        '<div class="collaboration-selection-tooltip">' + userId + '</div>' +
        '</div>';
};

/* This function must be bound with the markup which contains
 * the tooltip to hide. */
var _hideTooltipAndRemoveAttrForBoundMarkup = function () {
    this.children('.collaboration-selection-tooltip').fadeOut('fast');
    this.removeAttr('hideTooltipTimeoutRef');
};

/* Show the tooltip of the given selection markup. If duration is defined, the
 * tooltip is automaticaly hidden when the time is elapsed. */
var showTooltipForMarkup = function (markup, duration) {
    var timeoutRef = markup.attr('hideTooltipTimeoutRef');
    if (timeoutRef !== undefined) {
        clearTimeout(timeoutRef);
        markup.removeAttr('hideTooltipTimeoutRef');
    }

    markup.children('.collaboration-selection-tooltip').fadeIn('fast');

    if (duration !== undefined) {
        timeoutRef = setTimeout(_hideTooltipAndRemoveAttrForBoundMarkup.bind(markup), duration);
        markup.attr('hideTooltipTimeoutRef', timeoutRef);
    }
};

var getAceMode = function (filename) {
    var fileExtension = 'unknown';
    if (filename.indexOf('.') !== -1) {
        fileExtension = filename.split('.').pop();
    }
    return filetype.getAceModeFromExtension(fileExtension);
};

var setFilename = function (filename) {
    if (filename !== currentFilename) {
        /* Update document. */
        filename = escape(filename);
        $('#filename').html(filename);
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

        editor.getSelection().on('changeCursor', onSelectionChange);
        editor.getSelection().on('changeSelection', onSelectionChange);
    });

    /* Socket.io events. */
    socket.on('connect', function () {
        socket.emit('join', {
            documentId: documentId,
            userId: userId
        });
    });

    socket.on('selectionChange', function (data) {
        if (data.documentId === documentId) {
            var screenCoordinates = editor.renderer
                .textToScreenCoordinates(data.selection.start.row,
                    data.selection.start.column);

            /* Update the selection css to the correct position. */
            var $selection = $('#collaboration-selection-' + data.userId);
            if ($selection.length === 0) {
                /* The markup for the selection of this user does not
                 * exist yet. Append it to the dom. */
                $selection = $(getSelectionMarkupForUser(data.userId));
                $('body').append($selection);
            }

            /* Check if the selection has changed. */
            if ($selection.css('left').slice(0, -2) !== String(screenCoordinates.pageX) ||
                $selection.css('top').slice(0, -2) !== String(screenCoordinates.pageY)) {

                $selection.css({
                    left: screenCoordinates.pageX,
                    top: screenCoordinates.pageY
                });

                showTooltipForMarkup($selection, 500);
            }
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

    socket.on('collaboratorDisconnect', function (userId) {
        /* Remove the collaborator selection. */
        var $selection = $('#collaboration-selection-' + userId);
        if ($selection.length !== 0) {
            $selection.remove();
        }
    });

    /* Bind some ui events. */
    $(document).on('mouseenter',
        '.collaboration-selection,.collaboration-selection-tooltip',
        function () {
            var markup = $(this).parent();
            showTooltipForMarkup(markup);
        });

    $(document).on('mouseleave',
        '.collaboration-selection,.collaboration-selection-tooltip',
        function () {
            var markup = $(this).parent();
            showTooltipForMarkup(markup, 500);
        });

    $('#download').click(function (event) {
        event.preventDefault();
        downloadDocument();
    });

    $('#filename').focus(function () {
        $(this).addClass('editing');
    });

    $('#filename').blur(function () {
        var filename = $(this).html();
        setFilename(filename);
        $(this).removeClass('editing');
    });

    /* Make the body a drop zone. */
    var body = document.body;
    body.addEventListener('dragover', handleDragOver, false);
    body.addEventListener('drop', handleFileSelect, false);
});
