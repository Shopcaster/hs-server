var validate = require('./util/validation').validate,
    ping = require('./handlers/ping'),
    auth = require('./handlers/auth'),
    pubsub = require('./handlers/pubsub'),
    data = require('./handlers/data');

var validators = {
  'ping':   {},
  'auth':   {email: 'string', password: 'string?'},
  'deauth': {},
  'sub':    {key: 'string'},
  'unsub':  {key: 'string'},
  'create': {type: 'string', data: 'object'},
  'update': {key: 'string', diff: 'object'},
  'delete': {key: 'string'}
};

var handlers = {
  'ping': ping.ping,

  'auth': auth.auth,
  'deauth': auth.deauth,

  'sub': pubsub.sub,
  'unsub': pubsub.unsub,

  'create': data.create,
  'update': data.update,
  'delete': data.del
};

var handle = function(client, type, data, callback, errback) {
  try {
    // Validate the data
    if (!validate(validators[type], data)) return errback('Message failed validation');

    // If we don't have a handler for this type, yep, it's a validation
    // error.
    if (!(type in handlers)) return errback('Not Yet Implemented');

    // If we're here, we can dispatch to the handler because
    // everything's good
    handlers[type](client, data, callback, errback);
  } catch (err) {
    errback('Server error');
    console.log(err.stack, '');
  }
};

exports.handle = handle;
