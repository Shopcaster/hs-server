var EventEmitter = require('events').EventEmitter;

var Message = function(connection, id, message, data) {
  this.connection = connection;
  this.id = id;
  this.message = message;
  this.data = data;
};

var ConnectionState = {
  connected: 1,
  limbo: 2
};

var Connection = function(id) {
  this.id = id;
};
Connection.prototype = new EventEmitter();

Connection.prototype.disconnect = function() {

};

Connection.prototype.send = function(message, data) {

};

exports.Connection = Connection;
exports.ConnectionState = ConnectionState;
