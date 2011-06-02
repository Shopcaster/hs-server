var db = require('./../db'),
    models = require('../models');

var pwAdjectives = [
  'Happy',
  'Conservative',
  'Smarmy',
  'Underhanded',
  'Incredible',
  'Horrified',
  'Cranky',
  'Marvelous',
  'Suplexed',
  'Rampaging',
  'Virulent'
];
var pwNouns = [
  'SkyScraper',
  'Seaweed',
  'Rhinos',
  'Facebooks',
  'WaterCooler',
  'Zamboni',
  'Coconut',
  'NewtonianPhysics',
  'Catfish'
];

var createPassword = function(email) {
  var adjective = Math.floor(Math.random() * pwAdjectives.length);
  var noun = Math.floor(Math.random() * pwNouns.length);
  var n = Math.floor(Math.random() * 100 + 1);

  var pwRaw = adjective + '_' + noun + n;
  console.log('New password: ' + pwRaw);

  return crypto.createHash('sha256').update(pwRaw + email).toUpperCase();
};

// clientId -> models.Auth._id
var auths = [];

var auth = function(client, data, callback) {
  db.queryOne(models.Auth, {email: data.email}, function(err, obj) {
    //if something went wrong with the db just fail out
    if (err) {
      callback('error-server');
      return;
    }

    // If we couldn't get a record for that email address, we need
    // to create the user.
    if (obj == null) {

      // Create an auth/user record for this email
      var auth = new models.Auth();
      auth.email = data.email;
      auth.password = createPassword(email);

      var user = new models.User();
      // In order to give the new Auth object a reference to this
      // user, it needs to have an id.  However, since it hasn't
      // been saved yet it doesn't have one -- as such, we manaully
      // create one.
      user.genId(function() {
        auth.creator = user._id;

        // Save the records
        db.apply(auth, user);

        // Mark the user as auth'd
        auths[client.id] = auth._id;
        // Remove the auth on dc
        client.on('disconnect', function() { delete auths[client.id] });

        // Notify success!
        callback({
          password: auth.password,
          userid: auth.creator
        });
      });

    // If there was a record, we need to auth the client against it.
    } else {

      // Compared the password in the DB to the password the user
      // supplied.
      if (obj.password == data.password) {
        // Save the auth for this user
        auths[client.id] = obj._id;
        // Remove the auth on DC
        client.on('disconnect', function() { delete auths[client.id] });

        // Notify success!
        callback({
          password: data.password,
          userid: obj.creator
        });
      // If the passwords didn't match, that's an auth failure.
      } else {
        callback(false);
      }
    }

  });
};

var deauth = function(client, data, callback) {
  // Just delete the auth field on deauth.
  delete auths[client.id];
};

// Handlers
exports.auth = auth;
exports.deauth = deauth;

// Other Stuff
