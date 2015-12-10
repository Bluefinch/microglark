var express = require('express');
var router = express.Router();

/** GET home page. **/
router.get('/', function (req, res) {
    res.render('index', { 
        title: 'µGlark.io',
        defaultFile: 'scratch.js'
    });
});

/** GET about page. **/
router.get('/about', function (req, res) {
    res.render('index', {
        title: 'µGlark.io',
        defaultFile: 'about.js'
    });
});

/** HEAD for tweet button. **/
router.head('/', function (req, res) {
    res.send(200);
});

module.exports = router;