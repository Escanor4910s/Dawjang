declare const puter: any;

// ---- CONFIGURATION DU MODÈLE ----
const PUTER_AI_MODEL = "gemini-3.1-pro-preview"; // Tel que demandé par l'utilisateur

/**
 * Extrait le texte de la réponse de Puter AI de manière robuste.
 */
function extractPuterResponse(response: any): string {
  if (!response) return "";
  if (typeof response === "string") return response;
  if (response.message && typeof response.message.content === "string") return response.message.content;
  if (response.text && typeof response.text === "string") return response.text;
  return JSON.stringify(response);
}

/**
 * Génération de Résumé avec Puter AI
 */
export async function generateSummaryWithPuter(content: string, type: string, title?: string, template: string = "standard"): Promise<string> {
  const styleRules = `
FORMAT DE STRUCTURE STRICT:
- Sections principales: === TITRE DE SECTION ===
- Sous-sections: -- Sous-titre --
- Points avec puces: • pour les listes principales
- Sous-points: - pour les éléments détaillés
- Points validés: ✓ pour les points clés
- Flèches: → pour les conséquences ou liens
- Encadrés importants: [ POINT CRITIQUE À RETENIR ]
- Séparateurs entre grandes parties: Une ligne vide

**IMPORTANT - ILLUSTRATIONS CLINIQUES** : 
Là où un schéma anatomique, un algorithme diagnostique ou une illustration pathologique aiderait grandement la compréhension, tu DOIS insérer cette balise exacte, seule sur une ligne :
[ILLUSTRATION: <description très détaillée du schéma souhaité en anglais médical pour le générateur d'image>]
Exemple: [ILLUSTRATION: A detailed medical illustration showing the pathophysiology of heart failure, high quality, textbook style]

RÈGLES DE CONTENU:
- JAMAIS de hashtag (#) dans le texte
- Phrases complètes et claires
- Vocabulaire médical précis
- Chaque section doit contenir du contenu substantiel
- Ne pas créer de sections vides
- Structurer logiquement l'information`;

  let typeInstructions = "";
  let lengthGuidelines = "";

  switch (type) {
    case "complete":
      typeInstructions = `Crée un RÉSUMÉ COMPLET et DÉTAILLÉ du cours, format cours magistral médical.\n${styleRules}\nSTRUCTURE À SUIVRE:\n=== ${title?.toUpperCase() || "RÉSUMÉ COMPLET"} ===\n-- Introduction --\n• Contexte et importance du sujet\n• Définition claire et précise\n-- Physiopathologie --\n• Mécanismes physiopathologiques détaillés\n• Étiologies principales\n-- Clinique --\n• Signes fonctionnels (symptômes rapportés)\n• Signes généraux\n• Signes physiques à l'examen\n-- Examens complémentaires --\n• Biologie\n• Imagerie\n-- Diagnostic différentiel --\n• Pathologies à éliminer\n-- Complications --\n• Complications aiguës\n• Complications chroniques\n-- Traitement --\n• Traitement médical\n• Traitement chirurgical si applicable\n-- Prévention --\n• Mesures préventives\n[ POINTS CLÉS À RETENIR ]\n✓ Point essentiel 1\n✓ Point essentiel 2\n✓ Pièges à éviter`;
      lengthGuidelines = "Résumé détaillé de 2000 à 6000 mots. Chaque section doit être complète et informative.";
      break;
    case "structured":
      typeInstructions = `Crée un RÉSUMÉ STRUCTURÉ et ÉQUILIBRÉ du cours.\n${styleRules}\nSTRUCTURE:\n=== ${title?.toUpperCase() || "RÉSUMÉ STRUCTURÉ"} ===\n-- Définition --\n• Définition concise et complète\n-- Physiopathologie --\n• Mécanisme principal\n• Facteurs de risque\n-- Tableau clinique --\n• Signes majeurs\n-- Examens --\n• Examens de première intention\n-- Traitement --\n• Objectifs thérapeutiques\n[ RÉSUMÉ RAPIDE ]\n→ Point synthétique 1`;
      lengthGuidelines = "Résumé de 500 à 2000 mots. Équilibre entre exhaustivité et concision.";
      break;
    case "concise":
    default:
      typeInstructions = `Crée une FICHE D'EXAMEN ultra-concise et mémorisable.\n${styleRules}\nSTRUCTURE (20-30 lignes max):\n=== FICHE FLASH: ${title?.toUpperCase() || "RÉSUMÉ"} ===\n-- Définition --\n✓ Définition en une phrase\n-- Physiopathologie --\n✓ Mécanisme clé\n-- Clinique --\n✓ Signe cardinal 1\n-- Diagnostic --\n✓ Examen de référence\n-- Traitement --\n✓ Traitement de première ligne\n-- Complications --\n✓ Complication majeure à connaître\n[ À NE PAS OUBLIER ]\n→ Le piège classique de l'examen`;
      lengthGuidelines = "Fiche très courte: 150-400 mots maximum. Seulement l'essentiel.";
      break;
  }

  if (template === "objectives") {
    typeInstructions = `RÉDIGE LE RÉSUMÉ EN SUIVANT FIDÈLEMENT LES OBJECTIFS PÉDAGOGIQUES DU COURS.\n\nCONSEILS D'OBJECTIFS :\n1. Recherche impérativement dans le cours s'il y a une diapositive ou section "objectifs".\n2. Structure l'ensemble de ton résumé pour répondre à chacun de ces objectifs (ex: "-- Objectif 1: [titre] --").\n3. Si pas d'objectifs explicites, identifie les 3 à 5 compétences cliniques cruciales.\n\n${styleRules}\n\nSTRUCTURE DU RÉSUMÉ :\n=== OBJECTIFS CLINIQUES: ${title?.toUpperCase() || "RÉSUMÉ DE COURS"} ===\n-- Objectif 1: [ Intitulé ] --\n• Explications cliniques\n[ ACQUISITION DES OBJECTIFS MÉDICAUX ]\n✓ Compétence critique 1 validée`;
    lengthGuidelines = type === "concise" ? "Fiche d'objectifs concise : 250-500 mots." : type === "structured" ? "Résumé d'objectifs équilibré : 800-2000 mots." : "Résumé d'objectifs complet et exhaustif : 2000-5000 mots.";
  }

  const systemPrompt = `Tu es un assistant médical expert spécialisé dans la création de fiches pédagogiques professionnelles pour étudiants en médecine.\n\n${typeInstructions}\n\n${lengthGuidelines}\n\nRÈGLES CRITIQUES:\n1. JAMAIS de hashtag (#) - utilise === et -- pour les titres\n2. Utilise le français médical correct et précis\n3. Sois factuel, ne rajoute RIEN qui n'est pas dans le cours\n4. Style élégant, professionnel, facile à lire\n5. Utilise les icônes médicales avec parcimonie\n6. Encadrés [ ] pour les points importants\n7. Listes avec • ✓ → selon le contexte`;

  const userPrompt = `Titre du cours: ${title || "Non spécifié"}\n\nContenu du cours à résumer:\n${content.substring(0, 30000)}\n\nGénère le résumé selon les instructions données.`;

  console.log(`[Puter AI] Generating summary of type: ${type}`);
  const response = await puter.ai.chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], { model: PUTER_AI_MODEL });

  return extractPuterResponse(response);
}

