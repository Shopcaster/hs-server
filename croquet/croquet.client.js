var croquet = {};
(function() {

  // Bomb out because Opera doesn't support CORS.
  if (navigator && navigator.userAgent.indexOf('opera') > -1) {
    alert('Sorry, but Hipsell uses browser features that Opera does not ' +
          'support.  Please use a different browser (IE, Chrome, and ' +
          'Firefox all work just fine).');
    throw "Opera has no CORS operation, so Croquet won't function :(";
  }

  // Canonicalize XHR, using IE's CORS version if available.  Using
  // this approach, we have CORS across every browser except opera.
  var XHR = (typeof XDomainRequest != undefined) ? XDomainRequest
                                                 : XMLHttpRequest;

  var Message = function(type, data) {
    this.type = type;
    this.data = data;
  };

  var Connection = function(url) {
    this.url = url;
    this.connected = false;
    this.pending = [];
    this.mid = 0;
  };
  Connection.prototype = new EventEmitter();

  Connection.prototype.connect = function() {
    var self = this;

    this.connected = true;

    var xhr = this.connecting = new XHR();
    xhr.open('GET', this.url + '/xhr/connect');
    xhr.send();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        delete self.connecting;

        if (xhr.status === 201) {

          // Basic connection init
          self.cid = xhr.responseText;
          self.emit('connected');

          // Start sending all pending messages every 20ms
          self.startSendLoop();

          // Bootstrap the receive process
          self.startReceiveLoop();

        } else {
          console.log('Error when connecting to server: ' + xhr.status + '.  Retrying in 500ms');
          setTimeout(function() {
            self.connect();
          }, 500); //100 ms
        }

      }
    };
  };
  Connection.prototype.disconnect = function() {

    // Disconnecting an already disconnected connection is a problem
    if (!this.connected)
      throw new Error('Cannot disconnect from an already disconnected connection');

    // If we're marked as disconnected but don't have a cid, it means
    // we have a pending connect call.  We should kill it and move on.
    if (this.connecting) {
      this.connecting.abort();
      delete this.connecting;
      return;
    }

    var self = this;

    this.connected = false;

    var xhr = this.disconnecting = new XHR();
    xhr.open('POST', this.url + '/xhr/disconnect');
    xhr.send(this.cid);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        delete self.disconnecting;

        // Regardless of the response, we've disconnected.
        delete self.cid;
        self.stopSendLoop();
        self.stopReceiveLoop();
      }
    };
  };
  Connection.prototype.send = function(type, data) {
    if (!this.connected)
      throw new Error('Cannot send messages on a disconnected connection');

    this.pending.push([++this.mid, type, data]);

    // Return the message ID so the user can wait for responses.
    return this.mid;
  };

  Connection.prototype.startReceiveLoop = function() {
    var self = this;

    var xhr = this.recv = new XHR();
    xhr.open('GET', this.url + '/xhr/poll?cid=' + this.cid);
    xhr.send();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        delete self.recv;

        // A 200 indicates that we successfully received messages
        if (xhr.status == 200) {

          // Parse messages and raise the events
          var messages = deserializeMessages(xhr.responseText);
          for (var i=0; i<messages.lenth; i++) {
            try {
              self.emit('message', messages[i]);
            // Eat errors to keep the processing going
            } catch (err) {}
          }

          // Continue running the receive loop
          self.startReceiveLoop();

        // A 410 means we've been disconnected
        } else if (xhr.status == 410) {
          self.disconnect();

        // Any other sort of error is wonky, and we should
        // handle it by failing with a disconnect.
        } else {
          self.disconnect();
        }
      }
    };
  };
  Connection.prototype.stopReceiveLoop = function() {
    if (this.recv) this.recv.abort();
  };

  // TODO - the send loop functionality could optimize latency a bit
  //        more
  Connection.prototype.startSendLoop = function() {
    var self = this;

    this.sendTimeout = setTimeout(function() {

      if (self.pending.length) {

        var messages = self.pending;
        self.pending = [];

        var xhr = self.send = new XHR();
        xhr.open('POST', this.url + '/xhr/send');
        xhr.send(serializeMessages(messages));
        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4) {
            delete self.send;

            // 201 indicates success
            if (xhr.status == 201) {

            // Anything else is some sort of weird error.  We should
            // recover by restoring the message queue and disconnecting.
            } else {

              // Restore the message queue
              self.pending = messages.concat(self.pending);

              // Disconnect
              self.disconnect();
            }
          }
        };

      } else {
        self.startSendLoop();
      }
    }, 50); // 50ms
  };
  Connection.prototype.stopSendLoop = function() {
    if (this.sendTimeout) clearTimeout(this.sendTimeout);
    if (this.send) this.send.abort();
  };

  // De/serialization utilities
  var serializeData = function(data) {
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
      }

      ndata[t + i] = d;
    }

    return JSON.stringify(ndata);
  };
  var serializeMessage = function(cid, mid, type, data) {
    return cid + '|' + mid + '|' + type.replace(/[^\w-]/, '') + '|' + serializeData(data);
  };
  var serializeMessages = function() {
    var output = '';

    for (var i=0; i<arguments.length; i++) {
      var message = serializeMessage(arguments[i]);
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
      case 'u':
      default:
        return undefined;
    }
  };
  var deserializeMessage = function(data) {
    var msg = {};
    var i = data.indexOf('|');

    // Parse it out
    msg.type = data.substr(0, i);
    msg.data = data.substr(i + 1);

    // Convert the data to an object
    msg.data = JSON.parse(msg.data);
    for (var i in msg.data) if (msg.data.hasOwnProperty(i)) {
      var d = msg.data[i];
      msg.data[i.substr(1)] = convertData(i.substr(0, 1), d);
      delete msg.data[i];
    }
  };
  var deserializeMessages = function(data) {

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
        todo

        // Queue the message
        var con = self.connections[msg.cid];
        messages.push(new Message(msg.type, msg.data);
      }
    // We don't actually handle errors, unfortunately.  We just parse
    // until a failure, and then ignore the rest.
    } catch (err) {};

    return messages;
  };

  croquet.Connection = Connection;

})();
