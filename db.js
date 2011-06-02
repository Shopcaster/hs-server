var mongo = require('mongodb'),
    func = require('./functional'),
    EventEmitter = require('events').EventEmitter;

///////////////////////////////
// Utility
///////////////////////////////

var makeId = function() {
  var out = "";
  for (var i=0; i<8; i++)
    out += (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  return out;
};

var makeNiceId = function(namespace) {
  //todo
};

var merge = function(into, from) {
  for (var i in from) if (from.hasOwnProperty(i))
    into[i] = from[i];

  return true;
};

///////////////////////////////
// DB Stuff
///////////////////////////////

var db;

var init = function(host, port, name, callback) {
  db = new mongo.Db(name, new mongo.Server(host, port, {}));
  db.open(function(err, p_client) {
    if (err) {
      console.log('Unable to open database connection!');
      process.exit();
    } else {
      callback();
    }
  });
};

var apply = function() {

  //process each fieldset
  for (var i=0; i<arguments.length; i++) {
    var fs = arguments[i];

    //event type
    var eventType = fs._id ? 'update' : 'create';

    //set the updated date
    fs.modified = new Date().getTime();

    //if the fs doesn't have a created, we need to set its created date
    if (!fs.created) fs.created = fs.modified;

    //if there's no deleted field, add one
    if (fs.deleted === undefined)
      fs.deleted = false;

    //perform the upsert
    var upsert = function() {
      db.collection(fs.getCollection(), function(err, col) {


        //todo - error handling

        col.update({_id: fs._id}, fs, {upsert: true}, function(err) {
          //todo - error handling

          //send the event, with the cloned fieldset so event
          //handlers can't clobber the original
          if (!err)
            events.emit(eventType, fs.clone());
        });
      });
    };

    //if there's no id, generate one
    if (!fs._id)
      fs.genId(upsert);
    else
      upsert();
  }
};

var get = function(fs, callback) {
  if (!fs._id) callback(true);
  else db.collection(fs.getCollection(), function(err, col) {
    if (err) callback(true);
    else col.find({_id: fs._id}).limit(1).nextObject(function(err, obj) {
      if (err) callback(true);
      else if (!obj) callback(false, false);
      else merge(fs, obj) && callback(false, true);
    });
  });
};

var queryOne = function(type, q, callback) {
  if (!type.prototype.getCollection) callback(true);
  else db.collection(type.prototype.getCollection(), function(err, col) {
    if (err) callback(true);
    else col.find(q).limit(1).nextObject(function(err, obj) {
      if (err) callback(true);
      else callback(false, obj);
    });
  });
};

///////////////////////////////
// FieldSets
///////////////////////////////

var FieldSet = function(collection) {
  //require collection
  if (!collection)
    throw new Error('Must set collection name when created a fieldset');

  this.getCollection = function() {
    return collection;
  };
};
FieldSet.prototype.genId = function(callback) {
  this._id = makeId();
  if (callback) callback();
};
FieldSet.prototype.clone = function() {
  var fs = function() {};
  fs.prototype = new FieldSet(this.getCollection());

  for (var i in this) if (this.hasOwnProperty(i))
    fs[i] = this[i];

  return fs;
};

///////////////////////////////
// Exports
///////////////////////////////

exports.init = init;
exports.apply = apply;
exports.get = get;
exports.queryOne = queryOne;
exports.makeNiceId = makeNiceId;

exports.FieldSet = FieldSet;

///////////////////////////////
// Events Hack
///////////////////////////////
var events = new EventEmitter();
exports.events = events;
