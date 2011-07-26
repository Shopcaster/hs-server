var querystring = require('querystring'),
    url = require('url');

var types = {
  'fb': require('./facebook'),
  'twitter': require('./twitter'),
  'linkedin': require('./linkedin')
};


var serve = function(req, res) {
  // Find the relevant type
  var type = querystring.parse(url.parse(req.url).query).type;

  // If type is bad, we bail
  if (!type || !types.hasOwnProperty(type)) {
    res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('Bad type');
    return;
  }

  // Dispatch
  if (req.url.match(/connect\/callback/)) return types[type].callback(req, res);
  if (req.url.match(/connect/)) return types[type].connect(req, res);
};

exports.serve = serve;
