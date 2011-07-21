var querystring = require('querystring'),
    models = require('../models'),
    listings = require('../handlers/data-handling/listing'),
    db = require('../db'),
    templating = require('../templating'),
    email = require('../email'),
    auth = require('../handlers/auth');

var serve = function(req, res) {
  //only serve posts and cors
  if (req.method == 'OPTIONS') {
    res.writeHead(200, {'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Method': req.headers['access-control-request-method'],
                        'Access-Control-Allow-Headers': req.headers['access-control-request-headers']});
    res.end('');

    return;

  } else if (req.method != 'POST') {
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
        fs.latitude = parseFloat(q.latitude);
        fs.longitude = parseFloat(q.longitude);
        fs.price = parseInt(q.price);
        fs.sold = !!q.sold;
        //set the ceator
        fs.creator = obj.creator;

        //generate an id for the fieldset so that we can use it now
        fs.genId(function() {

          //resize the image
          listings.createImg(q.photo, function(err, id) {
            //handle errors
            if (err) {
              res.writeHead(500, {'Content-Type': 'text/plain',
                                  'Access-Control-Allow-Origin': '*'});
              return res.end('Server Error');
            }

            //set the photo field
            fs.photo = id;
            //set up the email autoresponder
            fs.email = email.makeRoute(fs._id.replace('/', '-'), '/iapi/email/' + fs._id);

            //save the listing
            db.apply(fs, function() {

              // Tell the client we succeeded
              res.writeHead(201, {'Content-Type': 'application/json',
                                  'Access-Control-Allow-Origin': '*'});

              res.end('{"listing": "' + fs._id + '", ' +
                      '"password": "' + obj.password + '"}');

              // Generate the message
              var msg = templating['email/listing_created'].render({id: fs._id});

              // Notify the user that their listing was posted
              email.send(q.email, 'We\'ve Listed Your Item', msg);

              // Notify hipsell that the listing was posted
              email.send('sold@hipsell.com', 'New Listing',
                templating['email/listing_created_cc'].render({id: fs._id}));
            });
          });
        });
      };

      var createdAuth = false;

      //500 on db error
      if (err) {
        res.writeHead(500, {'Content-Type': 'text/plain',
                            'Access-Control-Allow-Origin': '*'});
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
        res.writeHead(403, {'Content-Type': 'text/plain',
                            'Access-Control-Allow-Origin': '*'});
        return res.end('Forbidden');
      } else {
        finish();
      }
    });
  });
};

exports.serve = serve;
