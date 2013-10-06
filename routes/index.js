
/*
 * GET home page.
 */

exports.index = function (req, res) {
    res.render('index', { 
        title: 'µGlark.io',
        defaultFile: 'scratch.js'
    });
};

/*
 * GET about page.
 */

exports.about = function (req, res) {
    res.render('index', { 
        title: 'µGlark.io',
        defaultFile: 'about.js'
    });
};
