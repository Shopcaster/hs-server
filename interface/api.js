// TODO
//
// * Auth bootstrapping on connect
// * Data read layer (relations)
// * Reconnect handling
// * Presence (boiling in connection stuff)
// * Redo deauth
// * data -> get, nonexistant returns null
//

//
// Expects the following to exist:
//
//   JSON.stringify :: Object -> String
//   JSON.parse :: String -> Object
//   sha256 :: String -> String
//   io.Socket :: [Constructor] String -> Object -> unit
//   log :: (Variable args) -> unit
//   localStorage :: Object
//   setTimeout :: Function -> Number -> Object
//
// As well as:
//
//   zzConf
//   {
//     server:
//     {
//       host: String,
//       port: [String|Number]
//     },
//     logging: // Optional, as are all properties
//     {
//       connection: bool,
//       outgoing: [outgoing message types: bool]
//       incoming: [incoming message types: bool]
//     }
//   }
//


// Global closure
(function() {

// "Import" the conf
var zzConf = conf.zz;

// Global config
config = {};
// Allowable models
config.datatypes = [
  // singular, plural
  'listing', 'listings',
  'offer', 'offers',
  'user', 'users',
  'convo', 'convos',
  'message', 'messages',
  'inquiry', 'inquiries'
];

//
// Node.js style EventEmitter
//
var EventEmitter = function EventEmitter() {};
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
  this._onceListeners[event].push(listener);

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
  var args = Array.prototype.slice.call(arguments);
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
// Initialize the zz object
//
var ZZ = function() {};
ZZ.prototype = new EventEmitter();
zz = new ZZ();

//export EventEmitter
zz.EventEmitter = EventEmitter

//
// Misc zz settings
//
zz.waitThreshold = 500;

//
// Logging Setup
//
zz.logging = {};
zz.logging.connection = true;
zz.logging.responses = true;
zz.logging.incoming = {
  pub: false,
  presence: false,
  not: false
};
zz.logging.outgoing = {
  ping: false,
  error: false,
  auth: false,
  deauth: false,
  passwd: false,
  sub: false,
  unsub: true,
  create: false,
  update: false,
  'delete': false,
  'sub-presence': false,
  'unsub-presence': false
};

// Friendly log
var log = function() {
  console && console.log.apply(console, Array.prototype.slice.call(arguments));
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
  // Actively pending responses
  var pendingResponses = 0;

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
    console.log(msg);
    msg = messaging.deserialize(msg);

    // Log the message if we're configured to do so
    if (zz.logging.incoming[msg.type]) log(msg.type, msg.data);

    // If the message is a response, fire the appropriate callback
    if (msg.type == 'response' && messaging.callbacks[msg.data.id]) {
      messaging.callbacks[msg.data.id](msg.data);
      delete messaging.callbacks[msg.data.id];

    // Otherwise, pass it on to the correct handler by firing an event
    } else {
      messaging.emit(msg.type, msg.data);
    }
  };
  // Sends a message
  messaging.send = function(msg, data, callback) {
    console.log(msg, data);
    // Create this message's ID
    var id = messaging.id++;

    // Log if we're asked to
    if (zz.logging.outgoing[msg]) log(msg, id, data);

    // Default data
    data = data || {};

    // Update the data with the message ID
    data.id = id;

    // Set up a timeout to fire if this response takes too long
    var to = setTimeout(function() {
      // Increment the pending responses count.  If it was 0 prior to
      // this, then we need to fire the `waiting` event on zz.
      if (pendingResponses++ == 0)
        zz.emit('waiting');

      // Clear the callback handle so that the response callback knows
      // it was fired.
      to = null;
    }, zz.waitThreshold);

    // Register the callback for this message's response
    messaging.callbacks[id] = function(data) {

      // If the timeout was fired, decrement the pending responses count
      // and fire the `done` message if it's back to 0
      if (to === null) {
        if (--pendingResponses === 0)
          zz.emit('done');
      // Otherwise, just clear the timeout
      } else {
        clearTimeout(to);
      }

      // Log the response if needed
      if (zz.logging.responses && zz.logging.outgoing[msg])
        log('response', id, data.value);

      // If there's no callback, break early
      if (!callback) return;

      // Dispatch to the callback for this ID, if it exists
      if (data.error) callback(new Error(data.error));
      else callback(undefined, data.value);
    };


    // Fire the message
    connection.send(messaging.serialize(msg, data));
  };
})();

