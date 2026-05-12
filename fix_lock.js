const fs = require('fs');

try {
  let content = fs.readFileSync('package-lock.json', 'utf8');

  // We simply want to accept our changes (or their changes) to resolve the merge conflict for package-lock.json since we just installed supertest.
  // Actually the easiest way to resolve a lockfile conflict is just deleting it and regenerating it, or running npm install.

} catch (e) {
  console.log(e);
}
