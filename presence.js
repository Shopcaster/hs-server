var EventEmitter = require('events').EventEmitter;

var UserState = {
  offline: 0,
  online: 1,
  away: 2
};

// user id -> client
var online = {};
// user id -> bool
var away = {};

// Marks a client as online
var online = function(client) {
  //if the client isn't auth'd we can't do presence
  if (!client.state.auth) return;

  //dry
  var uid = client.state.auth.creator;

  //track this client as online
  if (!online[uid] || away[uid]) {
    online[uid] = client;
    delete away[uid];

    //fire the event for the userid
    events.emit(uid, UserState.online);
  }
};

// Marks a client as offline
var offline = function(client) {
  //if the client isn't auth'd we can't do presence
  if (!client.state.auth) return;

  //dry
  var uid = client.state.auth.creator;

  //mark them as offline by removing them from the online list
  delete online[uid];

  //fire the event for the userid
  events.emit(uid, UserState.offline);
};

// Marks a client as away
var away = function(client) {
  //if the client isn't auth'd we can't do presence
  if (!client.state.auth) return;

  //dry
  var uid = client.state.auth.creator;

  //if the user isn't online then they can't be away
  if (!online[uid]) return;

  //mark 'em as away
  away[uid] = true;

  //fire the event for the userid
  events.emit(uid, UserState.away);
};

var getState = function(uid) {
  if (online[uid]) {
    if (away[uid])
      return UserState.away;
    else
      return UserState.online;
  } else {
    return UserState.offline;
  }
};

var getClient = function(uid) {
  return online[uid];
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
