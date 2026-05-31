const fs = require('fs');
let file = fs.readFileSync('src/pages/ReviewPlanner.tsx', 'utf8');
file = file.replace(/hover:border-black\/10/g, 'hover:border-black');
file = file.replace(/bg-gray-50 border-black/g, 'bg-white border border-black');
fs.writeFileSync('src/pages/ReviewPlanner.tsx', file);
