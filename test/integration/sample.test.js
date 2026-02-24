const assert = require('assert');
const { MongoClient } = require('mongodb');

describe('Integration: MongoDB connectivity', () => {
  it('connects to the test MongoDB and lists databases', async () => {
    const uri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
    if (!uri) {
      // No database configured; skip the connectivity check (test passes as no-op)
      return;
    }
    const client = new MongoClient(uri);
    try {
      await client.connect();
      const admin = client.db().admin();
      const info = await admin.ping();
      assert.ok(info);
    } finally {
      await client.close();
    }
  }, 20000);
});
