var listings = require('./listings'),
    auth = require('./auth'),
    email = require('./email'),
    share = require('./social/share'),
    connect = require('./social/connect'),
    avatar = require('./avatar');

var serve = function(req, res) {
  var url = req.url.substr(6);

  if (url.match(/^listings/)) return listings.serve(req, res);
  if (url.match(/^listing/)) return listings.serve2(req, res);
  if (url.match(/^auth/)) return auth.serve(req, res);
  if (url.match(/^signup/)) return auth.signup(req, res);
  if (url.match(/^email\/\w+\/\d+$/)) return email.serve(req, res);
  if (url.match(/^social\/share/)) return share.serve(req, res);
  if (url.match(/^social\/connect/)) return connect.serve(req, res);
  if (url.match(/^avatar/)) return avatar.serve(req, res);

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};

exports.serve = serve;
