
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path');
var sharejs = require('share')
//var socketio = require('socket.io');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);

var server = http.createServer(app);
//var io = socketio.listen(server);

/* Attach the sharjs REST and Socket.io interfaces to the server. */
var sharejsOptions = {db: {type: 'none'}};
sharejs.server.attach(app, sharejsOptions);
    
server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
