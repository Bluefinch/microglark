'use strict';

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var sharejs = require('share');
var socketio = require('socket.io');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());

if ('development' === app.get('env')) {
    app.use(express.logger('dev'));
} else {
    app.use(express.logger());
}

app.use(express.compress());
app.use(express.methodOverride());
app.use(express.bodyParser());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

/* 404 like middleware. Route everything that was not answered yet to the main
 * page, except the 'channel' url used by sharejs. */
app.use(function (req, res, next) {
    var matched = req.path.match(/^\/(\w+).*$/);
    if (matched && matched[1] === 'channel') {
        next();
    } else {
        res.redirect('/');
    }
});

// development only
if ('development' === app.get('env')) {
    app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/about', routes.about);

var server = http.createServer(app);

var sio = socketio.listen(server);
sio.enable('browser client etag');
sio.set('log level', 1);
sio.set('transports', ['xhr-polling']);
// sio.set('close timeout', 5);

/* Attach the sharjs REST and Socket.io interfaces to the server. */
var sharejsOptions = {
    db: {
        type: 'none'
    }
};

sharejs.server.attach(app, sharejsOptions);

server.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});

sio.sockets.on('connection', function (socket) {
    console.log('Websocket connection.');

    socket.on('join', function (data) {
        socket.set('documentId', data.documentId, function () {
            socket.set('userId', data.userId, function () {
                socket.join(data.documentId);
            });
        });
    });

    socket.on('selectionChange', function (data) {
        socket.get('documentId', function (err, documentId) {
            if (err) return console.log(err);
            socket.broadcast.to(documentId).emit('selectionChange', data);
        });
    });

    socket.on('requestFilename', function () {
        socket.get('documentId', function (err, documentId) {
            if (err) return console.log(err);
            socket.broadcast.to(documentId).emit('requestFilename');
        });
    });

    socket.on('notifyFilename', function (data) {
        socket.get('documentId', function (err, documentId) {
            if (err) return console.log(err);
            socket.broadcast.to(documentId).emit('notifyFilename', data);
        });
    });

    socket.on('disconnect', function () {
        socket.get('documentId', function (err, documentId) {
            if (err) return console.log(err);
            var room = sio.sockets.manager.rooms['/' + documentId];
            if (!room || (room.length === 1 && room[0] === socket.id)) {
                /* Zombie document, prune it. */
                console.log('Deleting document ' + documentId);
                app.model.delete(documentId, function (err) {
                    if (err) return console.log(err);
                    console.log('document deleted.');
                });
            } else {
                socket.get('userId', function (err, userId) {
                    if (err) return console.log(err);
                    socket.broadcast.to(documentId).emit('collaboratorDisconnect', userId);
                });
            }
        });
    });
});

