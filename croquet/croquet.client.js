var croquet = {};
(function() {

  // We either need XDR support or CORS support.  If we have neither,
  // bomb out.
  var XHR = null;
  if (typeof XDomainRequest == 'undefined' &&
      typeof(new XMLHttpRequest().withCredentials) === 'undefined') {

    alert("Sorry, but your browser doesn't support security features " +
          "(specifically, CORS) required by Hipsell to operate.  Please " +
          "use a different browser; modern versions of Internet Explorer, " +
          "Chrome, Firefox, and Safari all work just fine.");
    throw "CORS is not supported, which means Croquet won't function :(";
  }

  // Our backoff function
  var backoff = function(n) {
    // Log n base 1.2
    Math.log(n) / Math.log(1.2);
  };

  ///////////////////////////////////////
  // Message Stuff
  //////////////////////////////////////

  //
  // The "Croquet Data Format"
  //
  // What this does is convert between straight up JSON and a more typed
  // version.
  //
  var CDF = {};
  CDF.to = function(o) {
    if (o === undefined)
      return {t: 0, v: undefined}

    if (o === null
    || typeof o == 'number'
    || typeof o == 'string'
    || typeof o == 'boolean')
      return {v: o}

    if (o instanceof Date)
      return {t: 1, v: +o}

    if (o instanceof Array) {
      var a = [];
      for (var i=0; i<o.length; i++)
        a.push(arguments.callee(o[i]);
      return {t: 2, v: a};
    }

    if (typeof o == 'object') {
      var obj = {};
      for (var i in o) if (o.hasOwnProperty(i))
        obj[i] = arguments.callee(o[i]);
      return {t: 3, v: obj};
    }

    throw new Error('Unable to convert data ' + o);
  };
  CDF.from = function(o) {
    switch (o.t) {
      case undefined: // not present = use JSON type
        return o.v;

      case 0: // undefined
        return undefined;

      case 1: // date
        return new Date(o.v);

      case 2: // array
        var a = [];
        for (var i=0; i<o.v.length; i++)
          a.push(arguments.callee(o.v[i]));
        return a;

      case 3: //object
        var obj = [];
        for (var i in o.v) if (o.v.hasOwnProperty(i))
          obj[i] = arguments.callee(o.v[i])
        return obj;

      default:
        throw new Error('Unknown type ' + o.t);
    }
  };

  var Message = function Message(type, data, id) {
    this.type = type;
    this.data = data;
    if (id) this.id = id;
  };

  // Stringifies multiple messages
  var stringify = function(messages) {
    // Prep the JSON structure
    var obj = {messages: []};

    // Build the JSON
    for (var i=0; i<messages.length; i++) {
      var msg = {};

      msg.type = messages[i].type;
      msg.data = CDF.to(messages[i].data);
      if (messages[i].id)
        msg.id = messages[i].id;

      obj.messages.push(msg);
    }

    // Return its stringified form
    return JSON.stringify(obj);

  };
  //Parses multiple messages
  var parse = function(str) {
    // Prepare out output list
    var ret = [];

    // Parse the JSON
    var msgs = JSON.parse(str).messages;

    // Convert the data
    for (var i=0; i<msgs.length; i++)
      ret.push(new Message(msgs[i].type, CDF.from(msgs[i].data), msgs[i].id));

    // And we're done
    return ret
  };

  var Connection = function(url) {
    this.status = 'disconnected';
    this.url = url;
    this.pending = [];

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

    // We have a separate codepath for XDomainRequest (the IE version of
    // CORS) and XMLHttpRequest.  Luckily, they share the same general
    // semantics, sending, and cancellation object, so we can share
    // a fair amount of code.
    if (typeof XDomainRequest != 'undefined') {
      var xhr = new XDomainRequest();

      // These are all set to the same.  Alas, we can only infer
      // success based on the presence of body data.
      xhr.onerror = xhr.ontimeout = xhr.onload = function() {
        clearTimeout(timeout);
        xhr.success = !!(xhr.responseText && xhr.responseText.length);
        callback(xhr);
      };
      xhr.timeout = 30 * 1000;
    } else {
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        switch (xhr.readyState) {
          case 4:
            xhr.success = xhr.status == 200;
            clearTimeout(timeout);
            callback(xhr);
            break;
        }
      };
      // Set up a timeout; if the xhr doesn't complete in 60s, we kill
      // it manually.  This will trigger the callback, with the xhr's
      // status being 0 -- just like a connection failure.
      var timeout = setTimeout(function() {
        //console.log('Failed request to ' + path);
        xhr.abort();
      }, 60 * 1000);
    }

    xhr.open(method, this.url + path, true);
    xhr.send(data);

    return xhr;
  };


  //////////////////////////////////////////////
  //  Public Interface
  //////////////////////////////////////////////

  Connection.prototype.connect = function() {
    var self = this;

    // Handle multiple connects gracefully
    if (this.status == 'connecting' || this.status == 'connected')
      return;

    // Begin the connect call
    this._connect = this._xhr('GET', '/xhr/connect', function(xhr) {
      delete self._connect;

      // If we succeeded in the connection, do the required setup work.
      if (xhr.success) {

        // Basic connection init
        self._cid = xhr.responseText;
        self.status = 'connected'
        self.emit('connect');

        // Start sending all pending messages every 20ms
        self._startSendLoop();

        // Bootstrap the poll process
        self._startPollLoop();

        // Clear backoff nums
        self._conAttempts = 0;
        self._pollAttempts = 0;
        self._sendAttempts = 0;

      // If we failed, schedule another connection attempt using
      // logarithmic backoff.
      } else {

        // If our status isn't 'connecting' then we should just accept
        // the failure, as it's been canceled.
        if (self.status != 'connecting') return;

        // Increment the connection attempts counter and get a backoff
        // time
        var t = backoff(self._conAttempts++);

        // Log our intent
        console.log('Error when connecting to server.  Retrying in ' + t + 's');

        // And when that wait time is over, do the connect again
        setTimeout(function() {
          self.connect();
        }, 1000 * t);
      }
    });
  };
  Connection.prototype.disconnect = function() {
    var self = this;

    // If we're not connected or connecting, there's no work to do.
    if (this.status != 'connected' && this.status != 'connecting')
      return;

    // Mark us as disconnecting
    this.status = 'disconnecting';

    // If we have an active connect call in flight, cancel it and then
    // we're done.
    if (this._connect) {
      this._connect.abort();
      this.status = 'disconnected';
      return;
    }

    // Otherwise, we have to do an actual disconnect
    this._disconnect = this._xhr('GET', '/xhr/disconnect?cid=' + this.cid, function(xhr) {
      delete self._disconnect;

      // Do the DC cleanup
      self._setDisconnected();
    });
  };
  Connection.prototype.send = function(id, type, data) {
    if (this.status != 'connected')
      throw new Error('Cannot send messages on a disconnected connection');

    this.pending.push(new Message(type, data, id));
  };
  Connection.prototype.pause = function() {
    if (this.status == 'paused') return;

    var self = this;

    this.status = 'paused';
    this._stopPollLoop();
    this._stopSendLoop();

    // Do a periodic empty send to force the keep alive
    this._kaTimeout = setTimeout(function() {
      delete self._kaTimeout;

      this._ka = this._xhr('GET', '/xhr/send?cid=' + this.cid, '{messages: []}', function(xhr) {
        delete self._ka;
      });

    }, 1 * 60 * 1000); // Once every minute
  }
  Connection.prototype.resume = function() {
    if (this.status != 'paused') return;

    // Remove the keep alive stuff
    if (this._kaTimeout) {
      clearTimeout(this._kaTimeout);
      delete this._kaTimeout;
    }
    if (this._ka) {
      this._ka.abort();
      delete this._ka;
    }

    // Resume the connection
    this.status = 'connected';
    this._startPollLoop();
    this._startSendLoop();
  }


  //////////////////////////////////
  // Misc
  //////////////////////////////////
  Connection.prototype._setDisconnected = function() {
    delete this.cid;
    this.status = 'disconnected';
    this._stopSendLoop();
    this._stopPollLoop();

    this.emit('disconnect');
  };

  //////////////////////////////////
  // Send/Receive Loops
  //////////////////////////////////

  Connection.prototype._startPollLoop = function() {
    var self = this;

    // Clear poll attempts to remove any backoff that may exist
    this._pollAttempts = 0;

    this._poll = this._xhr('GET', '/xhr/poll?cid=' + this.cid, function(xhr) {
      delete self._poll;

      // Handle success
      if (xhr.success) {

        // Reset poll attempts
        self._pollAttempts = 0;

        // If the responsetext is just 'dc', we need to do a disconnect
        // and bail out.  Otherwise, we continue as per usual.
        if (xhr.responseText == 'dc') {
          return self._setDisconnected();
        }

        // Parse messages and raise the events
        var messages = parse(xhr.responseText).messages;
        for (var i=0; i<messages.length; i++) {
          try {
            self.emit('message', messages[i]);
          // Eat errors to keep the processing going
          } catch (err) {

            // Try to use the fancier API's if they're available
            if (console.exception)
              console.exception(err);
            else if (console.error)
              console.error(err.stack);
            else
              console.log(err.stack);
          }
        }

        // Continue running the receive loop
        if (self.status == 'connected')
          self._startPollLoop();

      // Any other sort of error is wonky, but we don't need to do
      // a full disconnect.  Instead, we just need to restart the
      // poll after waiting the required backoff time.
      } else {
        if (self.status == 'connected') {
          setTimeout(function() {
            self._startPollLoop();
          }, backoff(self._pollAttempts++);
        }
      }
    });
  };
  Connection.prototype._stopPollLoop = function() {
    if (this._poll) this._poll.abort();
  };

  Connection.prototype._startSendLoop = function() {
    var self = this;

    // If the loop has already started, do nothing.
    if (this._sendTimeout) return;

    // Clear send attempts to remove any backoff that may exist
    this._sendAttempts = 0;

    // Otherwise, set up a timeout to fire sends within 50ms of eachother
    this._sendTimeout = setTimeout(function() {
      delete self._sendTimeout;

      // If there are messages waiting to be sent, send them.
      if (self.pending.length) {

        // Cache the messages in case we need to put them back in the
        // send list in the case of a send failure.
        var messages = self.pending;
        self.pending = [];

        // Stringify the messages for sending down the wire
        var data = stringify(messages);

        // Do the actual send
        self._send = self._xhr('POST', '/xhr/send?cid=' + self.cid, data, function(xhr) {
          delete self._send;

          // Handle success
          if (xhr.success) {

            // Reset send attempts, which will reset the next backoff
            self._sendAttempts = 0;

            // Continue sending
            self._startSendLoop();

          // Anything else is some sort of weird error.  We should
          // recover by restoring the message queue and continuing to
          // try to send after a backoff
          } else {

            // Restore the message queue
            self.pending = messages.concat(self.pending);

            // Continue to send if we're still connected
            if (self.status == 'connected') {
              // Resume the send loop after a little bit
              self.sendTimeout = setTimeout(function() {
                delete self._sendTimeout;
                self._startSendLoop();
              }, backoff(self._sendAttempts++);
            }
          }
        });

      // If there weren't any messages to send, queue up the timeout
      } else {
        if (self.status == 'connected')
          self._startSendLoop();
      }
    }, 50); // 50ms
  };
  Connection.prototype._stopSendLoop = function() {
    if (this._sendTimeout) {
      clearTimeout(this._sendTimeout);
      delete this._sendTimeout
    }
    if (this._send) {
      this._send.abort();
      delete this._send;
    }
  };

  croquet.Connection = Connection;

})();