//
// Connection Logic
//
var connection = new EventEmitter();
(function() {
  var con = new io.Socket(zzConf.server.host, {
    secure: false,
    port: zzConf.server.port
  });

  var delayedMessages = [];

  // Set up logging
  con.on('connect', function() {
    if (zz.logging.connection)
      log('Connect');

    // Attempt to reauth
    zz.auth(undefined, undefined, function() {

      // Send all the delayed messages
      for (var i=0; i<delayedMessages.length; i++)
        try { con.send.call(con, delayedMessages[i]) }
        catch(err) { log(err) }

      // Call the callbacks
      connection.emit('connect');
    });
  });
  con.on('disconnect', function() {
    if (zz.logging.connection)
      log('Disconnect');
    connection.emit('disconnect');
  });

  connection.send = function(msg) {
    // If the connection is ready pass everything through
    if (con.connected) con.send.call(con, msg);
    // Otherwise, delay the messages
    else delayedMessages.push(msg);
  };
  connection.connect = function() {
    con.connect();
  };
  connection.disconnect = function() {
    con.disconnect();
  };

  // Register the message handler
  con.on('message', messaging.handleMessage);
  // Bootstrap it
  con.connect();

  // Set the `init` function here.  It doesn't actually trigger the
  // init, but doesn't fire until init is over.
  zz.init = function(callback) {
    if (con.connected) callback();
    else connection.once('connect', callback);
  };
})();

//
// Ping
//
zz.ping = function(callback) {
  messaging.send('ping', null, function() {
    if (callback) callback();
    else log('pong');
  });
};

//
// Error
//
zz.recordError = function(err) {
  messaging.send('error', err);
};

//
// Auth
//
(function() {

  var bootstrapAuth = function() {
    // Initialize data from local storage
    var email = localStorage['zz.auth.email'] || null,
        password = localStorage['zz.auth.password'] || null;

    // Bootstrap -- if we have a stored email/password, try to auth with
    // them.
    if (email && password) zz.auth(email, password, function(err, user) {

      // If something went wrong, nuke the auth info
      if (err) {
        delete localStorage['zz.auth.email'];
        delete localStorage['zz.auth.password'];
        return;
      }
    });
  };

  var _AuthUserCur = null;
  var AuthUser = function(user, email) {
    var self = this;

    _AuthUserCur = user;
    _AuthUserCur.heat();

    this.email = email;

    // Wire up the data
    var self = this;
    var fields = ['name', 'avatar'];
    for (var i=0; i<fields.length; i++) with ({i: i}) {
      this[fields[i]] = user[fields[i]];
      user.on(fields[i], function(val) {
        self[fields[i]] = val;
      });
    }
  };
  AuthUser.prototype = new EventEmitter();
  AuthUser.prototype.destroy = function() {
    _AuthUserCur.freeze();
    _AuthUserCur = null;
  };

  var connectionAuthed = false;

  zz.auth = function(email, password, callback) {

    // Can't auth if we're already authed
    if (connectionAuthed) throw new Error('Already authed');

    // If both email and password are undefined, try to use the
    // stored credentials
    if (email === undefined && password === undefined) {
      email = localStorage['zz.auth.email'] || null;
      password = localStorage['zz.auth.password'] || null;

      // If either of those credentials was missing from local storage
      // then fail now via the callback
      if (email === null || password === null)
        callback(new Error("Cannot auth with stored credentials because they're missing"));
    }

    // If the password doesn't appear to be of hashed form, do that
    // for them.
    if (password && !password.match(/^[A-F0-9]{64}$/))
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
      localStorage['zz.auth.email'] = email;
      localStorage['zz.auth.password'] = ret.password;

      // This connection is now authed for its lifetime
      connectionAuthed = true;
      connection.on('disconnect', function() { connectionAuthed = false; });

      // Fetch the appropriate user object
      zz.data.user(ret.userid, function(user) {

        // Save the new current user
        curUser = new AuthUser(user, email);

        // Success callback
        callback && callback(undefined);

        // Emit the change event
        zz.auth.emit('change');
      });
    });
  };
  // Turn zz.auth into an event emitter by creating a new one and
  // monkey patching in all its functions
  with ({l: new EventEmitter}) {
    for (var i in l) if (typeof l[i] == 'function')
      zz.auth[i] = l[i];
  }

  zz.auth.changePassword = function(old, password, callback) {

    // Send the passwd message
    messaging.send('passwd', {old: old, password: password}, function(err, value) {

      // Handle user errors
      if (!err && !value) err = new Error(zz.auth.user ? 'Old password was incorrect'
                                                            : "Can't change password when not logged in");

      // Pass errors through
      if (err) return callback && callback(err);

      // Save the new password to local storage
      localStorage['zz.auth.password'] = value;

      // Return success to the callback
      callback && callback(undefined);
    });
  };

  zz.auth.deauth = function(callback) {
    delete localStorage['zz.auth.email'];
    delete localStorage['zz.auth.password'];

    curUser = null;

    connection.disconnect();
    connection.connect();

    callback && callback();
  };

  // The user we're authenticated as, which is null to start
  var curUser = null;
  zz.auth.curUser = function() {
    return curUser;
  };

})();

