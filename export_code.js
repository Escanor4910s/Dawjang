import fs from 'fs';

const filesToExport = [
    "src/pages/Dashboard.tsx",
    "src/pages/Flashcards.tsx",
    "src/pages/Summaries.tsx",
    "src/pages/SummaryView.tsx",
    "src/pages/QuizLibrary.tsx",
    "src/pages/Quiz.tsx",
    "src/pages/Ecos.tsx",
    "src/pages/Review.tsx",
    "src/pages/ReviewPlanner.tsx",
    "src/pages/MyPlan.tsx"
];

const outputFile = "dashboard_pages_code.md";
let content = "";

for (const f of filesToExport) {
    content += `\n\n# File: ${f}\n\`\`\`tsx\n`;
    try {
        const fileContent = fs.readFileSync(f, 'utf8');
        content += fileContent;
    } catch (e) {
        content += `// Error reading file: ${e.message}\n`;
    }
    content += `\n\`\`\`\n`;
}

fs.writeFileSync(outputFile, content, 'utf8');
console.log(`Exported to ${outputFile}`);
