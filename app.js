'use strict';

var express = require('express');
// var favicon = require('serve-favicon');
var methodOverride = require('method-override');
var compression = require('compression');
var bodyParser = require('body-parser');
var errorhandler = require('errorhandler');
var http = require('http');
var path = require('path');
var sharejs = require('share');
var socketio = require('socket.io');

var routes = require('./routes');

var app = express();
var server = http.Server(app);
var sio = socketio(server);

app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
// app.use(favicon());
app.use(methodOverride());
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(path.join(__dirname, 'www/public')));

app.use('/', routes);

/* 404 like middleware. Route everything that was not answered yet to the main
 * page, except the 'channel' url used by sharejs. */
app.use(function(req, res, next) {
    if (req.path.length > 7 && req.path.substr(1, 7) === 'channel') {
        next();
    } else {
        res.redirect('/');
    }
});

if ('development' === app.get('env')) {
    app.use(errorhandler());
}

/* Provide some variables to the views. */
if ('production' === app.get('env')) {
    app.set('production', true);
}

/* Attach the sharjs REST and Socket.io interfaces to the server. */
var sharejsOptions = {
    db: {
        type: 'none'
    }
};

if ('production' === app.get('env')) {
    sharejsOptions.websocket = true;
}

sharejs.server.attach(app, sharejsOptions);

server.listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});

var store = {};
sio.on('connection', function(socket) {
    console.log('Websocket connection.');

    socket.on('join', function(data) {
        console.log('id', socket.id);
        store[socket.id] = {
            documentId: data.documentId,
            userId: data.userId
        };
        socket.join(data.documentId);
        socket.emit('joined');
    });

    socket.on('requestUser', function() {
        var values = store[socket.id];
        if (!values) return;

        socket.broadcast.to(values.documentId).emit('requestUser');
    });

    socket.on('notifyUser', function(data) {
        var values = store[socket.id];
        if (!values) return;

        socket.broadcast.to(values.documentId).emit('notifyUser', data);
    });

    socket.on('notifySelection', function(data) {
        var values = store[socket.id];
        if (!values) return;

        socket.broadcast.to(values.documentId).emit('notifySelection', data);
    });

    socket.on('requestSelection', function(data) {
        var values = store[socket.id];
        if (!values) return;

        socket.broadcast.to(values.documentId).emit('requestSelection', data);
    });

    socket.on('requestFilename', function() {
        var values = store[socket.id];
        if (!values) return;

        socket.broadcast.to(values.documentId).emit('requestFilename');
    });

    socket.on('notifyFilename', function(data) {
        var values = store[socket.id];
        if (!values) return;

        socket.broadcast.to(values.documentId).emit('notifyFilename', data);
    });

    socket.on('notifyWriting', function(data) {
        var values = store[socket.id];
        if (!values) return;

        socket.broadcast.to(values.documentId).emit('notifyWriting', data);
    });

    socket.on('disconnect', function() {
        var values = store[socket.id];
        if (!values) return;
        delete store[socket.id];

        var room = sio.nsps['/'].adapter.rooms['/' + values.documentId];
        if (!room || (room.length === 1 && room[0] === socket.id)) {
            /* Zombie document, prune it. */
            console.log('Deleting document ' + values.documentId);
            app.model.delete(values.documentId, function(err) {
                if (err) return console.log(err);
                console.log('document deleted.');
            });
        } else {
            socket.broadcast.to(values.documentId).emit('collaboratorDisconnect', values.userId);
        }
    });
});
