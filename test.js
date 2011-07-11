#!/usr/bin/env node

// Bootstrap settings and set mode correctly
require('./settings').setMode('test');

var cli = require('cli'),
    settings = require('./settings'),
    url = require('url');
    spawn = require('child_process').spawn;
    testing = require('./testing/runner'),
    colors = require('colors');

var server;

var test = function() {
  //run the tests
  testing.run(function(r) {
    r.print();
    console.log('');

    //kill the server
    server.kill();
    //manually kill the process
    process.exit();
  });
}

cli.parse({
  // Nothing to see here, please move along
});

cli.main(function(args, opts) {
  console.log('Hipsell Server - Test Framework');
  console.log('');

  //run the test server
  var uri = url.parse(settings.serverUri);
  server = spawn('node', ['main.js', '--mode=test', '--dbname=test', '--noemail', '--port=' + uri.port, '--host=0.0.0.0']);
  var output = '';
  server.stdout.on('data', function(data) {
    output += data.toString();

    //run the tests when the server is ready
    if (data.toString().match(/Server Ready/)) test();
  });

  server.on('exit', function() {
    console.log('Test Server Exit'.red);
    console.log('Output dump:');
    console.log(output);
    console.log('');
    process.exit();
  });

});
