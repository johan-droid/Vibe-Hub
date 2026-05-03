import fs from 'fs';
const content = fs.readFileSync('apps/user-interface/src/vfs/container.js', 'utf-8');
const fixed = content.replace(/<<<<<<< HEAD[\s\S]*?=======[\s\S]*?>>>>>>> origin\/main\n?/m, "            if (filePattern && !fullPath.match(new RegExp(filePattern.split('*').map(s => s.replace(/[.*+?^${}()|[\\]\\\\]/g, (m) => '\\\\' + m)).join('.*')))) return;\n");
fs.writeFileSync('apps/user-interface/src/vfs/container.js', fixed);
console.log('Conflict resolved');
