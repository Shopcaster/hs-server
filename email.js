// This, boys and girls, is the email module.  It's responsible for
// letting us send email.

//  * Mailgun; for email sending
var mailgun = require('mailgun'),
    crypto = require('crypto'),
    db = require('./db'),
    models = require('./models'),
    uuid = require('./util/uuid'),
    mixpanel = require('./util/mixpanel'),
    settings = require('./settings');

// These are the static mailgun settings.  Nothing too fancy going on
// here, but if we ever publish this source code these should be
// redacted.
var mgSettings = {
  apiKey: 'key-61mtr1g-$cdqvb8_v4',
  sender: 'Hipsell <feedback@hipsell.com>',
  server: 'hipsell.me'
};

// Our Mailgun library requires an object to be instantiated, and all
// operations have to be performed through that object.  We're using
// a global one here.
var mail;
// Simple flag used to disable email sending.  If `true`, email send
// calls will pretend to send, but instead dump output to console.
var disabled = false;

// The initialization routine -- this needs to be called before using
// anything else in this module.
var init = function(disable) {
  // All we do is initialize that global Mailgun object with our API
  // key, and we're done.
  mail = new mailgun.Mailgun(mgSettings.apiKey);

  // Convert `disable` to a bool and set the disabled flag.  If
  // `disable` wasn't set it'll turn to false and all will be well.
  disabled = !!disable;
};


// This function uses Mailgun to send an HTML email to a single
// recipient.
var send = function(type, to, subject, body, from, inReplyTo) {

  // This function does all the hard work.  If we're tracking this email,
  // we'll use it as the callback for Mixpanel.  Otherwise, it's called
  // directly.
  var doit = function(body) {

    // Default from to the sender we provide in the settings up top.
    from = from || mgSettings.sender;

    // If email sending is disabled, log to console instead.
    if (disabled) {

      console.log('Email:');
      console.log('  To:      ' + to);
      console.log('  Subject: ' + subject);
      console.log('  Body:    ' + body);
      console.log('');

      return;
    }

    // We have to build the MIME data manually due to Node.js lacking an
    // appropriate MIME library.  Fortunately this stays simple as long
    // as we aren't sending attachments (please don't ever require this
    // feature D:).
    var mime = 'From: ' + from +
               '\nTo: ' + to +
               '\nContent-Type: text/html; charset=utf-8' +
               '\nSubject: ' + subject +
               '\nMessage-ID: ' + uuid.uuid4() +
               (inReplyTo ? '\nIn-Reply-To: ' + inReplyTo : '') +
               '\n\n' +
               body;

    // Use the raw send command since we're going the MIME route.  We
    // *aren't* setting the sender field, as this will let Mailgun
    // default to whatever sender we've set up.  If we ever have more
    // than one sender though, we're going to need to choose which one
    // we're sending from right here, or the mail won't send.
    mail.sendRaw(from, [to], mime, settings.server, function(err) {
      // So at the moment we're silently failing on errors.  In the
      // future we'll probably want to log that failure in the DB and
      // handle it somehow.
    });

    // We're logging all outgoing emails, so we want to construct
    // a basic object and throw that into the db.
    var m = new models.OutgoingEmail();
    m.mime = mime;
    m.from = from;
    m.to = to;
    m.subject = subject;
    db.apply(m);
  };

  // If the email type is defined, we need to do Mixpanel email
  // tracking.  Note that if the Mixpanel API call fails in any way, the
  // original body will be used.
  //
  // We also don't want to make the API call if we don't have email
  // sending enabled, as this will skew data.
  if (type && !disabled)
    mixpanel.trackEmail(type, to, body, doit);
  // If no type was sent we can forego tracking.
  else
    doit(body);
};

// This is a simple wrapper around `send` that sends to a User ID
// rather than to an email address.  It handles fetching the email
// address out of the database automatically.
var sendToUser = function(type, userId, subject, body, from, inReplyTo) {

  // Try to find the Auth object based on the user id, which is its
  // creator.
  db.queryOne(models.Auth, {creator: userId}, function(err, auth) {

    // Log DB errors.
    if (err) {
      console.log('Unable to send email to userid ' + userId + ' due to database error');
      console.log('');
      return;
    }
    // If the query didn't return any object, then the user doesn't
    // exist.  We should log it and then fail.
    if (!auth) {
      console.log('Unable to send email to userid ' + userId + ' because no such user exists');
      console.log('');
      return;
    }

    // Now send the email
    send(type, auth.email, subject, body, from, inReplyTo);

  });
};

// This sets up a route from the designated email address to a url on
// this server.  For example, from `listing-1` to `/iapi/email/listing/1`.
// Note that this won't function at all in testing or development mode,
// and that it will ensure that email addresses are unique across
// staging and production.
//
// Because it may have to modify the supplied email address, this
// function returns the email that was used to create the route.
var makeRoute = function(email, dest) {

  // Find out what mode we're in.
  var mode = settings.getMode();

  // If it's `testing` or `development`, print to the console rather than
  // setting up the actual route, as our endpoint is unlikely to be
  // reachable
  if (mode == 'test' || mode == 'development') {
    console.log('New email route from ' + email + mgSettings.server +' --> ' + dest);
    console.log('');
    return email + mgSettings.server;
  }

  // Add suffixes specific to server mode, to ensure uniqueness.
  if (mode == 'production') {
    // Do nothing for production, so that they're the prettiest.
  } else if (mode == 'staging') {
    email = email + '-stg';
  }

  // Add the domain to the email address to use.
  email = email + mgSettings.server;

  // Now create the route.
  mail.createRoute(email, settings.serverUri + dest);

  // And return the email address we used to the caller.
  return email;
};

// Verifies the authenticity of webhooks for Mailgun's HTTP callbacks.
// See http://documentation.mailgun.net/Documentation/DetailedDocsAndAPIReference#HTTP_POST_Authentication
// for details.
var verify = function(timestamp, token, signature) {
  var msg = ('' + timestamp) + ('' + token);
  var key = mgSettings.apiKey;
  var algo = 'sha256';

  return crypto.createHmac(algo, key).update(msg).digest('hex') == signature;
};

// Expose only the init function and email sending.
exports.init = init;
exports.send = send;
exports.sendToUser = sendToUser;
exports.makeRoute = makeRoute;
exports.verify = verify;
