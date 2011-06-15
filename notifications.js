var presence = require('./presence'),
    email = require('./email'),
    db = require('./db'),
    templating = require('./templating');

// Notification types
var Types = {
  NewQuestion: 0,
  NewOffer: 1,
  NewMessage: 2,

  OfferAccepted: 3
};

var emails = {};
emails[Types.NewQuestion] = templating['email/new_question'];
emails[Types.NewOffer] = templating['email/new_offer'];
emails[Types.NewMessage] = templating['email/new_message'];

var messages = {};
messages[Types.NewQuestion] = 'New question on your listing';
messages[Types.NewOffer] = 'New offer on your listing';
messages[Types.NewMessage] = 'New message on an offer';

var send = function(uid, type, fs, other) {
  // Get the user's presence
  var online = presence.getState(uid) == presence.UserState.online;

  // If they're not online, try to send an email.
  if (!online) {
    // Silently fail if there's no email for this notification type
    if (!emails[type]) return;

    // Get the email contents
    var msg = emails[type]({fs: fs, other: other});

    // And send the email
    email.sendToUser(uid, messages[type] || 'New Notification', msg);

  // If they ARE online, try to send a message
  } else {
    // Silently fail if there's no message for this notification type
    if (!messages[type]) return;

    // Grab the client and send them the notification
    var client = presence.getClient(uid);
    client.send('not', {message: messages[type], key: fs.getCollection + ':' + fs._id});
  }
};

exports.Types = Types;
exports.send = send;
