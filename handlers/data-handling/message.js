var db = require('./../../db'),
    models = require('./../../models'),
    nots = require('./../../notifications');

var create = function(client, data, callback, errback) {
  // Create the offer object -- this is entirely standard
  var fs = new models.Message();
  fs.merge(data);
  fs.creator = client.state.auth.creator;

  // Save it
  db.apply(fs, function() {
    // Return the ID to the client
    callback(fs._id);

    // Send a notification to the offer's creator as well as the
    // offer's listing's creator

    // Get the offer so that we can get the listing
    var offer = new models.Offer();
    offer._id = fs.offer;
    db.get(offer, function(err, success) {
      // Bail on errors
      if (err) return;

      // Get the listing
      var listing = new models.Listing();
      listing._id = offer.listing;
      db.get(listing, function(err, success) {
        // Bail on errors
        if (err) return;


        // Send the notification to the listing's creator
        nots.send(listing.creator, nots.Types.NewMessage, fs, listing);
        // Send the notificaton to the offer's creator
        nots.send(offer.creator, nots.Types.NewMessage, fs, listing);
      });
    });
  });
};

var update = function(client, id, diff, callback, errback) {
  // Create a diff fieldset
  var fs = models.Message();
  fs.merge(diff);
  fs._id = id;

  // Apply it to the database
  db.apply(fs);

  // And return success
  callback(true);
};

var del = function(client, id, callback, errback) {
  // Create a deletion fs
  var fs = new models.Message();
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
