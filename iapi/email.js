var mailgun = require('mailgun'),
    formidable = require('formidable'),
    email = require('../email'),
    templating = require('../templating'),
    db = require('../db'),
    emailUtil = require('../util/email'),
    nots = require('../notifications'),
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

    // Record the email in the database
    var m = new models.IncomingEmail();
    for (var i in fields) if (fields.hasOwnProperty(i))
      m[i] = fields[i];
    db.apply(m);

    // Check to see if this is from Craigslist or Kijiji
    var fromCraig = !! fields.sender.match(/noreply@craigslist.org/);
    var fromKijiji = !! fields.sender.match(/donotreply@kijiji.ca/)
                     || !! fields.from.match(/Kijiji Canada/);

    // If it looks like a kijiji or craigslist activation email, send
    // it to crosspost@hipsell.com and finish.
    if (fromCraig
    || (fromKijiji && fields.subject.match(/^Activate your Kijiji Ad/))) {
      email.send(null,
                 'crosspost@hipsell.com',
                 'Activation Email For: ' + fields.subject,
                 '<h4>Original Sender: ' + fields.from +
                 '</h4><p>' + (fields['body-html'] || fields['body-html']) + '</p>');

      // Bail out.
      return doResp(res, 200, 'OK');
    }

    // Fetch the relevant listing
    var listing = new models.Listing();
    listing._id = id;
    db.get(listing, function(err) {

      // If there's no such listing, bail out
      if (err) return doResp(res, 404, 'Not Found');

      // Report success to mailgun, and handle the rest from here.
      doResp(res, 200, 'OK');

      // Try to fetch the auth object for this user
      var auth = new db.Auth();
      auth._id = fields.from.match(/[\S]@[\S]/);
      db.get(auth, function(err, exists) {

        // Treat error the same as a not exists case
        exists = !error && exists;

        // Try to fetch an existing conversation
        if (exists) {
          var q = {
            creator: auth.creator
          };
        } else {
          var q = {
            creator: null,
            email: auth._id
          };
        }
        db.get(convo, function(err, convo) {

          // We'll need this later
          var convoWasCreated = !convo;

          // If there's an error... well, recovering from that is
          // going to be a bitch, so...
          if (err) return; //TODO - Recover

          // Common code; DRY
          var finish = function() {

            // So at this point, we have access to a few things:
            //  * The sender's email
            //  * The relevant convo object
            //  * Whether or not we created the convo

            // If we created the convo, we'll open up with a straight
            // autoreply email to the sender -- this works nicely, as
            // we won't really have anything to send them anyway until
            // the listing creator responds.
            if (convoWasCreated)
              email.send('Auto Response',
                         fields.from,
                         'Re: ' + fields.subject,
                         templating['email/autoresponse'].render({listing: listing}),
                         fields.recipient);

            // Update the `lastEmail` field on the convo.  This will
            // point to the email's Message-ID, and will be used when
            // sending responses to ensure that threading happens
            // properly (using the In-Reply-To header).
            convo.lastEmail = fields['message-id'] || null;
            // Strip out any wrapping brackets
            if (convo.lastEmail)
              convo.lastEmail = convo.lastEmail.replace(/^</, '')
                                               .replace(/>$/, '');
            // Save to db
            db.apply(convo);

            // Now all we have to do is create the message and we're golden.
            var message = new models.Message();
            message.creator = auth.creator || null;
            if (!message.creator) message.email = auth._id;
            message.convo = convo._id;
            message.offer = null;
            message.message = emailUtil.preprocess(fields['body-plain'], true);
            message.message = emailUtil.chopPlain(message.message);
            db.apply(message);
            // TODO - check out Mailgun's sig/quote stripping
            //        functionality

            // Send a notification to the listing owner.
            var listing = new models.Listing();
            listing._id = convo.listing;
            db.get(listing, function(err, found) {

              // If there's a DB error, or the listing doesn't exist
              // for some reason, we'll just not send this message...
              if (err || !found)
                return;

              // Send the notification.
              nots.send(listing.creator, nots.Types.NewMessage, fs, listing);

              // Fin.
            });
          };

          // If the convo doesn't exist we need to create it
          if (!convo) {
            // Note how we handle the nonexistant user case: creator
            // is null, and the email field is set to that email
            // address.
            var convo = new models.Convo();
            convo.creator = auth.creator || null;
            if (!exists) convo.email = auth._id;
            db.apply(convo, finish);
          } else {
            finish();
          }
        });
      });
    });
  });
};

exports.serve = serve;
