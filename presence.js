var EventEmitter = require('events').EventEmitter;

var UserState = {
  offline: 0,
  online: 1,
  away: 2
};

// user id -> client id
var clients = {};
// client id -> user id
var users = {};

var setUser = function(clientId, userId) {
  clients[userId] = clientId;
  users[clientId] = userId;

  // fire the event for the userid
  events.emit(userId, UserState.online);
};

var clearUser = function(clientId) {
  uid = users[clientId];
  delete users[clientId];
  delete clients[uid];

  // fire the event for the userid
  events.emit(uid, UserState.offline);
};

var getUserId = function(clientId) {
  return users[clientId];
};

var getState = function(userId) {
  if (clients[userId]) return UserState.online;
  else return UserState.offline;
};

// General Exports
exports.setUser = setUser;
exports.clearUser = clearUser;
exports.getUserId = getUserId;
exports.getState = getState;

// Event handling

var events = new EventEmitter();
events.setMaxListeners(0);
exports.events = events;
