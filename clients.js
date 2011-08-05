var events = require('events'),
    mongo = require('mongodb'),
    ConnectionState = require('./croquet/connection').ConnectionState,
    croquet = require('./croquet/croquet');

var socket;

// Client object
var Client = function(connection) {
  this.id = connection.cid;
  this.connection = connection;
  this.state = {};
  this.setMaxListeners(0);
};
Client.prototype = new events.EventEmitter();
Client.prototype.send = function(type, data) {
  if (this.connection.state === ConnectionState.connected)
    try { this.connection.send(type, data) }
    catch(err) {}
};

init = function(server, handler) {
  //initialize croquet
  socket = new croquet.Croquet(server, '/croquet');
  socket.on('connection', function(con) {

    //init stuff, because javascript's hashes suck
    var client = new Client(con);

    //listen for messages
    con.on('message', function(msg) {

      try {
        //dispatch the message
        handler(client, msg.type, msg.data,
        //success callback
        function(val) {
          msg.respond(val);
        },
        //error callback
        function(err) {
          msg.respondError(err);
        });
      } catch (err) {
        console.log(err.stack);
        console.log('');
      }
    });
    //listen for disconnect
    con.on('disconnect', function() {
      client.emit('disconnect');
    });
  });
};

//exports
exports.init = init;
