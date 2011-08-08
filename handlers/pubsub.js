var keys = require('../util/keys'),
    db = require('../db'),
    models = require('../models'),
    auth = require('./auth'),
    mongo = require('mongodb');

// FAIR WARNING:
//   This is one hell of a complicated module.  Bring your towel.
//

var sub = function(client, data, callback, errback) {

  // If the client has no sub hash, do some setup
  if (!(client.state.subs)) {
    client.state.subs = {};

    // Clean up handlers on disconnect
    client.on('disconnect', function() {
      unsub(client, {key: data.key}, function() {}, function() {});
    });
  }

  // If the client is already sub'd on this key we should abort
  if (client.state.subs[data.key]) return callback(true);

  // Break up the key into its components
  var key = keys.parse(data.key);

  // Listen on non-relation
  if (key instanceof keys.Key) {

    // Do the initial data fetch
    var obj = new models[key.type]();
    obj._id = key.id;
    db.get(obj, function(err, exists) {
      if (err === true) return errback('Database error');
      else if (!exists) return callback(false);

      // Subscribe on the key
      var sub = function(fs) {
        // Only send along pubs if the ID's match
        if (fs._id != obj._id) return;

        // Don't want to pass the ID field down the line, so
        // delete it here.  This is safe, as the db events are
        // only ever passed copies, and don't share references.
        delete fs._id;

        // Send the pub on down
        client.send('pub', {
          key: obj._id,
          diff: fs
        });
      };

      // Register the handler
      db.events.on('update', sub);

      // Set the subbed status to the handler killer
      client.state.subs[data.key] = function() {
        db.events.removeListener('update', sub);
      };

      // Send the initial data back to the user
      callback(obj);
    });

  // Listen on the relation
  } else if (key instanceof keys.Query) {
    // Util/DRY
    var send = function(add, remove) {
      client.send('pub', {
        key: data.key,
        diff: {
          add: add,
          remove: remove
        }
      });
    };

    // Creation handling
    var createHandler = function(fs) {
      // Ignore anything that isn't of the correct type
      if (fs.getCollection() != key.type) return;

      // Only pass things down if the field is set to the right value
      if (fs[key.field] != key.val) return;

      // Forward the created thing right down to the client
      send([fs._id], []);
    };
    // Deletion handling
    var deleteHandler = function(fs) {
      // Ignore anything that isn't of the correct type
      if (fs.getCollection() != key.type) return;

      // Fetch more data for the fieldset
      db.get(fs, function(err) {
        // On error, do nothing
        if (err) return;

        // Make sure we're talking to the right relation
        if (fs[key.field] != key.val) return;

        // Forward the deleted item right down to the client
        send([], [fs._id]);
      });
    };

    // Register the handlers
    db.events.on('create', createHandler);
    db.events.on('delete', deleteHandler);

    // Set subbed status to the event killer
    client.state.subs[data.key] = function() {;
      db.events.removeListener('create', createHandler);
      db.events.removeListener('delete', deleteHandler);
    };

    // Get the IDs
    var q = {};
    q[key.field] = key.val;
    db.query(models[key.type], q, function(err, fss) {

      // Handle errors
      if (err) return errback('Database Error');

      // Send the ID's down to the client
      var ids = [];
      for (var i=0; i<fss.length; i++)
        ids.push(fss[i]._id);
      callback(ids);
    });
  } else {
    return errback('Bad key format');
  }
};

var unsub = function(client, data, callback, errback) {
  // Try to find the sub
  if (client.state.subs) {
    for (sub in client.state.subs) if (client.state.subs.hasOwnProperty(sub)) {
      // If we found it, call the killer and remove the sub
      if (sub == data.key) {
        client.state.subs[sub]();
        delete client.state.subs[sub];

        return callback(true);
      }
    }
  }

  return callback(false);
};

exports.sub = sub;
exports.unsub = unsub;
