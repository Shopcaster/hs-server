var keys = require('./../util/keys'),
    func = require('./../util/functional'),
    db = require('./../db'),
    auth = require('./auth');

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
  var key = keys.parse(data.key);
  if (!key) return errback('Bad key format');

  // Listen on non-relation
  if (!key.relation) {

    // Subscribe on that key
    client.state.subs[data.key] = func.efilter(db.events, 'update')
    (function(fs) {
      return fs.getCollection() == key.type
          && fs._id == key.id;
    })
    .run(function(fs) {
      // No need to send the ID field along
      delete fs._id;

      client.send('pub', {
        key: data.key,
        diff: fs
      });
    });

    // Try to fetch the object from the database and send it to the
    // client
    var obj = new db.FieldSet(key.type);
    obj._id = key.id;
    db.get(obj, function(err, exists) {
      if (err === true) errback('Database error');
      else if (!exists) callback(false);
      else callback(obj);
    });

  // Listen on the relation
  } else {
    // Util/DRY
    var filter = function(fs) {
      return fs.getCollection() == key.relation.type
          && fs[key.relation.field] == key.id;
    };
    var send = function(add, remove) {
      client.send('pub', {
        key: data.key,
        diff: {
          add: add,
          remove: remove
        }
      });
    };

    // Register the subscription
    // TODO - delete
    client.state.subs[data.key] = func.efilter(db.events, ['create', 'update'])
      (filter).run(function(fs) { send([fs._id]) });

    // Get the IDs
    db.queryRelated(key.relation.type, key.relation.field, key.id, function(err, ids) {

      // Handle errors
      if (err) return errback('Database Error');

      // Send the ID's down to the client
      callback(ids);
    });
  }
};

var unsub = function(client, data, callback, errback) {
  var wasSubbed = false;
  var id = client.id;

  // Try to find the sub
  if (client.state.subs) {
    for (sub in client.state.subs) if (client.state.subs.hasOwnProperty(sub)) {
      // If we found it, call the killer and remove the sub
      if (sub == data.key) {
        client.state.subs[sub]();
        delete client.state.subs[sub];
        wasSubbed = true;
        break;
      }
    }
  }

  return callback(wasSubbed);
};

exports.sub = sub;
exports.unsub = unsub;
