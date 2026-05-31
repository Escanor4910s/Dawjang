const fs = require('fs');
let content = fs.readFileSync('old_gensum.tsx', 'utf16le');
content = content.replace(/import \{ useNavigate \} from \"react-router-dom\";/, 'import { useNavigate } from "react-router-dom";\nimport { AnimatedBanner } from "@/components/AnimatedBanner";');
content = content.replace(/<div className=\"text-center mb-6 sm:mb-8 pt-8 sm:pt-0\">[\s\S]*?<\/div>/, '<AnimatedBanner title="Génération de Synthèse." subtitle="Uploadez votre cours. L\'intelligence artificielle le transforme en polycopié éditorial." />');
fs.writeFileSync('src/pages/GenerateSummary.tsx', content, 'utf8');
console.log('Done');
