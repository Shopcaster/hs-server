var fs = require('fs');

// Globals
var currentMode = 'development', // Current mode
    settings = {}; // Settings object

// Loads the settings file
var reload = function() {
  settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
  setMode(currentMode);
};

// Updates the settings mode and sets up exports
var setMode = function(mode) {

  // Sanity check
  if (!settings.hasOwnProperty(mode))
    throw new Error('No settings for mode "' + mode + '"');

  // Update the current mode
  currentMode = mode;

  // Copy settings from the JSON into the exports.
  for (var i in settings[mode]) if (settings[mode].hasOwnProperty(i)) {
    exports[i] = settings[mode][i];
  }

};

// Bootstrap settings
reload();

// Watch for changes on the settings file and reload when
// the happen.
fs.watchFile('settings.json', function(curr, prev) {

  // Make sure the file was actually modified
  if (curr.mtime != prev.mtime) {
    console.log('Settings were modified, reloading...');
    console.log('');
    reload();
  }

});

// Allow external modules to change the mode
exports.setMode = setMode;
