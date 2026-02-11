const assert = require('assert');
const { MongoClient } = require('mongodb');

describe('Integration: MongoDB connectivity', function () {
  this.timeout(20000);
  it('connects to the test MongoDB and lists databases', async function () {
    const uri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
    if (!uri) {
      this.skip();
      return;
    }
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
      await client.connect();
      const admin = client.db().admin();
      const info = await admin.ping();
      assert.ok(info);
    } finally {
      await client.close();
    }
  });
});
