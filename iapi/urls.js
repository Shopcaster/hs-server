var listings = require('./listings'),
    auth = require('./auth');


var serve = function(req, res) {
  var url = req.url.substr(6);

  if (url.match(/^listings/)) return listings.serve(req, res);
  if (url.match(/^auth/)) return auth.serve(req, res);

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};

exports.serve = serve;
