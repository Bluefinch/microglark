/* global ace, sharejs */
var randomDocName = function (length) {
    var chars, x;
    if (!length) {
        length = 10;
    }
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-=";
    var name = [];
    for (x = 0; x < length; x++) {
        name.push(chars[Math.floor(Math.random() * chars.length)]);
    }
    return name.join('');
};
window.onload = function () {
    var editor = window.editor = ace.edit("editor");
    editor.setReadOnly(true);
    editor.getSession().setUseSoftTabs(true);
    editor.getSession().setTabSize(2);
    editor.getSession().setMode("ace/mode/coffee");
    editor.setTheme("ace/theme/glarkio_black");
    if (!document.location.hash) {
        document.location.hash = '#' + randomDocName();
    }
    var docName = "code:" + document.location.hash.slice(1);
    var span = document.getElementById('docname').innerText = docName;
    sharejs.open(docName, 'text', function (error, doc) {
        if (error) {
            console.error(error);
            return;
        }
        if (doc.created) {
            doc.insert(0, "# Coffeescript editor!\\n\nexports.foo = ->\n  console.log 'hi!'");
        }
        doc.attach_ace(editor);
        editor.setReadOnly(false);
    });
};
