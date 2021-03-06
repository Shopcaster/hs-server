var querystring = require('querystring'),
    _url = require('url'),
    EventEmitter = require('events').EventEmitter,
    Connection = require('./connection').Connection,
    Message = require('./connection').Message,
    _messages = require('./messages'),
    cors = require('../util/cors');

// TODO - proper shutdown, and shutdown()

var XHRTransport = function(server, url) {
  this.server = server;
  this.url = url;
  this.connections = {};
  this.dcTimeouts = {};
  this.curId = 0;
  this.pollers = {};
  this.paused = {};

  var self = this;

  // Listen for incoming XHR goodness
  server.on('request', function() { self.request.apply(self, arguments) });
  // If the server goes down, wipe out all connections
  server.on('close', function() { self.connections = {} });
};
XHRTransport.prototype = new EventEmitter();
XHRTransport.prototype.constructor = XHRTransport;

XHRTransport.prototype._startDCTimeout = function(cid) {
  var self = this;

  // If the DC timeout is already active, do nothing
  if (this.dcTimeouts[cid]) return false;

  // Set the timeout
  this.dcTimeouts[cid] = setTimeout(function() {
    self.disconnect(self.connections[cid]);
  }, 1 * 60 * 1000); // 1m
  return true;
};
XHRTransport.prototype._stopDCTimeout = function(cid) {
  // If there's no DC timeout active for this cid, do nothing
  if (!this.dcTimeouts[cid]) return false;

  // Remove the timeout
  clearTimeout(this.dcTimeouts[cid]);
  delete this.dcTimeouts[cid];
  return true;
};

XHRTransport.prototype.request = cors.wrap(function(req, res) {

  // Parse the url into something a bit more usable
  var url = _url.parse(req.url);
  var query = querystring.parse(url.query);

  // Pull the cid from the querystring
  var cid = query.cid;

  // Match on just the path
  switch (url.pathname) {

    // Handle new clients
    case this.url + '/xhr/connect':
      this._doConnect(req, res, cid);
      break;

    // Handle friendly disconnects
    case this.url + '/xhr/disconnect':
      this._doDisconnect(req, res, cid);
      break;

    // Handle message sends
    case this.url + '/xhr/send':
      this._doSend(req, res, cid);
      break;

    // Handling polling
    case this.url + '/xhr/poll':
      this._doPoll(req, res, cid);
      break;

    // Handle keepalive
    case this.url + '/xhr/pause':
      this._doPause(req, res, cid);
      break;

    // Special debug endpoint
    case this.url + '/xhr/_debug':
      this._doDebug(req, res);
      break;
  }
});

XHRTransport.prototype._doDebug = function(req, res) {
  var output = '' +
  '<!doctype html><html>' +
    '<head>' +
      '<title>Croquet Debug Info</title>' +
      '<style>' +
        'th, td {border: 1px solid black; padding: 3px;}' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<h2>Basic Info</h2>' +
      '<h4>Base URL: ' + this.url + '</h4>' +
      '<h2>Active Connections</h2>' +
      '<table>' +
        '<tr>' +
          '<th>Connection ID</th>' +
          '<th>State</th>' +
          '<th>Connection Duration</th>' +
          '<th>Has Active Poller</th>' +
          '<th>Has Active DC Timeout</th>' +
        '</tr>';

  var td = function(str) {
    output += '<td>' + str + '</td>';
  };
  for (var i in this.connections) if (this.connections.hasOwnProperty(i)) {
    output += '<tr>';

    // CID
    td(i);
    // State
    td(this.paused[i] ? 'Paused' : 'Online');
    // Connection Duration
    td(((+new Date()) - parseInt(i.split(':')[1])) / (1000 * 60) + ' minutes');
    // Has Active Poller
    td(this.pollers[i] ? 'Yes' : 'No');
    // Has Active DC Timeout
    td(this.dcTimeouts[i] ? 'Yes' : 'No');

    output += '</tr>';
  }


  output += '' +
      '</table>' +
    '</body>' +
  '</html>';

  // Simply write the table to the output
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  res.end(output);
};

XHRTransport.prototype._doConnect = function(req, res) {
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
  this._startDCTimeout(cid);
};
XHRTransport.prototype._doDisconnect = function(req, res, cid) {

  // Begin the response right away
  res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8',
                      'Cache-Control': 'no-cache'});

  // Missing cid = danger will robinson
  if (!cid) return res.end('cid');

  // Do the disconnect
  if (this.connections[cid])
    this.disconnect(this.connections[cid]);

  // Give the all clear
  res.end('ok');
};

