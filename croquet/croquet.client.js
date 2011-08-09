// TODO  - exponential backoff on connection or poll failure
//       - more robust connection handling
//       - handle repeated connect/disconnect calls

var croquet = {};
(function() {

  // Canonicalize XHR, using IE's CORS version if available.  Otherwise,
  // check that XMLHttpRequest is available with CORS and use that.  If
  // neither of those are true, bail.
  var XHR = null;
  if (typeof XDomainRequest != 'undefined') {
    XHR = XDomainRequest;
  } else if (typeof(new XMLHttpRequest().withCredentials) !== 'undefined') {
    XHR = XMLHttpRequest;
  } else {
    alert("Sorry, but your browser doesn't support security features " +
          "(specifically, CORS) required by Hipsell to operate.  Please " +
          "use a different browser; modern versions of Internet Explorer, " +
          "Chrome, Firefox, and Safari all work just fine.");
    throw "CORS is not supported, which means Croquet won't function :(";
  }


  var Message = function(type, data) {
    this.type = type;
    this.data = data;
  };

  var Connection = function(url) {
    this.url = url;
    this.connected = false;
    this.pending = [];
    this.mid = 0;
    this._conAttempts = 0;
  };
  Connection.prototype = new EventEmitter();
  Connection.prototype.constructor = Connection;

  Connection.prototype._xhr = function(method, path, data, callback) {
    // Magic arguments
    if (typeof data == 'function') {
      callback = data;
      data = undefined;
    }

    var xhr = new XHR();
    xhr.onreadystatechange = function() {
      switch (xhr.readyState) {
        case 4:
          clearTimeout(timeout);
          callback();
          break;
      }
    };

    xhr.open(method, this.url + path, true);
    xhr.send(data);

    // Set up a timeout; if the xhr doesn't complete in 30s, we kill
    // it manually.  This will trigger the callback, with the xhr's
    // status being 0 -- just like a connection failure.
    var timeout = setTimeout(function() {
      //console.log('Failed request to ' + path);
      xhr.abort();
    }, 30 * 1000);

    return xhr;
  };

  Connection.prototype.connect = function() {
    // Handle multiple connects graciously
    if (this._reallyConnected || this.connecting)
      return;

    var self = this;

    this.connected = true;

    var xhr = this.connecting = this._xhr('GET', '/xhr/connect', function() {
      delete self.connecting;

      if (xhr.status === 201) {

        // Basic connection init
        self.cid = xhr.responseText;
        self._reallyConnected = true;
        self.emit('connect');

        // Start sending all pending messages every 20ms
        self.startSendLoop();

        // Bootstrap the receive process
        self.startReceiveLoop();

        // Clear connection attempts
        self._conAttempts = 0;

      } else {
        self._conAttempts++;
        var t = Math.log(self._conAttempts) / Math.log(1.2);
        console.log('Error when connecting to server: ' + xhr.status + '.  Retrying in ' + t + 's');
        setTimeout(function() {
          self.connect();
        }, 1000 * t);
      }

    });
  };
  Connection.prototype.disconnect = function() {

    // Optimize disconnecting an already disconnected connection
    if (!this.connected)
      return;

    // If we're marked as disconnected but don't have a cid, it means
    // we have a pending connect call.  We should kill it and move on.
    if (this.connecting) {
      this.connecting.abort();
      delete this.connecting;
      return;
    }

    var self = this;

    // Set status to disconnected immediately in order to prevent
    // further messages from being sent.
    this.connected = false;

    var xhr = this.disconnecting = this._xhr('POST', '/xhr/disconnect', this.cid, function() {
      delete self.disconnecting;
      self._setDisconnected();
    });
  };
  Connection.prototype._setDisconnected = function() {
    if (!this._reallyConnected) return;

    this._reallyConnected = false;
    this.connected = false;
    delete self.cid;
    this.stopSendLoop();
    this.stopReceiveLoop();

    // Fire the event
    this.emit('disconnect');
  };

  Connection.prototype.send = function(id, type, data) {
    if (!this.connected)
      throw new Error('Cannot send messages on a disconnected connection');

    this.pending.push([this.cid, id, type, data]);
  };

  Connection.prototype.startReceiveLoop = function() {
    var self = this;

    var xhr = this._recv = this._xhr('GET', '/xhr/poll?cid=' + this.cid, function() {
      delete self._recv;

      // A 200 indicates that we successfully received messages
      if (xhr.status == 200) {

        // Parse messages and raise the events
        var messages = deserializeMessages(xhr.responseText);
        for (var i=0; i<messages.length; i++) {
          try {
            self.emit('message', messages[i]);
          // Eat errors to keep the processing going
          } catch (err) {
            console.log(err.stack);
          }
        }

        // Continue running the receive loop
        if (self.connected)
          self.startReceiveLoop();

      // A 410 means we've been disconnected
      } else if (xhr.status == 410) {
        self._setDisconnected();

      // Any other sort of error is wonky, but we don't need to do
      // a full disconnect.  Instead, we just need to restart the
      // poll.
      } else {
        if (self.connected)
          self.startReceiveLoop();
      }
    });
  };
  Connection.prototype.stopReceiveLoop = function() {
    if (this._recv) this._recv.abort();
  };

  // TODO - the send loop functionality could optimize latency a bit
  //        more
  Connection.prototype.startSendLoop = function() {
    var self = this;

    // If the loop has already started, do nothing.
    if (this.sendTimeout) return;

    this.sendTimeout = setTimeout(function() {
      delete self.sendTimeout;


      if (self.pending.length) {

        var messages = self.pending;
        self.pending = [];

        var data = serializeMessages.apply(this, messages);
        var xhr = self._send = self._xhr('POST', '/xhr/send', data, function() {
          delete self._send;

          // 201 indicates success
          if (xhr.status == 201) {

            // Continue sending
            self.startSendLoop();

          // Anything else is some sort of weird error.  We should
          // recover by restoring the message queue and continuing to
          // try to send after a short delay.
          } else {

            // Restore the message queue
            self.pending = messages.concat(self.pending);

            // Resume the send loop after a little bit
            self.sendTimeout = setTimeout(function() {
              self.startSendLoop();
            }, 100); // 100 ms
          }
        });
      } else {
        self.startSendLoop();
      }
    }, 50); // 50ms
  };
  Connection.prototype.stopSendLoop = function() {
    if (this.sendTimeout) {
      clearTimeout(this.sendTimeout);
      delete this.sendTimeout
    }
    if (this._send) {
      this._send.abort();
      delete this.sendTimeout;
    }
  };

  // De/serialization utilities
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
  var serializeMessage = function(cid, mid, type, data) {
    return cid + '|' + mid + '|' + type.replace(/[^\w-]/, '') + '|' + serializeData(data);
  };
  var serializeMessages = function() {
    var output = '';

    for (var i=0; i<arguments.length; i++) {
      var message = serializeMessage.apply(this, arguments[i]);
      output += message.length + '|' + message;
    }

    return output;
  };

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
  var deserializeMessage = function(data) {
    var msg = {};
    var i = data.indexOf('|');

    // Parse it out
    msg.type = data.substr(0, i);
    msg.data = data.substr(i + 1);

    // Convert the data to an object
    msg.data = JSON.parse(msg.data);
    convertObj(msg.data);

    return msg;
  };
  var deserializeMessages = function(data) {

    // Trim leading whitespace from the data.  This may be added
    // by the server to prevent browsers from buffering.
    data = data.replace(/^\s+/, '');

    // We hold all our messages here, and only send them once they're
    // all parsed.
    var messages = [];

    try {
      while (data.length) {
        // Parse out the message
        var i = data.indexOf('|');
        var length = parseInt(data.substr(0, i));
        var message = data.substr(i + 1, length);

        // Parse the message itself
        var msg = deserializeMessage(message);

        // Queue the message
        messages.push(new Message(msg.type, msg.data));

        // Chopchop
        data = data.substr(i + 1 + length);
      }
    // We don't actually handle errors, unfortunately.  We just parse
    // until a failure, and then ignore the rest.
    } catch (err) {
      console.log(err.stack);
    };

    return messages;
  };

  croquet.Connection = Connection;

})();
