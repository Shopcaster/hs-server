var querystring = require('querystring'),
    url = require('url');

var types = {
  'fb': require('./facebook'),
  'twitter': require('./twitter'),
  'linkedin': require('./linkedin')
};


var serve = function(req, finish) {
  // Find the relevant type
  var type = querystring.parse(url.parse(req.url).query).type;

  // If type is bad, we bail
  if (!type || !types.hasOwnProperty(type)) return finish(400, 'Bad type');

  // Dispatch
  if (req.url.match(/connect\/callback/)) return types[type].callback(req, finish);
  if (req.url.match(/connect/)) return types[type].connect(req, finish);
};

exports.serve = serve;
