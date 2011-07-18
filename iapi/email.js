
var serve = function(req, res) {
  var id = req.url.split('/').pop();

  // MASSIVE TODO

  // If no listing with this ID exists, silently fail

  // Otherwise, send the autoreply

  // Temporary; forward this email to sold@hipsell.com

  // Report success to mailgun
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('OK');
};

exports.server = serve;
