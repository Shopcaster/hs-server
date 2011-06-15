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
    // initialization order.
    db,
    urls,
    clients,
    protocol,
    email,
    templating;

cli.parse({
  port: ['p', 'Listen on this port', 'number', 8000],
  host: ['s', 'Listen on this hostname', 'string', '0.0.0.0'],
  dbhost: [false, 'Database server hostname', 'string', 'localhost'],
  dbport: [false, 'Database server port', 'number', 27017],
  dbname: [false, 'Database name', 'string', 'hipsell'],
  noemail: ['m', 'Disable email sending']
});

cli.main(function(args, opts) {
  console.log('Hipsell Server - Bonanza Branch');
  console.log('');

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
  });
});

