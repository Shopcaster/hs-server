var mongo = require('mongodb'),
    func = require('./functional'),
    events = require('events');

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

var merge = function(from, into) {

};

///////////////////////////////
// DB Stuff
///////////////////////////////

var db;

var init = function(host, port, callback) {
  db = new mongo.Db('hipsell', new mongo.Server(host, port, {}));
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

    //if the fs doesn't have an _id, we need to set its created date
    if (!fs._id) fs.created = fs.modified;

    //if there's no id, generate one
    if (!fs._id)
      fs.genId(upsert);
    else
      upsert();

    //perform the upsert
    var upsert = function() {
      db.collection(fs.constructor.name, function(err, col) {
        //todo - error handling

        col.update({_id: fs._id}, fs, {upsert: true}, function(err) {
          //todo - error handling

          //send the event
          if (!err)
            events.emit(eventType, fs);
        });
      });
    };
  }
};

var get = function(fs, callback) {
  if (!fs._id) callback(true);
  else db.collection(fs.constructor.name, function(err, col) {
    if (err) callback(true);
    else col.find({_id: fs._id}).limit(1).nextObject(function(err, obj) {
      if (err) callback(true);
      else merge(obj, fs) || callback(false);
    });
  });
};

///////////////////////////////
// FieldSets
///////////////////////////////

var FieldSet = function() {};
FieldSet.prototype.genId = function(callback) {
  this._id = makeId();
  if (callback) callback();
};

///////////////////////////////
// Exports
///////////////////////////////

exports.init = init;
exports.apply = apply;
exports.get = get;
exports.makeNiceId = makeNiceId;

exports.FieldSet = FieldSet;

///////////////////////////////
// Events Hack
///////////////////////////////
var events = new events.EventEmitter();

for (var i in events) if (events.hasOwnProperty(i))
  exports[i] = events[i]
