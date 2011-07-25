var EventEmitter = require('events').EventEmitter,
    fs = require('fs');

// Available transports
var transports = [];

// Find all available transports
with ({dir: fs.readdirSync(__dirname + '/' + 'transports')}) {
  for (var i=0; i<dir.length; i++) {
    var file = __dirname + '/' + dir[i];
    var stats = fs.statSync(file);
    if (stats.isFile() && dir[i].match(/\.js$/))
      transports.push(require(file).Transport);
  }
}

var Croquet = function(server, url) {
  this.server = server;
  this.url = url;
  this.transports = [];

  // Initialize the transports
  for (var i=0; i<transports.length; i++)
    this.transports.push(new transports[i](server, url));

  // Generate the client code
};
Croquet.prototype = new EventEmitter();
Croquet.prototype.kill = function() {
  // Shutdown all the transports
  for (var i=0; i<this.transports.length; i++)
    this.transports[i].shutdown();
};

exports.Croquet = Croquet;
