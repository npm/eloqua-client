var tap = require('tap');
var eloqua = require('./eloqua');

var dotenv = require('dotenv');
dotenv.load();

eloqua(eloqua.basic(process.env.ELOQUA_COMPANY, process.env.ELOQUA_USERNAME, process.env.ELOQUA_PASSWORD)).then(function(client) {

  tap.test('test createExternalActivityCreationStream', function(t) {
    var s = client.createExternalActivityCreationStream()
    s.on('finish', t.end);
    s.on('error', errorOut);

    s.write({
      "name": "Test Package Interaction",
      "assetName": "public",
      "assetType": "Test Package Interaction",
      "activityType": "Publish",
      "campaignId": 5,
      "activityDate": Math.floor(Date.now() / 1000),
      "emailAddress": client.user.emailAddress
    });
    s.end({
      "name": "Test Package Interaction",
      "assetName": "@test/package",
      "assetType": "Test Package Interaction",
      "activityType": "Publish Specific",
      "campaignId": 5,
      "activityDate": Math.floor(Date.now() / 1000),
      "emailAddress": client.user.emailAddress
    });

    function errorOut(err) {
      t.error(err);
      t.end();
    }
  });
})
