// ============================================================================
// disciplineProfileEngine.ts — Moteur Universel & Adaptatif de Profil Disciplinaire
// Détecte dynamiquement la spécialité d'un cours / d'une UE (sans jamais rester
// figé sur Hématologie, Orthopédie ou UCAD) et fournit les axes cliniques,
// grilles d'interprétation, tableaux différentiels et l'isolation multi-matières.
// ============================================================================

export type DomainFamily =
  | "traumatologie"
  | "orthopedie"
  | "rhumatologie"
  | "hematologie"
  | "cardiologie"
  | "pneumologie"
  | "neurologie"
  | "nephrologie"
  | "hepato_gastro"
  | "endocrinologie"
  | "infectiologie"
  | "pediatrie"
  | "gyneco_obstetrique"
  | "chirurgie"
  | "urologie"
  | "urgence_rea"
  | "dermatologie"
  | "orl_ophtalmo"
  | "pharmacologie"
  | "anatomie"
  | "immunologie"
  | "general";

export const COMPREHENSIVE_MEDICAL_SUBJECTS: string[] = [
  "Auto-détection selon le cours",
  "Traumatologie",
  "Orthopédie",
  "Rhumatologie",
  "Hématologie",
  "Cardiologie",
  "Pneumologie",
  "Neurologie",
  "Néphrologie",
  "Hépato-Gastro-Entérologie",
  "Infectiologie / Maladies Infectieuses",
  "Endocrinologie & Métabolisme",
  "Pédiatrie",
  "Gynécologie-Obstétrique",
  "Chirurgie Générale & Viscérale",
  "Urologie",
  "Dermatologie",
  "Ophtalmologie",
  "ORL & Stomatologie",
  "Urgences & Réanimation",
  "Immunologie & Maladies de Système",
  "Pharmacologie",
  "Anatomie",
  "Psychiatrie",
  "Santé Publique",
];

export const SUBJECT_FILTERS = ["Tous", ...COMPREHENSIVE_MEDICAL_SUBJECTS];

export interface ConfrontationAxisRow {
  criterion: string;
  courseGuidance: string;
  diff1Guidance: string;
  diff2Guidance: string;
  diff3Guidance: string;
}

export interface ClinicalCaseStepTemplate {
  stepNumber: number;
  title: string;
  bullets: string[];
}

export interface InterpretationDirectiveRule {
  trigger: RegExp;
  title: string;
  steps: string[];
}

export interface DisciplineProfile {
  domainFamily: DomainFamily;
  subjectLabel: string;
  specialistPersona: string;
  examFocusAxes: string[];
  interpretationDirectives: InterpretationDirectiveRule[];
  confrontationRows: ConfrontationAxisRow[];
  clinicalCaseSteps: ClinicalCaseStepTemplate[];
  fallbackObjectives: (cleanTitle: string) => string[];
  lexiconClusters: Array<{ triggers: string[]; expansions: string[] }>;
  exclusionPeerKeywords: string[];
}

