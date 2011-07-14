var ids = require('./../util/ids'),
    db = require('./../db'),
    auth = require('./auth'),
    mongo = require('mongodb');

var convert = function(data) {
  // Data conversion on message data
  for (var i in data) if (data.hasOwnProperty(i)) {
    var d = data[i];

    // Date
    if (d instanceof Date)
      data[i] = {type: 'date', val: +d - 1307042003319};
  }

  return data;
};

// FAIR WARNING:
//   This is one hell of a complicated module.  Bring your towel.
//

var sub = function(client, data, callback, errback) {

  // If the client has no sub hash, do some cleanup
  if (!(client.state.subs)) {
    client.state.subs = {};

    // Clean up handlers on disconnect
    client.on('disconnect', function() {
      for (var i in client.state.subs) if (client.state.subs.hasOwnProperty(i)) {
        client.state.subs[i]();
        delete client.state.subs[i];
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
      var sub = function(fs) {
        // Only send along pubs if the ID's match
        if (fs._id != obj._id) return;

        // Don't want to pass the ID field down the line, so
        // delete it here.  This is safe, as the db events are
        // only ever passed copies, and don't share references.
        delete fs._id;

        // Fix up the data
        convert(fs);

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
      callback(convert(obj));
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
