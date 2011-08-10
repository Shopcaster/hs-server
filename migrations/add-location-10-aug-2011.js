var db = require('../db');

db.init('localhost', 27017, 'hipsell', function() {
  console.log('DB ready');
  var models = require('../models');

  db.query(models.Listing, {}, function(err, listings) {
    console.log('We have the listings, here we go');

    for (var i=0; i<listings.length; i++) {
      var listing = listings[i];

      with ({listing: listing}) {
        console.log('Converting ' + listing._id);
        console.log('  ' + listing.latitude + ', ' + listing.longitude);

        if (!listing.location) {
          var l2 = new models.Listing();
          l2._id = listing._id;
          l2.location = [listing.latitude, listing.longitude];
          db.apply(l2, function(err) {
            if (err) console.log('Failed ' + listing._id);
            else console.log('Finished ' + listing._id);
          });
        }
      }
    }
  });

});
