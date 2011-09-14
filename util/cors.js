var settings = require('../settings');

// Wraps a handler function to deal with CORS automatically.
var wrap = function(f) {

  return function(req, res) {

    // If the request `Origin` header is supplied, then the browser
    // is attempting to make a cross-origin request, and we should
    // enable CORS
    if (req.headers['origin']) {
      if (req.method == 'OPTIONS') {
        res.writeHead(200, {'Access-Control-Allow-Origin': settings.clientUri,
                            'Access-Control-Allow-Method': req.headers['access-control-request-method'],
                            'Access-Control-Allow-Headers': req.headers['access-control-request-headers']});
        res.end();
        return;
      }

      // Patch the response object to automatically handle CORS in
      // responses.
      var owh = res.writeHead;
      res.writeHead = function(status, headers) {
        headers = headers || {};

        // Add Access-Control-Allow-Origin and allow everything through
        // if it wasn't set explicitly.
        if (!headers['Access-Control-Allow-Origin'])
          headers['Access-Control-Allow-Origin'] = settings.clientUri;

        // Delegate down to the real method
        return owh.call(res, status, headers);
      };

      // Pass the request down to the handler
      return f.call(this, req, res);

    // Otherwise, this is just a run-of-the-mill request and we
    // shouldn't do anything fancy.
    } else {
      // Pass it right through
      return f.call(this, req, res);
    }
  };
};

exports.wrap = wrap;
