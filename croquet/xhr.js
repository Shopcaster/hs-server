/*

Message format:

[cid]|[mid]|[type]|[data...]

Where
  cid = Client ID
  mid = message ID
  type = message type
  data = json

Send format:

[message1 length]|[message1][message2 length]|[message2] ...

Poll format:

[message1 length]|[message1][message2 length]|[message 2]

message = [type]|[data...]

*/

var querystring = require('querystring'),
    EventEmitter = require('events').EventEmitter,
    _url = require('url'),
    Connection = require('./connection').Connection,
    Message = require('./connection').Message,
    cors = require('../util/cors');

var convertData = function(type, data) {
  switch(type) {
    case 's':
      return data;
    case 'd':
      return new Date(parseFloat(data));
    case 'i':
      return parseInt(data);
    case 'f':
      return parseFloat(data);
    case 'n':
      return null;
    case 'a':
      return data;
    case 'o':
      return convertObj(data);
    case 'b':
      return data;
    case 'u':
    default:
      return undefined;
  }
};
var convertObj = function(obj) {
  for (var i in obj) if (obj.hasOwnProperty(i)) {
    var d = obj[i];
    obj[i.substr(1)] = convertData(i.substr(0, 1), d);
    delete obj[i];
  }

  return obj;
};

var parseMessage = function(message) {
  var a = 0,
      b = 0;

  var parsed = {};

  var get = function(field) {
    var i = message.indexOf('|');
    if (i < 0) throw new Error('Invalid message');
    parsed[field] = message.substr(0, i);
    message = message.substr(i+1);
  };

  // Parse out the segments
  try {
    get('cid');
    get('mid');
    get('type');
    parsed.data = message;
  } catch (err) {
    return null;
  }

  // Convert the x-www-form-urlencoded body into an obj
  parsed.data = JSON.parse(parsed.data);

  // Handle data formats
  convertObj(parsed.data);

  return parsed;
};

var convertDataDown = function(data) {
  var ndata = {};

  for (var i in data) if (data.hasOwnProperty(i)) {
    var d = data[i];
    var t = 'u';

    if (d === null) {
      t = 'n';
    } else if (d === undefined) {
      t = 'u';
    } else if (d instanceof Date) {
      t = 'd';
      d = +d;
    } else if (typeof d == 'string') {
      t = 's';
    } else if (typeof d == 'number') {
      t = 'f';
    } else if (d instanceof Array) {
      t = 'a';
    } else if (typeof d == 'object') {
      t = 'o';
      d = convertDataDown(d);
    } else if (typeof d == 'boolean') {
      t = 'b';
    }

    ndata[t + i] = d;
  }

  return ndata;
};
var serializeData = function(data) {
  data = convertDataDown(data);
  return JSON.stringify(data);
};
var serializeMessage = function(type, data) {
  // Serialize it
  return type.replace(/[^\w-]/, '') + '|' + serializeData(data);
};

var XHRTransport = function(server, url) {
  this.server = server;
  this.url = url;
  this.connections = {};
  this.dcTimeouts = {};
  this.curId = 0;
  this.pollers = {};

  var self = this;

  // Listen for incoming XHR goodness
  server.on('request', function() { self.request.apply(self, arguments) });
  // If the server goes down, wipe out all connections
  server.on('close', function() { self.connections = {} });
};
XHRTransport.prototype = new EventEmitter();
XHRTransport.prototype.request = cors.wrap(function(req, res) {

  // The polling endpoint is a bit of a special case, as it /must/ be
  // accessible via GET, and therefore requires info to be sent in
  // its query params.
  if (req.url.substr(0, this.url.length + 9) == this.url + '/xhr/poll')
    return this.doPoll(req, res);

  switch (req.url) {
    // Handle new clients
    case this.url + '/xhr/connect':
      this.doConnect(req, res);
      break;

    // Handle message sends
    case this.url + '/xhr/send':
      this.doSend(req, res);
      break;

    // Handle friendly disconnects
    case this.url + '/xhr/disconnect':
      this.doDisconnect(req, res);
      break;
  }
});

XHRTransport.prototype.doConnect = function(req, res) {
  var self = this;

  // Generate a unique clientid.  We add a timestamp so that we can
  // differentiate between server restarts.  The client id will be
  // unique in the lifetime of the server (but not across multiple
  // server runs), and the timestamp will be unique across server
  // runs (but not necessarily across the server's lifetime).
  //
  // Together, they're unique.
  cid = ++this.curId + ':' + (+new Date());

  // Create a new connection
  var con = new Connection(this, cid)
  this.connections[cid] = con;
  this.emit('connection', con);

  // Send the CID back to the client
  res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8',
                      'Cache-Control': 'no-cache'});
  res.end(cid);

  // Prep the DC timeout for this connection
  this.dcTimeouts[cid] = setTimeout(function() {
    self.disconnect(con);
  }, 1000 * 30); // 30 second
};