export function normalizeDisciplineText(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface DomainRuleDef {
  family: DomainFamily;
  label: string;
  persona: string;
  subjectPatterns: RegExp[];
  contentPatterns: RegExp[];
}

const DOMAIN_RULES: DomainRuleDef[] = [
  {
    family: "traumatologie",
    label: "Traumatologie",
    persona: "Professeur Agrégé de Traumatologie et Chirurgie Orthopédique",
    subjectPatterns: [
      /\btraumatolog/i,
      /\btraumato\b/i,
      /\bpolytraum/i,
      /\bfractures?\b/i,
      /\bluxations?\b/i,
      /\bentorses?\b/i,
    ],
    contentPatterns: [
      /\bfracture/i,
      /\bluxation/i,
      /\bentorse/i,
      /\bpolytraumatis/i,
      /\bgustilo/i,
      /\bcauchoix/i,
      /\bduparc/i,
      /\bgarden\b/i,
      /\bpauwels/i,
      /\bdelbet/i,
      /\bschatzker/i,
      /\bneer\b/i,
      /\bdenis\b/i,
      /\bmagerl/i,
      /\bosteosynthese/i,
      /\benclouage/i,
      /\bfixateur\s+externe/i,
      /\bsyndrome\s+des\s+loges/i,
      /\bembolie\s+graisseuse/i,
      /\bpseudarthrose/i,
      /\bcal\s+vicieux/i,
      /\bnecrose\s+(?:de\s+la\s+tete|aseptique)/i,
      /\bplaie\s+(?:articulaire|de\s+la\s+main|vasculo)/i,
      /\bcompression\s+(?:medullaire|nerveuse|sciatique|radiale|cubitale|ulnaire|spe)\b/i,
      /\bsat\b.*\bvat\b|\bantibioth[eé]rapie\s+prophylactique/i,
      /\bimmobilisation\s+platr[eé]e/i,
      /\breduction\s+(?:orthopedique|chirurgicale|en\s+urgence)/i,
    ],
  },
  {
    family: "orthopedie",
    label: "Orthopédie",
    persona: "Professeur Agrégé de Chirurgie Orthopédique",
    subjectPatterns: [/\borthoped/i, /\bortho\b/i],
    contentPatterns: [
      /\bscoliose/i,
      /\bangle\s+de\s+cobb/i,
      /\brisser\b/i,
      /\bcoxarthrose/i,
      /\bgonarthrose/i,
      /\barthrose\b/i,
      /\bluxation\s+congenitale\s+de\s+hanche|\blch\b/i,
      /\bpied\s+bot/i,
      /\bosteochondr/i,
      /\bscheuermann/i,
      /\bosteomyelite/i,
      /\barthrite\s+septique/i,
      /\bmal\s+de\s+pott/i,
      /\bosteosarcome/i,
      /\bsarcome\s+d\s*ewing/i,
      /\bprothese\s+totale/i,
      /\bosteotomie/i,
      /\bcorset\b/i,
      /\blombaire\b|\blombosciatique\b/i,
      /\btumeur\s+osseuse/i,
      /\bepiphysiolyse/i,
    ],
  },
  {
    family: "rhumatologie",
    label: "Rhumatologie",
    persona: "Professeur Agrégé de Rhumatologie",
    subjectPatterns: [/\brhumatolog/i, /\brhumato\b/i],
    contentPatterns: [
      /\bpolyarthrite\s+rhumatoide/i,
      /\bspondylarthrite\s+ankylosante|\bspa\b/i,
      /\bhla\s*b27/i,
      /\banti\s*ccp/i,
      /\bfacteur\s+rhumatoide/i,
      /\bgoutte\b/i,
      /\bchondrocalcinose/i,
      /\bosteoporose\b/i,
      /\bt[\s-]?score/i,
      /\bbisphosphonate/i,
      /\bosteomalacie/i,
      /\bmaladie\s+de\s+paget/i,
      /\bspondyloarthropathie/i,
      /\bpseudo[\s-]?polyarthrite\s+rhizomelique/i,
      /\bhorton\b/i,
      /\blombosciatique\b|\bcruralgie\b/i,
      /\bponction\s+articulaire/i,
      /\bliquide\s+(?:synovial|mecanique|inflammatoire)/i,
    ],
  },
  {
    family: "hematologie",
    label: "Hématologie",
    persona: "Professeur Agrégé d'Hématologie Clinique",
    subjectPatterns: [/\bhematolog/i, /\bhemato\b/i],
    contentPatterns: [
      /\bhemogramme/i,
      /\bhemoglobinopathie|\bdrepanocytose|\bthalassemie/i,
      /\breticulocyte/i,
      /\bfrottis\s+sanguin/i,
      /\bmyelogramme|\bbiopsie\s+osteo[\s-]?medullaire/i,
      /\baplasie\s+medullaire|\bcamitta/i,
      /\bleucemie\b|\bbinet\b|\bmatutes\b/i,
      /\blymphome\b|\bhodgkin\b|\bann\s+arbor/i,
      /\bmyelome\b|\bbence\s+jones|\bcrab\b/i,
      /\bhemophilie\b|\bwillebrand\b|\bcivd\b/i,
      /\bthrombopenie\b|\bpancytopenie\b/i,
      /\banemie\b|\bvgm\b|\bccmh\b|\btcmh\b/i,
      /\bpolyglobulie\b|\bvaquez\b/i,
      /\btransfusion\b|\bhemovigilance\b/i,
    ],
  },
  {
    family: "cardiologie",
    label: "Cardiologie",
    persona: "Professeur Agrégé de Cardiologie et Pathologie Vasculaire",
    subjectPatterns: [/\bcardiolog/i, /\bcardio\b/i, /\bcardiovascul/i],
    contentPatterns: [
      /\belectrocardiogramme|\becg\b/i,
      /\bsus[\s-]?decalage\s+st|\bsyndrome\s+coronarien|\bsca\b|\bidm\b/i,
      /\binsuffisance\s+cardiaque|\bnyha\b|\bkillip\b/i,
      /\btroponine|\bbnp|\bnt[\s-]?pro[\s-]?bnp/i,
      /\bfibrillation\s+auriculaire|\bcha2ds2/i,
      /\bendocardite\s+infectieuse|\bdukes?\b/i,
      /\bvalvulopathie|\bretrecissement\s+(?:mitral|aortique)/i,
      /\binsuffisance\s+(?:mitrale|aortique)/i,
      /\bembolie\s+pulmonaire|\bd[\s-]?dimeres/i,
      /\bhypertension\s+arterielle|\bhta\b/i,
      /\bpericardite|\btamponnade/i,
      /\bdissection\s+aortique/i,
      /\bcoronarographie|\bfraction\s+d\s*ejection|\bfevg\b/i,
    ],
  },
  {
    family: "pneumologie",
    label: "Pneumologie",
    persona: "Professeur Agrégé de Pneumologie",
    subjectPatterns: [/\bpneumolog/i, /\bpneumo\b/i],
    contentPatterns: [
      /\bbpco\b|\bgold\b|\bvems\b|\btiffeneau\b/i,
      /\basthme\b|\bgina\b|\bspirometrie|\befr\b/i,
      /\bgazometrie\s+arterielle|\bpao2\b|\bpaco2\b/i,
      /\btuberculose\s+pulmonaire|\bbk\b|\bgenexpert/i,
      /\bpneumothorax|\bepanchement\s+pleural|\bpleuresie|\blight\b/i,
      /\bpneumonie|\bpneumopathie/i,
      /\bcancer\s+bronchique|\btdm\s+thoracique/i,
      /\bfibroscopie\s+bronchique|\blba\b/i,
      /\binsuffisance\s+respiratoire/i,
    ],
  },
  {
    family: "neurologie",
    label: "Neurologie",
    persona: "Professeur Agrégé de Neurologie",
    subjectPatterns: [/\bneurolog/i, /\bneuro\b/i],
    contentPatterns: [
      /\bavc\b|\baccident\s+vasculaire\s+cerebral|\bnihss\b|\bthrombolyse\b/i,
      /\bepilepsie|\bcrise\s+comitiale|\beeg\b/i,
      /\bmeningite|\bponction\s+lombaire|\blcr\b/i,
      /\bsclerose\s+en\s+plaques|\bmacdonald\b/i,
      /\bparkinson|\bmyasthenie|\bguillain[\s-]?barre/i,
      /\bsign[e]?s?\s+de\s+babinski|\bscore\s+de\s+glasgow/i,
      /\bmigraine|\bcephalee|\bhtic\b/i,
      /\birm\s+cerebrale|\belectromyogramme|\bemg\b/i,
      /\bhemiplegie|\bparaplegie|\bataxie\b/i,
    ],
  },
  {
    family: "nephrologie",
    label: "Néphrologie",
    persona: "Professeur Agrégé de Néphrologie",
    subjectPatterns: [/\bnephrolog/i, /\bnephro\b/i],
    contentPatterns: [
      /\binsuffisance\s+renale|\bira\b|\birc\b|\bdfg\b|\bkdigo\b|\bckd[\s-]?epi\b/i,
      /\bsyndrome\s+nephrotique|\bproteinurie/i,
      /\bsyndrome\s+nephritique|\bglomerulonephrite/i,
      /\bionogramme|\bhyperkaliemie|\bhyponatremie/i,
      /\bponction\s+biopsie\s+renale|\bpbr\b/i,
      /\bhemodialyse|\bdialyse|\bepuration\s+extra/i,
      /\bpolykystose\s+renale/i,
    ],
  },
  {
    family: "hepato_gastro",
    label: "Hépato-Gastro-Entérologie",
    persona: "Professeur Agrégé d'Hépato-Gastro-Entérologie",
    subjectPatterns: [/\bgastro/i, /\bhepato/i, /\bhge\b/i],
    contentPatterns: [
      /\bcirrhose|\bchild[\s-]?pugh|\bmeld\b|\bhypertension\s+portale/i,
      /\bhepatite\b|\baghbs|\btransaminases|\bpalat|\basat\b/i,
      /\bpancreatite|\branson|\bbalthazar|\blipase/i,
      /\bulcere\s+gastro|\bhelicobacter\s+pylori/i,
      /\brgo\b|\bhemorragie\s+digestive|\bfibroscopie\s+oeso|\bfogd\b/i,
      /\bmici\b|\bmaladie\s+de\s+crohn|\bcolite\s+ulcereuse|\brch\b/i,
      /\bascite\b|\bictere\b|\bcoloscopie\b/i,
    ],
  },
  {
    family: "endocrinologie",
    label: "Endocrinologie & Métabolisme",
    persona: "Professeur Agrégé d'Endocrinologie et Diabétologie",
    subjectPatterns: [/\bendocrinolog/i, /\bdiabetolog/i, /\bendocrino/i],
    contentPatterns: [
      /\bdiabete\b|\bhba1c\b|\bacidocetose\b|\bhypoglycemie/i,
      /\bhyperthyroidie|\bhypothyroidie|\bbasedow\b|\bhashimoto\b|\btsh\b/i,
      /\bcushing\b|\baddison\b|\binsuffisance\s+surrenalienne/i,
      /\bpheochromocytome|\bhyperparathyroidie|\bhypercalcemie/i,
      /\bacromegalie|\bprolactinome|\badénome\s+hypophysaire/i,
    ],
  },
  {
    family: "infectiologie",
    label: "Infectiologie / Maladies Infectieuses",
    persona: "Professeur Agrégé de Maladies Infectieuses et Tropicales",
    subjectPatterns: [/\binfectiolog/i, /\bmaladies?\s+infectieuses?/i, /\bmit\b/i],
    contentPatterns: [
      /\bpaludisme|\bplasmodium|\bgoutte\s+epaisse|\btdr\b/i,
      /\bvih\b|\bsida\b|\bcd4\b|\bantiretrovir/i,
      /\bfievre\s+typhoide|\bsalmonell/i,
      /\bsepsis\b|\bchoc\s+septique|\bhemoculture/i,
      /\bmeningite\b|\bendocardite|\bpneumopathie|\btetanus|\btetano/i,
      /\bantibiogramme|\bantibiotherapie|\bantifongique|\bantiparasitaire/i,
    ],
  },
  {
    family: "pediatrie",
    label: "Pédiatrie",
    persona: "Professeur Agrégé de Pédiatrie",
    subjectPatterns: [/\bpediatr/i, /\bneonatalog/i],
    contentPatterns: [
      /\bnourrisson|\bnouveau[\s-]?ne|\bapgar\b/i,
      /\bdeshydratation\s+aigue|\brehydratation|\bsro\b/i,
      /\bbronchiolite|\blaryngite|\bconvulsion\s+febrile/i,
      /\bmalnutrition\s+aigue|\bkwashiorkor|\bmarasme/i,
      /\bvaccination\s+pev|\bcalendrier\s+vaccinal/i,
      /\bictere\s+neonatal|\bdetresse\s+respiratoire\s+neonatale/i,
    ],
  },
  {
    family: "gyneco_obstetrique",
    label: "Gynécologie-Obstétrique",
    persona: "Professeur Agrégé de Gynécologie-Obstétrique",
    subjectPatterns: [/\bgyneco/i, /\bobstetri/i],
    contentPatterns: [
      /\bgrossesse|\bplacenta\s+praevia|\bhrp\b|\bgeu\b|\bgrossesse\s+extra[\s-]?uterine/i,
      /\bpreeclampsie|\beclampsie|\bhellp\b/i,
      /\bhemorragie\s+de\s+la\s+delivrance|\baccouchement/i,
      /\bcancer\s+du\s+col|\bfrottis\s+cervico|\bcolposcopie|\bhpv\b/i,
      /\bfibrome\s+uterin|\bendometriose|\bovaires\s+polykystiques|\bsopk\b/i,
    ],
  },
  {
    family: "chirurgie",
    label: "Chirurgie Générale & Viscérale",
    persona: "Professeur Agrégé de Chirurgie Générale et Digestive",
    subjectPatterns: [/\bchirurg/i, /\bvisceral/i],
    contentPatterns: [
      /\babdomen\s+aigu|\bperitonite|\bocclusion\s+intestinale/i,
      /\bappendicite|\bcholecystite|\bcholangite/i,
      /\bhernie\s+(?:etranglee|inguinale)|\beventration/i,
      /\blaparotomie|\bcoelioscopie|\banastomose|\bstomie/i,
      /\bhemoperitoine|\bpneumoperitoine/i,
    ],
  },
  {
    family: "urologie",
    label: "Urologie",
    persona: "Professeur Agrégé d'Urologie",
    subjectPatterns: [/\burolog/i, /\buro\b/i],
    contentPatterns: [
      /\bhypertrophie\s+benigne\s+de\s+la\s+prostate|\bhbp\b|\bpsa\b/i,
      /\bcancer\s+de\s+la\s+prostate|\bgleason\b/i,
      /\bcolique\s+nephretique|\blithiase\s+urinaire/i,
      /\bretention\s+aigue\s+d\s*urine|\bhematurie|\btorsion\s+du\s+cordon/i,
    ],
  },
  {
    family: "urgence_rea",
    label: "Urgences & Réanimation",
    persona: "Professeur Agrégé d'Anesthésie-Réanimation et Médecine d'Urgence",
    subjectPatterns: [/\burgence/i, /\breanimation/i, /\banesthesie/i],
    contentPatterns: [
      /\bchoc\s+(?:hemorragique|septique|cardiogenique|anaphylactique)/i,
      /\barret\s+cardio[\s-]?respiratoire|\brcp\b|\bintubation/i,
      /\bventilation\s+mecanique|\bvasopresseur|\bnoradrenaline|\badrenaline/i,
      /\bglasgow\b|\bintoxication\s+aigue|\bdetresse\s+vitale/i,
    ],
  },
  {
    family: "immunologie",
    label: "Immunologie & Maladies de Système",
    persona: "Professeur Agrégé d'Immunologie et Médecine Interne",
    subjectPatterns: [/\bimmunolog/i, /\bmaladies?\s+de\s+systeme/i, /\bmedecine\s+interne/i],
    contentPatterns: [
      /\blupus\s+erythemateux|\banti[\s-]?dna|\banti[\s-]?sm/i,
      /\bsclerodermie|\banti[\s-]?scl70|\bcrest\b|\braynaud\b/i,
      /\bdermatomyosite|\bgottron|\banti[\s-]?jo1/i,
      /\bsarcoidose|\blofgren|\bbehcet|\bsjogren|\bgougerot/i,
      /\bvascularite|\banca\b|\bhorton\b|\btakayasu\b/i,
      /\bantiphospholipide|\bsapl\b/i,
    ],
  },
  {
    family: "dermatologie",
    label: "Dermatologie",
    persona: "Professeur Agrégé de Dermatologie-Vénéréologie",
    subjectPatterns: [/\bdermatolog/i, /\bdermato\b/i],
    contentPatterns: [
      /\bpsoriasis|\beczema|\btoxidermie|\blyell|\bstevens[\s-]?johnson/i,
      /\bmelanome|\bcarcinome\s+basocellulaire|\berysipele/i,
      /\bdermatose\s+bulleuse|\bpemphigus|\bpemphigoide/i,
    ],
  },
  {
    family: "orl_ophtalmo",
    label: "ORL / Ophtalmologie",
    persona: "Professeur Agrégé d'ORL / Ophtalmologie",
    subjectPatterns: [/\borl\b/i, /\bophtalmolog/i, /\bstomatolog/i],
    contentPatterns: [
      /\bglaucome|\bcataracte|\buveite|\btonus\s+oculaire|\bfond\s+d\s*oeil/i,
      /\botite|\bvertige|\bepistaxis|\bangine|\bsinusite|\bsurdite/i,
    ],
  },
  {
    family: "pharmacologie",
    label: "Pharmacologie",
    persona: "Professeur Agrégé de Pharmacologie Clinique",
    subjectPatterns: [/\bpharmacolog/i, /\bpharma\b/i],
    contentPatterns: [
      /\bpharmacocinetique|\bpharmacodynamie|\bbiodisponibilite/i,
      /\bclairance|\bdemi[\s-]?vie|\bcytochrome\s*p450|\binteraction\s+medicamenteuse/i,
    ],
  },
  {
    family: "anatomie",
    label: "Anatomie",
    persona: "Professeur Agrégé d'Anatomie et Organogenèse",
    subjectPatterns: [/\banatomie\b/i],
    contentPatterns: [
      /\binsertion\b|\binnervation\b|\bvascularisation\b|\brapports\s+anatomiques/i,
      /\bplexus\s+brachial|\bartère\b|\bnerf\b|\barticulation\b/i,
    ],
  },
];

function getProfileTemplate(
  family: DomainFamily,
  subjectLabel: string,
  specialistPersona: string
): DisciplineProfile {
  switch (family) {
    case "traumatologie":
      return {
        domainFamily: "traumatologie",
        subjectLabel,
        specialistPersona,
        examFocusAxes: [
          "Mécanisme lésionnel (choc direct vs indirect, haute vs basse énergie) et recherche de polytraumatisme",
          "Bilan lésionnel immédiat : ouverture cutanée (Cauchoix-Duparc / Gustilo-Anderson), pouls distaux, déficit sensitivo-moteur tronculaire et tension des loges",
          "Bilan radiographique orthogonal (face + profil + incidences dédiées) et TDM/IRM avec classifications pronostiques exactes (Garden, Pauwels, Schatzker, Neer, Denis, Tile)",
          "Complications immédiates (choc hémorragique, lésion vasculaire/nerveuse, syndrome des loges, embolie graisseuse) et tardives (pseudarthrose, cal vicieux, nécrose avasculaire, algodystrophie)",
          "Conduite à tenir d'urgence (réalignement, immobilisation, SAT/VAT + antibioprophylaxie si ouverture), traitement orthopédique vs ostéosynthèse/arthroplastie et délais",
        ],
        interpretationDirectives: [
          {
            trigger: /\b(radio|imagerie|scanner|tdm|irm|clich[eé]|classif|fracture|luxation)\b/i,
            title: "INTERPRÉTATION RADIOCLINIQUE & CLASSIFICATOIRE EN TRAUMATOLOGIE",
            steps: [
              "Vérifier la qualité des clichés (2 incidences orthogonales Face + Profil prenant les articulations sus- et sous-jacentes).",
              "Décrire le siège anatomique exact, la direction et la complexité du trait de fracture (transversal, oblique, spiroïde, comminutif) et les déplacements (angulation, translation, chevauchement, rotation).",
              "Appliquer la classification de référence du cours (ex. Garden/Pauwels, Dupuytren, Neer, Schatzker, Denis, Cauchoix/Gustilo) et son implication thérapeutique directe.",
              "Rechercher les lésions associées ou signes d'instabilité / pronostic vasculaire (ex. rupture de travées, arrachement osseux, pincement, incarcération).",
            ],
          },
        ],
        confrontationRows: [
          {
            criterion: "**Terrain & Mécanisme lésionnel (énergie, position)**",
            courseGuidance:
              "Âge, qualité osseuse (sujet jeune haute énergie vs sujet âgé ostéoporotique) et mécanisme exact du cours (chute directe, torsion, compression axiale, hyperextension)",
            diff1Guidance: "Mécanisme différent (choc direct vs torsion/arrachement) et tranche d'âge distincte",
            diff2Guidance: "Traumatisme minime ou fracture pathologique sur os fragilisé / choc de cinétique différente",
            diff3Guidance: "Lésion purement ligamentaire ou abarticulaire sans fracture déplacée",
          },
          {
            criterion: "**Examen clinique, Déformation & Bilan vasculo-nerveux / cutané**",
            courseGuidance:
              "Attitude vicieuse typique, déformation spécifique, recherche systématique de **complications immédiates** : ouverture (**Cauchoix/Gustilo**), **pouls distaux**, déficit neurologique ciblé et loges",
            diff1Guidance: "Déformation en sens opposé ou impotence fonctionnelle localisée à un autre segment",
            diff2Guidance: "Attitude antalgique sans déformation macroscopique majeure ; testing nerveux distinct",
            diff3Guidance: "Intégrité osseuse probable mais instabilité ligamentaire / signe spécifique (tiroir, Lachman, Thompson...)",
          },
          {
            criterion: "**Imagerie & Classification radioclinique de référence**",
            courseGuidance:
              "Incidences requises (Face, Profil, incidence dédiée / TDM si articulaire) et stades exacts de la classification du cours (ex. **Garden, Pauwels, Gustilo, Denis, Neer**)",
            diff1Guidance: "Trait situé à un autre niveau anatomique (ex. extracapsulaire vs intracapsulaire) ou autre classification",
            diff2Guidance: "Perte complète des rapports articulaires (luxation) ou intégrité corticale",
            diff3Guidance: "Clichés standard normaux ou nécessité d'IRM / échographie dynamique pour confirmer la lésion",
          },
          {
            criterion: "**Complications précoces & tardives pièges aux QCM**",
            courseGuidance:
              "Risques spécifiques du cours (**syndrome des loges, embolie graisseuse, nécrose avasculaire, pseudarthrose, cal vicieux, raideur, algodystrophie**)",
            diff1Guidance: "Risque dominé par une autre complication (ex. pseudarthrose rare vs cal vicieux fréquent ou inversement)",
            diff2Guidance: "Risque principal vasculo-nerveux aigu par compression anatomique de voisinage",
            diff3Guidance: "Évolution dominée par l'instabilité chronique, la récidive ou l'arthrose secondaire tardive",
          },
          {
            criterion: "**Prise en charge d'urgence, Traitement & Délais**",
            courseGuidance:
              "Urgence chirurgicale ou réduction immédiate si souffrance cutanée/vasculaire ; choix exact **orthopédique (plâtre/traction) vs ostéosynthèse (clou, plaque, vis, fixateur) vs prothèse** et **SAT/VAT + antibioprophylaxie** si ouverture",
            diff1Guidance: "Indication inverse (ex. ostéosynthèse systématique vs prothèse d'emblée ou traitement conservateur)",
            diff2Guidance: "Réduction orthopédique en urgence sous sédation/AG + contrôle radiologique et contention",
            diff3Guidance: "Traitement fonctionnel (RICE/GREC, attelle, rééducation précoce) ou suture/réparation ciblée",
          },
        ],
        clinicalCaseSteps: [
          {
            stepNumber: 1,
            title: "ÉTAPE 1 — RECONSTITUER LE TERRAIN, L'HEURE & LE MÉCANISME LÉSIONNEL",
            bullets: [
              "**Données clés d'entrée :** Âge (jeune haute énergie vs sujet âgé ostéoporotique), heure du traumatisme et du dernier repas (délai opératoire), tares (anticoagulants, diabète, tabac) et statut vaccinal antitétanique.",
              "**Priorité vitale (ABCDE si haute énergie) :** Éliminer un choc hémorragique, un traumatisme crânien/rachidien ou des lésions étagées avant de se focaliser sur la lésion périphérique.",
            ],
          },
          {
            stepNumber: 2,
            title: "ÉTAPE 2 — EXAMEN CLINIQUE LOCAL & BILAN IMMÉDIAT DES COMPLICATIONS (PEAU, VAISSEAUX, NERFS)",
            bullets: [
              "**Inspection & palper ciblés :** Identifier la déformation caractéristique, l'ecchymose, les phlyctènes ou une souffrance cutanée menaçante (urgence de réduction !).",
              "**Triade obligatoire en QCM traumatologique :** Evaluer l'ouverture cutanée (**Cauchoix-Duparc / Gustilo-Anderson**), **pouls distaux / chaleur / TRC**, et l'examen neurologique sensitivo-moteur distal sans omettre la **tension des loges musculaires**.",
            ],
          },
          {
            stepNumber: 3,
            title: "ÉTAPE 3 — PRESCRIRE & INTERPRÉTER L'IMAGERIE ORTHOGONALE ET LA CLASSIFICATION",
            bullets: [
              "**Clichés indispensables :** Radiographies Face + Profil prenant les articulations sus- et sous-jacentes ; **TDM** avec reconstructions 3D si fracture articulaire/complexe/rachis.",
              "**Classification décisive :** Nommer le stade/type exact enseigné dans le cours (ex. **Garden, Pauwels, Gustilo, Denis, AO**) car le QCM suivant en déduit directement l'indication thérapeutique.",
            ],
          },
          {
            stepNumber: 4,
            title: "ÉTAPE 4 — ANTICIPER LES COMPLICATIONS PRÉCOCES & TARDIVES SPÉCIFIQUES",
            bullets: [
              "**Complications précoces :** Syndrome des loges (douleur insoutenable résistant aux antalgiques = **aponévrotomie de décharge urgente**, jamais de plâtre serré !), embolie graisseuse, thrombose veineuse, sepsis sur fracture ouverte.",
              "**Complications tardives :** Pseudarthrose, cal vicieux, ostéonécrose épiphysaire, raideur articulaire, SDRC type I (algodystrophie).",
            ],
          },
          {
            stepNumber: 5,
            title: "ÉTAPE 5 — CONDUITE À TENIR D'URGENCE & STRATÉGIE THÉRAPEUTIQUE DÉFINITIVE",
            bullets: [
              "**Mise en condition immédiate :** Antalgie, immobilisation provisoire, parage/lavage + **SAT/VAT** + **antibioprophylaxie IV** précoce si fracture ouverte ; thromboprophylaxie selon le risque.",
              "**Choix du geste définitif :** Justifier entre traitement **orthopédique**, **ostéosynthèse** (clou, plaque vissée, brochage, fixateur externe) ou **arthroplastie**, puis modalités d'appui et rééducation.",
            ],
          },
        ],
        fallbackObjectives: (t) => [
          `Définir ${t}, son mécanisme lésionnel et les éléments clés de l'anatomie appliquée`,
          "Établir le bilan lésionnel clinique complet (déformation, peau, vaisseaux, nerfs, loges)",
          "Prescrire et interpréter les examens d'imagerie et la classification radioclinique de référence",
          "Identifier les complications immédiates, secondaires et tardives à prévenir",
          "Planifier la prise en charge d'urgence et le traitement orthopédique ou chirurgical avec ses délais",
        ],
        lexiconClusters: [
          {
            triggers: ["fracture", "ouverte", "gustilo", "cauchoix"],
            expansions: [
              "fracture ouverte", "cauchoix duparc", "gustilo anderson", "parage chirurgical", "fixateur externe",
              "antibioprophylaxie", "prophylaxie antitetanique", "syndrome des loges", "osteite", "pseudarthrose septique",
            ],
          },
          {
            triggers: ["femur", "col", "trochanter", "hanche", "cotyle", "bassin"],
            expansions: [
              "col du femur", "classification de garden", "pauwels", "delbet", "pertrochanterienne", "ostéonécrose tete femorale",
              "prothese intermediaire", "prothese totale de hanche", "vissage", "vis plaque", "clou gamma", "cotyle", "tile",
            ],
          },
          {
            triggers: ["genou", "tibia", "jambe", "plateau", "rotule", "patella", "entorse", "lca", "menisque"],
            expansions: [
              "plateau tibial", "schatzker", "diaphyse tibiale", "enclouage centromedullaire", "syndrome des loges",
              "ligament croise anterieur", "signe de lachman", "tiroir anterieur", "pentade", "triade", "patella",
            ],
          },
          {
            triggers: ["epaule", "humerus", "coude", "avant bras", "poignet", "pouteau", "scaphoide", "main"],
            expansions: [
              "luxation antero interne", "neer", "nerf axillaire", "nerf radial", "palette humerale", "supracondylienne",
              "volkmann", "monteggia", "galeazzi", "pouteau colles", "goyrand smith", "scaphoide carpien", "tabatiere anatomique",
            ],
          },
          {
            triggers: ["rachis", "cervical", "dorsal", "lombaire", "polytraumatisme", "cheville", "malleole", "calcaneus", "talus"],
            expansions: [
              "fracture du rachis", "mur posterieur", "classification de denis", "magerl", "segment mobile rachidien",
              "polytraumatise", "damage control", "embolie graisseuse", "bimalleolaire", "dupuytren", "bohler", "necrose du talus",
            ],
          },
        ],
        exclusionPeerKeywords: ["hemogramme", "reticulocytes", "frottis", "drépanocytose", "aplasie", "leucemie", "polyarthrite", "lupus"],
      };

    case "orthopedie":
      return {
        domainFamily: "orthopedie",
        subjectLabel,
        specialistPersona,
        examFocusAxes: [
          "Terrain chronique, facteurs anatomiques/congénitaux et signes fonctionnels ostéo-articulaires",
          "Examen physique morphostatique, mobilités comparatives, raccourcissements et signes spécifiques (Ortolani, Barlow, gibbosité, Lasègue...)",
          "Mesures angulaires et classifications radiologiques/IRM/scannographiques (angle de Cobb, Risser, Kellgren, Tonnis, Enneking)",
          "Évolution naturelle, séquelles fonctionnelles et diagnostics différentiels (infectieux vs tumoral vs dégénératif vs malformatif)",
          "Indications thérapeutiques graduées : orthopédie conservatrice (rééducation, corset, attelle) vs chirurgie réglée (ostéotomie, arthrodèse, arthroplastie, résection)",
        ],
        interpretationDirectives: [
          {
            trigger: /\b(radio|imagerie|cobb|risser|angle|irm|tdm|scintigraphie|biopsie|score)\b/i,
            title: "INTERPRÉTATION STRUCTURÉE EN ORTHOPÉDIE",
            steps: [
              "Identifier les repères anatomiques, l'axe mécanique, le pincement/ostéophytose ou la matrice lésionnelle osseuse (lyse, condensation, réaction périostée).",
              "Mesurer les angles de référence ou indices décrits dans le cours (Cobb, Risser, coxométrie VCE/HPE, signe d'Ombredanne).",
              "Corréler à la croissance osseuse (enfant/adolescent vs adulte) ou au retentissement articulaire pour choisir le stade.",
            ],
          },
        ],
        confrontationRows: [
          {
            criterion: "**Terrain, Âge osseux & Étiopathogénie**",
            courseGuidance: "Âge typique (nouveau-né, adolescent en croissance, adulte, sujet âgé), facteurs génétiques/mécaniques et chronologie",
            diff1Guidance: "Tranche d'âge ou facteur déclenchant distinct (ex. infectieux vs dégénératif vs malformatif)",
            diff2Guidance: "Présentation plus aiguë/fébrile ou au contraire strictement mécanique/posturale",
            diff3Guidance: "Terrain métabolique, tumoral ou inflammatoire systémique distinct",
          },
          {
            criterion: "**Sémiologie clinique & Examen orthopédique**",
            courseGuidance: "Déformation morphostatique, limitation des amplitudes, boiterie, signe pathognomonique du cours et état cutané/neurologique",
            diff1Guidance: "Signe clinique clé absent ou opposé (ex. attitude réductible vs raideur fixée)",
            diff2Guidance: "Douleur d'horaire différent (inflammatoire nocturne vs mécanique à l'effort) et absence de signe du cours",
            diff3Guidance: "Syndrome infectieux ou tumoral dominant avec altération de l'état général",
          },
          {
            criterion: "**Imagerie, Mesures & Bilan complémentaire**",
            courseGuidance: "Clichés en charge / téléradiographies / IRM ; valeurs seuils des **angles, stades ou marqueurs biologiques** du cours",
            diff1Guidance: "Absence des anomalies structurelles ou localisation anatomique / épiphysaire différente",
            diff2Guidance: "Bilan biologique inflammatoire ou ostéolyse agressive (perte corticale, éperon de Codman, biopsie)",
            diff3Guidance: "Imagerie normale ou lésion bénigne / structuration purement posturale",
          },
          {
            criterion: "**Évolution, Pronostic & Complications**",
            courseGuidance: "Complications évolutives majeures du cours (arthrose précoce, déformation progressive, déficit neurologique, septicité)",
            diff1Guidance: "Évolution naturellement régressive sous traitement conservateur simple",
            diff2Guidance: "Évolution destructrice rapide ou menace vitale en l'absence d'exérèse/antibiothérapie",
            diff3Guidance: "Atteinte plurifocale ou extra-articulaire absente dans la pathologie principale",
          },
          {
            criterion: "**Stratégie thérapeutique & Indications**",
            courseGuidance: "Critères précis séparant **surveillance / kinésithérapie / appareillage (plâtre, harnais, corset)** vs **chirurgie (ténotomie, ostéotomie, arthrodèse, prothèse)**",
            diff1Guidance: "Contre-indication ou choix d'un autre temps chirurgical / autre type de prothèse ou orthèse",
            diff2Guidance: "Antibiothérapie parentérale prolongée + drainage chirurgical en urgence",
            diff3Guidance: "Traitement purement symptomatique / rééducatif sans geste invasif indiqué",
          },
        ],
        clinicalCaseSteps: [
          {
            stepNumber: 1,
            title: "ÉTAPE 1 — ANALYSER LE TERRAIN, L'ÂGE ET L'HORAIRE DES SYMPTÔMES",
            bullets: [
              "**Contexte décisif :** Préciser la phase de croissance (nouveau-né, pic pubertaire de croissance) ou l'activité/âge adulte et l'horaire **mécanique vs inflammatoire**.",
              "**Red flags d'emblée :** Écarter une urgence infectieuse (arthrite septique, ostéomyélite aiguë fébrile), tumorale (douleur nocturne fixe, AEG) ou compressive médullaire.",
            ],
          },
          {
            stepNumber: 2,
            title: "ÉTAPE 2 — EXAMEN ORTHOPÉDIQUE MÉTHODIQUE & SIGNES SPÉCIFIQUES",
            bullets: [
              "**Inspection & Mensurations :** Statique rachidienne/pelvienne, déformation dans les 3 plans, inégalité de longueur, amyotrophie.",
              "**Manœuvres dédiées :** Réductibilité, testing musculaire, manœuvres spécifiques (ressaut, gibbosité, Lasègue, Patrick/Faber) et examen vasculo-nerveux.",
            ],
          },
          {
            stepNumber: 3,
            title: "ÉTAPE 3 — BILAN D'IMAGERIE, ANGLES MESURÉS & STADIFICATION",
            bullets: [
              "**Imagerie ciblée :** Radiographies comparatives en charge / rachis total, échographie (nourrisson), IRM (tissu mou, nécrose, moelle) ou scintigraphie.",
              "**Seuils décisifs :** Calculer et interpréter les angles et stades du cours (ex. **Cobb ≥ 10° / > 40-50°**, indice de Risser, classification radiologique).",
            ],
          },
          {
            stepNumber: 4,
            title: "ÉTAPE 4 — DIAGNOSTIC DIFFÉRENTIEL & BILAN PRÉ-THÉRAPEUTIQUE",
            bullets: [
              "**Éliminer les pièges classiques :** Posture réductible vs déformation structurale, douleur projetée (hanche devant gonalgie chez l'enfant !), infection vs tumeur.",
              "**Bilan complémentaire selon contexte :** CRP/VS/hémocultures si fièvre, biopsie chirurgicale planifiée avant toute exérèse si doute tumoral.",
            ],
          },
          {
            stepNumber: 5,
            title: "ÉTAPE 5 — ARBRE THÉRAPEUTIQUE & SURVEILLANCE À LONG TERME",
            bullets: [
              "**Traitement conservateur vs chirurgical :** Dégager le seuil d'indication exact (appareillage/corset/kinésithérapie vs ostéotomie/arthroplastie/arthrodèse).",
              "**Suivi :** Calendrier de contrôle clinique et radiologique jusqu'à maturation osseuse ou consolidation / surveillance de prothèse.",
            ],
          },
        ],
        fallbackObjectives: (t) => [
          `Définir ${t}, ses bases anatomo-biomécaniques et son épidémiologie`,
          "Réaliser l'examen clinique orthopédique et rechercher les signes d'orientation et de gravité",
          "Prescrire et interpréter l'imagerie, les mesures angulaires et les classifications de référence",
          "Établir le diagnostic positif et écarter les principaux diagnostics différentiels",
          "Indiquer la prise en charge conservatrice ou chirurgicale adaptée au stade évolutif et surveiller le patient",
        ],
        lexiconClusters: [
          {
            triggers: ["scoliose", "rachis", "cobb", "risser", "cyphose"],
            expansions: ["scoliose", "angle de cobb", "indice de risser", "gibbosite", "corset", "arthrodese vertebrale"],
          },
          {
            triggers: ["hanche", "coxarthrose", "lch", "luxation congenitale", "epiphysiolyse"],
            expansions: ["coxarthrose", "pincement articulaire", "ortolani", "barlow", "pavlik", "prothese totale de hanche", "vce"],
          },
          {
            triggers: ["osteomyelite", "arthrite septique", "pott", "tumeur osseuse", "sarcome"],
            expansions: ["osteomyelite aigue", "arthrite septique", "staphylococcus aureus", "ponction articulaire", "osteosarcome", "ewing"],
          },
        ],
        exclusionPeerKeywords: ["hemogramme", "reticulocytes", "frottis", "drépanocytose", "aplasie", "leucemie", "trombolyse"],
      };

    case "rhumatologie":
      return {
        domainFamily: "rhumatologie",
        subjectLabel,
        specialistPersona,
        examFocusAxes: [
          "Distinction douleur mécanique vs horaire inflammatoire et topographie (axial, périphérique symétrique/asymétrique, mono/oligo/polyarthrite)",
          "Analyse du liquide synovial (cytologie, microcristaux biréfringents, culture) : seuil mécanique < 2000 vs inflammatoire > 2000 élém/mm³",
          "Bilan immunologique et métabolique ciblé (FR, anti-CCP, FAN, HLA-B27, uricémie, bilan phosphocalcique, PTH, 25-OH-D)",
          "Imagerie ostéo-articulaire dédiée (érosions marginales, syndesmophytes, sacro-iliite, chondrocalcinose, T-score DEXA)",
          "Stratégie thérapeutique graduée (antalgiques/AINS, colchicine, corticoïdes, DMARDs/méthotrexate, biothérapies anti-TNF)",
        ],
        interpretationDirectives: [
          {
            trigger: /\b(liquide|synovial|ponction|dxa|densitom|t[\s-]?score|radio|immunolog)\b/i,
            title: "INTERPRÉTATION EN RHUMATOLOGIE",
            steps: [
              "Distinguer d'abord un liquide mécanique (< 2 000 GB/mm³) d'un liquide inflammatoire (> 2 000 GB/mm³) ou septique (PNN altérés, germe).",
              "Rechercher les microcristaux en microscopie polarisante (urate monosodique en aiguilles fortement biréfringentes négatives vs pyrophosphate de calcium).",
              "Croiser avec les radiographies/IRM et biomarqueurs (anti-CCP, HLA-B27, T-score ≤ -2,5 DS) pour poser l'indication thérapeutique.",
            ],
          },
        ],
        confrontationRows: [
          {
            criterion: "**Terrain, Horaire & Topographie articulaire**",
            courseGuidance: "Âge/sexe de prédilection, horaire inflammatoire vs mécanique et distribution caractéristique (ex. IPP/MCP, sacro-iliaques, gros orteil)",
            diff1Guidance: "Distribution articulaire ou atteinte axiale vs périphérique différente",
            diff2Guidance: "Horaire purement mécanique ou atteinte oligo-articulaire asymétrique",
            diff3Guidance: "Mono-arthrite aiguë fébrile ou contexte systémique distinct",
          },
          {
            criterion: "**Signes cliniques articulaires & extra-articulaires**",
            courseGuidance: "Synovite, dérouillage matinal chiffré, déformations typiques et manifestations extra-articulaires (uvéite, psoriasis, nodules, tophus)",
            diff1Guidance: "Absence d'atteinte extra-articulaire spécifique ou signes systémiques différents",
            diff2Guidance: "Atteinte enthésopathique / axiale sans synovite distale symétrique",
            diff3Guidance: "Signes infectieux locaux/généraux marqués ou signes vasculaires associés",
          },
          {
            criterion: "**Liquide synovial, Biologie & Sérologie**",
            courseGuidance: "Formule du liquide articulaire, VS/CRP, biomarqueurs spécifiques (**anti-CCP, FR, HLA-B27, uricémie, bilan Ca/P**)",
            diff1Guidance: "Profil auto-immun ou microcristallin opposé (ex. anti-CCP- / cristaux différents)",
            diff2Guidance: "Liquide strictement mécanique (< 2000/mm³) et syndrome inflammatoire absent",
            diff3Guidance: "Ponction mettant en évidence un germe / purulence > 50 000 PNN/mm³",
          },
          {
            criterion: "**Imagerie (Radiographie, Écho, IRM, DMO)**",
            courseGuidance: "Signes cardinaux d'imagerie (érosions péri-articulaires, pincement global vs localisé, sacro-iliite, liseré calcique, T-score)",
            diff1Guidance: "Aspect radiologique constructeur (ostéophytes/syndesmophytes) vs destructeur",
            diff2Guidance: "Incidence spécifique normale au stade précoce (intérêt IRM / échographie Doppler)",
            diff3Guidance: "Lésion focale ou déminéralisation diffuse sans érosion inflammatoire",
          },
          {
            criterion: "**Traitement de crise & Traitement de fond**",
            courseGuidance: "Règle thérapeutique exacte du cours (colchicine/AINS vs **méthotrexate**, biothérapie, bisphosphonate, règles hygiéno-diététiques et surveillance)",
            diff1Guidance: "Traitement de fond contre-indiqué ou molécule de classe différente",
            diff2Guidance: "AINS en 1re intention (spondyloarthrite) ou antibiothérapie urgente",
            diff3Guidance: "Prise en charge uniquement antalgique, rééducative ou chirurgicale",
          },
        ],
        clinicalCaseSteps: [
          {
            stepNumber: 1,
            title: "ÉTAPE 1 — CARACTÉRISER LE RYTHME DOULOUREUX & LE CADRE SYNDROMIQUE",
            bullets: [
              "**Interrogatoire clé :** Horaire inflammatoire (réveil nocturne, dérouillage matinal > 30-60 min) vs mécanique ; début brutal vs chronique ; antécédents personnels/familiaux.",
              "**Urgence absolue :** Devant toute monoarthrite aiguë fébrile, suspecter en premier lieu une **arthrite septique** et ponctionner avant toute antibiothérapie !",
            ],
          },
          {
            stepNumber: 2,
            title: "ÉTAPE 2 — CARTOGRAPHIE ARTICULAIRE & SIGNES EXTRA-ARTICULAIRES",
            bullets: [
              "**Examen ciblé :** Compter synovites et arthralgies, rechercher une atteinte axiale (indice de Schöber, sacro-iliaques), enthésites ou tophus.",
              "**Bilan systémique :** Œil (uvéite, sécheresse), peau (psoriasis, érythème), poumon, rein, neuropathie périphérique.",
            ],
          },
          {
            stepNumber: 3,
            title: "ÉTAPE 3 — PONCTION ARTICULAIRE, BIOLOGIE & IMAGERIE CIBLÉE",
            bullets: [
              "**Ponction synoviale :** Systématique devant tout épanchement (cytologie, cristaux, bactériologie).",
              "**Biomarqueurs & Imagerie :** CRP/VS, bilan immunologique ciblé, radiographies bilatérales comparatives (mains/poignets, avant-pieds, bassin) ou échographie/IRM/DEXA.",
            ],
          },
          {
            stepNumber: 4,
            title: "ÉTAPE 4 — CRITÈRES CLASSIFICATOIRES & DIAGNOSTIC DIFFÉRENTIEL",
            bullets: [
              "**Classification du cours :** Vérifier les scores/critères officiels (ACR/EULAR, ASAS, seuils OMS T-score) pour confirmer le diagnostic.",
              "**Écarter les pièges :** Arthrite septique masquée, chondrocalcinose vs goutte, douleur mécanique projetée.",
            ],
          },
          {
            stepNumber: 5,
            title: "ÉTAPE 5 — STRATÉGIE THÉRAPEUTIQUE (CRISE, FOND, SURVEILLANCE)",
            bullets: [
              "**Traitement symptomatique & d'attaque :** Antalgiques, AINS, colchicine ou corticothérapie à dose minimale efficace.",
              "**Traitement de fond & bilan pré-thérapeutique :** Bilan pré-MTX / pré-biothérapie (radiographie thorax, Quantiféron, sérologies VHB/VHC/VIH), posologies et objectifs de rémission.",
            ],
          },
        ],
        fallbackObjectives: (t) => [
          `Définir ${t}, ses facteurs favorisants et sa physiopathologie`,
          "Identifier le tableau clinique articulaire et extra-articulaire caractéristique",
          "Prescrire et interpréter la ponction articulaire, les examens biologiques et l'imagerie",
          "Établir le diagnostic positif et différentiel à l'aide des critères reconnus",
          "Planifier le traitement de crise, le traitement de fond et la surveillance",
        ],
        lexiconClusters: [
          {
            triggers: ["polyarthrite", "rhumatoide", "spondylarthrite", "goutte", "chondrocalcinose", "osteoporose"],
            expansions: [
              "polyarthrite rhumatoide", "anti ccp", "methotrexate", "spondylarthrite ankylosante", "hla b27",
              "goutte", "urate monosodique", "colchicine", "allopurinol", "chondrocalcinose", "osteoporose", "t score",
            ],
          },
        ],
        exclusionPeerKeywords: ["hemogramme", "reticulocytes", "aplasie", "fracture ouverte", "gustilo", "enclouage"],
      };

    case "hematologie":
      return {
        domainFamily: "hematologie",
        subjectLabel,
        specialistPersona,
        examFocusAxes: [
          "Constantes de l'hémogramme, seuils Hb/VGM/TCMH/CCMH/Plaquettes/GB et réticulocytes (seuil 120 G/L)",
          "Morphologie au frottis sanguin et critères du myélogramme / BOM",
          "Classifications et scores pronostiques officiels (Binet, Matutes, Ann Arbor, IPI, Camitta, ISS/R-ISS)",
          "Bilan d'hémostase (TP, TCA, Fibrinogène, Facteur V, Facteurs VIII/IX, vWF, D-dimères) et tests de certitude",
          "Indications et règles strictes de transfusion, contre-indications thérapeutiques et traitements curatifs/de fond",
        ],
        interpretationDirectives: [
          {
            trigger: /\b(h[eéè]mogramme|\bnfs\b|formule\s*sanguine|r[eé]ticulocyte|an[eé]mi)/i,
            title: "DÉMARCHE D'INTERPRÉTATION DE L'HÉMOGRAMME (ÉTAPE PAR ÉTAPE)",
            steps: [
              "1. Affirmer l'anémie (Hb inférieure aux seuils : H < 13 g/dL, F/enfant < 12 g/dL, grossesse T2/T3 < 10,5 g/dL) en éliminant une fausse anémie par hémodilution.",
              "2. Qualifier la taille via le VGM : microcytaire (< 80 fL), normocytaire (80–100 fL), macrocytaire (> 100 fL).",
              "3. Qualifier la coloration/charge en Hb via CCMH (hypochrome < 32 %, normochrome 32–36 %) et TCMH (< 27 pg).",
              "4. Déduire la formule érythrocytaire complète + analyser PNN, lymphocytes et plaquettes.",
              "5. Évaluer la réponse médullaire via les réticulocytes : régénérative (> 120 G/L = origine périphérique) vs arégénérative (< 120 G/L = origine centrale).",
            ],
          },
        ],
        confrontationRows: [
          {
            criterion: "**Terrain & Mode d'installation**",
            courseGuidance: "Terrain (âge, hérédité, acquis/médicamenteux) et début aigu ou progressif conforme au cours",
            diff1Guidance: "Terrain constitutionnel ou acquis différent (ex. lié à l'X vs auto-immun)",
            diff2Guidance: "Installation chronique vs tableau brutal / post-viral",
            diff3Guidance: "Contexte carentiel, toxique ou tumoral distinct",
          },
          {
            criterion: "**Clinique (syndrome anémique, hémorragique, tumoral : rate, ganglions, os)**",
            courseGuidance: "Triades/signes cardinaux du cours et présence ou absence d'**organomégalie (SMG, ADP, HMG)**",
            diff1Guidance: "Présence vs absence de syndrome tumoral ou hémolytique discriminant",
            diff2Guidance: "Type de saignement opposé (muqueux/pétéchial vs profond/hémarthrose) ou douleur osseuse",
            diff3Guidance: "Signes cliniques d'une autre lignée atteinte ou bilan physique normal",
          },
          {
            criterion: "**Hémogramme, Plaquettes & Réticulocytes**",
            courseGuidance: "Anomalies précises des constantes (**Hb, VGM, TCMH/CCMH, GB/PNN, Plaquettes**) et seuil des **réticulocytes (120 G/L)**",
            diff1Guidance: "Profil microcytaire vs macrocytaire ou régénératif vs arégénératif inverse",
            diff2Guidance: "Cytopénie isolée vs pancytopénie ou hyperleucocytose clonale",
            diff3Guidance: "Plaquettes normales vs thrombopénie profonde de consommation ou périphérique",
          },
          {
            criterion: "**Frottis sanguin, Hémostase & Bilan médullaire / biochimique**",
            courseGuidance: "Anomalies cytologiques (drépanocytes, schizocytes, corps de Heinz, blastes, Gumprecht) et **myélogramme / BOM / bilan d'hémostase**",
            diff1Guidance: "Moelle riche vs moelle désertique ou absence d'anomalie cytologique typique",
            diff2Guidance: "Allongement isolé du TCA vs TP+TCA effondrés + Facteur V ou D-dimères",
            diff3Guidance: "Bilan martial / vitaminique / Coombs / électrophorèse discordant",
          },
          {
            criterion: "**Examen de certitude & Traitement spécifique**",
            courseGuidance: "Test gold standard du cours (électrophorèse, Coombs, immunophénotypage Matutes, dosage enzymatique/facteur, BOM) et traitement dédié",
            diff1Guidance: "Critère immunophénotypique, génétique ou biochimique propre à cette entité",
            diff2Guidance: "Prise en charge urgente différente (ex. CGR phénotypés vs corticothérapie vs allogreffe)",
            diff3Guidance: "Contre-indications ou mesures préventives distinctes",
          },
        ],
        clinicalCaseSteps: [
          {
            stepNumber: 1,
            title: "ÉTAPE 1 — RECHERCHER LES SIGNES DE GRAVITÉ & ANALYSER LE TERRAIN",
            bullets: [
              "**Contexte décisif :** Âge, origine ethnique/familiale, antécédents hémorragiques ou transfusionnels, prise médicamenteuse/toxique.",
              "**Urgence immédiate :** Intolérance clinique (choc, dyspnée, angor), syndrome hémorragique grave (score, bulles hémorragiques, saignement viscéral), fièvre sur neutropénie.",
            ],
          },
          {
            stepNumber: 2,
            title: "ÉTAPE 2 — INTERPRÉTER MÉTHODIQUEMENT L'HÉMOGRAMME, LES RÉTICULOCYTES & LE FROTTIS",
            bullets: [
              "**Constantes chiffrées :** Qualifier **Hb, VGM, CCMH/TCMH, GB/PNN, Plaquettes** et le taux absolu de **réticulocytes (seuil 120 G/L)** pour trancher central vs périphérique.",
              "**Frottis sanguin obligatoire :** Repérer les anomalies orientatrices (schizocytes, drépanocytes, cellules cibles, blastes, ombres de Gumprecht, sphérocytes).",
            ],
          },
          {
            stepNumber: 3,
            title: "ÉTAPE 3 — EXAMENS DE CERTITUDE (MÉDULLAIRE, IMMUNO, HÉMOSTASE, BIOCHIMIE)",
            bullets: [
              "**Orientation ciblée :** Myélogramme vs Biopsie Ostéo-Médullaire (BOM), test de Coombs direct, électrophorèse de l'Hb, dosage enzymatique à distance d'une transfusion, TP/TCA/Fibrinogène/Facteurs.",
              "**Scores & stades :** Appliquer exactement les classifications du cours (Camitta, Binet, Matutes, Ann Arbor, IPI...).",
            ],
          },
          {
            stepNumber: 4,
            title: "ÉTAPE 4 — DÉJOUER LES PIÈGES D'INTERPRÉTATION & CLASSIFICATIONS ÉTIOLOGIQUES",
            bullets: [
              "**Pièges classiques :** Fausse normalisation après transfusion récente, pseudo-hyperleucocytose par érythroblastose, ferritine faussement normale en inflammation.",
            ],
          },
          {
            stepNumber: 5,
            title: "ÉTAPE 5 — DÉCISION THÉRAPEUTIQUE, TRANSFUSION & PROPHYLAXIE",
            bullets: [
              "**Mesures d'urgence :** Règles et seuils transfusionnels exacts (CGR phénotypés/déleucocytés/compatibilisés, CP, PFC), chimiothérapie / corticoïdes / IgIV / chélation.",
              "**Éléments à éviter & surveillance :** Listes de médicaments contre-indiqués, vaccinations, prévention des récidives.",
            ],
          },
        ],
        fallbackObjectives: (t) => [
          `Définir ${t}, ses seuils biologiques de référence et son cadre nosologique`,
          "Expliquer la physiopathologie et les mécanismes étiopathogéniques",
          "Décrire le tableau clinique et interpréter l'hémogramme, le frottis et le bilan biologique",
          "Établir le diagnostic positif, différentiel et les classifications pronostiques",
          "Planifier la prise en charge thérapeutique d'urgence, de fond et les mesures de prévention",
        ],
        lexiconClusters: [
          {
            triggers: ["aplasie", "fanconi", "camitta", "pancytopenie"],
            expansions: ["aplasie medullaire", "bom", "moelle desertique", "camitta", "fanconi", "pancytopenie", "allogreffe"],
          },
          {
            triggers: ["drepanocytose", "thalassemie", "hemoglobinopathie"],
            expansions: ["drepanocytose", "thalassemie", "hbs", "electrophorese", "syndrome thoracique aigu", "hydroxyuree"],
          },
          {
            triggers: ["hemostase", "hemophilie", "willebrand", "civd", "coagulation"],
            expansions: ["hemophilie", "facteur viii", "facteur ix", "willebrand", "civd", "tca", "tp", "fibrinogene"],
          },
        ],
        exclusionPeerKeywords: ["fracture", "luxation", "gustilo", "enclouage", "osteosynthese", "cobb", "schatzker"],
      };

    case "cardiologie":
      return {
        domainFamily: "cardiologie",
        subjectLabel,
        specialistPersona,
        examFocusAxes: [
          "Facteurs de risque cardiovasculaire, douleur thoracique / dyspnée (NYHA, Killip) et signes d'insuffisance cardiaque droite/gauche",
          "Analyse systématique de l'ECG 12 dérivations (rythme, conduction, repolarisation, territoires coronaires)",
          "Biomarqueurs cardiaques (Troponine US cinétique, BNP/NT-proBNP, D-dimères) et ETT (FEVG, valvulopathie, pressions)",
          "Scores décisionnels et classifications (Killip, NYHA, CHA2DS2-VASc, HAS-BLED, Wells, sPESI, Dukes)",
          "Prise en charge d'urgence (revascularisation, anticoagulation, diurétiques, choc) et traitement chronique optimisé",
        ],
        interpretationDirectives: [
          {
            trigger: /\b(ecg|electrocardiogramme|ett|echocardiographie|coronarographie|troponine|bnp)\b/i,
            title: "INTERPRÉTATION CARDIOLOGIQUE MÉTHODIQUE (ECG / ÉCHO / BIOMARQUEURS)",
            steps: [
              "ECG 12 dérivations : rythme et fréquence, axe, onde P/PR, largeur QRS, anomalies du segment ST/onde T dans un territoire concordant.",
              "Croiser la cinétique de Troponine / BNP avec le délai depuis le début des symptômes.",
              "ETT : évaluer FEVG, cinétique segmentaire, surfaces/gradients valvulaires, cavités droites et péricarde.",
            ],
          },
        ],
        confrontationRows: [
          {
            criterion: "**Terrain & Facteurs de risque cardiovasculaire**",
            courseGuidance: "Profil FDRCV, cardiopathie sous-jacente et circonstances déclenchantes décrites dans le cours",
            diff1Guidance: "Profil épidémiologique ou facteur déclenchant différent",
            diff2Guidance: "Patient sans cardiopathie structurelle connue ou contexte post-infectieux / thromboembolique",
            diff3Guidance: "Terrain hypertensif ou polyvasculaire prédominant",
          },
          {
            criterion: "**Clinique, Hémodynamique & Auscultation**",
            courseGuidance: "Caractères symptomatiques (douleur, dyspnée NYHA), constantes (PA, FC, SpO2), souffles et signes congestifs",
            diff1Guidance: "Irradiation, facteur calmant ou bruits auscultatoires distincts",
            diff2Guidance: "Absence d'insuffisance cardiaque gauche ou tableau droit aigu isolé",
            diff3Guidance: "Asymétrie tensionnelle/pouls ou frottement / syndrome fébrile",
          },
          {
            criterion: "**ECG 12 dérivations & Radiographie thoracique**",
            courseGuidance: "Anomalies électriques typiques du cours (territoire, rythme, voltage) et silhouette cardiomédiastinale",
            diff1Guidance: "Sus-décalage diffus sans miroir vs systématisé avec image en miroir",
            diff2Guidance: "Tracé électrique normal ou signes droits isolés (S1Q3, BBD)",
            diff3Guidance: "Médiastin élargi ou signes de surcharge vasculaire différente",
          },
          {
            criterion: "**Biomarqueurs, ETT & Examen de référence**",
            courseGuidance: "Troponine, BNP, D-dimères, hémocultures, paramètres **ETT** ou **angioscanner / coronarographie**",
            diff1Guidance: "Cinétique enzymatique ou résultat écho-Doppler discordant",
            diff2Guidance: "Gradient valvulaire ou fraction d'éjection conservée vs altérée",
            diff3Guidance: "Confirmation scannographique ou hémocultures positives",
          },
          {
            criterion: "**Stratégie d'urgence & Traitement de fond**",
            courseGuidance: "Délais critiques (ex. angioplastie vs fibrinolyse), anticoagulation, diurétiques/IEC/BB et contre-indications formelles",
            diff1Guidance: "Thrombolyse ou anticoagulation curatrice formellement contre-indiquée (ex. dissection / péricardite !)",
            diff2Guidance: "Traitement anti-inflammatoire ou valvulaire/rythmique spécifique",
            diff3Guidance: "Chirurgie cardiaque urgente ou antibiothérapie parentérale prolongée",
          },
        ],
        clinicalCaseSteps: [
          {
            stepNumber: 1,
            title: "ÉTAPE 1 — RECONNAISSANCE CLINIQUE & DÉTECTION DES SIGNES DE CHOC / GRAVITÉ",
            bullets: [
              "**Constantes vitales :** PA aux 2 bras, FC, SpO2, signes d'hypoperfusion ou OAP (Killip).",
              "**Caractérisation :** Type de douleur/dyspnée, facteurs déclenchants et FDRCV.",
            ],
          },
          {
            stepNumber: 2,
            title: "ÉTAPE 2 — LECTURE CHRONOLOGIQUE DE L'ECG 12 DÉRIVATIONS",
            bullets: [
              "**Réflexe absolu (< 10 min) :** Rythme, fréquence, troubles conductifs, repolarisation systématisée ou diffuse, miroir.",
            ],
          },
          {
            stepNumber: 3,
            title: "ÉTAPE 3 — BIOMARQUEURS & IMAGERIE CARDIAQUE DE RÉFÉRENCE",
            bullets: [
              "**Examens discriminants :** Troponine, BNP/NT-proBNP, D-dimères selon probabilité (Wells), ETT, angioscanner ou coronarographie.",
            ],
          },
          {
            stepNumber: 4,
            title: "ÉTAPE 4 — DIAGNOSTICS DIFFÉRENTIELS PIÈGES & STRATIFICATION PRONOSTIQUE",
            bullets: [
              "**Écarter l'erreur fatale :** Dissection aortique / péricardite avant d'anticoaguler ou de thrombolyser !",
              "**Scores du cours :** Appliquer les échelles (NYHA, Killip, CHA2DS2-VASc...).",
            ],
          },
          {
            stepNumber: 5,
            title: "ÉTAPE 5 — REPERFUSION / URGENCE & ORDONNANCE DE FOND",
            bullets: [
              "**Traitement d'attaque et de fond :** Molécules exactes, doses de charge, durée de bithérapie/anticoagulation et surveillance.",
            ],
          },
        ],
        fallbackObjectives: (t) => [
          `Définir ${t}, ses facteurs de risque et ses mécanismes physiopathologiques`,
          "Identifier le tableau clinique et les signes de gravité hémodynamique",
          "Interpréter l'ECG, les biomarqueurs et l'échocardiographie / imagerie",
          "Poser le diagnostic positif, différentiel et les scores pronostiques",
          "Planifier la prise en charge d'urgence, le traitement chronique et la surveillance",
        ],
        lexiconClusters: [
          {
            triggers: ["coronarien", "infarctus", "sca", "angor", "cardiopathie"],
            expansions: ["syndrome coronarien", "troponine", "ecg", "angioplastie", "antiagregant", "fevg"],
          },
          {
            triggers: ["insuffisance cardiaque", "oedeme", "oap", "nyha"],
            expansions: ["insuffisance cardiaque", "nyha", "bnp", "furosemide", "iec", "betabloquant"],
          },
        ],
        exclusionPeerKeywords: ["fracture", "gustilo", "enclouage", "myelogramme", "vgm"],
      };

    case "pneumologie":
    case "neurologie":
    case "nephrologie":
    case "hepato_gastro":
    case "endocrinologie":
    case "infectiologie":
    case "pediatrie":
    case "gyneco_obstetrique":
    case "chirurgie":
    case "urologie":
    case "urgence_rea":
    case "immunologie":
    case "dermatologie":
    case "orl_ophtalmo":
    case "pharmacologie":
    case "anatomie":
    default: {
      const domainLabels = getDisciplineSpecificAxes(family, subjectLabel);
      return {
        domainFamily: family,
        subjectLabel,
        specialistPersona,
        examFocusAxes: domainLabels.examFocusAxes,
        interpretationDirectives: [
          {
            trigger: /\b(interpr[eéè]ter|analyser|bilan|examen|imagerie|classification|score|biolog)\b/i,
            title: `DÉMARCHE D'INTERPRÉTATION EN ${subjectLabel.toUpperCase()}`,
            steps: domainLabels.interpretationSteps,
          },
        ],
        confrontationRows: domainLabels.confrontationRows,
        clinicalCaseSteps: domainLabels.clinicalCaseSteps,
        fallbackObjectives: (t) => domainLabels.fallbackObjectives(t),
        lexiconClusters: [],
        exclusionPeerKeywords: [],
      };
    }
  }
}

function getDisciplineSpecificAxes(family: DomainFamily, label: string): {
  examFocusAxes: string[];
  interpretationSteps: string[];
  confrontationRows: ConfrontationAxisRow[];
  clinicalCaseSteps: ClinicalCaseStepTemplate[];
  fallbackObjectives: (cleanTitle: string) => string[];
} {
  const paraclinicalFocusMap: Partial<Record<DomainFamily, string>> = {
    pneumologie: "Imagerie thoracique (Rx, TDM), Gazométrie artérielle (PaO2, PaCO2, pH), EFR (VEMS/CVF) et prélèvements (ECBC, BK/GeneXpert, ponction pleurale / critères de Light)",
    neurologie: "Examen neurologique topographique (force, ROT, sensibilité, paires crâniennes, syndrome méningé), TDM/IRM cérébrale ou médullaire, PL/LCR, EEG et EMG",
    nephrologie: "Fonction rénale (Créatininémie, DFG KDIGO/CKD-EPI), Ionogramme (K+, Na+, HCO3-), Protéinurie/Albuminurie, ECBU, Échographie rénale et Ponction-Biopsie Rénale (PBR)",
    hepato_gastro: "Bilan hépatique (ASAT/ALAT, PAL, GGT, Bilirubine, TP/FV), Lipase, Endoscopie (FOGD, coloscopie), Échographie/TDM abdominale et scores (Child-Pugh, MELD, Ranson, Rockall)",
    endocrinologie: "Dosages hormonaux dynamiques et statiques (TSH/T4L, HbA1c, glycémie, cortisol, ACTH, ionogramme, calcémie/PTH) et imagerie endocrinienne (échographie, IRM hypophysaire)",
    infectiologie: "Prélèvements microbiologiques avant antibiothérapie (hémocultures, ECBU, LCR, goutte épaisse/TDR), marqueurs inflammatoires (CRP, PCT) et sensibilité aux anti-infectieux",
    pediatrie: "Évaluation selon l'âge et le poids (constantes pédiatriques normales, score de déshydratation, courbes pondérales, Apgar, calendrier vaccinal PEV et posologies en mg/kg/j)",
    gyneco_obstetrique: "Bêta-hCG, Échographie pelvienne/obstétricale, RCF, bilan vasculo-rénal (protéinurie, ASAT/ALAT, plaquettes), frottis/colposcopie et pronostic materno-fœtal",
    chirurgie: "Examen abdominal/local, signes péritonéaux ou occlusifs, ASP/TDM abdominopelvienne injectée, bilan préopératoire d'urgence et indication opératoire (délais et technique)",
    urologie: "Examen urologique et toucher pelvien, BU/ECBU, PSA, créatininémie, échographie réno-vésico-prostatique, TDM urologique sans/avec injection et geste de drainage urgent",
    urgence_rea: "Évaluation ABCDE, gazométrie/lactates, remplissage/amines vasopressives, monitorage continu et gestes de sauvetage immédiats",
    immunologie: "Bilan auto-immun spécifique (FAN, anti-DNA natifs, anti-ENA, ANCA, SAPL, complément CH50/C3/C4), atteintes viscérales et biopsie d'organe cible",
    dermatologie: "Analyse de la lésion élémentaire (macule, papule, bulle, ulcération), signe de Nikolsky, atteinte muqueuse, prélèvement/biopsie cutanée et critères de gravité",
    orl_ophtalmo: "Acuité visuelle / fond d'œil / tonus oculaire ou otoscopie / nasofibroscopie / audiométrie / TDM des rochers-sinus et urgences sensorielles",
    pharmacologie: "Paramètres PK/PD (Cmax, Tmax, biodisponibilité, Vd, T1/2, clairance, métabolisme CYP450), marge thérapeutique étroite, interactions et adaptations posologiques",
    anatomie: "Limites anatomiques, contenu, rapports antérieurs/postérieurs/médiaux/latéraux, vascularisation artério-veineuse-lymphatique, innervation et applications médico-chirurgicales",
  };

  const paraclinicalLine =
    paraclinicalFocusMap[family] ||
    `Examens paracliniques clés, scores, seuils chiffrés et critères de certitude spécifiques à « ${label} »`;

  const clinicalAxis =
    family === "anatomie"
      ? "Description morphologique systématique : situation, forme, dimensions, rapports anatomiques précis, vascularisation et innervation"
      : family === "pharmacologie"
      ? "Mécanisme d'action moléculaire, cibles pharmacologiques, indications cliniques validées et contre-indications formelles"
      : `Sémiologie clinique discriminante, formes cliniques typiques/pièges et signes de gravité immédiate en ${label}`;

  const therapeuticAxis =
    family === "anatomie"
      ? "Voies d'abord anatomiques, zones dangereuses (nerfs/vaisseaux) et déductions cliniques lésionnelles"
      : family === "pharmacologie"
      ? "Posologies, modalités d'administration, suivi thérapeutique (STP), effets indésirables dose-dépendants et gestion des surdosages/antidotes"
      : "Stratégie thérapeutique complète : mesures d'urgence, traitements étiologiques/de fond, posologies exactes, contre-indications et surveillance";

  return {
    examFocusAxes: [
      `Définition exacte, physiopathologie / mécanismes fondamentaux et épidémiologie propre à ${label}`,
      clinicalAxis,
      paraclinicalLine,
      "Diagnostics différentiels concurrents et pièges classiques de QCM/Cas cliniques",
      therapeuticAxis,
    ],
    interpretationSteps: [
      `Identifier les paramètres clés exigés en ${label} et vérifier les critères de qualité/validité de l'examen.`,
      "Repérer les valeurs pathologiques, écarts aux seuils officiels ou lésions élémentaires caractéristiques du cours.",
      "Corréler systématiquement ces résultats au contexte clinique pour éliminer les faux positifs / diagnostics différentiels.",
      "Formuler la conclusion diagnostique ou classificatoire précise et en déduire la décision immédiate.",
    ],
    confrontationRows: [
      {
        criterion: "**Terrain, Circonstances & Étiopathogénie**",
        courseGuidance: `Âge, facteurs de risque, antécédents et mécanisme déclenchant propres au cours (${label})`,
        diff1Guidance: "Terrain ou mode de début (aigu vs chronique / héréditaire vs acquis) distinct",
        diff2Guidance: "Facteurs favorisants ou exposition causale différents",
        diff3Guidance: "Contexte physiopathologique ou terrain de survenue opposé",
      },
      {
        criterion: `**Tableau clinique & Signes cardinaux (${label})**`,
        courseGuidance: "Triade/syndrome caractéristique du cours, topographie et signes de gravité immédiate",
        diff1Guidance: "Signe clinique clé absent ou orientation vers un autre appareil/système",
        diff2Guidance: "Symptomatologie trompeuse proche mais discordance sur l'évolution ou l'examen physique",
        diff3Guidance: "Absence de critère spécifique ou présence d'un signe d'alerte différent",
      },
      {
        criterion: "**Examens de 1re intention & Paraclinique clé**",
        courseGuidance: paraclinicalLine,
        diff1Guidance: "Profil biologique, fonctionnel, électrophysiologique ou d'imagerie différent",
        diff2Guidance: "Examen de débrouillage normal ou orientant vers une autre étiologie",
        diff3Guidance: "Marqueurs inflammatoires, biochimiques ou radiologiques discordants",
      },
      {
        criterion: "**Examen / Critère de certitude & Score pronostique**",
        courseGuidance: "Gold standard diagnostique, critères classificatoires et scores officiels enseignés dans le cours",
        diff1Guidance: "Test spécifique de confirmation différent propre à cette entité concurrente",
        diff2Guidance: "Seuil ou stade classificatoire inférieur/supérieur modifiant la catégorie",
        diff3Guidance: "Diagnostic d'exclusion nécessitant un examen anatomopathologique / microbien / ciblé",
      },
      {
        criterion: "**Prise en charge, Urgences & Contre-indications**",
        courseGuidance: therapeuticAxis,
        diff1Guidance: "Traitement de 1re ligne différent ou contre-indication réciproque en QCM",
        diff2Guidance: "Prise en charge purement symptomatique vs urgence étiologique spécifique",
        diff3Guidance: "Délai d'intervention, posologie ou modalité de surveillance distincte",
      },
    ],
    clinicalCaseSteps: [
      {
        stepNumber: 1,
        title: `ÉTAPE 1 — RECHERCHER LES SIGNES DE GRAVITÉ & ANALYSER LE TERRAIN (${label.toUpperCase()})`,
        bullets: [
          "**Données d'entrée :** Repérer l'âge, le terrain, les antécédents, le mode d'installation et l'état hémodynamique / vital.",
          "**Urgence immédiate :** Écarter d'emblée les signes de menace vitale ou fonctionnelle avant d'engager le bilan spécialisé.",
        ],
      },
      {
        stepNumber: 2,
        title: `ÉTAPE 2 — STRUCTURER L'EXAMEN CLINIQUE SPÉCIALISÉ (${label.toUpperCase()})`,
        bullets: [
          "**Sémiologie ciblée :** Rechercher les signes positifs cardinaux et les signes négatifs pertinents exigés dans le cours.",
          "**Orientation différentielle :** Repérer dès l'examen physique les éléments permettant d'éliminer les pathologies voisines.",
        ],
      },
      {
        stepNumber: 3,
        title: "ÉTAPE 3 — HIERARCHISER & INTERPRÉTER LES EXAMENS PARACLINIQUES",
        bullets: [
          `**Bilan ciblé :** ${paraclinicalLine}.`,
          "**Confirmation :** Distinguer les examens de débrouillage rapide de l'examen de certitude (Gold Standard) du cours.",
        ],
      },
      {
        stepNumber: 4,
        title: "ÉTAPE 4 — POSER LA CLASSIFICATION, LE STADE ET ÉCARTER LES PIÈGES QCM",
        bullets: [
          "**Stadification :** Calculer le score ou stade pronostique enseigné dans le polycopié.",
          "**Anti-piège :** Vérifier les critères d'exclusion et confusions classiques testés en examen.",
        ],
      },
      {
        stepNumber: 5,
        title: "ÉTAPE 5 — DÉCISION THÉRAPEUTIQUE, CONTRE-INDICATIONS & SURVEILLANCE",
        bullets: [
          "**Traitement complet :** Mesures symptomatiques urgentes, traitement spécifique/curatif (molécules, posologies, durées ou geste interventionnel).",
          "**Sécurité :** Citer systématiquement les contre-indications absolues et paramètres de suivi.",
        ],
      },
    ],
    fallbackObjectives: (cleanTitle: string) => [
      `Définir ${cleanTitle}, son cadre nosologique et son épidémiologie`,
      `Expliquer les mécanismes physiopathologiques et étiologiques de ${cleanTitle}`,
      `Identifier le tableau clinique typique, les formes cliniques et le bilan paraclinique de référence (${label})`,
      "Établir le diagnostic positif, différentiel et évaluer la gravité / le pronostic",
      "Planifier la prise en charge thérapeutique complète, les contre-indications et la surveillance",
    ],
  };
}

/**
 * Infère dynamiquement le profil disciplinaire complet à partir du sujet saisi,
 * du titre du cours et de son contenu réel (sans jamais rester figé sur Hématologie ou une matière précédente).
 */
export function inferDisciplineProfile(params: {
  subjectHint?: string;
  isExplicitSubjectChoice?: boolean;
  courseTitle?: string;
  courseText?: string;
}): DisciplineProfile {
  const { subjectHint = "", isExplicitSubjectChoice = false, courseTitle = "", courseText = "" } = params;
  const trimmedHint = subjectHint.trim();
  const isNeutralHint =
    !trimmedHint ||
    /^(auto|auto[-\s]*d[eé]tection|m[eé]decine|discipline|tous|g[eé]n[eé]ral)$/i.test(trimmedHint);

  const normHint = normalizeDisciplineText(trimmedHint);
  const normTitle = normalizeDisciplineText(courseTitle);
  const normBody = normalizeDisciplineText((courseText || "").slice(0, 22000));

  let bestRule: DomainRuleDef | null = null;
  let bestScore = -1;
  const scores = new Map<DomainFamily, number>();

  for (const rule of DOMAIN_RULES) {
    let score = 0;

    if (!isNeutralHint && normHint) {
      for (const pat of rule.subjectPatterns) {
        if (pat.test(normHint)) {
          // Si le hint vaut "Hématologie" par défaut historique, on lui donne un poids modéré si le utilisateur ne l'a pas explicitement verrouillé
          score += isExplicitSubjectChoice ? 60 : trimmedHint === "Hématologie" ? 4 : 30;
          break;
        }
      }
    }

    for (const pat of rule.subjectPatterns) {
      if (pat.test(normTitle)) score += 16;
    }

    for (const pat of rule.contentPatterns) {
      if (pat.test(normTitle)) score += 10;
      if (pat.test(normBody)) {
        const gMatches = normBody.match(new RegExp(pat.source, "gi"));
        score += Math.min(18, (gMatches?.length || 1) * 3);
      }
    }

    scores.set(rule.family, score);
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  // Si l'utilisateur a explicitement verrouillé un nom de matière qui correspond à un domaine connu
  if (isExplicitSubjectChoice && !isNeutralHint && normHint) {
    const explicitRule = DOMAIN_RULES.find((r) => r.subjectPatterns.some((p) => p.test(normHint)));
    if (explicitRule) {
      return getProfileTemplate(explicitRule.family, trimmedHint, explicitRule.persona);
    }
    return getProfileTemplate(
      bestScore >= 12 && bestRule ? bestRule.family : "general",
      trimmedHint,
      `Professeur Agrégé de ${trimmedHint}`
    );
  }

  // Si le hint n'est pas verrouillé (ou vaut l'ancien défaut "Hématologie") mais qu'un autre domaine domine nettement le cours
  if (bestRule && bestScore >= 6) {
    const label = !isNeutralHint && trimmedHint !== "Hématologie" && (scores.get(bestRule.family) || 0) <= 15
      ? trimmedHint
      : bestRule.label;
    return getProfileTemplate(bestRule.family, label, bestRule.persona);
  }

  const finalLabel = !isNeutralHint ? trimmedHint : "Médecine Clinique";
  return getProfileTemplate("general", finalLabel, `Professeur Agrégé de ${finalLabel}`);
}

/**
 * Détecte rapidement la matière d'un cours pour pré-remplir / adapter l'interface.
 */
export function detectSubjectFromCourse(courseTitle: string, courseText: string): string {
  return inferDisciplineProfile({
    courseTitle,
    courseText,
    isExplicitSubjectChoice: false,
  }).subjectLabel;
}

/**
 * Retourne des lignes adaptatives pour le tableau 3.2 lorsque la génération IA est incomplète ou interrompue.
 */
export function getAdaptiveConfrontationRows(
  headers: string[],
  profile?: DisciplineProfile
): string[][] {
  const effectiveProfile =
    profile ||
    inferDisciplineProfile({
      courseTitle: headers.join(" "),
      courseText: headers.join(" "),
    });

  return effectiveProfile.confrontationRows.map((row) => [
    row.criterion,
    row.courseGuidance,
    row.diff1Guidance,
    row.diff2Guidance,
    row.diff3Guidance,
  ]);
}

const KNOWN_EXAM_SUBJECT_HEADERS: Array<{ label: string; regex: RegExp }> = [
  { label: "Traumatologie", regex: /\btraumatologie(?:\s+orthop[eé]dique)?\b/i },
  { label: "Orthopédie", regex: /\borthop[eé]die(?:\s+traumatologie)?\b/i },
  { label: "Rhumatologie", regex: /\brhumatologie\b/i },
  { label: "Hématologie", regex: /\bh[eé]matologie(?:\s+clinique)?\b/i },
  { label: "Maladies de Système", regex: /\bmaladies?\s+de\s+syst[eè]me|\bsyst[eé]mique\b/i },
  { label: "Cardiologie", regex: /\bcardiologie\b/i },
  { label: "Pneumologie", regex: /\bpneumologie\b/i },
  { label: "Neurologie", regex: /\bneurologie\b/i },
  { label: "Néphrologie", regex: /\bn[eé]phrologie\b/i },
  { label: "Hépato-Gastro-Entérologie", regex: /\bh[eé]pato[\s-]?gastro/i },
  { label: "Infectiologie", regex: /\bmaladies?\s+infectieuses?|\binfectiologie\b/i },
  { label: "Endocrinologie", regex: /\bendocrinologie\b/i },
  { label: "Pédiatrie", regex: /\bp[eé]diatrie\b/i },
  { label: "Gynécologie-Obstétrique", regex: /\bgyn[eé]cologie|\bobst[eé]trique\b/i },
  { label: "Chirurgie", regex: /\bchirurgie(?:\s+g[eé]n[eé]rale|\s+visc[eé]rale)?\b/i },
  { label: "Urologie", regex: /\burologie\b/i },
];

/**
 * Détecte toutes les matières explicitement nommées dans un sujet d'examen / UE (ex: TOR -> Orthopédie, Traumatologie, Rhumatologie).
 */
export function detectSubjectsInExamText(examText: string): string[] {
  if (!examText) return [];
  const head = examText.slice(0, 12000);
  const found: string[] = [];
  for (const entry of KNOWN_EXAM_SUBJECT_HEADERS) {
    if (entry.regex.test(head) || new RegExp(`(?:^|\\n)\\s*(?:PARTIE|SECTION|EPREUVE|MODULE|EC)\\s*[:\\-–—]?\\s*[^\\n]*${entry.regex.source}`, "im").test(examText)) {
      if (!found.includes(entry.label)) found.push(entry.label);
    }
  }
  return found;
}

/**
 * Isole strictement la section / les pages correspondant à la matière ou au cours cible
 * dans une annale pouvant contenir plusieurs matières d'une même UE (ex. TOR : Orthopédie + Traumatologie + Rhumatologie).
 */
export function isolateExamContentForSubject(
  fullExamText: string,
  opts: {
    targetSubject: string;
    domainFamily: DomainFamily;
    courseTitle: string;
    extraKeywords?: string[];
  }
): {
  isolatedText: string;
  isOtherSubjectOnly: boolean;
  wasTrimmedFromMultiSubject: boolean;
  detectedOtherSubjects: string[];
} {
  if (!fullExamText || !fullExamText.trim()) {
    return { isolatedText: "", isOtherSubjectOnly: false, wasTrimmedFromMultiSubject: false, detectedOtherSubjects: [] };
  }

  const normTargetSubj = normalizeDisciplineText(opts.targetSubject);
  const targetRule = DOMAIN_RULES.find((r) => r.family === opts.domainFamily);
  const targetSubjectPatterns = targetRule?.subjectPatterns || (normTargetSubj ? [new RegExp(normTargetSubj.replace(/\s+/g, "\\s+"), "i")] : []);

  // Découpage par grands en-têtes d'épreuve ou marqueurs de page
  const sectionSplitter =
    /(?=(?:^|\n)\s*(?:===\s*)?(?:SECTION|PARTIE|EPREUVE|SOUS[- ]EPREUVE|EC\s*\d+|ELEMENT\s+CONSTITUTIF|MATIERE|MODULE|DEPARTEMENT|[I|V|X]{1,3}\s*[.)-]\s*(?:TRAUMATOLOGIE|ORTHOPEDIE|RHUMATOLOGIE|CARDIOLOGIE|PNEUMOLOGIE|HEMATOLOGIE|MALADIES?\s+DE\s+SYSTEME|NEUROLOGIE|PEDIATRIE|GYNECOLOGIE|UROLOGIE|NEPHROLOGIE|HEPATO|GASTRO|INFECTIOLOGIE|DERMATOLOGIE)|---+\s*PAGE\s+\d+\s*---+))/gim;

  const rawBlocks = fullExamText
    .split(sectionSplitter)
    .map((b) => b.trim())
    .filter((b) => b.length > 40);

  if (rawBlocks.length <= 1) {
    return {
      isolatedText: fullExamText,
      isOtherSubjectOnly: false,
      wasTrimmedFromMultiSubject: false,
      detectedOtherSubjects: [],
    };
  }

  const courseTokens = normalizeDisciplineText(opts.courseTitle)
    .split(" ")
    .filter((w) => w.length >= 4);
  const extraToks = (opts.extraKeywords || []).map(normalizeDisciplineText).filter((w) => w.length >= 4);
  const allTargetTokens = Array.from(new Set([...courseTokens, ...extraToks]));

  const keptBlocks: string[] = [];
  const matchedTargetBlocks: string[] = [];
  const otherSubjectsFound = new Set<string>();
  let explicitTargetBlocksCount = 0;

  let currentActiveSubjectMatchesTarget: boolean | null = null;

  for (const block of rawBlocks) {
    const firstLinesNorm = normalizeDisciplineText(block.split(/\r?\n/).slice(0, 4).join(" "));
    const fullBlockNorm = normalizeDisciplineText(block);

    // Détecte si l'en-tête du bloc annonce explicitement une matière connue
    let announcedDomain: DomainRuleDef | null = null;
    for (const r of DOMAIN_RULES) {
      if (r.subjectPatterns.some((p) => p.test(firstLinesNorm))) {
        announcedDomain = r;
        break;
      }
    }

    if (announcedDomain) {
      const isTargetHeader =
        announcedDomain.family === opts.domainFamily ||
        targetSubjectPatterns.some((p) => p.test(firstLinesNorm));
      currentActiveSubjectMatchesTarget = isTargetHeader;
      if (!isTargetHeader) {
        otherSubjectsFound.add(announcedDomain.label);
      } else {
        explicitTargetBlocksCount++;
      }
    }

    // Évalue le contenu réel du bloc (utile si c'est une page sans en-tête de section)
    let targetContentScore = 0;
    for (const tok of allTargetTokens) {
      if (fullBlockNorm.includes(tok)) targetContentScore += 3;
    }
    if (targetRule) {
      for (const pat of targetRule.contentPatterns) {
        if (pat.test(fullBlockNorm)) targetContentScore += 2;
      }
    }

    let strongestOtherScore = 0;
    let strongestOtherLabel = "";
    for (const r of DOMAIN_RULES) {
      if (r.family === opts.domainFamily) continue;
      let oScore = 0;
      for (const pat of r.subjectPatterns) {
        if (pat.test(firstLinesNorm)) oScore += 12;
      }
      for (const pat of r.contentPatterns) {
        if (pat.test(fullBlockNorm)) oScore += 2;
      }
      if (oScore > strongestOtherScore) {
        strongestOtherScore = oScore;
        strongestOtherLabel = r.label;
      }
    }

    if (strongestOtherScore >= 8 && strongestOtherScore > targetContentScore * 2 && strongestOtherLabel) {
      otherSubjectsFound.add(strongestOtherLabel);
    }

    if (currentActiveSubjectMatchesTarget === true) {
      // Ne garde le bloc que s'il ne bascule pas clairement sur une autre matière sans en-tête explicite
      if (strongestOtherScore >= 12 && targetContentScore === 0) {
        continue;
      }
      keptBlocks.push(block);
      matchedTargetBlocks.push(block);
    } else if (currentActiveSubjectMatchesTarget === false) {
      // Hors section cible : sauf si des mots du cours lui-même y apparaissent fortement
      if (targetContentScore >= 10 && strongestOtherScore < targetContentScore) {
        keptBlocks.push(block);
        matchedTargetBlocks.push(block);
      }
    } else {
      // Pas encore d'en-tête explicite (ex: bannière de garde avant PARTIE 1) : garder sauf si autre matière pure
      if (strongestOtherScore >= 10 && targetContentScore <= 1) {
        continue;
      }
      keptBlocks.push(block);
      if (targetContentScore >= 4) {
        matchedTargetBlocks.push(block);
      }
    }
  }

  const otherList = Array.from(otherSubjectsFound);
  if (
    keptBlocks.length === 0 ||
    (otherList.length > 0 && explicitTargetBlocksCount === 0 && matchedTargetBlocks.length === 0)
  ) {
    return {
      isolatedText: "",
      isOtherSubjectOnly: otherList.length > 0,
      wasTrimmedFromMultiSubject: true,
      detectedOtherSubjects: otherList,
    };
  }

  const isolatedText = keptBlocks.join("\n\n");
  const wasTrimmed = keptBlocks.length < rawBlocks.length && (explicitTargetBlocksCount > 0 || otherList.length > 0);
  return {
    isolatedText,
    isOtherSubjectOnly: false,
    wasTrimmedFromMultiSubject: wasTrimmed,
    detectedOtherSubjects: otherList,
  };
}
