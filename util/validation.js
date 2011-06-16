
var regexes = {
  'ref': /^[0-9a-f]+$/
};

var validate = function(spec, data) {
  // Some sanity checking
  if (!spec || !data) return false;

  var passed = true;

  // Check all fields in the spec
  for (var i in spec) if (spec.hasOwnProperty(i)) {
    // Cache type for DRY
    var t = spec[i];

    // If this field is preset in the data, it needs to be validated
    // whether it's optional or not.
    if (data.hasOwnProperty(i)) {

      // Strip the optional flag, since we don't care about here
      if (t[t.length - 1] == '?')
        t = t.substr(0, t.length - 1);

      // Ensure types match
      if ((t == 'string' && typeof data[i] != 'string')
      ||  (t == 'number' && typeof data[i] != 'number')
      ||  (t == 'boolean' && typeof data[i] != 'boolean')
      ||  (t == 'object' && typeof data[i] != 'object')
      ||  (t == 'ref' && typeof data[i] != 'string')
      ||  (typeof data[i] === 'null')
      ||  (typeof data[i] === 'undefined')) {
        passed = false;
        break;
      }

      // Perform regex matching
      if (t in regexes && !regexes[t].exec(data[i])) {
        passed = false;
        break;
      }

    // However, if the field is optional then it doesn't need to be
    // there; we only throw a protocol error if the field is required
    // and missing.
    } else if (t[t.length - 1] != '?') { //ends with ?
      passed = false;
      break;
    }
  }

  // If the client has any fields that aren't in the spec, fail 'em.
  for (var i in data) if (data.hasOwnProperty(i)) {
    if (!spec.hasOwnProperty(i)) {
      passed = false;
      break;
    }
  }

  return passed;
};

exports.validate = validate;
