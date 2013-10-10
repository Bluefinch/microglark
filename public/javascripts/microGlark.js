/* global io, ace, sharejs, $, editor, socket, userId, userColor, documentId, escape, 
FileReader, sharedDocument, currentFilename, defaultFile, Blob, saveAs */
'use strict';

window.userId = null;
window.userColor = null;
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

var selectionHelper = {

    getSelectionMarkupForUser: function (userId) {
        return '<div id="collaboration-selection-' + userId + '" class="collaboration-selection-wrapper">' +
            '<div class="collaboration-selection"></div>' +
            '<div class="collaboration-selection-tooltip">' + userId + '</div>' +
            '</div>';
    },

    hideMarkupTooltip: function ($markup) {
        $markup.children('.collaboration-selection-tooltip').fadeOut('fast');
        $markup.removeAttr('hideTooltipTimeoutRef');
    },

    /* Show the tooltip of the given selection markup. If duration is defined, the
     * tooltip is automaticaly hidden when the time is elapsed. */
    showMarkupTooltip: function ($markup, duration) {
        var timeoutRef = $markup.attr('hideTooltipTimeoutRef');
        if (timeoutRef !== undefined) {
            clearTimeout(timeoutRef);
            $markup.removeAttr('hideTooltipTimeoutRef');
        }

        $markup.children('.collaboration-selection-tooltip').fadeIn('fast');

        if (duration !== undefined) {
            timeoutRef = setTimeout(function () {
                selectionHelper.hideMarkupTooltip($markup);
            }, duration);
            $markup.attr('hideTooltipTimeoutRef', timeoutRef);
        }
    }
};

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

        var screenCoordinates = editor.renderer
            .textToScreenCoordinates(data.selection.start.row,
                data.selection.start.column);

        /* Update the selection css to the correct position. */
        var $selection = $('#collaboration-selection-' + data.userId);
        if ($selection.length === 0) {
            /* The markup for the selection of this user does not
             * exist yet. Append it to the dom. */
            $selection = $(selectionHelper.getSelectionMarkupForUser(data.userId));
            $selection.find('.collaboration-selection').css('background-color', data.userColor);
            $selection.find('.collaboration-selection-tooltip').css('background-color', data.userColor);
            $('body').append($selection);
        }

        /* Check if the selection has changed. */
        if ($selection.css('left').slice(0, -2) !== String(screenCoordinates.pageX) ||
            $selection.css('top').slice(0, -2) !== String(screenCoordinates.pageY)) {

            $selection.css({
                left: screenCoordinates.pageX,
                top: screenCoordinates.pageY
            });

            selectionHelper.showMarkupTooltip($selection, 500);
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
            selectionHelper.showMarkupTooltip(markup);
        });

    $(document).on('mouseleave',
        '.collaboration-selection,.collaboration-selection-tooltip',
        function () {
            var markup = $(this).parent();
            selectionHelper.showMarkupTooltip(markup, 500);
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
