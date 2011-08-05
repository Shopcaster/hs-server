var formidable = require('formidable');

var handleSms = function(req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {

  });
};

var serve = function(req, res) {
  if (req.url.match('/sms')) return handleSms(req, res);

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};
