var _url = require('url'),
    querystring = require('querystring'),
    common = require('./common'),
    cors = require('../cors'),
    models = require('../../models'),
    db = require('../../db'),
    settings = require('../../settings'),
    auth = require('../../handlers/auth');

// Handles the Facebook side of posting a listing
var facebook = function(auth, listing, reauth, success, fail) {

  // If there's no FB token on this auth record, we need to link
  // the account again (or for the first time).  We do so by just
  // redirecting to the Facebook connect URL, and specifying the share
  // URL (with all the relevant data) as the return url.
  if (!auth.fb)
    reauth();

  // Prepare the wall post
  var data = {};
  data.picture = settings.serverUri + listing.photo;
  data.link = settings.clientUri + '/' + listing._id;
  data.message = "I'm selling this on Hipsell:\n\n" + listing.description;
  //data.caption = ''; // Image caption
  //data.description = ''; // Link description
  data = querystring.stringify(data);

  // Create it via the Graph API
  graph(auth, '/me/feed', 'POST', data, function(err, result) {
    result = JSON.parse(result);

    // Handle errors
    if (result.error) {

      // OAuthExceptions are likely access token related (expired,
      // incorrect authorization, revoked, etc).  Handle them
      // by just reauthing.
      if (results.type && result.type == 'OAuthException')
        return reauth();
      // We can't handle any other type of error.
      else
        return fail()
    }

    // If the error flag wasn't set, it must have succeeded
    return success();
  });
};

// Handles the Twitter side of posting a listing
var twitter = function(auth, listing, reauth, success, fail) {

  // If there's no Twitter oauth on this auth record, we need to link
  // the account again (or for the first time).  We do so by just
  // redirecting to the Twitter connect URL, and specifying the share
  // URL (with all the relevant data) as the return url.
  if (!auth.twitter_token || !auth.twitter_secret)
    reauth();

  // Prepare the tweet
  var data = {};
  //actual tweet contents
  data.status = "Selling on @hipsellapp: ";
  data.status += listing.description;
  // Limit to 140 by words
  if (data.status.length > 140) {
    var split = data.status.split(' ');
    var removed = 0;
    while (split.length > 1) {
      removed += split.pop().length;
      if (removed >= 3)
        break;
    }
    data.status = split.join(' ') + '...';
  }
  //geo
  data.lat = listing.latitude;
  data.long = listing.longitude;
  //ensure correct format
  data = querystring.stringify(data);

  // Post the tweet
  api(auth, '/1/statuses/update?' + data, 'POST', null, function(err, result) {

    // Handle errors
    switch(err) {

      // No problems
      case undefined:
        success();
        break;

      // Bad auth
      case 401:
        reauth();
        break;

      // Some other error we can't recover from
      default:
        fail();
        break;
    }
  });

};

var serve = cors.wrap(function(req, res) {

  // Parse out the url
  var url = _url.parse(req.url);

  // Make sure there was a query
  if (!url.query) {
    res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('Bad Request');
    return;
  }

  // Parse the query
  url.query = querystring.parse(url.query);

  // Make sure the return url was supplied
  if (!query.return) {
    res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('No return URL supplied');
    return;
  }

  // Helper functions
  var fail = function(m) {
    return common.fail(m, query.return, res);
  };
  var succeed = function() {
    return common.success('true', query.return, res);
  };

  // Because we use this URL as the return url for registration, we
  // need to be able to handle failures.  As such, if `error` is set
  // in the query parameters, we serve a redirect directly to the
  // original return url.
  if (url.query.error) return
    fail(query.error);

  // Make sure auth info was supplied
  if (!url.query.email || !url.query.password)
    return fail('Bad authentication');

  // Make sure social type was provided, and valid
  if (!url.query.type || (url.query.type != 'fb' && url.query.type != 'twitter'))
    return fail('Missing social type');

  // Make sure a listing id was provided
  if (!url.query.listing)
    return fail('Missing listing id');

  // Check the auth
  auth.authUser(url.query.email, url.query,password, function(err, badPw, auth) {

    // Handle errors and bad auth
    if (err) return fail('Database error');
    if (badPw) return fail('Bad authentication');
    if (!auth) return fail('Bad authentication');

    // Make sure the listing exists
    var listing = new models.Listing();
    listing._id = url.query.listing;
    db.get(listing, function(err, success) {

      // Handle any db error by failing
      if (err) return fail('Database error');

      // If the listing doesn't exist, fail
      if (!success) return fail('Listing doesn\'t exist');

      // This callback simply does the appropriate redirect
      var successCallback = succeed();
      // This callback tell the user something went wrong
      var failCallback = function() {
        fail('Something weird happened.  Wait a litte bit and then try again');
      }
      // This forces sends the client back to the appropriate social
      // connection URL before sending them back here.
      var reauth = function() {

        // Building the correct url is a bit of a doozy...
        var url = settings.serverUri + '/iapi/social/connect?';
        url += querystring.stringify({
          type: url.query.type,
          email: auth.email,
          password: auth.password,
          return: settings.serverUri + req.url
        });

        // Do the redirect
        res.writeHead('303', {'Location': url});
        res.end('');
      };

      // At this point, we have an auth object, the listing object, and
      // the type of sharing to do.  We can now just delegate down to
      // the appropriate handler.
      if (url.query.type == 'fb')
        return facebook(auth, listing, reauth, successCallback, failCallback);
      else if (url.query.type == 'twitter')
        return twitter(auth, listing, reauth, successCallback, failCallback);
    });
  });
});

exports.serve = serve;

