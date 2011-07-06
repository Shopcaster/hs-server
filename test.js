#!/usr/bin/env node

var cli = require('cli'),
    testing = require('./testing/runner');

cli.parse({
  // Nothing to see here, please move along
});

cli.main(function(args, opts) {
  console.log('Hipsell Server - Bonanza Branch');
  console.log('  Test Framework');

  testing.run();
});
