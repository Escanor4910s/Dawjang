import fs from 'fs';

const data = fs.readFileSync('dashboard_pages_code.md', 'utf8');
const files = data.split('# File: ');

files.forEach(f => {
  if (f.startsWith('src/pages/QuizLibrary.tsx')) {
    fs.writeFileSync('old_QuizLibrary.txt', f);
  }
  if (f.startsWith('src/pages/ReviewPlanner.tsx')) {
    fs.writeFileSync('old_ReviewPlanner.txt', f);
  }
});
console.log("Extracted old files.");
