var EventEmitter = require('events').EventEmitter;

<<<<<<< HEAD
var Message = function(connection, id, type, data) {
  this.connection = connection;
  this.id = id;
  this.type = type;
  this.data = data;
  this.responded = false;
};
Message.prototype = {};
Message.prototype.respond = function(val) {
  if (this.responded) throw new Error('Already responded to this message');
  this.responded = true;

  this.connection.send('response', {id: this.id, value: val});
};
Message.prototype.respondError = function(err) {
  if (this.responded) throw new Error('Already responded to this message');
  this.responded = true;

  this.connection.send('response', {id: this.id, error: err});
=======
var Message = function(connection, id, message, data) {
  this.connection = connection;
  this.id = id;
  this.message = message;
  this.data = data;
>>>>>>> dda5b55531659c8ca4958304940b5f93bcb82682
};

var ConnectionState = {
  connected: 1,
<<<<<<< HEAD
  disconnected: 2
};

var Connection = function(transport, cid) {
  this._transport = transport;
  this.cid = cid;
  this.state = ConnectionState.connected;

  this.pending = [];
=======
  limbo: 2
};

var Connection = function(id) {
  this.id = id;
>>>>>>> dda5b55531659c8ca4958304940b5f93bcb82682
};
Connection.prototype = new EventEmitter();

Connection.prototype.disconnect = function() {
<<<<<<< HEAD
  if (this.state == ConnectionState.disconnected)
    throw new Error('Connection is disconnected');

  // Use the transport's base disconnect
  this._transport.disconnect(this);
};

Connection.prototype.send = function(type, data) {
  if (this.state == ConnectionState.disconnected)
    throw new Error('Connection is disconnected');

  // Add the message to the pending list
  this.pending.push([type, data]);

  // If the pending list was previously empty, tell the transport
  // that it should push data.
  if (this.pending.length == 1)
    this._transport.requestSend(this);
=======

};

Connection.prototype.send = function(message, data) {

>>>>>>> dda5b55531659c8ca4958304940b5f93bcb82682
};

exports.Connection = Connection;
exports.ConnectionState = ConnectionState;
<<<<<<< HEAD
exports.Message = Message;
=======
>>>>>>> dda5b55531659c8ca4958304940b5f93bcb82682
