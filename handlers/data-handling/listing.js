var db = require('../../db'),
    models = require('../../models'),
    external = require('../../util/external'),
    email = require('../../email'),
    templating = require('../../templating'),
    settings = require('../../settings');

var createImg = function(b, callback) {
  var img = new models.File();

  // If b is a string then handle it like base 64, which means we
  // need to convert it to a buffer.
  if (typeof b == 'string')
    b = new Buffer(img_b64, 'base64');

  external.run('resize-img', b, function(err, res) {
    // Error handling
    if (err) {
      console.log('Error converting image:');
      console.log(res.toString());
      console.log('');
      return callback(true);
    }

    // Create the file object
    var f = new models.File();
    f.data = res;
    f.mime = 'image/jpeg';
    f.generateHash();

    // Save it
    db.apply(f, function() {
      callback(false, f._id);
    });
  });

};

var create = function(client, data, callback, errback) {

  // Move the data into a fieldset
  var fs = new models.Listing();
  fs.merge(data);
  // Set the creator
  fs.creator = client.state.auth.creator;

  // Generate an ID for this fieldset *now* so that we can use it
  // when generating the email autoresponder
  fs.bootstrap().genId(function() {

    // Resize their image
    createImg(data.photo, function(err, id) {

      // Handle errors
      if (err) return errback('Server error');

      // Update the image field
      fs.photo = id;
      // Set up the email autoresponder
      fs.email = email.makeRoute(fs._id.replace('/', '-'), '/iapi/email/' + fs._id);
      // Default accepted offer to null
      fs.accepted = null;
      // Default sold to false
      fs.sold = false;

      // Save the listing
      db.apply(fs, function() {
        // Return the id to the client
        callback(fs._id);

        // Generate the email message
        var msg = templating['email/listing_created'].render({id: fs._id});

        // Notify the user that their listing was posted
        email.send('New Listing', client.state.auth.email, 'We\'ve Listed Your Item', msg);

        // Notify hipsell that the listing was posted, but only in
        // production.
        if (settings.getMode() == 'production')
          email.send(null, 'crosspost@hipsell.com', 'New Listing',
            templating['email/listing_created_cc'].render({id: fs._id}));

      });
    });
  });
};

var update = function(client, id, diff, callback, errback) {

  // Stuff the data into a fieldset
  var fs = new models.Listing();
  fs.merge(diff);
  fs._id = id;

  // Calling this finishes up the update process
  var finish = function() {

    // Apply the diff
    db.apply(fs);

    // Return success
    callback(true);
  };

  // Resize the image if it's present
  if (fs.photo) {

    // TODO

  // Otherwise just finish the update
  } else {
    finish();
  }


};

var del = function(client, id, callback, errback) {

  // Create a deletion fs
  var fs = new models.Listing();
  fs._id = id;
  fs.deleted = true;

  // And apply it to the database
  db.apply(fs);

  // Always return true
  callback(true);
};

// Data Handling exports
exports.create = create;
exports.update = update;
exports.del = del;

// Misc Exports

// Temp for IAPI posting
exports.createImg = createImg;
