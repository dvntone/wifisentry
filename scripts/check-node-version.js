const version = process.versions.node;
const majorVersion = parseInt(version.split('.')[0]);

if (majorVersion < 18) {
  console.error(`❌ Node.js 18+ required (you have ${version})`);
  console.error('Update Node.js: https://nodejs.org/');
  process.exit(1);
}
