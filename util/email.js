
var preprocess = function(email, qp) {

  // Deal with quoted printable
  if (qp) {
    // Lines ending in = get unbreaked
    email = email.replace('=\n', '\n');
    // Convert charcodes
    var re = /=\d({2})/;

    var match;
    var matches = [];
    while (match = re.exec(email)) matches.push(match);
    // Go backwards to preserve indices
    while (matches.length) {
      var m = matches.pop();

      email = email.substr(0, m[2]) + String.fromCharCode(parseInt(m[1])) + email.substr(m[2] + 3);
    }
  }

  return email;
}

var chopPlain = function(email) {
  var lines = email.split('\n');
  var output = [];

  for (var i=0; i<lines.length; i++) {
    var line = lines[i];

    // Skip lines that start with >, since they're likely quotes
    if (line[0] == '>')
      continue;

    // If a line starts with '-- ', it's the start of a signature
    // which means we're dong (RFC3676)
    if (line == '-- ')
      break;

    // If a line ends with ' wrote:', it indicates a reply section
    // so we should skip.
    if (line.match(/ wrote:$/))
      break;

    // Add the line to the output
    output.push(line);
  }
};

exports.preprocess = preprocess;
exports.chopPlain = chopPlain;
