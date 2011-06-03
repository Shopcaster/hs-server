#!/usr/bin/env node

var cli = require('cli'),
    http = require('http'),
    db = require('./db'),
    urls = require('./urls'),
    clients = require('./clients'),
    protocol = require('./protocol'),
    email = require('./email');

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
  db.init(opts.dbhost, opts.dbport, opts.dbname, function() {

    console.log('  Initializing Email');
    email.init(opts.noemail);

    //set up http
    console.log('  Initializing HTTP on ' + opts.host + ':' + opts.port);
    var server = http.createServer(urls.dispatch);
    server.listen(opts.port, opts.host);

    //set up client listeners
    console.log('  Initializing Client Listener');
    clients.init(server, protocol.handle);

    //done
    console.log('');
    console.log('Server Ready');
    console.log('');
  });
});

