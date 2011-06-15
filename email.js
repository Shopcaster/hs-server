// This, boys and girls, is the email module.  It's responsible for
// letting us send email.

//  * Mailgun; for email sending
var mailgun = require('mailgun'),
    db = require('./db'),
    models = require('./models');

// These are the static mailgun settings.  Nothing too fancy going on
// here, but if we ever publish this source code these should be
// redacted.
var mgSettings = {
  apiKey: 'key-61mtr1g-$cdqvb8_v4',
  sender: 'Hipsell <noreply@hipsell.me>'
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
var send = function(to, subject, body) {

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
  var mime = 'From: ' + mgSettings.sender +
             '\nTo: ' + to +
             '\nContent-Type: text/html; charset=utf-8' +
             '\nSubject: ' + subject +
             '\n\n' +
             body;

  // Use the raw send command since we're going the MIME route.  We
  // *aren't* settings the sender field, as this will let Mailgun
  // default to whatever sender we've set up.  If we ever have more
  // than one sender though, we're going to need to choose which one
  // we're sending from right here, or the mail won't send.
  mail.sendRaw(mgSettings.sender, [to], mime, null, function(err) {
    // So at the moment we're silently failing on errors.  In the
    // future we'll probably want to log that failure in the DB and
    // handle it somehow.
  });
};

// This is a simple wrapper around `send` that sends to a User ID
// rather than to an email address.  It handles fetching the email
// address out of the database automatically.
var sendToUser = function(userId, subject, body) {

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
    send(auth.email, subject, body);

  });
};

// Expose only the init function and email sending.
exports.init = init;
exports.send = send;
exports.sendToUser = sendToUser;
