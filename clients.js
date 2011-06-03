var io = require('socket.io'),
    events = require('events');

var socket;
var clients = {}, cur_id = 0;

// Serializes a message
var serialize = function(messageType, messageData) {
  return messageType + ':' + (JSON.stringify(messageData) || '');
};

// Deserializes a message
var deserialize = function(msg) {
  var i = msg.indexOf(':');
  if (i < 1)
    throw 'Invalid message: ' + msg;
  var type = msg.substr(0, i);
  var data = JSON.parse(msg.substr(i + 1) || null);

  return {type: type, data: data};
};

// Client object
var Client = function(client_id) {
  this.id = cur_id++;
};
Client.prototype = new events.EventEmitter();
Client.prototype.send = function(type, data) {
  clients[this.id].send(serialize(type, data));
};

init = function(server, handler) {
  //initialize socket.io server
  socket = new io.listen(server, {log: function() {}});
  socket.on('connection', function(c) {
    //init stuff, because javascript's hashes suck
    var client = new Client();
    clients[client.id] = c;

    //listen for messages
    c.on('message', function(msg) {
      var done = false;

      try {
        var message = deserialize(msg);
        var mid = message.data.id;
        delete message.data.id;

        //dispatch the message
        handler(client, message.type, message.data,
        //success callback
        function(val) {
          if (!done)
            client.send('response', {id: mid, value: val});
          done = true;
        },
        //error callback
        function(err) {
          if (!done)
            client.send('response', {id: mid, error: err});
          done = true
        });
      } catch (err) {
        console.log(err.stack, '');
      }
    });
    //listen for disconnect
    c.on('disconnect', function() {
      client.emit('disconnect');
    });
  });
};

//exports
exports.init = init;
