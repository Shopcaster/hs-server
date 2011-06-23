var validate = require('./../util/validation').validate,
    keys = require('./../util/keys'),
    db = require('./../db');

// Validation for all data types goes here
var validators = {
  'user': {name: 'string?',
           avatar: 'string?'},

  'listing': {photo: 'string?',
              description: 'string?',
              latitude: 'number?',
              longitude: 'number?',
              price: 'number?',
              sold: 'boolean?',
              accepted: 'ref?'},

  'offer': {amount: 'number?',
            listing: 'ref?'},

  'message': {message: 'string?',
              convo: 'ref?'},

  'inquiry': {question: 'string?',
              answer: 'string?',
              listing: 'ref?'},

  'convo': {listing: 'ref?'}
};

// Any data type that doesn't have an entry in this object gets the
// default create/update/delete behavior, which is to just insert or
// update all fields verbatim.
var specialHandlers = {
  'listing': require('./data-handling/listing'),
  'offer': require('./data-handling/offer'),
  'inquiry': require('./data-handling/inquiry'),
  'message': require('./data-handling/message')
};

var create = function(client, data, callback, errback) {
  // Don't let unauthed clients create
  if (!client.state.auth) return errback('Access denied');

  // Do some basic validation
  if (!data.type in validators) return errback('Invalid type');
  if (!validate(validators[data.type], data.data)) return errback('Invalid field');

  // Check if we have a special handler for this data type
  if (data.type in specialHandlers) {

    // Delegate to the handler
    specialHandlers[data.type].create(client, data.data, callback, errback);

  // If we don't, do the default, which is to stuff all the fields
  // right into the DB.  This is safe, as we've validated them.
  } else {

    // Just stuff the data in a new fieldset
    var fs = new db.FieldSet(data.type);
    fs.merge(data.data);
    // Creator field is required on everything, so we pull it from this
    // user's auth info.
    fs.creator = client.state.auth.creator;

    // Do the save!
    db.apply(fs, function() {
      // Return the ID to the client
      callback(fs._id);
    });

  }
};

var update = function(client, data, callback, errback) {
  // Don't let unauthed clients update
  if (!client.state.auth) return errback('Access denied');

  // Try to parse the key
  var key = keys.parse(data.key);
  if (!key || key.relation) return errback('Invalid key');

  // Do some basic validation
  if (!key.type in validators) return errback('Invalid type');
  if (!validate(validators[key.type], data.diff)) return errback('Invalid field');

  // Check if we have a special handler for this data type
  if (key.type in specialHandlers) {

    // Delegate to the handler
    specialHandlers[key.type].update(client,
                                      key.id,
                                      data.diff,
                                      callback,
                                      errback);

  // If we don't, do the default, which is to update all fields in
  // the diff.  This is safe, we we've validated them.
  } else {

    // Stuff the data into a fieldset
    var fs = new db.FieldSet(key.type);
    fs.merge(data.diff);
    fs._id = key.id;

    // Apply the diff
    db.apply(fs);

    // Return success
    callback(true);
  }
};

var del = function(client, data, callback, errback) {
  // Don't let unauthed clients delete
  if (!client.state.auth) return errback('Access denied');

  // Try to parse the key
  var key = keys.parse(data.key);
  if (!key || key.relation) return errback('Invalid key');

  // Check if we have a special handler for this data type
  if (key.type in specialHandlers) {

    // Delegate to the handler
    specialHandlers[key.type].del(client, key.id, callback, errback);

  // If we don't, do the default, which is to simply set the deleted
  // flag on the object and save it to the database.
  } else {

    // Create a deletion fs
    var fs = new db.FieldSet(key.type);
    fs._id = key.id;
    fs.deleted = true;

    // Apply the diff
    db.apply(fs);

    // Return true
    callback(true);
  }
};

exports.create = create;
exports.update = update;
exports.del = del;
