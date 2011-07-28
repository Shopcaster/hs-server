var querystring = require('querystring');

var convertData = function(type, data) {
  switch(type) {
    case 's':
      return data;
    case 'd':
      return new Date(parseFloat(data));
    case 'i':
      return parseInt(data);
    default:
      return undefined;
  }
};

var parseMessage = function(message) {
  var a = 0,
      b = 0;

  var parsed = {};

  var get = function(field) {
    b = message.indexOf('|');
    if (b < 0) throw new Error('Invalid message');
    parsed[field] = message.substring(a, b);
    a = b;
  };

  // Parse out the segments
  try {
    get('cid');
    get('mid');
    get('data');
  } catch (err) {
    return null;
  }

  // Convert the x-www-form-urlencoded body into an obj
  parsed.data = querystring.parse(parsed.ata);

  // Handle data formats
  for (var i in parsed.data) if (parsed.data.hasOwnProperty(i)) {
    var d = parsed.data[i];
    parsed.data[i] = convertData(d.substring(0, 1), d.substring(1));
  }

  return parsed;
};

var XHRTransport = function(server, url) {

};

exports.Transport = XHRTransport;
