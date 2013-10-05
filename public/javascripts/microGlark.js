/* global ace, sharejs, $, editor, socket, userId, documentId */
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

var handleFileSelect = function (evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var files = evt.dataTransfer.files; // FileList object.

    // files is a FileList of File objects. List some properties.
    var output = [];
    for (var i = 0; i < files.length; ++i) {
        var f = files[i];
        output.push('<li><strong>', f.name, '</strong> (', f.type || 'n/a', ') - ',
                f.size, ' bytes, last modified: ',
                f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a',
                '</li>');
    }
    document.getElementById('editor').innerHTML = '<ul>' + output.join('') + '</ul>';
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
    var span = document.getElementById('documentId').innerText = documentId;

    /* Initialize socket.io */
    window.socket = io.connect();

    /* Initialize ace. */
    var editor = window.editor = ace.edit("editor");
    editor.setReadOnly(true);
    editor.getSession().setUseSoftTabs(true);
    editor.getSession().setTabSize(2);
    editor.getSession().setMode("ace/mode/coffee");
    editor.setTheme("ace/theme/glarkio_black");

    /* Initialize sharejs. */
    sharejs.open(documentId, 'text', function (error, doc) {
        if (error) {
            console.error(error);
            return;
        }
        if (doc.created) {
            doc.insert(0, "# Coffeescript editor!\\n\nexports.foo = ->\n  console.log 'hi!'");
        }
        doc.attach_ace(editor);
        editor.setReadOnly(false);

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
        if (data.documentId === documentId || true) {
            console.log(data);
            var screenCoordinates = editor.renderer
            .textToScreenCoordinates(data.selection.start.row,
                data.selection.start.column);
            console.log(screenCoordinates);
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

    /* Make the body a drop zone. */
    var body = document.body;
    body.addEventListener('dragover', handleDragOver, false);
    body.addEventListener('drop', handleFileSelect, false);
};
