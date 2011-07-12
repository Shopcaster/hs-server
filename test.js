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
    console.log('');
    console.log('Summary: TODO');
    console.log('');
    //kill the server
    server.kill();
    //manually kill the process
    process.exit();
  });
}

cli.parse({
  showserver: ['s', 'Show server output', 'boolean']
});

cli.main(function(args, opts) {
  console.log('Hipsell Server - Test Framework');
  console.log('');

  //run the test server
  var uri = url.parse(settings.serverUri);
  server = spawn('node', ['main.js', '--mode=test', '--dbname=test', '--noemail', '--port=' + uri.port, '--host=0.0.0.0']);
  server.stdout.on('error', function(data) {
    if (opts.showserver)
      process.stdout.write(data.toString().grey.inverse);
  });
  server.stdout.on('data', function(data) {
    if (opts.showserver)
      process.stdout.write(data.toString().grey);

    //run the tests when the server is ready
    if (data.toString().match(/Server Ready/)) test();
  });

  server.on('exit', function() {
    console.log('');
    console.log('Test Server Exit'.red.inverse);
    console.log('');
    process.exit();
  });

});
