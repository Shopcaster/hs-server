var db = require('../db'),
    models = require('../models'),
    querying = require('../querying');

var query = function(client, data, callback, errback) {

  // Handle listings
  if (data.type == 'listing') data.type = 'item';

  // Grab the query
  if (!data.query) {
    var q = {};
  } else {
    var q = querying[data.query];
    if (!q) return callback([]);

    // Apply the parameters
    q = q.make(data.params || {});
  }

  // The db query callback
  var finish = function(err, objs) {

    // If there was an error, let 'em know
    if (err) {
      console.log('Error running ' + data.query + ' query:');
      console.log(err.stack);
      return errback('Database Error');
    }

    // Since we're given objects, we must convert to ids
    var ids = [];
    for (var i=0; i<objs.length; i++)
      ids.push(objs[i]._id);

    // Fire the callback with the IDs
    return callback(ids);
  };

  // Run the query
  if (data.sort)
    db.query(models[data.type], q, [data.offset || 0, Math.min(data.limit || 100, 100)], data.sort, finish);
  else
    db.query(models[data.type], q, [data.offset || 0, Math.min(data.limit || 100, 100)], finish);
};

exports.query = query;