XHRTransport.prototype._doSend = function(req, res, cid) {
  var self = this;

  // Grab the data
  var data = '';
  req.on('data', function(c) { data += c });
  req.on('end', function() {

    // Being the response
    res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8',
                        'Cache-Control': 'no-cache'});

    // Make sure we've got a valid cid
    if (!cid) return res.end('cid');
    if (!self.connections[cid]) return res.end('dc');
    var con = self.connections[cid];

    // Let the client know everything worked.  We do this *before*
    // trying to handle messages, as it solves a potential race
    // condition where the client thinks the send call has timed
    // out while the server is processing the messages.
    //
    // Assuming it's not a parsing error, all the messages will get
    // handled anyway, so it works the same from the client's
    // perspective.
    res.end('ok');

    // Parse out the messages
    var messages = [];
    try {

      // First, use the message parser
      var msgs = _messages.parse(data);

      // Next we need to convert these into actual Message objects
      for (var i=0; i<msgs.length; i++)
        messages.push(new Message(con, msgs[i].id, msgs[i].type, msgs[i].data));

    // We don't handle messages, unfortunately.  The messages list will
    // always be valid and a parsing error will simply cause us to drop
    // some messages, which is fine.
    } catch (err) {}

    // Send the messages on to the connections
    for (var i=0; i<messages.length; i++) {
      try {
        messages[i].connection.emit('message', messages[i]);

      // If there was an error while handling the message, ignore it
      // and keep on sending.  This way, an event handler can't stop
      // everything be raising an uncaught exception.
      } catch (err) {}
    }

    // Reset the DC timeout if one's running
    if (self._stopDCTimeout(cid))
      self._startDCTimeout(cid);
  });
};

XHRTransport.prototype._doPoll = function(req, res, cid) {
  var self = this;

  // Make sure CID is valid
  if (!cid) {
    res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8',
                        'Cache-Control': 'no-cache'});
    res.end('cid');
    return;
  }

  // Make sure the connection is valid
  var con = this.connections[cid];
  if (!con) {
    res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8',
                        'Cache-Control': 'no-cache'});
    res.end('dc');
    return;
  }

  // Unpause us if we're paused
  if (this.paused[cid]) {
    delete this.paused[cid];
    this.emit('resume', con);
    con.emit('resume');
  }

  // Wipe out the disconnect timeout
  this._stopDCTimeout(cid);

  // If we have stuff to send, do it
  if (con.pending.length) {

    // Begin the response
    res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8',
                        'Cache-Control': 'no-cache'});

    // Grab the messages from the connection
    var messages = con.pending;
    con.pending = [];

    // We have to listen on close, as this will signify that we failed
    // to send successfully, and we should put the messages back into
    // the connection's pending list
    req.on('close', function() {
      con.pending = messages.concat(con.pending);
    });

    // Serialize and send the messages
    res.end(_messages.stringify(messages));

    // Start the DC timeout
    this._startDCTimeout(cid);


  // Otherwise, we need to delay the response by pushing this function
  // curried.
  } else {
    // Set up the curried form
    var f = arguments.callee;
    this.pollers[con.cid] = function() {
      return f.call(self, req, res, cid);
    };

    // We have some cleanup to do if the connection closes prematurely
    req.on('close', function() {

      // Remove from pollers
      delete self.pollers[con.cid];

      // Remove this handler so as not to leak
      req.removeListener('close', arguments.callee);

      // Start the DC timeout again
      self._startDCTimeout(cid);
    });
  }
};
XHRTransport.prototype._doPause = function(req, res, cid) {

  // Make sure the cid actually points to something valid
  var con = this.connections[cid];
  if (!con) {
    res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8',
                        'Cache-Control': 'no-cache'});
    res.end('dc');
    return;
  }

  // Ensure the paused flag is set on this cid
  if (!this.paused[cid]) {
    // Set it
    this.paused[cid] = true;
    // Fire the paused event on the connection
    this.emit('pause', con);
    con.emit('pause');
  }

  // Restart the dc timeout
  if (this._stopDCTimeout(cid))
    this._startDCTimeout(cid);

  // Return success
  res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8',
                      'Cache-Control': 'no-cache'});
  res.end('ok');
};

// Notifies the transport that the specified client has data to send.
XHRTransport.prototype.requestSend = function(con) {
  var self = this;

  // We wait till the next tick in order to batch messages and reduce
  // the number of polling requests required.
  process.nextTick(function() {

    // If there's a live poller we want to use that to send the message
    // right away.
    if (self.pollers[con.cid]) {
      self.pollers[con.cid]();
      delete self.pollers[con.cid];
    }
    // Otherwise, we just just kick back and wait for then ext poll
    // request.  This will automatically pull data from the pending
    // messages, and all is well.
  });
};
// Disconnects a connection
XHRTransport.prototype.disconnect = function(con) {

  // Delete the connection from the list
  delete this.connections[con.cid];

  // Unpause the connection if it happens to be paused
  delete this.paused[con.cid];

  // Disconnect a waiting poller
  if (this.pollers[con.cid])
    this.pollers[con.cid]();
  delete this.pollers[con.cid];

  // Remove the DC timeout
  this._stopDCTimeout(con.cid);

  // Fire the relevant events
  con.emit('disconnect');
  this.emit('disconnect', con);
};

exports.Transport = XHRTransport;
