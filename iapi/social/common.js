var querystring = require('querystring'),
    _url = require('url'),
    uuid = require('../../util/uuid');

var sessions = {};

var Session = function() {
  this.id = uuid.uuid4();
  sessions[this.id] = this;
  setTimeout(function() {
    delete sessions[this.id];

  }, 20 * 60 * 1000); // 20 min
};
Session.prototype = {};

// These exist to solve a redirect problem with oauth.  The regular
// flow doesn't quite fit into the oauth approach, so we have to
// hack it.
var error = function(message, r, finish) { return doReturn('error', message, r, finish) };
var success = function(message, r, finish) { return doReturn('success', message, r, finish) };

var doReturn = function(arg, message, r, finish) {
  var url = _url.parse(r);

  // Update the query
  url.query = url.query ? querystring.parse(url.query) : {};
  url.query[arg] = message;
  url.query = querystring.stringify(url.query);
  url.search = '?' + url.query;

  finish(303, _url.format(url));
};

exports.error = error;
exports.success = success;
exports.Session = Session;
exports.sessions = sessions;
