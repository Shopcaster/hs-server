var mailgun = require('mailgun'),
    formidable = require('formidable'),
    email = require('../email'),
    templating = require('../templating'),
    db = require('../db'),
    models = require('../models');

var doResp = function(res, num, d) {
  res.writeHead(num, {'Content-Type': 'text/html; charset=utf-8'});
  res.end(d);
};

var serve = function(req, res) {
  var match = req.url.match(/listing\/\d+$/);
  var id = match && match[0];

  // If we couldn't grab what looks like a listing id from the URL, we
  // should bail.
  if (!id) return doResp(res, 404, 'Not Found');

  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {

    // Handle errors with basic fail
    if (err) return doResp(res, 500, 'Server Error');

    // Verify the request
    if (!email.verify(fields.timestamp, fields.token, fields.signature))
      return doResp(res, 400, 'Bad Request');

    // check to see if this is from craigslist
    var fromCraig = !!fields.sender.match(/noreply@craigslist.org/);
    var fromKijiji = !!fields.sender.match(/donotreply@kijiji.ca/);

    // Forward the email contents to sold@hipsell.com
    email.send('sold@hipsell.com',
               'Autoreply For: ' + fields.subject,
               '<h4>Original Sender: ' + fields.from +
               '</h4><p>' + (fields['body-html'] || fields['body-html']) + '</p>');

    // If it's from craig, finish early
    if (fromCraig || fromKijiji) return doResp(res, 200, 'OK');

    // Otherwise, fetch the relevant listing
    var listing = new models.Listing();
    listing._id = id;
    db.get(listing, function(err) {

      // If there's no such listing, bail out
      if (err) return doResp(res, 404, 'Not Found');

      // Report success to mailgun
      doResp(res, 200, 'OK');

      // Send the autoreply to the sender
      email.send(fields.from,
                 'Re: ' + fields.subject,
                 templating['email/autoresponse'].render({listing: listing}),
                 fields.recipient);

    });
  });
};

exports.serve = serve;
