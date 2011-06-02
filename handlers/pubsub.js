var keys = require('./../util/keys'),
    func = require('./../util/functional'),
    db = require('./../db'),
    auth = require('./auth');

// clientid -> {key, killer}
var subs = [];

var sub = function(client, data, callback, errback) {
  // If the client has no sub hash, we have some setup to do
  if (!(client.id in subs)) {
    // Create them a sub hash
    subs[client.id] = {};
    // When the client disconnects, clear each sub and then delete
    // the sub hash.
    client.on('disconnect', function() {
      for (var sub in subs[client.id]) if (subs[client.id].hasOwnProperty(sub)) {
        subs[client.id][sub].kill();
      }
      delete subs[client.id];
    });
  }

  // Break up the key into its components
  var key = keys.parse(data.key);
  if (!key) return errback('Bad key format');

  // Listen on non-relation
  if (!key.relation) {

    // Subscribe on that key
    subs[client.id][data.key] = func.efilter(db.events, 'update')
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
      return fs.getCollection() = key.relation.type
          && fs[key.relation.field] = key.id;
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
    subs[client.id][data.key] = func.efilter(db,events, ['create', 'update'])
      (filter).run(function(fs) { send(fs._id) });

    // Get the IDs
    // TODO
    ids = [];

    // Send the ID's down to the client
    callback(ids);
  }
};

var unsub = function(client, data, callback, errback) {
  var wasSubbed = false;
  var id = client.id;

  // Try to find the sub
  if (subs[id]) {
    for (sub in subs[id]) if (subs[id].hasOwnProperty(sub)) {
      // If we found it, call the killer and remove the sub
      if (sub == data.key) {
        subs[id][sub]();
        delete subs[id][sub];
        wasSubbed = true;
        break;
      }
    }
  }

  return callback(wasSubbed);
};

exports.sub = sub;
exports.unsub = unsub;
