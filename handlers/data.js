var validate = require('./../util/validation').validate,
    keys = require('./../util/keys'),
    db = require('./../db'),
    auth = require('./auth');

var validators = {
  'user': {name: 'string?',
           avatar: 'string?'},

  'listing': {photo: 'string?',
              description: 'string?',
              latitude: 'number?',
              longitude: 'number?',
              price: 'number?'},

  'offer': {amount: 'number?',
            listing: 'ref?'},

  'message': {message: 'string?',
              offer: 'ref?'},

  'inquiry': {question: 'string?',
              answer: 'string?',
              listing: 'ref?'}
};

var create = function(client, data, callback, errback) {
  // Don't let unauthed clients create
  if (!auth.getAuth(client)) return errback('Access denied');

  // Do some basic validation
  if (!data.type in validators) return errback('Invalid type');
  if (!validate(validators[data.type], data.data)) return errback('Invalid field');

  // For now we can literally just stuff the data in a new fieldset
  var fs = new db.FieldSet(data.type);
  fs.merge(data.data);
  // Creator field is required on everything
  fs.creator = auth.getAuth(client)._id;

  // Do the save!
  db.apply(fs, function() {
    // Return the ID to the client
    callback(fs._id);
  });
};

var update = function(client, data, callback, errback) {
  // Don't let unauthed clients update
  if (!auth.getAuth(client)) return errback('Access denied');

  // Try to parse the key
  var key = keys.parse(data.key);
  if (!key || key.relation) return errback('Invalid key');

  // Do some basic validation
  if (!key.type in validators) return errback('Invalid type');
  if (!validate(validators[key.type], data.diff)) return errback('Invalid field');

  // Stuff the data into a fieldset
  var fs = new db.FieldSet(key.type);
  fs.merge(data.diff);
  fs._id = key.id;

  // Apply the diff
  db.apply(fs, function() {
    callback(true);
  });
};

var del = function(client, data, callback, errback) {
  // Don't let unauthed clients delete
  if (!auth.getAuth(client)) return errback('Access denied');

  // Try to parse the key
  var key = keys.parse(data.key);
  if (!key || key.relation) return errback('Invalid key');

  // Create a deletion fs
  var fs = new FieldSet(key.type);
  fs._id = key.id;
  fs.deleted = true;

  // Apply the diff
  db.apply(fs);

  // Return true
  callback(true);
};

exports.create = create;
exports.update = update;
exports.del = del;
