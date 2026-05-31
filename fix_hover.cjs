const fs = require('fs');
let file = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
file = file.replace(/shadow-\[0_4px_20px_rgba\(0,0,0,0\.03\)\]/g, 'shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300');
fs.writeFileSync('src/pages/Dashboard.tsx', file);
