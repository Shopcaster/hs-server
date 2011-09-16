var cors = require('../util/cors'),
    auth = require('../handlers/auth'),
    db = require('../db'),
    models = require('../models'),
    external = require('../util/external'),
    querystring = require('querystring'),
    _url = require('url'),
    formidable = require('formidable'),
    fs = require('fs');

var serve = cors.wrap(function(req, finish) {

  // Only serve POSTs.
  if (req.method != 'POST') return finish(405, 'Method not allowed');

  // Get all formidable up in here
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {

    // Make sure the fields we need are there
    if (!fields.email || !fields.password || !files.avatar)
      return finish(400, 'Missing Field');

    // Grab the user.
    auth.authUser(fields.email, fields.password, function(err, badPassword, obj) {

      // Database errors are bad
      if (err) return finish(500, 'Database error');
      // As are bad logins
      if (badPassword || !obj) return finish(403, 'Bad login');

      // Now that we have a legit user, read the avatar file
      // Read the file in.
      fs.readFile(files.avatar.path, function(err, data) {
        // Fail on error
        if (err) return finish(500, 'Database error');

        // Resize the avatar
        external.run('resize-avatar', data, function(err, avy) {

          // Handle errors by failing, like all good software should.
          if (err) {
            console.log('Error converting avatar:');
            console.log(res.toString());
            console.log('');
            return finish(500, 'Error converting image');
          }

          // Create the new static file
          var f = new models.File();
          f.data = avy;
          f.mime = 'image/jpeg';
          f.generateHash();

          // Save it.
          db.apply(f, function() {

            // Update the user's avatar to point to the staticfile.
            var user = new models.User();
            user._id = obj.creator;
            user.avatar = f.getUrl();

            db.apply(user, function() {

              return finish(200);
            });
          });

        });
      });
    });
  });
});

exports.serve = serve;
