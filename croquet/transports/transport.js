
// Initializes the transport on the specified HTTP(S) server, at the
// specified base URL.
//
// Each transport should perform whatever interactions it needs at a
// unique additional path to this base url.  For example, a websocket
// transport might use `baseUrl + 'websocket'`.
var Transport = function(server, baseUrl) {};

// Available events:
//
//  * connection
//
Transport.prototype = new EventEmitter();

// Cleanly shuts down the transport.  This should forcefully disconnect
// all open connections.
Transport.prototype.shutdown = function() {};

exports.Transport = Transport;
