var db = require('./../../db'),
    models = require('./../../models'),
    auth = require('./../auth'),
    external = require('./../../util/external'),
    email = require('./../../email');

var createImg = function(img_b64, callback) {
  var img = new models.File();

  var b = new Buffer(img_b64, 'base64');
  external.run('resize-img', b, function(err, res) {
    // Error handling
    if (err) return callback(true);

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
  fs.creator = auth.getAuth(client).creator;

  // Resize their image
  createImg(data.photo, function(err, id) {

    // Handle errors
    if (err) return errback('Server error');

    // Update the image field
    fs.photo = id;

    // Save the listing
    db.apply(fs, function() {
      // Return the id to the client
      callback(fs._id);

      // Notify the user that their listing was posted
      email.send(auth.getAuth(client).email, 'We\'ve Listed Your Item',
        '<p>Hey, we\'ve listed your item on Hipsell.  You can view it ' +
        '<a href="http://">here</a>.</p>' +
        '<p>We\'ll be cross-posting it to Craigslist shortly, and we\'ll ' +
        'send you another email to let you know when we\'ve finished that ' +
        'process.</p>' +
        '<h4>&ndash; Hipsell</h4>'
        +'<br><br>ps: '+fs._id);
    });
  });
};

var update = function(client, id, diff, callback, errback) {

  // Stuff the data into a fieldset
  var fs = models.Listing();
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

    // Do the resize
    resizeImg(fs.photo, function() {

    });

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

exports.create = create;
exports.update = update;
exports.del = del;
