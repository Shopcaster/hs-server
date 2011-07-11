var ids = require('./../util/ids'),
    func = require('./../util/functional'),
    db = require('./../db'),
    auth = require('./auth'),
    mongo = require('mongodb');

// FAIR WARNING:
//   This is one hell of a complicated module.  Bring your towel.
//

var sub = function(client, data, callback, errback) {
  // If the client has no sub hash, we have some setup to do
  if (!(client.state.subs)) {
    // Create them a sub hash
    client.state.subs = {};
    // When the client disconnects, clear each sub and then delete
    // the sub hash.
    client.on('disconnect', function() {
      for (var sub in client.state.subs) if (client.state.subs.hasOwnProperty(sub)) {
        client.state.subs[sub].kill();
      }
      delete client.state.subs;
    });
  }

  // If the client is already sub'd on this key we should abort
  if (client.state.subs[data.key]) return callback(true);

  // Break up the key into its components
  var key = ids.parse(data.key);

  // Listen on non-relation
  if (key instanceof ids.Key) {

    // Do the initial data fetch
    var obj = new db.FieldSet(key.type);
    obj._id = key.id;
    db.get(obj, function(err, exists) {
      if (err === true) return errback('Database error');
      else if (!exists) return callback(false);

      // Subscribe on the key
      client.state.subs[data.key] = func.efilter(db.events, 'update')
      (function(fs) {
        return fs._id == obj._id;
      }).run(function(fs) {
        // No need to send the ID field along
        delete fs._id;

        // Send along the update
        client.send('pub', {
          key: obj._id,
          diff: fs
        });
      });

      // Send the initial data back to the user
      callback(obj);
    });

  // Listen on the relation
  } else if (key instanceof ids.Query) {
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

    // Register the subscription for creation
    client.state.subs[data.key] = func.efilter(db.events, 'create')
    (function(fs) {
      return fs[key.field] == key.val;
    }).run(function(fs) {
      // Forward created items right down to the client
      send([fs._id]);
    })
    // Register the subscription for deletion
    .join(func.efilter(db.events, 'delete')
    // There's only a  filter here, because we have to do it async.
    // Instead, the run callback basically handles the complex
    // filtering.
    (function(fs) { return fs.getCollection() == key.type })
    .run(function(fs) {

      // Fetch more data for the fieldset
      db.get(fs, function(err) {
        // On error, do nothing
        if (err) return;

        // Make sure we're talking to the right relation
        if (fs[key.relation.field] != key.val) return;

        // Forward deleted items right down to the client
        send([], [fs._id]);
      });
    }));

    // Get the IDs
    var q = {};
    q[key.field] = key.val;
    db.query(key.type, q, function(err, fss) {

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
        client.state.subs[sub].kill();
        delete client.state.subs[sub];

        return callback(true);
      }
    }
  }

  return callback(false);
};

exports.sub = sub;
exports.unsub = unsub;
