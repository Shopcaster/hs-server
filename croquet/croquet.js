var EventEmitter = require('events').EventEmitter,
    fs = require('fs');

// Transports
var xhr = require('./xhr');

var Croquet = function(server, url) {
  this.server = server;
  this.url = url;
  this.transports = [];

  // Initialize xhr transport
  this.transports.push(new xhr.Transport(server, url));

  // Listen for connections
  var self = this;
  for (var i=0; i<this.transports.length; i++) {
    this.transports[i].on('connection', function(con) {
      self.emit('connection', con);
    });
  }
};
Croquet.prototype = new EventEmitter();
Croquet.prototype.kill = function() {
  // Shutdown all the transports
  for (var i=0; i<this.transports.length; i++)
    this.transports[i].shutdown();
};

exports.Croquet = Croquet;
