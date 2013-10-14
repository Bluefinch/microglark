window.defaultFile = {
    filename: 'Scratch.js',
    getContent: function () {
        return "/* µGlark.io is a minimalistic pair programming editor.\n" +
        " * Share the url of this page " + window.location.toString() + " with anybody,\n" +
        " * and start collaborative editing.\n" +
        " * Drag and drop any file from your desktop here to open it.\n" +
        " * Edit the filename just above the editor to change the syntax highlighting type.\n" +
        " * Because we value privacy, nothing is stored on the server,\n" +
        " * closing your browser tab will instantly destroy the document.\n" +
        " * Enjoy! */\n" +
        "exports.glark = function () {\n    console.log('hi!');\n};";
    }
};
