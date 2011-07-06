var utils = {};
utils.options = {
  options: function(options, merge){
    this.options = utils.merge(options || {}, merge || {});
  }
};

utils.merge = function(source, merge){
  for (var i in merge) source[i] = merge[i];
  return source;
};

var frame = '~m~';

function stringify(message){
  if (Object.prototype.toString.call(message) == '[object Object]'){
    return '~j~' + JSON.stringify(message);
  } else {
    return String(message);
  }
};

utils.encode = function(messages){
  var ret = '', message,
      messages = Array.isArray(messages) ? messages : [messages];
  for (var i = 0, l = messages.length; i < l; i++){
    message = messages[i] === null || messages[i] === undefined ? '' : stringify(messages[i]);
    ret += frame + message.length + frame + message;
  }
  return ret;
};

utils.decode = function(data){
  var messages = [], number, n;
  do {
    if (data.substr(0, 3) !== frame) return messages;
    data = data.substr(3);
    number = '', n = '';
    for (var i = 0, l = data.length; i < l; i++){
      n = Number(data.substr(i, 1));
      if (data.substr(i, 1) == n){
        number += n;
      } else {
        data = data.substr(number.length + frame.length)
        number = Number(number);
        break;
      }
    }
    messages.push(data.substr(0, number)); // here
    data = data.substr(number);
  } while(data !== '');
  return messages;
};

(function () {

var sys = require('sys'),
    WebSocket = require('websocket-client').WebSocket,
    EventEmitter = require('events').EventEmitter,
    io = {};

var Socket = io.Socket = function (host, options) {
  var resource = options.resource || 'socket.io';

  this.url = 'ws://' + host + ':' + options.port + '/' + resource + '/websocket';
  this.connected = false;
  this.sessionId = null;
  this._heartbeats = 0;
  this.buffer = [];
};

Socket.prototype = new EventEmitter;

Socket.prototype.connect = function () {
  var self = this;

  function heartBeat() {
    self.send('~h~' + ++self._heartbeats);
  }

  this.conn = new WebSocket(this.url, 'borf');

  function flush() {
    for (var i = 0; i < self.buffer.length; i++) {
      self.conn.send(self.buffer[i]);
    }
    self.buffer = [];
  }

  this.conn.onopen = function () {
    self.connected = true;
    flush();
    self.emit('connect');
  };

  this.conn.onmessage = function (event) {
    var rawmsg = utils.decode(event.data)[0],
        frame = rawmsg.substr(0, 3),
        msg;

    switch (frame){
      case '~h~':
        return heartBeat();
      case '~j~':
        // The server has sent a JSON object.
        msg = JSON.parse(rawmsg.substr(3));
        break;
      default:
        // The server has sent an unencoded string.
        msg = rawmsg;
    }

    if (msg !== undefined) {
      // The sessionId is the first message received.
      if (self.sessionId === null) {
        self.sessionId = msg;
      } else {
        self.emit('message', msg);
      }
    }
  };

  this.conn.onclose = function () {
    self.emit('disconnect');
    self.connected = false;
  };
};

Socket.prototype.send = function (data) {
  var msg = utils.encode(data);
  if (this.connected) {
    this.conn.send(msg);
  } else {
  this.buffer.push(msg);
  }
};

Socket.prototype.disconnect = function () {
  if (this.connected) {
    // Timeout exists as a workaround for this bug:
    //   https://github.com/pgriess/node-websocket-client/issues#issue/6
    // Remove when websocket bug fixed.
    this.conn.close(0.001);
  }
};


this.io = exports.io = io;

})();
