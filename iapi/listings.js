var querystring = require('querystring'),
    formidable = require('formidable'),
    cors = require('../util/cors'),
    models = require('../models'),
    listings = require('../handlers/data-handling/listing'),
    db = require('../db'),
    templating = require('../templating'),
    email = require('../email'),
    auth = require('../handlers/auth');

var serve = cors.wrap(function(req, _finish) {

  // We only serve POSTs here.
  if (req.method != 'POST') return _finish(405, 'Method not allowed');

  //collect the data
  var data = '';
  req.on('data', function(chunk) { data += chunk; });
  req.on('end', function() {

    //parse the data
    var q = querystring.parse(data);

    //do auth
    db.queryOne(models.Auth, {email: q.email}, function(err, obj) {

      var finish = function() {
        //create the listing
        var fs = new models.Listing();
        //copy the data
        fs.description = q.description;
        fs.location = [parseFloat(q.latitude), parseFloat(q.longitude)];
        fs.price = parseInt(q.price);
        fs.sold = !!q.sold;
        //set the ceator
        fs.creator = obj.creator;

        //generate an id for the fieldset so that we can use it now
        fs.bootstrap().genId(function() {

          //resize the image
          listings.createImg(q.photo, function(err, id) {
            //handle errors
            if (err) return _finish(500, 'Server error');

            //set the photo field
            fs.photo = id;
            //set up the email autoresponder
            fs.email = email.makeRoute(fs._id.replace('/', '-'), '/iapi/email/' + fs._id);
            // Default accepted offer to null
            fs.accepted = null;
            // Default sold to false
            fs.sold = false;

            //save the listing
            db.apply(fs, function() {

              // Tell the client we succeeded
              _finish(201, '{"listing": "' + fs._id + '", ' +
                           '"password": "' + obj.password + '"}');

              // Generate the message
              var msg = templating['email/listing_created'].render({id: fs._id});

              // Notify the user that their listing was posted
              email.send('Listing Created', q.email, 'We\'ve Listed Your Item', msg);

              // Notify hipsell that the listing was posted
              email.send(null, 'crosspost@hipsell.com', 'New Listing',
                templating['email/listing_created_cc'].render({id: fs._id}));
            });
          });
        });
      };

      var createdAuth = false;

      //500 on db error
      if (err) {
        return _finish(500, 'Server error');
      // If there was no user for this email, create one
      } else if (!obj) {
        auth.signup(q.email, function(auth, user) {
          createdAuth = true;
          obj = auth;
          finish();
        });
      //403 if passwords don't match, or if the user doesn't exist
      } else if (obj.password !== q.password) {
        return _finish(403, 'Forbidden');
      } else {
        finish();
      }
    });
  });
});

var serve2 = function(req, finish) {

  // We only serve POSTs here.
  if (req.method != 'POST') return finish(405, 'Method not allowed');

  // Parse the incoming form
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {

    // Handle errors
    if (err) {
      console.log(err.message || err);
      return finish(400, 'Bad multipart data');
    }

    // Make sure all the required data is there
    if (!fields.email || !fields.password || !fields.description
    || !fields.price || !fields.latitude || !fields.longitude
    || !files.photo) return finish(400, 'Missing required field');

    // Make sure auth is OK
    auth.authUser(fields.email, fields.password, function(err, badPw, obj) {

      // Bail out on error
      if (err) return finish(500, 'Database error');

      // 403 'em on bad password or nonexistant user
      if (badPw || !obj) return finish(403, 'Bad credentials');

      // Prepare the listing
      var listing = new models.Listing();
      listing.description = fields.description;
      listing.price = parseInt(fields.price);
      listing.sold = false;
      listing.creator = obj.creator;
      listing.accepted = null;
      listing.location = [parseFloat(fields.latitude), parseFloat(fields.longitude)];

      // Bootstrap the listing so that we have an ID to use later
      listing.bootstrap().genId(function() {

        // Read the contents of the saved image into memory
        fs.readFile(files.photo.path, function(err, data) {

          // Bail on errors
          if (err) return finish(500, 'Error reading photo');

          // Create the listing image
          listings.createImg(data, function(err, id) {

            // Bail out on errors
            if (err) return finish(500, 'Error processing photo');

            // Set the image on the listing
            listing.photo = id;

            // Set up the email autoresponder
            listing.email = email.makeRoute(listing._id.replace('/', '-'), '/iapi/email/' + listing._id);

            // And finally, save the listing
            db.apply(listing, function() {
              // FIXME - error handling?

              // Tell the client we succeeded
              finish(201, listing._id);

              // Notify the user that their listing was posted
              email.send('Listing Created', fields.email, 'We\'ve Listed Your Item',
                templating['email/listing_created'].render({id: listing._id}));

              // Notify Hipsell that the listing was posted
              email.send(null, 'crosspost@hipsell.com', 'New Listing',
                templating['email/listing_created_cc'].render({id: listing._id}));
            });
          });
        });
      });
    });

  });
};

exports.serve = serve;
exports.serve2 = serve2;
