var func = require('./../functional'),
    db = require('./../db'),
    auth = require('./auth');

//               type : key [: type.field]
var keyRegex = /^(\w+):(\w+)(:(\w+)\.(\w+))?$/
var parseKey = function(key) {
  var res = keyRegex.exec(key);

  if (!res || res.length < 3) return null;

  // Build the result
  var k = {type: res[1], id: res[2]};
  // If the regex included a relation, include that
  if (res[3])
    k.relation = {type: res[4], field: res[5]};

  return k;
};

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
        subs[client.id][sub]();
      }
      delete subs[client.id];
    });
  }

  // Break up the key into its components
  var key = parseKey(data.key);
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
          key: key.type + ':' + key.id,
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
    return errback('Not Yet Implemented');
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
