var db = require('../../db'),
    models = require('../../models'),
    nots = require('../../notifications'),
    templating = require('../../templating');

var create = function(client, data, callback, errback) {
  // Create the offer object -- this is entirely standard
  var fs = new models.Message();
  fs.merge(data);
  fs.creator = client.state.auth.creator;

  // Save it
  db.apply(fs, function() {
    // Return the ID to the client
    callback(fs._id);

    // Get the convo so that we can get the listing
    var convo = new models.Convo();
    convo._id = fs.convo;
    db.get(convo, function(err, success) {
      // Bail on errors
      if (err) return;

      // Get the listing
      var listing = new models.Listing();
      listing._id = convo.listing;
      db.get(listing, function(err, success) {
        // Bail on errors
        if (err) return;

        // Send notifications for messages created by standard users to
        // both the convo's creator (the buyer), and the convo's
        // listing's creator (the seller).
        if (convo.creator) {

          // Send the notification to the listing's creator
          if (fs.creator != listing.creator)
            nots.send(listing.creator, nots.Types.NewMessage, fs, listing);
          // Send the notificaton to the convo's creator
          if (fs.creator != convo.creator)
            nots.send(convo.creator, nots.Types.NewMessage, fs, listing);

        // Send notifications for messages created on a convo where
        // the buyer is using email instead of an account.
        } else {
          // Since it's impossible for the buyer to create a message
          // through normal means, we just always send one.  Also,
          // we don't use the traditional notification API and instead
          // send it directly.

          //var
        }
      });
    });
  });
};

var update = function(client, id, diff, callback, errback) {
  // Create a diff fieldset
  var fs = new models.Message();
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
