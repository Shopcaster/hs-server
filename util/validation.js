
var regexes = {
  'ref': /^\w+\/[0-9a-f]+$/
};

var validate = function(spec, data) {
  // Some sanity checking
  if (!spec || !data) return false;

  var passed = true;

  var optional = false;

  // Check all fields in the spec
  for (var i in spec) if (spec.hasOwnProperty(i)) {
    // Cache type for DRY
    var t = spec[i];

    // Check for the optional flag
    if (t[t.length - 1] == '?') {
      // Strip it out so that further validation can happen
      t = t.substr(0, t.length - 1);
      optional = true;
    // If there's no optional flag set, we don't allow null
    } else {
      optional = false;
      // So fail if the data item is null
      if (data[i] === null)
        passed = false;
        break;
    }

    // If this field is preset in the data, it needs to be validated
    // whether it's optional or not.
    if (data.hasOwnProperty(i)) {

      // Get the data
      var d = data[i];

      // Ensure types match
      if ((t == 'string' && typeof d != 'string')
      ||  (t == 'number' && typeof d != 'number')
      ||  (t == 'boolean' && typeof d != 'boolean')
      ||  (t == 'object' && typeof d != 'object')
      ||  (t == 'ref' && typeof d != 'string' && typeof d != 'object')
      ||  (typeof d === 'undefined')) {
        passed = false;
        break;
      }

      // For optional refs, let null through
      if (t == 'ref' && optional && d === null)
        continue;

      // Perform regex matching
      if (t in regexes && !regexes[t].exec(d)) {
        console.log(t);
        passed = false;
        break;
      }

    // However, if the field is optional then it doesn't need to be
    // there; we only throw a protocol error if the field is required
    // and missing.
    } else if (!optional) {
      console.log(t);
      passed = false;
      break;
    }
  }

  // Break early if passed is false
  if (!passed)
    return false;

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
