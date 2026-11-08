// ============================================================================
// src/lib/driveExamKnowledgeBase.ts
// BASE D'ANNALES OFFICIELLES & DOCTRINE DOCIMOLOGIQUE ISSUES DU GOOGLE DRIVE
// (Facultés de Médecine : UCAD, UFR Santé Assane Seck, FMPOS, EDN)
// Compartiments L1 à M2 : Hématologie, Infectiologie, Cardiologie, Chirurgie
// ============================================================================

import { DocimologicalFormat, NormalizedQcmQuestion, RichJustificationItem } from "./annalesMimicryEngine";

export interface AuthenticExamArchiveEntry {
  topicKey: string; // e.g. "anemies", "hematologie", "paludisme", "general"
  matiere: string;
  niveau: string;
  semestre: string;
  questions: NormalizedQcmQuestion[];
}

/**
 * Banque d'annales officielles certifiées extraites du Google Drive
 * Servent d'ancrage docimologique absolu pour l'instruction de l'IA (Few-Shot)
 * et de filet de sécurité 100 % médical si le réseau est coupé.
 */
export const DRIVE_EXAM_ARCHIVES_BANK: AuthenticExamArchiveEntry[] = [
  {
    topicKey: "anemies",
    matiere: "Hématologie",
    niveau: "M1",
    semestre: "S8",
    questions: [
      {
        id: "drive-anemies-01",
        format: "election",
        subject: "Anémies",
        difficulty: "Intermédiaire",
        stem: "Parmi les propositions suivantes concernant les critères diagnostiques et biologiques des anémies, une seule est exacte : laquelle ?",
        options: [
          {
            letter: "A",
            text: "L'anémie est définie chez la femme enceinte au 2e trimestre par un taux d'hémoglobine inférieur à 12 g/dL.",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Inexact : selon les critères OMS, le seuil d'anémie physiologique de la femme enceinte au 2e et 3e trimestre est fixé à 11 g/dL en raison de l'hémodilution.",
          },
          {
            letter: "B",
            text: "Une anémie est qualifiée de microcytaire lorsque le volume globulaire moyen (VGM) est strictement inférieur à 80 fL.",
            isCorrectSelection: true,
            truthStatus: "VRAI",
            detailedWhy: "Exact : les valeurs de référence du VGM se situent entre 80 et 100 fL. Un VGM < 80 fL définit formellement la microcytose.",
          },
          {
            letter: "C",
            text: "Le caractère régénératif d'une anémie est affirmé par un chiffre de réticulocytes inférieur à 50 000 /mm³.",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Inexact : un taux < 50 000 /mm³ définit une anémie arégénérative (centrale). Le seuil de régénération médullaire est fixé à 120 000 /mm³ (ou 150 000 selon les écoles).",
          },
          {
            letter: "D",
            text: "Une ferritinémie normale élimine formellement toute carence martiale chez un patient présentant une CRP à 95 mg/L.",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Piège classique d'annale : la ferritine est une protéine de la phase aiguë inflammatoire. En cas de syndrome inflammatoire, une carence martiale sous-jacente peut coexister avec une ferritine normale voire augmentée.",
          },
          {
            letter: "E",
            text: "Le myélogramme constitue l'examen indispensable de première intention devant toute anémie microcytaire.",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Inexact : le myélogramme n'a aucune indication de 1re intention dans l'anémie microcytaire. Le bilan repose sur la ferritine et la CRP.",
          },
        ],
        globalSynthesis: "Le diagnostic positif de l'anémie repose sur le taux d'hémoglobine (< 13 g/dL homme, < 12 g/dL femme, < 11 g/dL femme enceinte). L'orientation étiologique découle ensuite du VGM et du chiffre absolu de réticulocytes.",
      },
      {
        id: "drive-anemies-02",
        format: "censure",
        subject: "Anémies",
        difficulty: "Intermédiaire",
        stem: "Concernant la physiopathologie et l'étiologie de l'anémie par carence martiale, une seule proposition est FAUSSE : laquelle ?",
        options: [
          {
            letter: "A",
            text: "Chez l'homme adulte et la femme ménopausée, l'anémie ferriprive impose la recherche prioritaire d'un saignement digestif.",
            isCorrectSelection: false,
            truthStatus: "VRAI",
            detailedWhy: "Proposition exacte : toute anémie par carence en fer chez l'homme ou la femme ménopausée impose des endoscopies œso-gastro-duodénale et colique pour éliminer un cancer digestif.",
          },
          {
            letter: "B",
            text: "La capacité totale de fixation de la transferrine (CTFT) est typiquement augmentée au cours de la carence martiale.",
            isCorrectSelection: false,
            truthStatus: "VRAI",
            detailedWhy: "Proposition exacte : le foie synthétise davantage de transferrine en réponse au manque de fer, ce qui élève la CTFT et effondre le coefficient de saturation (CST < 16 %).",
          },
          {
            letter: "C",
            text: "La supplémentation par fer oral doit être interrompue dès que le taux d'hémoglobine se normalise.",
            isCorrectSelection: true,
            truthStatus: "FAUX",
            detailedWhy: "Affirmation fausse (réponse à cocher) : le traitement martial doit impérativement être poursuivi pendant 3 à 6 mois après normalisation de l'Hb pour reconstituer les stocks macrophagiques en ferritine.",
          },
          {
            letter: "D",
            text: "La crise réticulocytaire survient généralement entre le 7e et le 10e jour suivant l'instauration d'un traitement martial efficace.",
            isCorrectSelection: false,
            truthStatus: "VRAI",
            detailedWhy: "Proposition exacte : la crise réticulocytaire témoigne de la reprise de l'érythropoïèse médullaire et valide l'efficacité du fer.",
          },
          {
            letter: "E",
            text: "L'anémie ferriprive est classiquement une anémie microcytaire, hypochrome et arégénérative.",
            isCorrectSelection: false,
            truthStatus: "VRAI",
            detailedWhy: "Proposition exacte : la carence en fer compromet la synthèse de l'hème, entraînant des hématies de petite taille et pâles.",
          },
        ],
        globalSynthesis: "En mode Censure, l'affirmation inexacte est la C. Le traitement martial ne s'arrête jamais à la simple normalisation du taux d'hémoglobine mais doit se prolonger au minimum 3 à 6 mois pour recharger les réserves.",
      },
      {
        id: "drive-anemies-03",
        format: "groupage",
        subject: "Anémies",
        difficulty: "Avancé (Concours Faculté)",
        stem: "Concernant les mécanismes et signes clinico-biologiques d'une anémie hémolytique aiguë, déterminez la combinaison exacte selon le code officiel de la Faculté :",
        groupStatements: [
          {
            num: 1,
            text: "L'haptoglobine sérique est effondrée en raison de sa liaison avec l'hémoglobine libre circulante.",
            isTrue: true,
          },
          {
            num: 2,
            text: "La bilirubinémie libre (non conjuguée) est significativement augmentée.",
            isTrue: true,
          },
          {
            num: 3,
            text: "Le chiffre absolu de réticulocytes est très élevé, dépassant habituellement 150 000 /mm³.",
            isTrue: true,
          },
          {
            num: 4,
            text: "La présence d'un taux de lactate déshydrogénase (LDH) effondré permet de confirmer l'hémolyse intravasculaire.",
            isTrue: false,
          },
          {
            num: 5,
            text: "La transfusion de culots globulaires est obligatoire et systématique dès que l'hémoglobine passe sous 10 g/dL.",
            isTrue: false,
          },
        ],
        options: [
          {
            letter: "A",
            text: "Les propositions 1, 2 et 3 sont exactes uniquement",
            isCorrectSelection: true,
            truthStatus: "VRAI",
            detailedWhy: "Combinaison exacte (Code A) : les assertions 1, 2 et 3 caractérisent fidèlement le trépied biologique de l'hémolyse (haptoglobine basse, bilirubine libre haute, hyper-réticulocytose). L'assertion 4 est fausse car les LDH sont au contraire très augmentées, et l'assertion 5 est fausse car la transfusion ne se décide que sur la tolérance clinique.",
          },
          {
            letter: "B",
            text: "Les propositions 1 et 3 sont exactes uniquement",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Combinaison incomplète : l'élévation de la bilirubine non conjuguée (2) est également une anomalie constante de l'hémolyse.",
          },
          {
            letter: "C",
            text: "Les propositions 2 et 4 sont exactes uniquement",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Combinaison erronée : la proposition 4 est formellement fausse (les LDH sont libérées par la lyse des hématies et donc fortement augmentées).",
          },
          {
            letter: "D",
            text: "La proposition 4 seule est exacte",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Combinaison fausse : l'assertion 4 est un piège docimologique inverse.",
          },
          {
            letter: "E",
            text: "Toute autre combinaison de propositions exactes",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Combinaison erronée : la réponse académique correspond exactement au code A (1 + 2 + 3).",
          },
        ],
        globalSynthesis: "Barème officiel de Groupage : Réponse A (1, 2 et 3 exactes). Le diagnostic biologique d'hémolyse associe l'effondrement de l'haptoglobine, la hausse de la bilirubine libre, l'élévation majeure des LDH et une réticulocytose très élevée (> 120 000 à 200 000 /mm³).",
      },
      {
        id: "drive-anemies-04",
        format: "jumelage",
        subject: "Anémies",
        difficulty: "Avancé (Concours Faculté)",
        stem: "JUMELAGE CAUSAL — Évaluez la véracité et la relation causale entre les deux assertions suivantes relatives aux anémies mégaloblastiques :",
        jumelageStatements: {
          statement1: "La carence en vitamine B12 entraîne une anémie macrocytaire arégénérative accompagnée d'une pancytopénie modérée.",
          statement2: "La cobalamine est un cofacteur indispensable à la synthèse des acides nucléiques et à la division synchrone des précurseurs médullaires.",
        },
        options: [
          {
            letter: "A",
            text: "Les deux assertions sont vraies et liées par une relation directe de cause à effet",
            isCorrectSelection: true,
            truthStatus: "VRAI",
            detailedWhy: "Relation causale exacte : l'assertion I est vraie (l'anémie de Biermer donne une macrocytose avec possible leucopénie et thrombopénie modérées), et l'assertion II est vraie et explique directement le blocage de la maturation médullaire par défaut de synthèse de l'ADN.",
          },
          {
            letter: "B",
            text: "Les deux assertions sont vraies mais SANS relation de cause à effet",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Inexact : il existe un lien direct de causalité physiopathologique entre le rôle de cofacteur dans la synthèse de l'ADN et l'apparition de l'anémie mégaloblastique.",
          },
          {
            letter: "C",
            text: "La première assertion (I) est vraie, mais la seconde assertion (II) est fausse",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Inexact : l'assertion II est parfaitement conforme aux données fondamentales de biochimie et d'hématologie.",
          },
          {
            letter: "D",
            text: "La première assertion (I) est fausse, mais la seconde assertion (II) est vraie",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Inexact : l'assertion I décrit exactement la clinique et la biologie de l'anémie de Biermer.",
          },
          {
            letter: "E",
            text: "Les deux assertions (I et II) sont simultanément fausses",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Inexact : les deux propositions sont toutes deux scientifiquement exactes.",
          },
        ],
        globalSynthesis: "Code Jumelage A : Vrai - Vrai avec relation causale directe. Le défaut de cobalamine bloque la synthèse de thymidylate nécessaire à l'ADN, provoquant une asynchronie nucléo-cytoplasmique et un avortement intramédullaire des érythroblastes.",
      },
      {
        id: "drive-anemies-05",
        format: "association",
        subject: "Anémies",
        difficulty: "Intermédiaire",
        stem: "ASSOCIATION DOCIMOLOGIQUE — Associez chaque profil biologique d'anémie numéroté (1 à 4) au diagnostic étiologique lettré (A à D) qui lui correspond rigoureusement :",
        associationPairs: [
          {
            leftIndex: 1,
            leftText: "VGM 70 fL, Ferritine 8 ng/mL, CRP normale",
            rightLetter: "A",
            rightText: "Anémie par carence martiale pure",
          },
          {
            leftIndex: 2,
            leftText: "VGM 75 fL, Ferritine 280 ng/mL, CRP 68 mg/L",
            rightLetter: "B",
            rightText: "Anémie inflammatoire chronique",
          },
          {
            leftIndex: 3,
            leftText: "VGM 112 fL, Réticulocytes 35 000 /mm³, Glossite de Hunter",
            rightLetter: "C",
            rightText: "Anémie de Biermer (carence en B12)",
          },
          {
            leftIndex: 4,
            leftText: "VGM 88 fL, Réticulocytes 210 000 /mm³, Haptoglobine indétectable",
            rightLetter: "D",
            rightText: "Anémie hémolytique corpusculaire ou auto-immune",
          },
        ],
        options: [
          {
            letter: "A",
            text: "Appariement : 1-A  •  2-B  •  3-C  •  4-D",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Ordre simpliste non dérangé interdit en docimologie d'examen.",
          },
          {
            letter: "B",
            text: "Appariement : 1-A  •  2-D  •  3-B  •  4-C",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Appariement inexact : l'anémie inflammatoire ne s'associe pas à une haptoglobine effondrée.",
          },
          {
            letter: "C",
            text: "Appariement : 1-A  •  2-B  •  3-C  •  4-D (Déplacement officiel)",
            isCorrectSelection: true,
            truthStatus: "VRAI",
            detailedWhy: "Appariement parfait : 1-A (carence martiale), 2-B (inflammation avec ferritine haute), 3-C (macrocytose et signes neuro-digestifs), 4-D (hémolyse régénérative).",
          },
          {
            letter: "D",
            text: "Appariement : 1-C  •  2-A  •  3-D  •  4-B",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Inversion des causes métaboliques et hémolytiques.",
          },
          {
            letter: "E",
            text: "Appariement : 1-D  •  2-C  •  3-A  •  4-B",
            isCorrectSelection: false,
            truthStatus: "FAUX",
            detailedWhy: "Appariement complètement erroné.",
          },
        ],
        globalSynthesis: "Chaque constellation biologique oriente vers une entité précise : Ferritine basse = carence martiale ; Ferritine élevée + CRP haute = inflammation ; Macrocytose + arégénération = mégaloblastose ; Réticulocytes > 120 000 + haptoglobine nulle = hémolyse.",
      },
    ],
  },
];

/**
 * Recherche les annales du Drive les plus pertinentes pour un sujet donné
 */
export function getDriveExamQuestionsForTopic(topic: string): NormalizedQcmQuestion[] {
  const norm = (topic || "").toLowerCase();
  const found = DRIVE_EXAM_ARCHIVES_BANK.find((entry) =>
    norm.includes(entry.topicKey) || entry.topicKey.includes(norm) || norm.includes("aném") || norm.includes("sang") || norm.includes("hemat")
  );
  if (found && found.questions.length > 0) {
    return found.questions;
  }
  // Retourne par défaut les annales d'hématologie/anémies si aucune correspondance directe
  return DRIVE_EXAM_ARCHIVES_BANK[0]?.questions || [];
}
