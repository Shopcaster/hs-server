var mailgun = require('mailgun'),
    querystring = require('querystring'),
    email = require('../email'),
    templating = require('../templating'),
    db = require('../db'),
    models = require('../models');

var serve = function(req, res) {
  var match = req.url.match(/listing\/\d+$/);
  var id = match && match[0];

  // If we couldn't grab what looks like a listing id from the URL, we
  // should bail.
  if (!id) {
    res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'})
    res.end('Not Found');
    return;
  }



  // Read the data
  var data = '';
  req.on('data', function(c) { data += c });
  req.on('end', function() {

    // Parse the data as x-www-form-urlencoded
    data = querystring.parse(data);

    // Verify the request
    if (!email.verify(data.timestamp, data.token, data.signature)) {
      res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8'});
      res.end('Bad Request');
      return;
    }

    // Fetch the relevant listing
    var listing = new models.Listing();
    listing._id = id;
    db.get(listing, function(err) {

      // If there's no such listing, bail out
      if (err) {
        res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
        res.end('Not Found');
        return;
      }

      // Report success to mailgun
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      res.end('OK');

      // Send the autoreply to the sender -- skip if it's from craiglist
      // though.
      if (!data.sender.match(/noreply@craiglist.org/)) {
        email.send(data.sender,
                   'Re: ' + data.subject,
                   templating['email/autoresponse'].render({listing: listing}),
                   data.recipient);
      }

      // Forward the email contents to sold@hipsell.com
      email.send('sold@hipsell.com',
                 'Autoreply For: ' + data.subject,
                 '<h4>Original Sender: ' + data.sender + '</h4>' + data['body-plain']);
    });
  });
};

exports.serve = serve;
