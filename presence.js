var EventEmitter = require('events').EventEmitter;

var UserState = {
  offline: 0,
  online: 1,
  away: 2
};

// user id -> client
var online = {};

// Marks a client as online
var online = function(client) {
  //if the client isn't auth'd we can't do presence
  if (!client.state.auth) return;

  //dry
  var uid = client.state.auth.creator;

  //track this client as online
  online[uid] = client;

  // fire the event for the userid
  events.emit(uid, UserState.online);
};

// Marks a client as offline
var offline = function(client) {
  //if the client isn't auth'd we can't do presence
  if (!client.state.auth) return;

  //dry
  var uid = client.state.auth.creator;

  //mark them as offline by removing them from the online list
  delete online[uid];

  // fire the event for the userid
  events.emit(uid, UserState.offline);
};

var getState = function(uid) {
  if (online[uid]) return UserState.online;
  else return UserState.offline;
};

// General Exports
exports.online = online;
exports.offline = offline;
exports.getState = getState;
exports.UserState = UserState;

// Event handling

var events = new EventEmitter();
events.setMaxListeners(0);
exports.events = events;
