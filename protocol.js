var ping = require('./handlers/ping'),
    auth = require('./handlers/auth'),
    pubsub = require('./handlers/pubsub'),
    data = require('./handlers/data');

var handlers = {
  'ping': ping.ping,
  'auth': auth.auth,
  'deauth': auth.deauth
};

var handle = function(client, type, data, callback) {
  if (type in handlers)
    handlers[type](client, data, function(val) {
      callback(val);
    });
  else
    callback('error-protocol');
};

exports.handle = handle;
