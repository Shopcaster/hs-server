var  presence = require('./../presence');

var sub = function(client, data, callback, errback) {

  //bootstap the state if we need to
  if (!client.state.presenceSubs) {
    //create the sub hash
    client.state.presenceSubs = {};

    //clear all presence subscriptions when the user disconnects
    client.on('disconnect', function() {
      for (var i in client.state.presenceSubs) if (client.state.presenceSubs.hasOwnProperty(i)) {
        unsub(client, {user: i}, function() {}, function() {});
      }
      delete client.state.presenceSubs;
    });
  }

  //if the client is already sub'd on this presence, bail
  if (client.state.presenceSubs[data.user]) return callback(true);

  //subscribe to this user's presence notifications
  var handler = function(state) {
    client.send('presence', {user: data.user, state: state});
  };
  presence.events.on(data.user, handler);
  client.state.presenceSubs[data.user] = handler;

  //send the response
  callback(true);

  //send the initial state
  client.send('presence', {user: data.user, state: presence.getState(data.user)});
};

var unsub = function(client, data, callback, errback) {

  if (client.state.presenceSubs[data.user]) {
    presence.events.removeListener(data.user, client.state.presenceSubs[data.user]);
    delete client.state.presenceSubs[data.user];
  } else {
    console.log('Warning: trying to unsub-presence with no actual sub');
  }

  callback(true);
};

exports.sub = sub;
exports.unsub = unsub;
