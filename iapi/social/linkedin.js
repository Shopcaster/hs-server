var url = require('url'),
    querystring = require('querystring'),
    auth = require('../../handlers/auth'),
    oauth = require('../../util/oauth'),
    settings = require('../../settings'),
    db = require('../../db'),
    models = require('../../models'),
    common = require('./common');

var client = new oauth.OAuth('iXlFhLOOpd5WXZE_mTccdbF5mpe486hL9MHNvsxDMA7ZgbwFprLbpI-SFWOjIGqV',
                             'hTLF45CTWXX207ZHRUl2Y8tr5Y488cwiRlXKX3YC2-3pCSl0tHVYa_MmIzK45SeJ',
                             'https://api.linkedin.com', 'HMAC-SHA1');

var api = function(auth, path, method, data, callback) {
  var headers = {'Content-Length': 0};
  if (data)
    headers = {'Content-Length': Buffer.byteLength(data)};

  // We want JSON instead of XML
  headers['x-li-format'] = 'json';

  var token = undefined;
  if (auth && auth.linkedin_token && auth.linkedin_secret)
    token = new oauth.Token(auth.linkedin_token, auth.linkedin_secret);

  var options = {
    path: path,
    method: method,
    headers: headers,
    token: token
  };

  var req = client.request(options, function(res) {

    var body = '';
    res.on('close', function(err) {
      console.log('Error receiving data from LinkedIn API');
      console.log(err.stack);
      console.log('');
      callback(err);
    });
    res.on('data', function(c) { body += c});
    res.on('end', function() {
      try {
        body = JSON.parse(body);
      } catch(err) {
        console.log('Bad JSON from LinkedIn API');
        console.log(body);
        console.log('');

        return callback('Bad data from LinkedIn');
      }

      callback(res.statusCode != 200 && res.statusCode != 201, body);
    });
  });
  if (data)
    req.write(data);
  req.end();
  req.on('error', function(err) {
    console.log('Error accessing LinkedIn API');
    console.log(err.stack);
    console.log('');
    callback(err);
  });
};

var connect = function(req, finish) {

  // Query params contain user info and such
  var args = querystring.parse(url.parse(req.url).query);

  // Make sure the user supplied a valid email/password combo
  auth.authUser(args.email, args.password, function(err, bad, obj) {

    // Handle errors by failing -- with class
    if (err) return common.error('Unexpected server error', args['return'], res);
    // If the auth was incorrect of missing, bail
    if (bad || !obj) return common.error('Incorrect login', args['return'], res);

    // Set up the "session"
    var s = new common.Session();
    s.auth = obj;
    s.ret = args['return'];

    // Fetch the temp OAuth token
    var callbackUrl = settings.serverUri + '/iapi/social/connect/callback?type=linkedin&state=' + s.id;
    client.requestToken('/uas/oauth/requestToken', callbackUrl, function(err, token) {

      // Handle errors
      if (err) {
        console.log('Error at LinkedIn request token');
        console.log(err.message);
        console.log('');

        return finish(500, 'Error fetching LinkedIn request token');
      }

      // Send the user to the authorization page
      var url = 'https://www.linkedin.com/uas/oauth/authorize?oauth_token=' + token.token;
      return finish(302, url);
    });
  });
};

// OAuth verification callback
var callback = function(req, finish) {
  var args = querystring.parse(url.parse(req.url).query);

  // Verify that the session is valid and hasn't expired
  if (!common.sessions[args.state]) {
    console.log('Client returned from LinkedIn auth callback with invalid session');
    console.log('');

    return finish(500, 'Invalid session');
  }

  // Fetch the session
  var session = common.sessions[args.state];
  delete common.sessions[args.state];

  // From here on, we have to use common's return functions rather than
  // using finish directly.  We have to do a manual redirect due to
  // the way oauth flow works; the original request had the `return`
  // query param set, but this redirect from LinkedIn doesn't.  Instead,
  // we use the return url stored in the session.

  // TODO - handle errors from the oauth redirect (in the get args?)

  // Build the token
  var token = new oauth.Token(args.oauth_token);
  token.verifier = args.oauth_verifier;

  client.accessToken('/uas/oauth/accessToken', token, function(err, token) {

    // Handle errors
    if (err) return common.error('Failed to authenticate with LinkedIn', session.ret, finish);

    // Save the oauth token on the user's record
    session.auth.linkedin_token = token.token;
    session.auth.linkedin_secret = token.secret;
    db.apply(session.auth);

    // Make the initial request to the LinkedIn API to get the data
    // we need to associate teh user, and then dave that data.
    api(session.auth, '/v1/people/~:public', 'GET', null, function(err, data) { //TODO

      // Handle errors
      if (err) {
        console.log('Unable to get LinkedIn user data');
        if (data) console.log(data);
        console.log('');

        return finish(500, 'Unable to fetch user data');
        return common.error('Unable to fetch user data', session.ret, finish);
      }

      // Store the link in the user's profile
      var user = new models.User();
      user._id = session.auth.creator;
      user.linkedin = data['site-public-profile-request'].url;
      db.apply(user);

      console.log(user);

      // Redirect back to the client
      return common.success('true', session.ret, finish);
    });
  });
};

exports.connect = connect;
exports.callback = callback;
