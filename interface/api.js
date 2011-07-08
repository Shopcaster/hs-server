// Seig heil!
this.spandex = null;

// TODO
//
// * Auth bootstrapping on connect
// * Presence
// * Data read layer
// * Data write layer
// * Reconnect handling
// * Remove deauth

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

  this.emit('newListener', event, listener);

  return this;
};
EventEmitter.prototype.once = function(event, listener) {
  if (!this._onceListeners) this._onceListeners = {};
  if (!this._onceListeners[event]) this._onceListeners[event] = [];
  this._onceListeners[event].push(listeners);

  this.emit('newListener', event, listener);

  return this;
};
EventEmitter.prototype.removeListener = function(event, listener) {
  if (this._listeners && this._listeners[event]) {
    var n = this._listeners[event].indexOf(listener);
    if (n >= 0) this._listeners[event].splice(n, 1);

  } else if (this._onceListeners && this._onceListeners[event]) {
    var n = this._onceListeners[event].indexOf(listener);
    if (n >= 0) this._onceListeners[event].splice(n, 1);
  }

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
// We have no concept of max listeners...
EventEmitter.prototype.setMaxListeners = function() {};
// NYI
EventEmitter.prototype.listeners = function(event) { throw new Error('Not Yet Implemented') };

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
var messaging = new EventEmitter();
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

    // If the message is a response, fire the appropriate callback
    if (msg.type == 'response' && messaging.callbacks[msg.data.id]) {
      messaging.callbacks[msg.data.id](msg.data);
      delete messaging.callbacks[msg.data.id];

    // Otherwise, pass it on to the correct handler by firing an event
    } else {
      messaging.emit(msg,type, msg.data);
    }
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

  // Active subscriptions

  // Initialize he data layer
  spandex.data = {};
  spandex.models = {};

  // Active subscriptions
  var subs = {};

  // Base subscription class
  var Sub = function(key) {
    // TODO - this is broken
    var self = this;

    this.ready = false;
    this.key = key;
    // Add to the active subscriptions list
    subs[key] = this;
    // Set the reference count
    this.refs = 0;
    // Make the subscription, and notify the _sub listeners
    this._sub(function(data) {
      this.ready = true;

      self.emit('ready', data);
      self.removeAllListeners('ready');
    });
  };
  Sub.prototype = new EventEmitter();
  Sub.prototype._sub = function(callback) {
    var self = this;

    messaging.send('sub', {key: key}, function(err, data) {
      // Handle errors by deleting the subscription
      if (err) {
        delete subs[key];
        console.log('Error while subscribing:', err);
        return;
      }
      // Log bad subs to console
      if (data === false) {
        delete subs[key];
        console.log('Attempted to subscribe to nonexistent key:', key);
        return;
      }
      // Store the data
      self.data = data;

      // Call the callback
      if (callback) callback(data);
    });
  };
  Sub.prototype.resub = function() {
    var self = this;

    this._sub(function(data) {
      self.update(data);
    });
  };
  Sub.prototype.update = function(data) { throw new Error('NYI') };
  Sub.prototype.destroy = function() {
    // Unsub this sub
    messaging.send('unsub', {key: key}, function(err, data) {
      // Handle errors by failing
      if (err) return console.log('Error while unsubbing:', err);
    });

    // And remove ourselves from the list
    delete subs[key];
  };
  Sub.prototype.retain = function() { this.refs++ };
  Sub.prototype.release = function() {
    if (--this.refs < 1) {
      // Don't remove the subscription right away.  Instead, hold it
      // for about 10s in case anybody else wants it in that time.
      var self = this;
      setTimeout(function() {
        if (self.refs < 1) self.destroy();
      }, 10 * 1000);
    }
  };

  // Subscription on a model
  var ModelSub = function() {
    Sub.apply(this, Array.prototype.slice.call(arguments));
  };
  ModelSub.prototype = new Sub();
  ModelSub.prototype.update = function(data) {
    for (var i in data) if (data.hasOwnProperty(i)) {
      // Only update fields if they're different
      if (this.data[i] != data[i]) {
        // Update the field in our internal data storage
        this.data[i] = data[i];
        // Fire the relevant callback
        this.emit('field', i, data[i]);
      }
    }
  };

  // Subscription on a relation
  var RelationSub = function() {
    Sub.apply(this, Array.prototype.slice.call(arguments));
    this.data = [];
  };
  RelationSub.prototype = new Sub();
  RelationSub.prototype.update = function(data) {
    // Add elements
    for (var i=0; i<data.add.length; i++) {
      var x = data.add[i];
      if (this.data.indexOf(x) == -1) this.data.push(x);
    }

    // Remove elements
    for (var i=0; i<data.remove.length; i++) {
      var x = data.remove[i];
      var n = this.data.indexOf(x);
      if (n >= 0)
        this.data.splice(n, 1);
    };

    // Fire the appropriate events
    if (data.add.length)
      this.emit('add', data.add);
    if (data.remove.length)
      this.emit('remove', data.remove);
  };

  // Register a handler for `pub` messages so that we can update
  // the relevant sub
  messaging.on('pub', function(data) {
    if (!subs[data.key]) return console.log('Error: Dangling sub');

    subs[data.key].update(data);
  });

  // The model class
  spandex.models.Model = function(type) {
    this._type = type;  // Model type (e.g. 'listing')
    this._slis = [];    // Listeners we've registered on the sub
    this._sub = null;   // The current subscription.  Only set if hot.
    this._levents = {}; // The events currently being listened on this model.

    var self = this;
    this.on('newListener', function(event, listener) {
      if (event != 'newListeners') self._levents[event] = true;
    });
  };
  spandex.models.Model.prototype = new EventEmitter();
  spandex.models.Model.prototype.related = {};
  spandex.models.Model.prototype.heat = function() {
    if (this.hot) throw new Error('Model is already hot');

    // This is a helper function that bootstraps all the data.
    var bootstrap = function(data) {
      for (var i in data) if (data.hasOwnProperty(i)) {
        //only update if needed
        if (self[i] != data[i]) {
          self[i] = data[i];
          self.emit(i, data[i]);
        }
      }
    };

    // Subscribe for changes.
    var self = this;
    // Grab an existing sub for this key, or create one
    this._sub = subs[this.key] || new Sub(this.key);
    // If the sub isn't ready we should listen on the ready event
    // so we can update data.
    if (!this._sub.ready)
      this._sub.on('ready', bootstrap) && this._slis.push(['ready', bootstrap]);
    // If the sub is ready, we need to just bootstrap the data from
    // it directly.
    else
      bootstrap(this._sub.data);

    // Listen on field events
    var field = function(field, val) {
      // The sub already checks whether the field changed before firing
      // the field event.
      self[i] = val;
      self.emit(i, val);
    };
    this._sub.on('field', field);

    // Push the field event listeners so we can remove it
    this._slis.push(['field', field]);

    // Finally, mark this model as hot
    this.hot = true;
    return this;
  };
  spandex.models.Model.prototype.freeze = function() {
    if (!this.hot) throw new Error('Model is already cold');

    // Unsubscribe all registered events on the sub
    for (var i=0; i<this._slis.length; i++) {
      var ev = this._slis[i];
      this._sub.removeListener(ev[0], ev[1]);
    }
    this._slis = [];
    // Decrease the reference count of the base sub
    this._sub.release();
    this._sub = null;
    // Unregister all events registered on this model
    for (var i=0; i<this._levents.length; i++) {
      var event = this._levents[i];
      this.removeAllListeners(event)
    }
    this._levents = {};

    // Finally, mark this model as cold
    this.hot = false;
    return this;
  };

  // The IDList class
  spandex.models.IDList = function(type) { this._type = type; };
  spandex.models.IDList.prototype = new EventEmitter();

  // Data initialization
  for (var i=0; i<config.models.length; i+=2) {
    var type = config.models[i];
    var ptype = config.models[i+1];

    // Create and register the model for this type
    var M = function(key) {
      this.hot = false;
      this.key = key;
    };
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

      // TODO - make the query
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
      if (fields.length == 0) { // Default field

      } else if (fields.length == 1) { // Explicit field

      } else { // Field chain

      }
    };
  };



})();

})();
