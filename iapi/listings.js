var querystring = require('querystring'),
    models = require('./../models'),
    listings = require('./../handlers/data-handling/listing'),
    db = require('./../db'),
    email = require('./../email');

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
      //500 on db error
      if (err) {
        res.writeHead(500);
        return res.end();
      //403 if passwords don't match, or if the user doesn't exist
      } else if (!obj || obj.password !== q.password) {
        res.writeHead(403);
        return res.end();
      }

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

      //resize the image
      listings.createImg(q.photo, function(err, id) {
        //handle errors
        if (err) {
          res.writeHead(500);
          return res.end();
        }

        //set the photo field
        fs.photo = id;

        //save the listing
        db.apply(fs, function() {
          //todo - notify success to the client
          res.writeHead(201, {'Content-Type': 'text/plain',
                              'Access-Control-Allow-Origin': '*'});
          res.end(fs._id);

          var clientServer = 'beta.hipsell.com';
          var listingPath = '/listings/';

          // Notify the user that their listing was posted
          email.send(q.email, 'We\'ve Listed Your Item',
            '<p>Hey, we\'ve listed your item on Hipsell.  You can view it ' +
            '<a href="http://'+clientServer+'/#!'+listingPath+fs._id+'/">here</a>' +
            '.</p><p>We\'ll be cross-posting it to Craigslist shortly, and we\'ll ' +
            'send you another email to let you know when we\'ve finished that ' +
            'process.</p>' +
            '<h4>&ndash; Hipsell</h4>');

          //Notify hipsell that the listing was posted
          email.send('sold@hipsell.com', 'New Listing', '<a href="http://' + clientServer + '/#!' + 
                                                        listingPath + fs._id + '/">' + fs._id + '</a>');
        });
      });
    });
  });
};

exports.serve = serve;

