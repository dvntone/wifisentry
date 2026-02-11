#!/usr/bin/env node
// Simple env validator: node utils/validate-env.js VAR1 VAR2 ...
const required = process.argv.slice(2);
if (required.length === 0) {
  console.error('Usage: node utils/validate-env.js VAR_NAME [VAR_NAME ...]');
  process.exit(2);
}
let missing = [];
for (const v of required) {
  if (!process.env[v]) missing.push(v);
}
if (missing.length > 0) {
  console.error('Missing required environment variables: ' + missing.join(', '));
  process.exit(1);
}
console.log('All required environment variables present:', required.join(', '));
process.exit(0);
