var staticServing = require('./static-serving'),
    interfaceServing = require('./interface/serve');
    iapi = require('./iapi/urls'),
    templating = require('./templating'),
    crosspost = require('./crosspost/handlers'),
    phone = require('./phone/handlers'),
    fs = require('fs');

// Serves an individual file
var file = function(file, type) {
  type = type || 'text/plain; charset=utf-8';

  return function(req, res) {

    res.writeHead(200, {'Content-Type': type});
    fs.readFile(file, function(err, data) {
      if (err) {
        res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
        res.end('Server error');
      } else {
        res.writeHead(200, {'Content-Type': type})
        res.end(data);
      }
    });
  };
};

var urls = {
  //dummy handler that keeps us from clobbering croquet's urls
  '^/croquet/': function() {},

  //serve File objects from the db
  '^/staticfile/': staticServing.serve,

  //serve the api library
  '^/api-library.js': interfaceServing.serve,

  //delegate to the internal api
  '^/iapi/': iapi.serve,

  //crossposting urls
  '^/crosspost': crosspost.serve,

  //template testing
  '^/template/': templating.serve,

  //twilio stuff
  '^/phone/': phone.server
};

var dispatch = function(req, res) {

  // Special case for / for pingdom
  if (req.url == '/') {
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('Hi');
    return;
  }

  //try to dispatch
  for (var r in urls) if (urls.hasOwnProperty(r)) {
    if (req.url.match(r)) {
      urls[r](req, res);
      return;
    }
  }

  //on failure, 404
  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};

exports.dispatch = dispatch;