/**
 * Génération de QCM avec Puter AI
 */
export async function generateQuizWithPuter(content: string, nbQuestions: number, type: string, difficulty: string = "facile"): Promise<any[]> {
  const baseFormat = `Tu es un expert en génération de QCM médicaux de niveau universitaire. Tu dois IMPÉRATIVEMENT répondre UNIQUEMENT avec un array JSON valide, sans aucun texte avant ou après.

IMPORTANT - VARIÉTÉ ET ORIGINALITÉ:
- Génère des questions UNIQUES et VARIÉES à chaque appel
- Varie les formulations
- Alterne entre questions positives et négatives

Format EXACT requis:
[
  {
    "question": "Texte de la question?",
    "choices": ["Choix A", "Choix B", "Choix C", "Choix D", "Choix E"],
    "correct": [0],
    "explanation": "Explication détaillée"
  }
]

RÈGLES STRICTES:
- "question": string
- "choices": array de 5 strings
- "correct": array d'index (0-based) des bonnes réponses
- "explanation": string
- PAS de texte hors JSON, PAS de markdown
- SEULEMENT le JSON`;

  let systemPrompt = baseFormat;
  if (difficulty === "facile") {
    systemPrompt += `\n\nNIVEAU FACILE:\n- UNE SEULE bonne réponse par question\n- Formulation directe, sans pièges\n- Les réponses doivent être retrouvables dans le texte`;
  } else if (difficulty === "intermediaire") {
    systemPrompt += `\n\nNIVEAU INTERMÉDIAIRE:\n- 1 à 5 bonnes réponses possibles\n- Reformulation intelligente\n- Nuances diagnostiques ou thérapeutiques`;
  } else if (difficulty === "difficile") {
    systemPrompt += `\n\nNIVEAU DIFFICILE:\n- Enrichi avec des connaissances médicales externes\n- Raisonnement et analyse complexe\n- 1 à 5 bonnes réponses possibles\n- Niveau concours/internat médical`;
  }

  let userPrompt = `Génère exactement ${nbQuestions} QCM CLASSIQUES.\n- 5 choix (A-E), 1 à 5 bonnes réponses\n- Explication détaillée\n\nCours médical:\n${content}`;
  
  if (type === "groupage") {
    userPrompt = `Génère exactement ${nbQuestions} QCM de type GROUPAGE.\nSTRUCTURE GROUPAGE - TRÈS IMPORTANT:\n- La question DOIT contenir l'énoncé principal SUIVI de 5 affirmations numérotées, chacune sur sa propre ligne\n- Les "choices" doivent être EXACTEMENT: ["A", "B", "C", "D", "E"]\n- Le barème est: A=1+2+3 vraies, B=1+3 vraies, C=2+4 vraies, D=4 uniquement, E=autre combinaison\n- L'explication doit détailler pourquoi chaque affirmation est vraie ou fausse\n\nCours médical:\n${content}`;
  } else if (type === "election") {
    userPrompt = `Génère exactement ${nbQuestions} QCM de type ÉLECTION.\nRÈGLES ÉLECTION:\n- EXACTEMENT 1 SEULE bonne réponse parmi 5 propositions\n- Les 4 autres sont TOUTES FAUSSES\n- correct contient UN SEUL index\n- 5 choix (A-E)\n\nCours médical:\n${content}`;
  } else if (type === "censure") {
    userPrompt = `Génère exactement ${nbQuestions} QCM de type CENSURE.\nRÈGLES CENSURE:\n- EXACTEMENT 1 SEULE mauvaise réponse parmi 5 propositions\n- Les 4 autres sont TOUTES VRAIES\n- correct contient UN SEUL index correspondant à la FAUSSE proposition\n- Varie les formulations: "laquelle est FAUSSE?", "SAUF UNE. Laquelle?"\n- 5 choix (A-E)\n\nCours médical:\n${content}`;
  } else if (type === "cas-cliniques") {
    userPrompt = `Génère exactement ${nbQuestions} QCM basés sur des CAS CLINIQUES.\n- Vignette clinique + question diagnostique/thérapeutique\n- 5 choix, 1 à 5 bonnes réponses\n\nCours médical:\n${content}`;
  } else if (type === "vrai-faux") {
    userPrompt = `Génère exactement ${nbQuestions} QCM VRAI/FAUX.\n- choices: ["Vrai", "Faux"]\n- correct: [0] pour Vrai ou [1] pour Faux\n\nCours médical:\n${content}`;
  }

  console.log(`[Puter AI] Generating ${nbQuestions} questions (${type}, ${difficulty})`);
  
  const response = await puter.ai.chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], { model: PUTER_AI_MODEL });

  const rawOutput = extractPuterResponse(response);
  
  try {
    let cleaned = rawOutput.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    cleaned = cleaned.trim();
    
    const qcm = JSON.parse(cleaned);
    if (!Array.isArray(qcm)) throw new Error('Le résultat n\'est pas un tableau JSON');
    
    const validatedQcm = qcm.filter((q: any) => {
      if (!q.question || !Array.isArray(q.choices) || !Array.isArray(q.correct)) return false;
      return true;
    });
    
    if (validatedQcm.length === 0) throw new Error('Aucune question valide générée');
    
    return validatedQcm;
  } catch (parseError) {
    console.error('[Puter AI] JSON parsing failed:', parseError);
    return [{ 
      question: "⚠️ Erreur lors de la génération avec Puter", 
      choices: ["Réessayer", "Fichier différent", "Support", "Autre", "N/A"],
      correct: [0],
      explanation: "L'IA n'a pas renvoyé un format valide. Veuillez réessayer."
    }];
  }
}

