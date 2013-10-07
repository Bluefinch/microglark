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
app.use(express.logger('dev'));
app.use(express.compress());
app.use(express.methodOverride());
app.use(express.bodyParser());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

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

    socket.on('join', function (documentId) {
        socket.set('documentId', documentId, function () {
            socket.join(documentId);
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
});
