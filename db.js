var mongo = require('mongodb'),
    uuid = require('./util/uuid'),
    EventEmitter = require('events').EventEmitter;

///////////////////////////////
// Utility
///////////////////////////////

var makeId = function(collection, callback) {
  return collection + '/' + uuid.uuid4();
}

var niceIds = {};
var makeNiceId = function(collection, callback) {

  // If we already have a nice ID stored for this collection, return
  // it as a string, and increment it.
  if (niceIds.hasOwnProperty(collection)) return callback(collection + '/' + (niceIds[collection]++));

  // Otherwise, we just need to count the number of items in the
  // collection and initialize the nice id counter to that value.

  // Grab the collection from the db
  db.collection(collection, function(err, col) {

    // On an error, fail horribly.
    if (err) {
      console.log('Unable to open collection ' + collection + ':');
      console.log(err.stack);
      console.log('');
      process.exit();
    }

    // Count the number of objects in the collection to generate
    // the friendly ID.
    col.count(function(err, n) {

      // On an error, fail horribly.
      if (err) {
        console.log('Unable to count objects in collection ' + collection + ':');
        console.log(err.stack);
        console.log('');
        process.exit();
      }

      // Set the nice id counter
      niceIds[collection] = n + 1; //do 1-based counting

      // Execute makeNiceId again, which will result in it using the
      // cached version to return the id to the caller.  This keeps
      // that logic in one place.
      makeNiceId(collection, callback);

    });

  });
};

var ensureIndex = function(collection, field, type) {
  db.collection(collection, function(err, col) {

    // Fail on errors
    if (err) {
      console.log('Unable to ensure index on collection ' + collection + ':' + field);
      console.log(err.stack);
      console.log('');
      return;
    }

    // Set the index.
    var s = {};
    s[field] = type;
    col.ensureIndex(s, function() {});
  });
};

///////////////////////////////
// DB Stuff
///////////////////////////////

var db;

var init = function(host, port, name, callback) {
  db = new mongo.Db(name, new mongo.Server(host, port, {}));
  db.open(function(err, p_client) {
    // If we get an error opening the database, we need to fail
    // hard because there's nothing else to do if we can't read/store
    // data.
    if (err) {
      console.log('    Unable to open database connection!');
      process.exit();
    } else {
      // If the DB name is "test", we automatically clear the DB when
      // we connect.
      if (name == 'test') {
        console.log('    Dropping database...');
        db.dropDatabase(function(err) {

          // Loudly continue one rror
          if (err)
            console.log('    Unable to drop database');

          callback();
        });
      } else {
        callback();
      }
    }
  });
};

var apply = function() {
  // Checking for zero arguments here makes things easier down the
  // road.
  if (!arguments.length) return;

  // Shift out the callback if it's there
  var callback;
  if (typeof arguments[arguments.length - 1] == 'function')
    callback = arguments[--arguments.length];

  // Countdown used for determining when to fire the callback
  var opCount = arguments.length;

  //process each fieldset
  for (var i=0; i<arguments.length; i++) {
    var fs = arguments[i];

    //event type
    var eventType = !fs._id ? 'create' : fs.deleted ? 'delete' : 'update';

    //set the updated date
    fs.modified = new Date();

    //perform the upsert
    var upsert = function() {
      db.collection(fs.getCollection(), function(err, col) {
        //ye olde error dump
        if (err) return console.log(err.stack, '');

        // This is where it gets a little funky.  Upserting with an
        // id doesn't work for update.  So we clone the FS, remove
        // the id, and use it for the query.
        var nfs = fs.clone();
        var nid = fs._id;
        delete nfs._id;

        col.update({_id: nid}, {'$set': nfs}, {upsert: true, safe: true}, function(err) {
          //ye olde error dump
          if (err) return console.log(err.stack, '');

          //send the event, with the cloned fieldset so event
          //handlers can't clobber the original
          if (!err)
            events.emit(eventType, fs.clone());

          // If all the inserts are done, fire the callback
          if (--opCount == 0 && callback) callback();
        });
      });
    };

    // If there's no ID, it's a new record and we need to set up
    // the default fields and create an id.
    if (!fs._id)
      //generate an id for it
      fs.bootstrap().genId(upsert);
    else
      upsert();
  }
};

