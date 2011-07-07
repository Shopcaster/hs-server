// SPANDEX - A temporary name for our flexible protocol library.
this.spandex = null;

// TODO
//
// * Auth bootstrapping on connect
// * Presence
// * Data read layer
// * Data write layer

//
// Expects the following to exist:
//
//   JSON.stringify :: Object -> String
//   JSON.parse :: String -> Object
//   sha256 :: String -> String
//   io.Socket :: [Constructor] String -> Object -> unit
//   console.log :: (Variable args) -> unit
//   localStorage :: Object
//
// As well as:
//
//   spandexConf
//   {
//     server:
//     {
//       host: String,
//       port: String
//     }
//   }
//



(function() {

//
// Node.js style EventEmitter
//
var EventEmitter = function() {};
EventEmitter.prototype = {};

EventEmitter.prototype.on = function(event, listener) {
  if (!this._listeners) this._listeners = {};
  if (!this._listeners[event]) this._listeners[event] = [];
  this._listeners[event].push(listener);

  return this;
};
EventEmitter.prototype.once = function(event, listener) {
  if (!this._onceListeners) this._onceListeners = {};
  if (!this._onceListeners[event]) this._onceListeners[event] = [];
  this._onceListeners[event].push(listeners);

  return this;
};
EventEmitter.prototype.removeListener = function(event, listener) {
  if (this._listeners && this._listeners[event]);
    //todo

  if (this._onceListeners && this._onceListeners[event]);
    //todo

  return this;
};
EventEmitter.prototype.removeAllListeners = function(event) {
  if (this._listeners) delete this._listeners[event];
  if (this._onceListeners) delete this._onceListeners[event];

  return this;
};
EventEmitter.prototype.emit = function() {
  var args = Array.prototype.slice(arguments);
  var event = args.shift();

  // Call regular listeners
  if (this._listeners && this._listeners[event]) {
    for (var i=0; i<this._listeners[event].length; i++)
      this._listeners[event][i].apply(null, args);
  }

  // Call once listeners
  if (this._onceListeners && this._onceListeners[event]) {
    for (var i=0; i<this._onceListeners[event].length; i++)
      this._onceListeners[event][i].call(null, args);

    // Clean up
    delete this._onceListeners[event];
  }

  return this;
};

//
// Initialize the spandex object
//
var Spandex = function() {};
Spandex.prototype = new EventEmitter();
spandex = new Spandex();

//
// Logging Setup
//
spandex.logging = {};
spandex.logging.connection = false;
spandex.logging.incoming = {
  response: false,
  pub: false,
  presence: false,
  not: false
};
spandex.logging.outgoing = {
  ping: false,
  error: false,
  auth: false,
  deauth: false,
  passwd: false,
  sub: false,
  unsub: false,
  create: false,
  update: false,
  'delete': false,
  'sub-presence': false,
  'unsub-presence': false
};

var log = function() {
  if (this.console && console.log) {
    this.console.log.apply(this, Array.prototype.slice.call(arguments));
  }
};

//
// Messaging util
//
var messaging = {};
(function() {
  // Message ID
  messaging.id = 1;
  // Callbacks (id -> callback)
  messaging.callbacks = {};

  messaging.serialize = function(type, data) {
    return type + ':' + JSON.stringify(data);
  };
  messaging.deserialize = function(str) {
    var i = str.indexOf(':');
    if (i < 1)
      throw 'Invalid message: ' + str;
    var type = str.substr(0, i);
    var data = JSON.parse(str.substr(i + 1) || null);

    return {type: type, data: data};
  };

  // Handles incoming messages
  messaging.handleMessage = function(msg) {
    msg = messaging.deserialize(msg);

    // Log the message if we're configured to do so
    if (spandex.logging[msg.type]) log(msg.type, msg.data);

    // Fire the appropriate callback
    messaging.callbacks[msg.data.id](msg.data);
    delete messaging.callbacks[msg.data.id];
  };
  // Sends a message
  messaging.send = function(msg, data, callback) {
    // Default data
    data = data || {};

    // Create this message's ID
    var id = messaging.id++;
    // Update the data to send with the ID
    data.id = id;
    // Register the callback for this message's response
    messaging.callbacks[id] = function(data) {
      // If there's no callback, break early
      if (!callback) return;

      // Dispatch to the callback for this ID, if it exists
      if (data.error) callback(new Error(data.error));
      else callback(undefined, data.value);
    };

    // Fire the message
    con.send(messaging.serialize(msg, data));
  };
})();

//
// Connection Logic
//
var con = null;
(function() {
  con = new io.Socket(spandexConf.server.host, {
    secure: true,
    port: spandexConf.server.port
  });

  // Set up logging
  con.on('connect', function() {
    if (spandex.logging.connection)
      console.log('Connect');
  });
  con.on('disconnect', function() {
    if (spandex.logging.connection)
      console.log('Disconnect');
  });

  // Self explanatory
  spandex.connect = function() {
    con.connect();
  };
  // Also self explanatory
  spandex.disconnect = function() {
    con.disconnect();
    if (spandex.logging.connection)
      console.log('Disconnect');
  };

  // Register the message handler
  con.on('message', messaging.handleMessage);
  // Bootstrap it
  spandex.connect();
})();

//
// Ping
//
spandex.ping = function(callback) {
  messaging.send('ping', null, function() {
    callback();
  });
};

//
// Error
//
spandex.recordError = function(err) {
  messaging.send('error', err);
};

//
// Auth
//
var bootstrapAuth = function() {
  // Initialize data from local storage
  var email = localStorage['spandex.auth.email'] || null,
      password = localStorage['spandex.auth.password'] || null;

  // Bootstrap -- if we have a stored email/password, try to auth with
  // them.
  if (email && password) spandex.auth(email, password, function(err, user) {

    // If something went wrong, nuke the auth info
    if (err) {
      delete localStorage['spandex.auth.email'];
      delete localStorage['spandex.auth.password'];
      return;
    }
  });
};

spandex.auth = function(email, password, callback) {
  // Default password to nothing
  password = password || '';

  // If the password doesn't appear to be of hashed form, do that
  // for them.
  if (!password.match(/^[A-F0-9]{64}$/))
    password = sha256(password + email).toUpperCase();

  // Send the auth message
  messaging.send('auth', {email: email, password: password}, function(err, ret) {

    // If we didn't have an error, check the return value.  If it's
    // false, the auth was bad and we should set that as the error.
    if (!err && !ret)
      err = new Error('Incorrect username or password');

    // Pass errors on to the callback
    if (err) return callback && callback(err);

    // Save the password and the email to local storage for future use
    localStorage['spandex.auth.email'] = email;
    localStorage['spandex.auth.password'] = ret.password;

    // Fetch the appropriate user object
    spandex.data.user(ret.userid, function(err, user) {

      // Pass errors right on through
      if (err) return callback && callback(err);

      // Save the user object so that we can access it later
      spandex.auth.user = user;

      // Success callback
      callback(undefined, user);
    });
  });
};
spandex.auth.deauth = function(callback) {

  // Send the deauth message
  messaging.send('deauth', null, function(err, value) {

    // On an error, wipe out the connection and reconnect
    // TODO

    callback();
  });

};
spandex.auth.changePassword = function(old, password, callback) {

  // Send the passwd message
  messaging.send('passwd', {old: old, password: password}, function(err, value) {

    // Handle user errors
    if (!err && !value) err = new Error(spandex.auth.user ? 'Old password was incorrect'
                                                          : "Can't change password when not logged in");

    // Pass errors through
    if (err) return callback && callback(err);

    // Save the new password to local storage
    localStorage['spandex.auth.password'] = value;

    // Return success to the callback
    callback(undefined);
  });
};

// The user we're authenticated as, which is null to start
spandex.auth.user = null;


//
// Data layer logic
//
(function() {
  // Configuration
  var config = {};
  // Allowable models
  config.models = [
    'listing', 'listings',
    'offer', 'offers',
    'user', 'users'
  ];

  // Initialize he data layer
  spandex.data = {};
  spandex.models = {};

  // The model class
  spandex.models.Model = function(type) { this._type = type; };
  spandex.models.Model.prototype = new EventEmitter();
  spandex.models.Model.prototype.related = {};

  // The IDList class
  spandex.models.IDList = function(type) { this._type = type; };
  spandex.models.IDList.prototype = new EventEmitter();

  // Gets a model by ID
  spandex.data._get = function(id) {

  };

  // Data initialization
  for (var i=0; i<config.models.length; i+=2) {
    var type = config.models[i];
    var ptype = config.models[i+1];

    // Create and register the model for this type
    var M = function() {};
    M.prototype = new spandex.models.Model(type);
    spandex.models[type[0].toUpperCase() + type.substr(1)] = M;

    // Add the relation
    spandex.models.Model.prototype.related[ptype] = function() {

      // Arguments
      var field;
      var callback;

      // Magic arguments
      var args = Array.prototype.slice.call(arguments);
      if (args.length > 1)
        field = args.shift();
      callback = args.shift();
      delete args;

      // Set the default field
      if (!field) field = type;
    };

    // Create the fetcher
    spandex.data[type] = function() {

      // Arguments
      var thing;
      var fields = [];
      var callback;

      // Magic arguments
      var args = Array.prototype.slice.call(arguments);
      thing = args.shift();
      while (args.length > 1)
        fields.push(args.shift());
      callback = args[0];

      // Validate arguments
      if (typeof thing != 'string' && typeof thing != 'object')
        throw new Error('Thing to fetch on must be a string or a Model; ' +
                        'instead it was ' + typeof thing);
      if (!callback || typeof callback != 'function')
        throw new Error('No callback was passed');
      if (typeof thing == 'string' && fields.length)
        throw new Error('Getting through fields is invalid with a string argument');

      // If the thing is a string, it's a key-based
      // get, which is nice and easy to deal with.

      // Otherwise, if the thing is an object we want
      // to use the default field (`type`), or the field
      // chain if it was specified
    };
  };



})();

})();
