const fs = require('fs');
const filePath = 'apps/server-bridge/test/vfs.test.js';
let content = fs.readFileSync(filePath, 'utf-8');

// Update to expect conflict
content = content.replace(
  /expect\(stats\)\.toEqual\(\{/,
  `expect(stats).toEqual({\n      conflict: 0,`
);
content = content.replace(
  /pending: 2,\n      approved: 1,\n      rejected: 1,\n      committed: 0\n    \}\)/g,
  `pending: 2,\n      conflict: 0,\n      approved: 1,\n      rejected: 1,\n      committed: 0\n    })`
);

content = content.replace(
  /pending: 1,\n        approved: 0,\n        rejected: 1,\n        committed: 0\n      \}\)/g,
  `pending: 1,\n        conflict: 0,\n        approved: 0,\n        rejected: 1,\n        committed: 0\n      })`
);

fs.writeFileSync(filePath, content);
