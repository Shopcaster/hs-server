var func = require('./../util/functional'),
    presence = require('./../presence');

var sub = function(client, data, callback, errback) {

  //bootstap the state if we need to
  if (!client.state.presenceSubs) {
    //create the sub hash
    client.state.presenceSubs = {};

    //clear all presence subscriptions when the user disconnects
    for (var i in client.state.presenceSubs) if (client.state.presenceSubs.hasOwnProperty(i)) {
      unsub(client, {user: i}, function() {}, function() {});
      delete client.state.presenceSubs;
    }
  }

  //if the client is already sub'd on this presence, bail
  if (client.state.presenceSubs[data.user]) return callback(true);

  //subscribe to this user's presence notifications
  client.state.presenceSubs[data.user] = func.efilter(presence.events, data.user)
    .run(function(state) {
      client.send('presence', {user: data.user, state: state});
    });

  //send the response
  callback(true);

  //send the initial state
  client.send('presence', {user: data.user, state: presence.getState(data.user)});
};

var unsub = function(client, data, callback, errback) {

  client.state.presenceSubs[data.user].kill();
  delete client.state.presenceSubs[data.user];

  callback(true);
};

exports.sub = sub;
exports.unsub = unsub;
