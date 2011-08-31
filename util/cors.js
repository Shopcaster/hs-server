
// Wraps a handler function to deal with CORS automatically.
var wrap = function(f) {

  return function(req, res) {

    // Let all requests through
    if (req.method == 'OPTIONS') {
      res.writeHead(200, {'Access-Control-Allow-Origin': '*',
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
        headers['Access-Control-Allow-Origin'] = '*';

      // Delegate down to the real method
      return owh.call(res, status, headers);
    };

    // Pass the request down to the handler
    return f.call(this, req, res);
  };
};

exports.wrap = wrap;