/**
 * Assistant Mor avec Puter AI
 */
export async function askMorWithPuter(chatHistory: {role: "user" | "assistant", content: string}[], courseContent: string, courseTitle: string = "Cours"): Promise<{answer: string, sources: any[]}> {
  if (chatHistory.length === 0) throw new Error("L'historique est vide");
  
  const lastUserMessage = chatHistory[chatHistory.length - 1].content;
  
  const FORBIDDEN_PATTERNS = [
    /j'ai (mal|des douleurs|des symptômes)/i,
    /je (ressens|souffre de|présente)/i,
    /dois-je (prendre|consulter|aller)/i,
    /quel (médicament|traitement|dosage)/i,
    /combien de (mg|grammes|doses)/i,
    /diagnostic|prescription|ordonnance/i,
    /mon cas|ma situation|pour moi/i,
  ];

  if (FORBIDDEN_PATTERNS.some(pattern => pattern.test(lastUserMessage))) {
    return {
      answer: "🩺 Je peux expliquer la théorie médicale, mais je ne peux pas donner de diagnostic ni de conseil médical personnalisé. Consultez un professionnel de santé pour votre situation.",
      sources: [],
    };
  }

  const SYSTEM_PROMPT = `Tu es Mor, un tuteur virtuel en médecine interactif, expert et chaleureux. Ton rôle est d'expliquer, clarifier et enseigner.

RÈGLES :
1. Sois très interactif et prends en compte la conversation en cours.
2. Si on te dit bonjour, réponds amicalement en proposant ton aide sur le cours en question, SANS générer un gros bloc de cours si aucune question précise n'est posée.
3. Utilise d'abord le contenu du cours fourni pour répondre aux questions médicales.
4. Complète avec tes connaissances médicales générales si nécessaire.
5. Sois pédagogue, concis et structure tes réponses.
6. REFUSE tout diagnostic ou conseil médical personnalisé.

Format de réponse : clair, naturel, interactif (pose des questions si pertinent), avec quelques emojis (🩺💡).`;

  // Basic excerpt extraction based on the latest question
  const questionKeywords = lastUserMessage.toLowerCase().split(/\s+/).filter(word => word.length > 3);
  let relevantContent = "";
  if (courseContent && questionKeywords.length > 0) {
    const sentences = courseContent.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const scoredSentences = sentences.map(sentence => {
      const lowerSentence = sentence.toLowerCase();
      const score = questionKeywords.reduce((acc, keyword) => acc + (lowerSentence.includes(keyword) ? 1 : 0), 0);
      return { sentence: sentence.trim(), score };
    });
    
    const relevantSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .filter(s => s.score > 0)
      .map(s => s.sentence);
      
    if (relevantSentences.length > 0) {
      relevantContent = relevantSentences.join(". ") + ".";
      if (relevantContent.length > 2500) relevantContent = relevantContent.substring(0, 2500) + "...";
    }
  }

  const sources = [];
  if (relevantContent.length > 100) sources.push({ type: "course", text: `Cours: ${courseTitle}` });
  if (relevantContent.length <= 200 && questionKeywords.length > 0) sources.push({ type: "web", text: "Connaissances générales" });

  const messagesForPuter = [{ role: "system", content: SYSTEM_PROMPT }];
  
  chatHistory.forEach((msg, index) => {
    if (index === chatHistory.length - 1 && msg.role === "user") {
        messagesForPuter.push({
            role: "user",
            content: relevantContent.length > 0 
                ? `📚 CONTEXTE DU COURS "${courseTitle}" :\n${relevantContent}\n\n---\n\nMessage de l'étudiant : ${msg.content}\n\nInstructions pour ta réponse :\n1. Agis comme un tuteur dans une discussion naturelle.\n2. Si la question nécessite le cours, base-toi dessus en priorité.\n3. Indique si l'info vient du cours ou non.`
                : `Message de l'étudiant : ${msg.content}\n\nInstructions :\nRéponds de manière interactive au message de l'étudiant. S'il dit salut, sois accueillant et demande ce qu'il souhaite réviser sur "${courseTitle}". S'il pose une question sans rapport au cours, utilise tes connaissances générales.`
        });
    } else {
        messagesForPuter.push(msg as any);
    }
  });

  console.log(`[Puter AI] Calling AskMor with history length: ${chatHistory.length}`);
  const response = await puter.ai.chat(messagesForPuter, { model: PUTER_AI_MODEL });

  return {
    answer: extractPuterResponse(response),
    sources
  };
}
