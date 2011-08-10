var formidable = require('formidable'),
    db = require('../db'),
    models = require('../models');

var end = function(res, num, content) {
  res.writeHead(num, {'Content-Type': 'text/html; charset=utf-8'});
  res.end(content || '');
};

var handleSms = function(req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {

    // Available fields (See http://www.twilio.com/docs/api/twiml/sms/twilio_request)
    //
    // * SmsSid - SMS unique id
    // * AccountSid - Account this message is from
    // * From - Phone number that send the message
    // * To - Phone number of the recipient
    // * Body - SMS text body

    // Look for an awaited SMS message to this number
    db.query(models.AwaitedSMS, {to: fields.To}, function(err, sms) {

      // If there was an error, send a 500 so the sms will get
      // re posted later.
      if (err) return end(res, 500);
      // If we're not waiting for this text, ignore it.  Return success
      // because our "processing" happened fine.
      if (!obj) return end(res, 200);

      // Otherwise, handle this incoming sms based on its type.

      // Craigslist verification sms.  We need to strip the code out
      // and assign it to the listing.
      if (sms.type == 'craigslist-verification') {

        // Get the secret code out.
        var code = fields.Body.match(/\s(\d+)\s/);
        if (code) code = code[1];

        // If we couldn't find the code, silently fail
        if (!code) return end(res, 200);

        // Set it on the appropriate listing.
        var listing = new models.Listing();
        listing._id = sms.listing;
        listing.craigSMSCode = code;
        db.apply(listing);

        // Return success
        return end(res, 200);

      // If we don't know how to handle this awaited sms type (which
      // would be weird, but hey), 500 out so we have a chance to
      // take care of it later.
      } else {
        console.log('Unknown SMS type ' + sms.type);
        return end(res, 500);
      }
    });
  });
};

var serve = function(req, res) {
  if (req.url.match('/sms')) return handleSms(req, res);

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};

exports.serve = serve;

