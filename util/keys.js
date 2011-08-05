
//
// Sample keys:
//
//     convo/1234dead5678beef
//     convo(foo=bar)
//



//               type / key  [= type.field]
var keyRegex = /^(\w+)\/(\w+)(=(\w+)\.(\w+))?$/

var normalRegex = /^(\w+)\/(\w+)$/;
var queryRegex = /^(\w+)\((\w+)\=(\w+\/\w+)\)/$;

var Key = function(orig) { this.orig = orig };
Key.prototype.toString = function() { return this.orig };

var Query = function(orig) { this.orig = orig };
Query.prototype.ToString = function() { return this.orig };

var parseKey = function(key) {
  var res = normalRegex.exec(key);
  if (res) {
    var k = new Key(key);
    k.type = res[1];
    k.id = key;
    return k;
  }

  res = queryRegex.exec(key);
  if (res) {
    var q = new Query(key);
    q.type = res[1];
    q.field = res[2];
    q.val = res[3];
    return q;
  }

  // Fail! :O
  return null;
};

exports.parse = parseKey;
exports.Key = Key;
exports.Query = Query;
