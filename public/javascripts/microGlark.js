/* global ace, sharejs, $, editor, socket, userId, documentId, escape, FileReader, sharedDocument */
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

var setFilename = function (filename) {
    document.getElementById('filename').innerText = filename;
    document.title = 'µGlark.io - ' + filename;
};

var handleFileSelect = function (evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var files = evt.dataTransfer.files;
    var file = files[0];
    var filename = escape(file.name);
    setFilename(filename);
    socket.emit('filenameChange', {
        filename: filename,
        documentId: documentId
    });

    var reader = new FileReader();
    reader.onload = function (evt) {
        var content = evt.target.result;

        editor.setReadOnly(true);
        sharedDocument.detach_ace();
        sharedDocument.del(0, sharedDocument.getLength(), function () {
            sharedDocument.insert(0, content, function () {
                sharedDocument.attach_ace(editor);
                editor.setReadOnly(false);
            });
        });
    };
    reader.readAsText(file);
};

var handleDragOver = function (evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
};

window.onload = function () {
    window.userId = makeRandomHash(5);

    if (!document.location.hash) {
        document.location.hash = '#' + makeRandomHash();
    }

    window.documentId = document.location.hash.slice(1);

    /* Initialize socket.io */
    window.socket = io.connect();

    /* Initialize ace. */
    var editor = window.editor = ace.edit("editor");
    editor.setReadOnly(true);
    editor.getSession().setUseWrapMode(true);
    editor.getSession().setUseSoftTabs(true);
    editor.getSession().setTabSize(2);
    editor.getSession().setMode("ace/mode/javascript");
    editor.setTheme("ace/theme/glarkio_black");

    /* Initialize sharejs. */
    sharejs.open(documentId, 'text', function (error, doc) {
        if (error) {
            console.error(error);
            return;
        }
        if (doc.created) {
            doc.insert(0, "/* µglark.io is a minimalistic pair programing editor.\n" +
               " * Share the url of this page " + window.location.toString() +
               " with anybody,\n *  and start collaborating editing.\n" +
               " * Drag and drop any file from your desktop here to open it.\n" +
               " * Enjoy! */\n" +
               " exports.glark = function () {\n    console.log('hi!');\n};");
        }
        doc.attach_ace(editor);
        editor.setReadOnly(false);

        window.sharedDocument = doc;

        editor.getSelection().on('changeCursor', onSelectionChange);
        editor.getSelection().on('changeSelection', onSelectionChange);
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

    /* Socket.io events. */
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

                showTooltipForMarkup($selection, 2000);
            }
        }
    });

    socket.on('filenameChange', function (data) {
        if (data.documentId === documentId) {
            setFilename(data.filename);
        }
    });

    /* Make the body a drop zone. */
    var body = document.body;
    body.addEventListener('dragover', handleDragOver, false);
    body.addEventListener('drop', handleFileSelect, false);
};
