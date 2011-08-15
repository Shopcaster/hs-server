var fs = require('fs');

try {
  var settings = JSON.parse(fs.readFileSync('settings.json'));
} catch (err) {
  console.log('    Error parsing settings.json: ' + err.message);
  console.log('\n');
  process.exit(0);
}

var init = function(overrides) {
  var mode = overrides.mode;
  delete overrides.mode;

  // Load the defaults from the settings
  for (var i in settings.default) if (settings.default.hasOwnProperty(i))
    exports[i] = settings.default[i];

  // Look for the mode in settings, and if it's there load in the data.
  if (mode in settings) {
    var lsettings = settings[mode];
  // Otherwise, try loading the file
  } else {
    try {
      var lsettings = JSON.parse(fs.readFileSync(mode));
    } catch (err) {
      console.log('    Unable to load settings file ' + mode);
      console.log('    Details: ' + err.message);
      console.log('');
      process.exit(0);
    }
  }

  // Merge the local settings in
  for (var i in lsettings) if (lsettings.hasOwnProperty(i))
    exports[i] = lsettings[i];

  // Copy overrides into settings
  for (var i in overrides) if (overrides.hasOwnProperty(i))
    exports[i] = overrides[i];

};

exports.init = init;
