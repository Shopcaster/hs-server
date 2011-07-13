//
// Serve the API interface file via http
//

var common = require('./common');

var serve = function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/javascript'});

  // Get the api.js code
  var code = common.getCode();

  // Write the code
  res.end(code, 'utf8');
};

exports.serve = serve;
