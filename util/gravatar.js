// Gravatar support.

var crypto = require('crypto');

// Generates the gravatar normalized hash, which is simply
//
//     email |> trim |> lowercase |> md5
//
var hash = function(email) {
  return crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
};

// Gets the Gravatar avatar URL for this email
var getAvatarUrl = function(email) {
  return 'http://www.gravatar.com/avatar/' + hash(email)
       + ''; //TODO - default avy
};

exports.hash = hash;
exports.getAvatarUrl = getAvatarUrl;
