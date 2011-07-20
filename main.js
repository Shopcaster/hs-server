#!/usr/bin/env node

var cli = require('cli'),
    http = require('http'),
    // These bad boys don't get loaded off the bat.  Instead, we load
    // them as late as possible in the initialization sequence.  The
    // reason for this is that we don't want modules to be
    // accidentally included before they're initialized.  If they're
    // `required()` up here, the end result is that ALL of them will
    // be loaded before they're init'd.  Keeping the loading lazy
    // solves this problem and gives us fine-grained control over
    // initialization order.  Note that this isn't an academic
    // concern, and things actually break without this loading
    // technique.
    settings,
    db,
    urls,
    clients,
    protocol,
    email,
    templating;

cli.parse({
  mode: [false, 'Server mode (development, production, staging, test)', 'string', 'development'],
  port: ['p', 'Listen on this port', 'number', 8080],
  host: ['s', 'Listen on this hostname', 'string', '0.0.0.0'],
  dbhost: [false, 'Database server hostname', 'string', 'localhost'],
  dbport: [false, 'Database server port', 'number', 27017],
  dbname: [false, 'Database name', 'string', 'hipsell'],
  noemail: ['m', 'Disable email sending']
});

cli.main(function(args, opts) {
  console.log('Hipsell Server');
  console.log('Running in mode ' + opts.mode);
  console.log('');

  //prep settings in the correct mode
  console.log('  Loading settings');
  settings = require('./settings');
  settings.setMode(opts.mode);

  //set up database
  console.log('  Initializing Database');
  db = require('./db');
  db.init(opts.dbhost, opts.dbport, opts.dbname, function() {

    //set up templating
    console.log('  Initializing Templating');
    templating = require('./templating');
    templating.init();

    //set up email
    console.log('  Initializing Email');
    email = require('./email')
    email.init(opts.noemail);

    //set up http
    console.log('  Initializing HTTP on ' + opts.host + ':' + opts.port);
    urls = require('./urls')
    var server = http.createServer(urls.dispatch);
    server.listen(opts.port, opts.host);

    //set up client listeners
    console.log('  Initializing Client Listener');
    clients = require('./clients');
    protocol = require('./protocol');
    clients.init(server, protocol.handle);

    //done
    console.log('');
    console.log('Server Ready');
    console.log('');

    // Handle uncaught exceptions without crashing the server.  Don't
    // move this any earlier, as we want failure during init to crash
    // it.
    process.on('uncaughtException', function(err) {
      console.log('Uncaught Exception!');
      console.log(err.stack);
      console.log('NOTE: There\'s a good chance we\'ve just leaked some ' +
                  'memory.  Restarting would be a good idea.');
      console.log('');
    });
  });
});
