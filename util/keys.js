//               type : key [: type.field]
var keyRegex = /^(\w+):(\w+)(:(\w+)\.(\w+))?$/

var parseKey = function(key) {
  var res = keyRegex.exec(key);

  if (!res || res.length < 3) return null;

  // Build the result
  var k = {type: res[1], id: res[2]};
  // If the regex included a relation, include that
  if (res[3])
    k.relation = {type: res[4], field: res[5]};

  return k;
};

exports.parse = parseKey;
