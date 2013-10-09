window.defaultFile = {
    filename: 'Scratch.js',
    getContent: function () {
        return "/* µGlark.io is a minimalistic pair programing editor.\n" +
        " * Share the url of this page " + window.location.toString() +
        " with anybody,\n * and start collaborative editing.\n" +
        " * Drag and drop any file from your desktop here to open it.\n" +
        " * Enjoy! */\n" +
        "exports.glark = function () {\n    console.log('hi!');\n};";
    }
};
