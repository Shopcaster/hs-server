var db = require('./../../db'),
    models = require('./../../models'),
    nots = require('./../../notifications');

var create = function(client, data, callback, errback) {
  // Create the offer object -- this is entirely standard
  var fs = new models.Inquiry();
  fs.merge(data);
  fs.creator = client.state.auth.creator;

  // Save it
  db.apply(fs, function() {
    // Return the ID to the client
    callback(fs._id);

    // Send a notification to the listing's creator about the new
    // question.
    var listing = new models.Listing();
    listing._id = fs.listing;

    // Get the listing so that we know the author's id
    db.get(listing, function(err, success) {
      // Bail on errors
      if (err) return;

      // Send the notification
      nots.send(listing.creator, nots.Types.NewQuestion, fs, listing);
    });
  });
};

var update = function(client, id, diff, callback, errback) {
  // Create a diff fieldset
  var fs = new models.Inquiry();
  fs.merge(diff);
  fs._id = id;

  // Apply it to the database
  db.apply(fs);

  // And return success
  callback(true);

  // If the answer changed, send a notification to the inquiry's
  // creator.
  if (diff.answer) {

    // Fetch the inquiry
    var inquiry = new models.Inquiry();
    inquiry._id = id;
    db.get(inquiry, function(err) {

      // Fail silently on error
      if (err) return;

      //Fetch the listing
      var listing = new models.Listing();
      listing._id = inquiry.listing;
      db.get(listing, function(err) {

        // Send the notification
        nots.send(inquiry.creator, nots.Types.NewAnswer, inquiry, listing);
      });
    });
  }
};

var del = function(client, id, callback, errback) {
  // Create a deletion fs
  var fs = new models.Inquiry();
  fs._id = id;
  fs.deleted = true;

  // Apply it
  db.apply(fs);

  // Return true
  callback(true);
};

exports.create = create;
exports.update = update;
exports.del = del;
