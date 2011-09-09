var querystring = require('querystring'),
    formidable = require('formidable'),
    cors = require('../util/cors'),
    models = require('../models'),
    listings = require('../handlers/data-handling/listing'),
    db = require('../db'),
    templating = require('../templating'),
    email = require('../email'),
    auth = require('../handlers/auth');

var serve = cors.wrap(function(req, res) {

  // We only serve POSTs here.
  if (req.method != 'POST') {
    res.writeHead(405, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('Method Not Allowed');
    return;
  }

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
            if (err) {
              res.writeHead(500, {'Content-Type': 'text/plain'});
              return res.end('Server Error');
            }

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
              res.writeHead(201, {'Content-Type': 'application/json'});

              res.end('{"listing": "' + fs._id + '", ' +
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
        res.writeHead(500, {'Content-Type': 'text/plain'});
        return res.end('Server Error');
      // If there was no user for this email, create one
      } else if (!obj) {
        auth.signup(q.email, function(auth, user) {
          createdAuth = true;
          obj = auth;
          finish();
        });
      //403 if passwords don't match, or if the user doesn't exist
      } else if (obj.password !== q.password) {
        res.writeHead(403, {'Content-Type': 'text/plain'});
        return res.end('Forbidden');
      } else {
        finish();
      }
    });
  });
});

var serve2 = cors.wrap(function(req, res) {

  // We only serve POSTs here.
  if (req.method != 'POST') {
    res.writeHead(405, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('Method Not Allowed');
    return;
  }

  // Parse the incoming form
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {

    // Make sure all the required data is there
    if (!fields.email || !fields.password || !fields.description
    || !fields.price || !fields.latitude || !fields.longitude
    || !files.photo) {
      res.writeHead(400, {'Content-Type': 'text/plain; charset=utf-8'});
      res.end('Missing required field');
    }

    // Make sure auth is OK
    auth.authUser(fields.email, fields.password, function(err, badPw, obj) {

      // Bail out on error
      if (err) {
        res.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'});
        res.end('Database error');
        return;
      }

      // 403 'em on bad password or nonexistant user
      if (badPw || !obj) {
        res.writeHead(403, {'Content-Type': 'text/plain; charset=utf-8'});
        res.end('Bad login info');
        return;
      }

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

        // Create the listing image
        listings.createImg(files.photo, function(err, id) {

          // Bail out on errors
          if (err) {
            res.writeHead(500, {'Content-Type': 'text/plain; charset=utf-8'});
            res.end('Error converting photo');
            return;
          }

          // Set the image on the listing
          listing.photo = id;

          // Set up the email autoresponder
          listing.email = email.makeRoute(listing._id.replace('/', '-'), '/iapi/email/' + listing._id);

          // And finally, save the listing
          db.apply(listing, function() {
            // FIXME - error handling?

            // Tell the client we succeeded
            res.writeHead(201, {'Content-Type': 'text/plain; charset=utf-8'});
            res.end(listing._id);

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

exports.serve = serve;
exports.serve2 = serve2;