//
// Presence
//
(function() {
  zz.presence = new EventEmitter();
  zz.presence.status = 'offline';

  // Helpers
  var setOffline = function() {
    zz.presence.status = 'offline';
    zz.presence.emit('offline');
  };
  var setOnline = function() {
    zz.presence.status = 'online';
    zz.presence.emit('online');
  };
  var setAway = function() {
    setOffline();
  };

  // Set up events
  connection.on('disconnect', setOffline);
  connection.on('connect', setOnline);

  zz.presence.offline = function() {
    if (zz.presence.status == 'offline') return;
    connection.disconnect();
  };

  zz.presence.online = function() {
    if (zz.presence.status == 'online') return;
    connection.connect();
  };

  zz.presence.away = function() {
    // Eventually we'll add real away support
    zz.presence.offline();
  };
})();

//
// Data read layer logic
//
(function() {

  // Initialize he data layer
  zz.data = {};
  zz.models = {};

  // Active subscriptions
  var subs = {};

  // Base subscription class
  var Sub = function(key) {

    // Slight kludge; if key isn't present we just bail, since
    // it's probably just another subclass settings it as prototype.
    if (!key) return;

    var self = this;

    this.ready = false;
    this.key = key;
    // Add to the active subscriptions list
    subs[key] = this;
    // Set the reference count
    this.refs = 0;
    // Make the subscription, and notify the _sub listeners
    this._sub(function(data) {
      self.ready = true;

      self.emit('ready', data);
      self.removeAllListeners('ready');
    });
  };
  Sub.prototype = new EventEmitter();
  Sub.prototype._sub = function(callback) {
    var self = this;

    messaging.send('sub', {key: this.key}, function(err, data) {

      // Handle errors by deleting the subscription
      if (err) {
        delete subs[self.key];
        log('Error while subscribing:', err);
        return;
      }
      // Log bad subs to console
      if (data === false) {
        delete subs[self.key];
        log('Attempted to subscribe to nonexistent key:', self.key);
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
    messaging.send('unsub', {key: this.key}, function(err, data) {
      // Handle errors by failing
      if (err) return log('Error while unsubbing:', err);
    });

    // And remove ourselves from the list
    delete subs[this.key];
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
    if (!subs[data.key]) return log('Error: Dangling sub');

    subs[data.key].update(data.diff);
  });
  // Whenever auth changes, we have to resub everything.
  zz.init(function() {
    connection.on('connect', function() {
      for (var i in subs) if (subs.hasOwnProperty(i))
        subs[i].resub();
    });
  });

  // The model class
  zz.models.Model = function(type) {
    this._type = type;  // Model type (e.g. 'listing')
    this._slis = [];    // Listeners we've registered on the sub
    this._sub = null;   // The current subscription.  Only set if hot.
    this._levents = {}; // The events currently being listened on this model.
    this.hot = false;   // Default hot state.

    var self = this;
    this.on('newListener', function(event, listener) {
      if (event != 'newListeners') self._levents[event] = true;
    });
  };
  zz.models.Model.prototype = new EventEmitter();
  zz.models.Model.prototype.related = {};
  zz.models.Model.prototype.heat = function() {
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
    this._sub = subs[this._id] || new ModelSub(this._id);
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
      self[field] = val;
      self.emit(field, val);
    };
    this._sub.on('field', field);

    // Push the field event listeners so we can remove it
    this._slis.push(['field', field]);

    // Increase the sub's retain count
    this._sub.retain();

    // Finally, mark this model as hot
    this.hot = true;
    return this;
  };
  zz.models.Model.prototype.freeze = function() {
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
  zz.models.IDList = function(type) { this._type = type; };
  zz.models.IDList.prototype = new EventEmitter();

  // Helper function -- ensures we have a sub for the specified key
  // and fires the callback when the sub is ready
  var _get = function(key, callback) {
    var sub = subs[key] || new ModelSub(key);
    if (!sub.ready) {
      sub.on('ready', callback);
    } else {
      callback(sub.data);
    }
  };

  // Data initialization
  for (var i=0; i<config.datatypes.length; i+=2) {
    var type = config.datatypes[i];
    var ptype = config.datatypes[i+1];

    // Create and register the model for this type
    zz.models[type[0].toUpperCase() + type.substr(1)] = function() {};
    var M = zz.models[type[0].toUpperCase() + type.substr(1)];
    M.prototype = new zz.models.Model(type);

    // Add the relation
    with ({type: type, ptype: ptype, M: M}) {
      zz.models.Model.prototype.related[ptype] = function() {

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
      zz.data[type] = function() {

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
          throw new Error('Fetching through fields is invalid with a string argument');

        // If the thing is an object, we need to do a bit of work to
        // get the fields ID we're looking for.
        if (typeof thing == 'object') {
          // If no fields were specified and the thing was an object, we
          // need to get the ID from the default fild on that object.
          if (fields.length == 0)
            thing = thing[type];

          // If there's just a single field specified, we need to just
          // use an explicit field from the object to get the ID.
          else if (fields.length == 1)
            thing = thing[fields[0]];

          // Otherwise, we need to fetch multiple fields through multiple
          // objects.  This is pretty simple to do -- just
          else return _get(thing[fields.shift()], function(data) {
            var type = data._id.split('/')[0];
            zz.data[type].apply(this, [data].concat(fields.concat([callback])));
          });
        }

        // At this point, thing is a string set to the key of the thing
        // we're looking for.  We can do a basic get on that key and
        // then return it to the client.
        _get(thing, function(data) {

          // Clone the data into the appropriate model
          var m = new M(thing);
          for (var i in data) if (data.hasOwnProperty(i))
            m[i] = data[i];

          // Return the model to the user
          callback(m);
        });
      };
    }
  }
})();

//
// Data creation
//
zz.create = {};
for (var i=0; i<config.datatypes.length; i+=2) {
  with ({type: config.datatypes[i]}) {
    zz.create[type] = function(data, callback) {
      messaging.send('create', {type: type, data: data}, function(err, ret) {
        if (err)
          throw new Error('Failed to create ' + type + ': ' + err.message);
        else if (!ret)
          throw new Error('Validation error when creating ' + type);

        callback && callback(ret);
      });
    };
  }
}

//
// Data update
//
zz.update = {};
for (var i=0; i<config.datatypes.length; i+=2) {
  with ({type: config.datatypes[i]}) {
    zz.update[type] = function(key, diff, callback) {
      // Update can either be passed an ID, or a model
      var key = typeof key == 'string' ? key
                                       : key._id;

      messaging.send('update', {key: key, diff: diff}, function(err, ret) {
        if (err)
          throw new Error('Failed to update ' + type + ': ' + err.message);
        else if (!ret)
          throw new Error('Validation error when updating ' + type);

        callback && callback();
      });
    };
  }
}

// End global closure
})();
