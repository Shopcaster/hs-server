var EventEmitter = require('events').EventEmitter;

var UserState = {
  offline: 0,
  online: 1,
  away: 2
};

// UserID -> [client, state]
var presence = {};

// Marks a client as online
var online = function(client) {
  // If the client isn't auth'd we can't do presence
  if (!client.state.auth) return;

  // DRY
  var uid = client.state.auth.creator;

  // Set this client to online
  presence[uid] = [client, UserState.online];

  // Fire the event for the userid
  events.emit(uid, UserState.online);
};

// Marks a client as offline
var offline = function(client) {
  //iIf the client isn't auth'd we can't do presence
  if (!client.state.auth) return;

  // DRY
  var uid = client.state.auth.creator;

  // Mark them as offline by removing them from the presence list
  delete presence[uid];

  // Fire the event for the userid
  events.emit(uid, UserState.offline);
};

// Marks a client as away
var away = function(client) {
  // If the client isn't auth'd we can't do presence
  if (!client.state.auth) return;

  // DRY
  var uid = client.state.auth.creator;

  // Mark them as away
  presence[uid] = [client, UserState.away];

  // Fire the event for the userid
  events.emit(uid, UserState.away);
};

var getState = function(uid) {
  if (presence[uid])
    return presence[uid][1];
  else
    return UserState.offline;
};

var getClient = function(uid) {
  return presence[uid] ? presence[uid][0] : null;
};

// General Exports
exports.online = online;
exports.offline = offline;
exports.away = away;
exports.getState = getState;
exports.getClient = getClient;
exports.UserState = UserState;

// Event handling

var events = new EventEmitter();
events.setMaxListeners(0);
exports.events = events;
