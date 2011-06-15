var db = require('./../db'),
    models = require('./../models'),
    _email = require('./../email'),
    gravatar = require('./../util/gravatar'),
    presence = require('./../presence'),
    templating = require('./../templating'),
    crypto = require('crypto');

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
  'Catfish',
  'DrumSolo',
  'Engineer',
  'Rainbow'
];

var hashPassword = function(password, email) {
  return crypto.createHash('sha256').update(password + email).digest('hex').toUpperCase();
};

var createPassword = function(email) {
  var adjective = pwAdjectives[Math.floor(Math.random() * pwAdjectives.length)];
  var noun = pwNouns[Math.floor(Math.random() * pwNouns.length)];
  var n = Math.floor(Math.random() * 100 + 1);

  var pwRaw = adjective + '_' + noun + n;
  console.log('New password: ' + pwRaw);

  // Send an email to the user
  _email.send(email, 'Welcome to Hipsell',
    templating['email/signup'].render({password: pwraw}));

  // Only store the hashed form
  return hashPassword(pwRaw, email);
};

var auth = function(client, data, callback, errback) {

  // Look for an auth object with this email
  db.queryOne(models.Auth, {email: data.email}, function(err, obj) {

    // If something went wrong with the db just fail out
    if (err) {
      errback('Database Error');
      return;
    }

    // If we couldn't get a record for that email address, we need
    // to create the user.
    if (obj == null) {

      // Create an auth/user record for this email
      var auth = new models.Auth();
      auth.email = data.email;
      auth.password = createPassword(data.email);

      var user = new models.User();
      // Use gravatar for urls
      user.avatar = gravatar.hash(data.email);

      // In order to give the new Auth object a reference to this
      // user, it needs to have an id.  However, since it hasn't
      // been saved yet it doesn't have one -- as such, we manually
      // bootstrap the fieldset and create an id.
      user.bootstrap().genId(function() {
        auth.creator = user._id;

        // Save the records
        db.apply(auth, user, function() {

          // Update presence information
          presence.setUser(client.id, user._id);

          // Save the auth for the client
          client.state.auth = auth;

          // Remove the auth on dc
          client.on('disconnect', function() { delete auths[client.id] });

          // Notify success!
          callback({
            password: auth.password,
            userid: auth.creator
          });
        });
      });

    // If there was a record, we need to auth the client against it.
    } else {

      // Compared the password in the DB to the password the user
      // supplied.
      if (obj.password == data.password) {

        // Save the auth for the client
        client.state.auth = obj;

        // Update presence information
        presence.setUser(client.id, obj.creator);

        // Remove the auth on DC
        client.on('disconnect', function() { deauth(client, null, function() {}, function() {}) });

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

var deauth = function(client, data, callback, errback) {
  // Just clear the presence information
  try {
    presence.clearUser(client.id);
    callback(true);
  } catch (err) {
    console.log(err.stack);
    console.log('');
    errback('Server error');
  }
};

var passwd = function(client, data, callback, errback) {

  // Make sure the client is already authenticated
  if (!client.state.auth) return callback(false);

  // DRY
  var auth = client.state.auth;

  // Make sure the passwords match
  if (!auth.password != hashPassword(data.old, auth.email)) return callback(false);

  // Hash the new password
  var password = hashPassword(data.password, auth.email);

  // Save it
  auth.password = password;
  db.apply(auth);

  // Return the hashed form to the user
  callback(password);
};

// Handlers
exports.auth = auth;
exports.deauth = deauth;
