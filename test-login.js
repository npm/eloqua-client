var tap = require('tap');
var eloqua = require('./eloqua');

var dotenv = require('dotenv');
dotenv.load();

tap.test('test eloqua', function(t) {

  return eloqua(eloqua.basic(process.env.ELOQUA_COMPANY, process.env.ELOQUA_USERNAME, process.env.ELOQUA_PASSWORD)).then(function(client) {
    t.test('client properties and login', function(t) {
      t.ok(client, 'got client');
      t.match(client.urls.base, /^https:\/\/secure\..*\.eloqua\.com$/i, 'got pod url');
      t.end();
    });

  })
})
