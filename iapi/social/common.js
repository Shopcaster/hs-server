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

var doReturn = function(arg, message, r, res) {
  var url = _url.parse(r);

  // Update the query
  url.query = url.query ? querystring.parse(url.query) : {};
  url.query[arg] = message;
  url.query = querystring.stringify(url.query);
  url.search = '?' + url.query;

  res.writeHead(302, {'Location': _url.format(url)});
  res.end('');
  return;
};
var error = function(message, r, res) { return doReturn('error', message, r, res) };
var success = function(message, r, res) { return doReturn('success', message, r, res) };

exports.error = error;
exports.success = success;
exports.Session = Session;
exports.sessions = sessions;
