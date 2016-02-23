var tap = require('tap');
var eloqua = require('./eloqua');

var dotenv = require('dotenv');
dotenv.load();

tap.test('test eloqua', function(t) {

  return eloqua(eloqua.basic(process.env.ELOQUA_COMPANY, process.env.ELOQUA_USERNAME, process.env.ELOQUA_PASSWORD)).then(function(client) {
    t.test('getContactId finds known contact', function(t) {
      return client.getContactId(client.user.emailAddress).then(function(id) {
        t.match(id, /^\d+/, 'id is a number');
      });
    });

    t.test('getContactId creates new contact', function(t) {
      return client.getContactId('test+' + Date.now() + '@npmjs.com').then(function(id) {
        t.match(id, /^\d+/, 'id is a number');
      });
    });

  })
})
