var ping = require('./handlers/ping'),
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
  'deauth': auth.deauth
};

var handle = function(client, type, data, callback) {
  //validate
  var validationError = false;

  if (type in validators) {
    for (var i in validators[type]) if (validators.hasOwnProperty(i)) {
      //cache type for dry
      var t = validators[type][i];

      // If this field is preset in the client data, it needs to
      // be validated whether it's optional or not.
      if (i in data) {

        //strip the optional flag, since we don't care about here
        if (t[t.length - 1] == '?')
          t = t.substr(0, t.length - 1);

        //ensure types match
        if ((t == 'string' && typeof data[i] != 'string')
        ||  (t == 'number' && typeof data[i] != 'number')
        ||  (t == 'boolean' && typeof data[i] != 'boolean')
        ||  (t == 'object' && typeof data[i] != 'object')
        ||  (typeof data[i] === 'null')
        ||  (typeof data[i] === 'undefined')) {
          validationError = true;
          break;
        }


      // However, if the field is optional then it doesn't need to be
      // there; we only throw a protocol error if the field is required
      // and missing.
      } else if (data[i[data[i].length - 1]] != '?') { //ends with ?
        callback('error-protocol');
        break;
      }
    }
  // If we don't even have a validator for this message type, there's
  // definitely a validation error;
  } else {
    validationError = true;
  }

  // If we don't have a handler for this type, yep, it's a validation
  // error.
  if (!validationError && !(type in handlers))
    validationError = true;

  // Handle validation errors
  if (validationError) callback('error-protocol')
  // Or dispatch to the handler if everything's good
  else handlers[type](client, data, function(val) {
    callback(val);
  });
};

exports.handle = handle;