var get = function(fs, callback) {

  // If there's no ID we can't get the object
  if (!fs._id) {
    console.log('Attempting to call get on a fieldset with no _id');
    return callback(true);
  }

  // Grab the appropriate collection
  db.collection(fs.getCollection(), function(err, col) {

    // Log errors and pass them on down
    if (err) {
      console.log(err.stack);
      return callback(true);
    }

    // Get the object from the collection
    col.find({_id: fs._id}).limit(1).nextObject(function(err, obj) {

      // Log errors and pass them on down
      if (err) {
        console.log(err.stack)
        return callback(true);
      }

      // If the object is null, return with an error
      if (!obj)
        return callback(false, false);

      // Fix the fields
      fs.merge(obj);
      callback(false, true);
    });
  });
};

var queryOne = function(type, q, callback) {
  q.deleted = false;

  if (!type.prototype.getCollection) console.log('Type is not a fieldset class') || callback(true);
  else db.collection(type.prototype.getCollection(), function(err, col) {
    if (err) console.log(err.stack) || callback(true);
    else col.find(q).limit(1).nextObject(function(err, obj) {
      if (err) console.log(err.stack) || callback(true);
      else callback(false, obj && new type().merge(obj));
    });
  });
};

/* type, q, [[offset, limit]], [sort], callback */
var query = function(type, q) {

  // Magic args
  var args = Array.prototype.slice.call(arguments);

  var callback = args.pop();
  var offset = 0;
  var limit = 0;
  if (args.length > 2) {
    offset = offset || args[2][0];
    limit = limit || args[2][1];
  }
  var sort = undefined;
  if (args.length > 3)
    sort = args[3] || undefined;

  // Don't query deleted fields
  q.deleted = {$ne: true};

  var typeName = '';
  if (typeof type == 'string') {
    throw new Error('Must supply a FieldSet instance as the type');
  } else if (type && type.prototype && type.prototype instanceof FieldSet) {
    typeName = type.prototype.getCollection();
    var genType = function() { return new type(); };
  } else {
    console.log('Type is not a FieldSet or String');
    console.log('type: ', type);
    console.log('');
    throw new Error('Type must be a FieldSet or String');
  }

  db.collection(typeName, {}, function(err, col) {
    if (err) {
      console.log(err.stack);
      console.log('');
      return callback(err);
    }

    // Prepare query options.
    var options = {};

    // Offset
    if (offset) options.skip = offset;
    if (limit) options.limit = limit;

    // Sort
    if (sort) {
      if (sort[0] == '-')
        options.sort = [sort.substr(1), 'desc'];
      else if (sort[0] == '+')
        options.sort = sort.substr(1);
      else
        options.sort = osrt;
    }

    // Base query
    var f = col.find(q, options);

    // Run the query and fetch the individual things
    f.toArray(function(err, objs) {
      if (err) {
        console.log(err.stack || err)
        return callback(err);
      }

      var fss = [];
      for (var i=0; i<objs.length; i++)
        fss.push(genType().merge(objs[i]));
      callback(false, fss);
    });
  });
};

///////////////////////////////
// FieldSets
///////////////////////////////

var FieldSet = function(collection) {
  //require collection
  if (!collection)
    throw new Error('Must set collection name when creating a fieldset');

  this.getCollection = function() {
    return collection;
  };
};
FieldSet.prototype.genId = function(callback) {
  this._id = makeId(this.getCollection());
  if (callback) callback();

  return this;
};
FieldSet.prototype.clone = function() {
  //create the new fieldset
  var fs = new this.constructor();

  //copy the fields over
  for (var i in this) if (this.hasOwnProperty(i))
    fs[i] = this[i];

  //and return it
  return fs;
};
FieldSet.prototype.merge = function(from) {
  for (var i in from) if (from.hasOwnProperty(i))
    this[i] = from[i];

  return this;
};
FieldSet.prototype.bootstrap = function(id) {
  this._id = id;
  this.created = this.modified || new Date();
  this.deleted = false;

  return this;
};

///////////////////////////////
// Exports
///////////////////////////////

exports.init = init;
exports.apply = apply;
exports.get = get;
exports.queryOne = queryOne;
exports.query = query;
exports.makeNiceId = makeNiceId;
exports.ensureIndex = ensureIndex;

exports.FieldSet = FieldSet;

///////////////////////////////
// Events Hack
///////////////////////////////
var events = new EventEmitter();
events.setMaxListeners(0); // TO THE MOOOOOON
exports.events = events;