XHRTransport.prototype.doSend = function(req, res) {
  var self = this;

  // Grab the data
  var data = '';
  req.on('data', function(c) { data += c });
  req.on('end', function() {

    // We hold all our messages here, and only send them once they're
    // all parsed.
    var messages = [];

    // Separate out the individual messages
    try {
      while (data.length) {

        // Parse out the message
        var i = data.indexOf('|');
        var length = parseInt(data.substr(0, i));
        var message = data.substr(i + 1, length);

        // Parse the message itself
        var msg = parseMessage(message);

        // Queue the message
        var con = self.connections[msg.cid];
        messages.push(new Message(con, msg.mid, msg.type, msg.data));

        // Prepare to read the next message
        data = data.substr(i + 1 + length);
      }
    // We don't actually handle errors, unfortunately.  We just parse
    // until a failure, and then ignore the rest.
    } catch (err) {};

    // Send the messages on to the connections
    for (var i=0; i<messages.length; i++) {
      try {
        messages[i].connection.emit('message', messages[i]);

      // If there was an error while handling the message, ignore it
      // and keep on sending.
      } catch (err) {}
    }

    // Send a response to the client
    res.writeHead(200, {'Cache-Control': 'no-cache'});
    res.end('ok');

  });
};

XHRTransport.prototype.doPoll = function(req, res) {
  var self = this;

  // The DC functions
  var wipeout = function() {
    res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'}); // `Gone`
    res.end('dc');
  };

  // The sending function
  var send = function() {

    var messages = Array.prototype.slice.call(arguments);

    // We have to listen on close, as this will signify that we failed
    // to send successfully, and we should put the messages back into
    // the connection's pending list
    req.on('close', function() {
      con.pending = messages.concat(con.pending);
    });

    // Serialize and send the messages
    for (var i=0; i<messages.length; i++) {
      var msg = serializeMessage(messages[i][0], messages[i][1]);
      res.write(msg.length + '|' + msg);
    }

    // End the response
    res.end('ok');

    // Add a new DC timeout
    self.dcTimeouts[con.cid] = setTimeout(function() {
      self.disconnect(con);
    }, 1000 * 30); // 30 seconds
  };


  // Fetch the query params
  var params = querystring.parse(_url.parse(req.url).query);
  if (!params || !params.cid) {
    res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8',
                        'Cache-Control': 'no-cache'});
    res.end('Missing cid query param');
    return;
  }

  // Get the connection
  var con = this.connections[params.cid];
  if (!con) return wipeout();

  // Wipe out the disconnect timeout
  clearTimeout(this.dcTimeouts[con.cid]);
  delete this.dcTimeouts[con.cid];

  // Send a success header, so that the client knows it made the
  // connection successfully
  res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8',
                      'Cache-Control': 'no-cache'});

  // If the connection has pending messages to send, do it
  if (con.pending.length) {
    var msgs = con.pending;
    con.pending = [];
    send.apply(this, msgs);

  // Otherwise, wait for messages
  } else {
    this.pollers[con.cid] = [send, function() { res.end('ok') }];
    // If the request gets closed, nuke the poller
    req.on('close', function() {
      delete self.pollers[con.cid];
      req.removeListener('close', arguments.callee);
    });
  }
};

XHRTransport.prototype.doDisconnect = function(req, res) {
  var self = this;

  // The body just contains the client ID, so fetch that
  var cid = '';
  req.on('data', function(c) { cid += c });
  req.on('end', function() {

    // Shut down the connection
    if (self.connections[cid])
      self.disconnect(self.connections[cid]);

    // Return with success
    res.writeHead(200, {'Cache-Control': 'no-cache'});
    res.end('ok');
  });
};

// Notifies the transport that the specified client has data to send.
XHRTransport.prototype.requestSend = function(con) {
  var self = this;

  // If there's an active long poll, fill it up.
  process.nextTick(function() {
    if (self.pollers[con.cid]) {
      var msgs = con.pending;
      con.pending = [];
      self.pollers[con.cid][0].apply(self, msgs);
      delete self.pollers[con.cid];
    }
  });

  // Otherwise, we just kick back and wait for the next connection.

};
// Disconnects a connection
XHRTransport.prototype.disconnect = function(con) {

  // Disconnect a waiting poller
  if (this.pollers[con.cid])
    this.pollers[con.cid][1]();

  // Delete the connection from the list
  delete this.connections[con.cid];
  delete this.pollers[con.cid];

  // Fire the relevant events
  con.emit('disconnect');
  this.emit('disconnect', con);
};

exports.Transport = XHRTransport;
