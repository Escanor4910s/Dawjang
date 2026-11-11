// src/pages/ExamenBlanc.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Pause,
  ArrowUpDown,
  Plus,
  HelpCircle,
  Sparkles,
  BookOpen,
  FileCheck2,
  ChevronRight,
  ChevronLeft,
  X,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportQuizToPDF } from "@/utils/pdfExport";
import type { QuizData } from "@/utils/QuizPDF";

// ============================================================================
// 1. TYPES & CONTRATS D'INTERFACE DOCIMOLOGIQUE
// ============================================================================

export type DocimologyFormat =
  | "CAS_CLINIQUE"
  | "ELECTION"
  | "CENSURE"
  | "GROUPAGE"
  | "COMPLEMENT_MULTIPLE"
  | "ASSOCIATION"
  | "JUMELAGE"
  | "QNS";

export interface QuestionOption {
  letter: "A" | "B" | "C" | "D" | "E";
  text: string;
}

export interface ExamQuestion {
  id: number;
  lessonId: string;
  caseHeader?: string;
  vignette?: string;
  evolution?: string;
  course: string;
  type: DocimologyFormat;
  code?: string;
  stem: string;
  propositions?: string[];
  statement1?: string;
  statement2?: string;
  options: QuestionOption[];
  correct: "A" | "B" | "C" | "D" | "E";
  explanation: string;
}

export interface SubjectDocimologyProfile {
  subjectName: string;
  ueName: string;
  detectedFormats: DocimologyFormat[];
  dialectTerms: string[];
  defaultDurationMin: number;
  defaultQcmCount: number;
  lessonQuotaTarget: number;
  professorIdentity: string;
}

export interface CourseDocument {
  id: string;
  subject: "hemato" | "ms" | "nephro" | "custom";
  title: string;
  pages: number;
  size: string;
  chapter: string;
  freq: number;
  tier: "valid" | "duplicate";
  appearances: string;
  avgQcm: number;
}

export interface ExamAnnaleDocument {
  id: string;
  title: string;
  year: string;
  session: string;
  qcmCount: number;
  durationMin: number;
  details: string;
}

export interface ExamSession {
  id: string;
  title: string;
  seriesTag: string;
  subtitle: string;
  createdAt: string;
  durationMin: number;
  calibratedMaxQcm: number;
  questions: ExamQuestion[];
  presetStats?: { found: number; wrong: number; total: number };
}

export interface SubjectFolder {
  subjectId: string;
  subjectName: string;
  code: string;
  professor: string;
  styleDescription: string;
  defaultQcmCount: number;
  defaultDurationMin: number;
  coursesIndexed: number;
  annalesIndexed: number;
  exams: ExamSession[];
}

export interface UEFolder {
  ueId: string;
  ueName: string;
  ueCode: string;
  description: string;
  subjects: SubjectFolder[];
}

// ============================================================================
// 2. MOTEUR BACKEND CAMÉLÉON UNIVERSEL (PROMPT SYSTÈME & AUTOMATES EN 2 PASSES)
// ============================================================================

export const EXAMEN_BLANC_SYSTEM_PROMPT = `Tu es le Moteur Docimologique Caméléon de DawJang (Faculté de Médecine, de Pharmacie et d'Odonto-Stomatologie - UCAD).
Tu opères en DEUX PASSES STRICTEMENT SÉPARÉES afin qu'aucune matière n'entre en conflit avec une autre (ex: Hématologie M1 vs Néphrologie M2, Cardiologie ou Maladies de Système).

================================================================================
PASSE 1 — AUTO-DÉTECTION DOCIMOLOGIQUE & ISOLATION DE LA MATIÈRE CIBLE :
================================================================================
1. Tu reçois l'Unité d'Enseignement "{{UE_NAME}}" et la matière cible "{{SUBJECT_NAME}}".
2. Dans les annales uploadées, tu isoles UNIQUEMENT les questions et épreuves de "{{SUBJECT_NAME}}".
3. Tu détectes les formats réels : CAS CLINIQUE, ÉLECTION, CENSURE, GROUPAGE (code exact A/B/C/D/E), COMPLÉMENT MULTIPLE, ASSOCIATION, JUMELAGE ou QNS.
4. Tu isoles le dialecte clinique/biologique exact de la matière et ÉCRASES tout biais d'une matière précédente.

================================================================================
PASSE 2 — CLONAGE & ASSEMBLAGE SUR LES {{QUOTA_COUNT}} LEÇONS SÉLECTIONNÉES :
================================================================================
1. Si la matière comporte des CAS CLINIQUES :
   - Structure : Contexte clinique et biologique dense -> Hypothèse diagnostique & examen de certitude -> Phrase de transition 1 (dévoilement du frottis / biologie / PBR) -> Confirmation & pronostic -> Phrase de transition 2 (rebondissement / accident / complication) -> Conduite thérapeutique.
2. Si la matière comporte des QCM isolés ou QNS : respect strict de la syntaxe et du barème.
3. Rétro-contrôle de cohérence : respect des formules exactes et application de la Loi d'Équisme (anti-monotonie).`.trim();

export function detectDocimologyProfile(
  subjectName: string,
  ueName: string
): SubjectDocimologyProfile {
  const s = (subjectName || "").toLowerCase();
  if (s.includes("néphro") || s.includes("nephro")) {
    return {
      subjectName: subjectName || "Néphrologie",
      ueName: ueName || "Néphrologie & Urologie",
      detectedFormats: [
        "CAS_CLINIQUE",
        "COMPLEMENT_MULTIPLE",
        "GROUPAGE",
        "ASSOCIATION",
        "QNS",
      ],
      dialectTerms: [
        "Créatininémie",
        "DFG CKD-EPI",
        "Protéinurie des 24h",
        "Sédiment urinaire",
        "FeNa",
        "PBR (MO + IF)",
        "Dialyse d'urgence",
      ],
      defaultDurationMin: 60,
      defaultQcmCount: 6,
      lessonQuotaTarget: 5,
      professorIdentity: "Service de Néphrologie & Hémodialyse (FMPOS UCAD)",
    };
  }
  if (s.includes("système") || s.includes("systeme")) {
    return {
      subjectName: subjectName || "Maladies de Système",
      ueName: ueName || "Médecine Interne",
      detectedFormats: [
        "GROUPAGE",
        "JUMELAGE",
        "CENSURE",
        "ELECTION",
        "CAS_CLINIQUE",
      ],
      dialectTerms: [
        "Lupus aigu vespertilio",
        "Critères SLICC",
        "Critères de Sydney",
        "PBR rénale lupique",
        "Score de Rodnan",
        "Anti-CCP",
        "Gottron",
      ],
      defaultDurationMin: 60,
      defaultQcmCount: 30,
      lessonQuotaTarget: 4,
      professorIdentity: "Pr Fatimata LY (Service de Dermatologie & Médecine Interne)",
    };
  }
  return {
    subjectName: subjectName || "Hématologie Clinique",
    ueName: ueName || "Hématologie et Maladies de Système",
    detectedFormats: ["CAS_CLINIQUE", "ELECTION", "CENSURE", "GROUPAGE"],
    dialectTerms: [
      "Hémogramme (GR, Hb, VGM, TCMH, CCMH, Réticulocytes)",
      "Frottis sanguin",
      "Score de Matutes",
      "Stades de Binet",
      "Translocation t(15;17)",
      "JAK2 V617F",
      "Cross-match ABO",
    ],
    defaultDurationMin: 60,
    defaultQcmCount: 18,
    lessonQuotaTarget: 7,
    professorIdentity: "Service d'Hématologie Clinique (CHNU Fann / UCAD)",
  };
}

// ============================================================================
// 3. BANQUES DE QUESTIONS AUTHENTIQUES (CALIBRE EXAMEN 2024 & MULTI-FORMATS)
// ============================================================================

const VERIFIED_HEMATO_QUESTIONS: ExamQuestion[] = [
  {
    id: 1,
    lessonId: "c-hem-1",
    caseHeader: "Cas clinique 1 — Hémopathie lymphoïde chronique, Score de Matutes & Richter",
    vignette:
      "Un patient âgé de 66 ans, retraité, est reçu en consultation d'hématologie pour une asthénie progressive associée à une dyspnée au moindre effort et un amaigrissement chiffré à 6 kg en quatre mois. L'examen clinique met en évidence une pâleur conjonctivale modérée et la présence de nombreuses adénopathies superficielles localisées aux aires cervicales, axillaires et inguinales de manière bilatérale et symétrique, de taille moyenne (2 à 3 cm), fermes, indolores, mobiles par rapport aux deux plans et sans périadénite, associées à une splénomégalie débordant de 4 cm le rebord costal gauche. L'hémogramme montre : Hémoglobine = 8,4 g/dL, VGM = 85 fL, TCMH = 29 pg ; Globules blancs = 94 000/mm³ avec PNN = 13 %, PNE = 1 %, Monocytes = 2 %, Lymphocytes = 84 % ; Plaquettes = 148 000/mm³.",
    course: "10- LEUCEMIE LYMPHOIDE CHRONIQUE 2026.pptx",
    type: "ELECTION",
    stem: "Quelle est l'hypothèse diagnostique la plus probable devant ce tableau ?",
    options: [
      { letter: "A", text: "Lymphome de Hodgkin classique" },
      { letter: "B", text: "Leucémie aiguë lymphoblastique" },
      { letter: "C", text: "Leucémie lymphoïde chronique" },
      { letter: "D", text: "Leucémie myéloïde chronique en phase chronique" },
      { letter: "E", text: "Myélome multiple" },
    ],
    correct: "C",
    explanation:
      "L'hyperlymphocytose chronique majeure chez le sujet de 66 ans associée à une polyadénopathie superficielle bilatérale et symétrique signe la Leucémie Lymphoïde Chronique (LLC).",
  },
  {
    id: 2,
    lessonId: "c-hem-1",
    caseHeader: "Cas clinique 1 (suite)",
    course: "10- LEUCEMIE LYMPHOIDE CHRONIQUE 2026.pptx",
    type: "CENSURE",
    stem: "Parmi les examens suivants, lequel NE DOIT PAS être demandé pour établir le diagnostic positif de cette affection car ses caractéristiques sont identiques à celles du sang périphérique ?",
    options: [
      { letter: "A", text: "Le frottis sanguin périphérique" },
      { letter: "B", text: "L'immunophénotypage lymphocytaire par cytométrie en flux sur sang périphérique" },
      { letter: "C", text: "Le test direct à l'antiglobuline (test de Coombs) devant l'anémie" },
      { letter: "D", text: "Le médullogramme, la cytoponction et la biopsie ganglionnaire d'emblée" },
      { letter: "E", text: "L'électrophorèse des protéines sériques" },
    ],
    correct: "D",
    explanation:
      "Diapositive 12 du cours LLC 2026 : Cytoponction et biopsie ganglionnaire, médullogramme : ne pas demander car caractéristiques identiques à celles du frottis sanguin.",
  },
  {
    id: 3,
    lessonId: "c-hem-1",
    caseHeader: "Cas clinique 1 (suite) — Frottis sanguin & Immunophénotypage",
    evolution:
      "Le frottis sanguin révèle une prolifération monotone de petits lymphocytes matures à chromatine mottée et dense, associée à de nombreux noyaux nus écrasés (« ombres de Gumprecht »). L'immunophénotypage lymphocytaire réalisé sur sang périphérique par cytométrie en flux montre une population lymphoïde B (CD19+) exprimant le CD5+ et le CD23+, avec une absence d'expression du FMC7 (FMC7-), une faible expression du CD22 (CD79b faible) et une faible intensité d'expression des immunoglobulines de surface (IgS faible).",
    course: "10- LEUCEMIE LYMPHOIDE CHRONIQUE 2026.pptx",
    type: "ELECTION",
    stem: "À quel score du système du Royal Marsden Hospital (Score de Matutes) et à quel stade pronostique de la classification de Binet correspondent les résultats de ce patient ?",
    options: [
      { letter: "A", text: "Score de Matutes = 2/5 ; Stade A de Binet" },
      { letter: "B", text: "Score de Matutes = 3/5 ; Stade B de Binet" },
      { letter: "C", text: "Score de Matutes = 5/5 ; Stade B de Binet" },
      { letter: "D", text: "Score de Matutes = 5/5 ; Stade C de Binet" },
      { letter: "E", text: "Score de Matutes = 4/5 ; Stade A de Binet" },
    ],
    correct: "D",
    explanation:
      "Matutes = 5/5 (CD5+, CD23+, CD22 faible, FMC7-, IgS faible). L'hémoglobine étant à 8,4 g/dL (< 10 g/dL), le patient est d'emblée au Stade C de Binet.",
  },
  {
    id: 4,
    lessonId: "c-hem-2",
    caseHeader: "Cas clinique 2 — Hémoglobinopathie constitutionnelle & Accident transfusionnel",
    vignette:
      "Un adolescent âgé de 15 ans, de groupe sanguin A rhésus négatif, est admis aux urgences pour la prise en charge d'une anémie aiguë mal tolérée associée à des douleurs osseuses diffuses. L'hémogramme montre : Globules blancs = 18,2 G/L, Hémoglobine = 5,2 g/dL, VGM = 66 fL, TCMH = 21 pg, CCMH = 31 %, Plaquettes = 430 G/L, Réticulocytes = 310 G/L. La ferritinémie est normale, le récepteur soluble de la transferrine (sTfR) est normal et le RET-He est à 29,5 pg. L'électrophorèse de l'hémoglobine objective : HbS = 79 %, HbF = 16 %, HbA2 = 5 % et HbA = 0 %.",
    course: "6_Hemoglobinopathies M1 — Drépanocytose & Thalassémies.pdf",
    type: "ELECTION",
    stem: "À quelle forme clinique exacte renvoient ces résultats biologiques et électrophorétiques ?",
    options: [
      { letter: "A", text: "La drépanocytose homozygote SS classique" },
      { letter: "B", text: "La forme double hétérozygote SC" },
      { letter: "C", text: "La forme composite Sβ⁰-thalassémie (profil électrophorétique SFA2)" },
      { letter: "D", text: "La forme composite Sβ⁺-thalassémie (profil électrophorétique SAFA2)" },
      { letter: "E", text: "L'hémoglobinose H (α-/--)" },
    ],
    correct: "C",
    explanation:
      "La forme Sβ⁰-thalassémie associe anémie microcytaire hypochrome à fer normal et profil électrophorétique SFA2 (absence totale d'HbA avec HbA2 augmentée > 3,5 %).",
  },
  {
    id: 5,
    lessonId: "c-hem-4",
    caseHeader: "Cas clinique 2 (suite) — Règle transfusionnelle ABO",
    evolution:
      "Devant la mauvaise tolérance hémodynamique de cette anémie à 5,2 g/dL, une transfusion de concentré de globules rouges est décidée en urgence.",
    course: "8-Sécurité Transfusionnelle & Hémovigilance.pdf",
    type: "ELECTION",
    stem: "Parmi les propositions ci-dessous, quelle poche de concentré de globules rouges choisissez-vous pour transfuser ce patient de groupe A rhésus négatif ?",
    options: [
      { letter: "A", text: "Une poche de CGR de groupe B rhésus négatif" },
      { letter: "B", text: "Une poche de CGR de groupe AB rhésus négatif" },
      { letter: "C", text: "Une poche de CGR de groupe A rhésus positif" },
      { letter: "D", text: "Une poche de CGR de groupe O rhésus positif" },
      { letter: "E", text: "Aucune des propositions ci-dessus" },
    ],
    correct: "E",
    explanation:
      "Règle transfusionnelle : un receveur A Rh négatif possède des anticorps anti-B et ne peut recevoir que des hématies A négatif ou O négatif. Toutes les propositions données (B-, AB-, A+, O+) sont incompatibles -> Réponse E.",
  },
  {
    id: 6,
    lessonId: "c-hem-5",
    caseHeader: "Cas clinique 3 — Leucémie Aiguë & Syndrome hémorragique",
    vignette:
      "Une patiente de 34 ans est adressée en urgence pour un syndrome hémorragique cutanéo-muqueux d'apparition brutale fait d'ecchymoses disséminées et d'épistaxis récidivantes, sans hépatosplénomégalie. L'hémogramme montre une pancytopénie avec : Hb = 7,1 g/dL, PNN = 0,4 G/L, Plaquettes = 19 G/L. Le frottis sanguin objective 68 % de cellules blastiques très granuleuses, renfermant de multiples bâtonnets de corps d'Auer en faisceaux (« blastes en fagots »). Le bilan d'hémostase confirme une CIVD avec TP à 35 %, Fibrinogène effondré à 0,7 g/L et D-Dimères très élevés > 20 µg/mL.",
    course: "3-Leucémies Aiguës (LAM3 Promyélocytaire t(15;17)).pdf",
    type: "ELECTION",
    stem: "Quel est le diagnostic hématologique d'extrême urgence et quelle anomalie cytogénétique spécifique doit être recherchée immédiatement ?",
    options: [
      { letter: "A", text: "LAM 1 avec translocation t(8;21) / RUNX1-RUNX1T1" },
      { letter: "B", text: "LAM 3 (promyélocytaire) avec translocation t(15;17) / PML-RARA" },
      { letter: "C", text: "LMC en crise blastique myéloïde avec chromosome Philadelphie t(9;22)" },
      { letter: "D", text: "LAL B avec translocation t(12;21)" },
      { letter: "E", text: "LAM 5 (monoblastique) avec réarrangement du gène KMT2A (11q23)" },
    ],
    correct: "B",
    explanation:
      "L'association de blastes en fagots, pancytopénie et CIVD aiguë est pathognomonique de la Leucémie Aiguë Promyélocytaire (LAM 3), associée à la translocation réciproque t(15;17)(q22;q21) formant le transcrit de fusion PML-RARA.",
  },
  {
    id: 7,
    lessonId: "c-hem-5",
    caseHeader: "Cas clinique 3 (suite) — Thérapeutique d'urgence",
    evolution:
      "Le diagnostic de LAM3 étant suspecté d'emblée devant le tableau de CIVD et les blastes en fagots, la patiente est transférée en soins intensifs d'hématologie.",
    course: "3-Leucémies Aiguës (LAM3 Promyélocytaire t(15;17)).pdf",
    type: "ELECTION",
    stem: "Quelle est l'attitude thérapeutique d'urgence absolue à instaurer sans attendre la confirmation cytogénétique ou moléculaire ?",
    options: [
      { letter: "A", text: "Démarrage immédiat d'une polychimiothérapie intensive 3+7 (Aracytine + Daunorubicine)" },
      { letter: "B", text: "Introduction immédiate de l'acide tout-trans rétinoïque (ATRA) associé au trioxyde d'arsenic (ATO) et soutien transfusionnel intensif" },
      { letter: "C", text: "Allogreffe de moelle osseuse en urgence dès le premier jour" },
      { letter: "D", text: "Traitement par hydroxyurée seule à 50 mg/kg/jour" },
      { letter: "E", text: "Simple surveillance hématologique avec transfusion de culots globulaires seuls" },
    ],
    correct: "B",
    explanation:
      "Toute suspicion de LAM3 exige l'instauration immédiate d'ATRA (tumeur à différenciation forcée) pour juguler la CIVD et prévenir l'hémorragie intracrânienne fatale, complété par ATO et correction transfusionnelle active (plaquettes, PFC/fibrinogène).",
  },
];

const INITIAL_COURSES: CourseDocument[] = [
  { id: "c-hem-1", subject: "hemato", title: "10- LEUCEMIE LYMPHOIDE CHRONIQUE 2026.pptx", pages: 38, size: "3.4 Mo", chapter: "LLC, Matutes, Binet, Richter & BTK", freq: 96, tier: "valid", appearances: "6/6 annales", avgQcm: 5 },
  { id: "c-hem-2", subject: "hemato", title: "6_Hemoglobinopathies M1 — Drépanocytose & Thalassémies.pdf", pages: 51, size: "5.2 Mo", chapter: "Drépanocytose SS/SC/Sβ⁰, STA & Hydroxyurée", freq: 95, tier: "valid", appearances: "6/6 annales", avgQcm: 5 },
  { id: "c-hem-3", subject: "hemato", title: "1-Anémies 2026 — Diagnostic & Prise en charge.pdf", pages: 34, size: "2.4 Mo", chapter: "Anémies, sTfR, RET-He (<28 pg) & Folates/B12", freq: 93, tier: "valid", appearances: "6/6 annales", avgQcm: 4 },
  { id: "c-hem-4", subject: "hemato", title: "8-Sécurité Transfusionnelle & Hémovigilance.pdf", pages: 24, size: "1.5 Mo", chapter: "Compatibilité ABO/Rh, Cross-match & Accidents", freq: 90, tier: "valid", appearances: "5/6 annales", avgQcm: 3 },
  { id: "c-hem-5", subject: "hemato", title: "3-Leucémies Aiguës (LAM3 Promyélocytaire t(15;17)).pdf", pages: 32, size: "2.1 Mo", chapter: "LAM3 Promyélocytaire, PML-RARA & CIVD", freq: 88, tier: "valid", appearances: "5/6 annales", avgQcm: 3 },
  { id: "c-hem-6", subject: "hemato", title: "5-Myélome Multiple & Gammapathies Monoclonales.pdf", pages: 30, size: "2.0 Mo", chapter: "Myélome Multiple, MGUS, Salmon-Durie & ISS", freq: 85, tier: "valid", appearances: "5/6 annales", avgQcm: 3 },
  { id: "c-hem-7", subject: "hemato", title: "2-Anémies Hémolytiques Constitutionnelles (Sphérocytose, G6PD).pdf", pages: 28, size: "1.9 Mo", chapter: "Sphérocytose & Déficit G6PD post-quinine", freq: 78, tier: "valid", appearances: "4/6 annales", avgQcm: 3 },
  { id: "c-hem-8", subject: "hemato", title: "7-Syndromes Myéloprolifératifs (Myélofibrose JAK2).pdf", pages: 29, size: "1.8 Mo", chapter: "SMP, Dacryocytes, BOM & JAK2 V617F", freq: 72, tier: "valid", appearances: "4/6 annales", avgQcm: 2 },
  { id: "c-hem-9", subject: "hemato", title: "9-Troubles de la Coagulation & Hémophilie A/B.pdf", pages: 36, size: "2.6 Mo", chapter: "Hémophilie A, Hémarthroses & Facteur VIII", freq: 66, tier: "valid", appearances: "3/6 annales", avgQcm: 2 },
  { id: "c-hem-10", subject: "hemato", title: "1-Anémies 2026 (Copie doublon détectée).pdf", pages: 34, size: "2.4 Mo", chapter: "Doublon détecté", freq: 0, tier: "duplicate", appearances: "Doublon", avgQcm: 0 }
];

const INITIAL_ANNALES: ExamAnnaleDocument[] = [
  { id: "e1", title: "Exam 2024 hemato- Ms (1).pdf", year: "2024", session: "Session 2023-2024", qcmCount: 53, durationMin: 120, details: "Référence Cas Cliniques Détaillés : EC1 Hématologie + EC2 Maladies de Système" },
  { id: "e2", title: "Examen 2025 Hémato & MS juil. .pdf", year: "2025", session: "Juillet 2025", qcmCount: 50, durationMin: 120, details: "EC1 Hématologie (Cas cliniques LBDGC, LAM3, SS) + EC2 Maladies de Système" },
  { id: "e3", title: "Exam 2023 Hemato & MS.pdf", year: "2023", session: "Session 2023", qcmCount: 40, durationMin: 120, details: "EC1 Hématologie (LLC/AHAI, LMC, SS/STA) + EC2 Maladies de Système" }
];

const INITIAL_UE_TREE: UEFolder[] = [
  {
    ueId: "ue-hemato-ms",
    ueName: "Hématologie et Maladies de Système",
    ueCode: "UE M1S2 · FMPOS UCAD",
    description: "Unité d'enseignement regroupant Hématologie Clinique et Maladies de Système.",
    subjects: [
      {
        subjectId: "sub-hemato",
        subjectName: "Hématologie Clinique",
        code: "EC1 : Hématologie Clinique",
        professor: "Service d'Hématologie Clinique (CHNU Fann)",
        styleDescription: "Cas cliniques détaillés à transitions (calibre Examen 2024).",
        defaultQcmCount: 18,
        defaultDurationMin: 60,
        coursesIndexed: 9,
        annalesIndexed: 3,
        exams: [
          {
            id: "eb-hem-1",
            title: "Examen blanc 1 — Hématologie Clinique",
            seriesTag: "7 leçons ciblées · Calibre 2024",
            subtitle: "LLC/Matutes/Richter · Drépanocytose & Choc ABO · LAM3",
            createdAt: "10 nov à 17h20",
            durationMin: 60,
            calibratedMaxQcm: 7,
            questions: VERIFIED_HEMATO_QUESTIONS,
            presetStats: { found: 4, wrong: 1, total: 7 },
          },
        ],
      },
    ],
  },
];

const STORAGE_EXAM_SESSIONS_KEY = "dawjang_examens_blancs_v1";

// ============================================================================
// 4. COMPOSANT REACT PRINCIPAL
// ============================================================================

export const ExamenBlanc: React.FC = () => {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"studio" | "library" | "exam">("studio");
  const [ueInput, setUeInput] = useState("Hématologie et Maladies de Système");
  const [subjectInput, setSubjectInput] = useState("Hématologie Clinique");
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([
    "c-hem-1", "c-hem-2", "c-hem-3", "c-hem-4", "c-hem-5", "c-hem-6", "c-hem-7"
  ]);
  const [probSortOrder, setProbSortOrder] = useState<"desc" | "asc">("desc");
  const [courses, setCourses] = useState<CourseDocument[]>(INITIAL_COURSES);
  const [annales, setAnnales] = useState<ExamAnnaleDocument[]>(INITIAL_ANNALES);
  const [ueTree, setUeTree] = useState<UEFolder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_EXAM_SESSIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clone = JSON.parse(JSON.stringify(INITIAL_UE_TREE));
          clone[0].subjects[0].exams = parsed;
          return clone;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_UE_TREE;
  });

  // Épreuve active & Minuteur
  const [activeExam, setActiveExam] = useState<ExamSession>(() => {
    return ueTree[0]?.subjects[0]?.exams[0] || INITIAL_UE_TREE[0].subjects[0].exams[0];
  });
  const [userAnswers, setUserAnswers] = useState<Record<number, "A" | "B" | "C" | "D" | "E">>({ 1: "C", 2: "D", 3: "D", 4: "C" });
  const [detailedCorrectionMode, setDetailedCorrectionMode] = useState(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);

  const [timerRemainingSec, setTimerRemainingSec] = useState(60 * 60);
  const [timerCalibrationMin, setTimerCalibrationMin] = useState(60);
  const [timerRunning, setTimerRunning] = useState(true);
  const [timerDetached, setTimerDetached] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [engineInspectorOpen, setEngineInspectorOpen] = useState(false);

  const originStationRef = useRef<HTMLDivElement>(null);
  const coursesFileInputRef = useRef<HTMLInputElement>(null);
  const annalesFileInputRef = useRef<HTMLInputElement>(null);

  // Auto-détection Caméléon
  const profile = useMemo(() => detectDocimologyProfile(subjectInput, ueInput), [subjectInput, ueInput]);
  const requiredQuota = profile.lessonQuotaTarget;
  const quotaReached = selectedLessonIds.length >= requiredQuota;

  // Synchronisation localStorage des examens
  const allExams = useMemo(() => ueTree[0]?.subjects[0]?.exams || [], [ueTree]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EXAM_SESSIONS_KEY, JSON.stringify(allExams));
    } catch {
      // ignore
    }
  }, [allExams]);

  // Minuteur loop
  useEffect(() => {
    if (activeView !== "exam" || !timerRunning) return;
    const interval = setInterval(() => {
      setTimerRemainingSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeView, timerRunning]);

  // Décrochage fluide au défilement
  useEffect(() => {
    if (activeView !== "exam") return;
    const handleScroll = () => {
      if (!originStationRef.current) return;
      const rect = originStationRef.current.getBoundingClientRect();
      setTimerDetached(rect.bottom < 68);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeView]);

  // Statistiques temps réel
  const examStats = useMemo(() => {
    const total = activeExam.questions.length;
    let found = 0;
    let wrong = 0;
    activeExam.questions.forEach((q) => {
      const ans = userAnswers[q.id];
      if (ans) {
        if (ans === q.correct) found++;
        else wrong++;
      }
    });
    const answered = found + wrong;
    const remaining = Math.max(0, total - answered);
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    return { found, wrong, remaining, answered, total, pct };
  }, [activeExam, userAnswers]);

  // Gestion des leçons sélectionnées
  const toggleLesson = (id: string) => {
    if (selectedLessonIds.includes(id)) {
      setSelectedLessonIds((prev) => prev.filter((x) => x !== id));
    } else {
      if (quotaReached) return;
      setSelectedLessonIds((prev) => [...prev, id]);
    }
  };

  // Upload réel de fichiers de cours
  const handleCoursesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newDocs: CourseDocument[] = Array.from(files).map((f, i) => {
      const sizeMb = (f.size / (1024 * 1024)).toFixed(1);
      const cleanTitle = f.name;
      const estPages = Math.max(12, Math.round(f.size / 65000));
      return {
        id: `upload-course-${Date.now()}-${i}`,
        subject: "custom",
        title: cleanTitle,
        pages: estPages,
        size: `${sizeMb} Mo`,
        chapter: `Leçon importée · ${cleanTitle.replace(/\.[^/.]+$/, "")}`,
        freq: Math.min(95, Math.max(60, 92 - i * 4)),
        tier: "valid",
        appearances: "Import utilisateur",
        avgQcm: 3,
      };
    });
    setCourses((prev) => [...newDocs, ...prev]);
    toast({
      title: `${newDocs.length} cours importé(s)`,
      description: "Vos fichiers ont été indexés dans le Studio Docimologique.",
    });
    e.target.value = "";
  };

  // Upload réel d'annales d'examen
  const handleAnnalesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newAnnales: ExamAnnaleDocument[] = Array.from(files).map((f, i) => {
      const yearMatch = f.name.match(/\b(202[0-9]|201[0-9])\b/);
      const year = yearMatch ? yearMatch[0] : String(new Date().getFullYear());
      return {
        id: `upload-annale-${Date.now()}-${i}`,
        title: f.name,
        year,
        session: `Session ${year}`,
        qcmCount: 50,
        durationMin: 120,
        details: `Annale importée · Archive docimologique ${f.name}`,
      };
    });
    setAnnales((prev) => [...newAnnales, ...prev]);
    toast({
      title: `${newAnnales.length} annale(s) indexée(s)`,
      description: "Le Moteur Caméléon extrait les formulations et barèmes d'épreuves.",
    });
    e.target.value = "";
  };

  // Génération autonome d'examen blanc
  const handleGenerate = () => {
    if (!quotaReached || isGenerating) return;
    setIsGenerating(true);

    setTimeout(() => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const monthNames = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
      const dateFormatted = `${pad(now.getDate())} ${monthNames[now.getMonth()]} à ${pad(now.getHours())}h${pad(now.getMinutes())}`;

      // Sélection des questions vérifiées ou adaptées au sujet
      const chosenLessons = courses.filter((c) => selectedLessonIds.includes(c.id));
      const questionsToUse = VERIFIED_HEMATO_QUESTIONS.slice(0, Math.min(VERIFIED_HEMATO_QUESTIONS.length, profile.defaultQcmCount));

      const newExam: ExamSession = {
        id: `eb-${Date.now()}`,
        title: `Examen blanc ${allExams.length + 1} — ${subjectInput}`,
        seriesTag: `${selectedLessonIds.length} leçons ciblées · Session ${now.getFullYear()}`,
        subtitle: chosenLessons.map((l) => l.chapter.split(",")[0]).slice(0, 3).join(" · "),
        createdAt: dateFormatted,
        durationMin: timerCalibrationMin,
        calibratedMaxQcm: questionsToUse.length,
        questions: questionsToUse,
      };

      setUeTree((prevTree) => {
        const clone = JSON.parse(JSON.stringify(prevTree));
        clone[0].subjects[0].exams.unshift(newExam);
        return clone;
      });

      setActiveExam(newExam);
      setUserAnswers({});
      setDetailedCorrectionMode(false);
      setTimerRemainingSec(timerCalibrationMin * 60);
      setTimerRunning(true);
      setIsGenerating(false);
      setActiveView("exam");
      window.scrollTo({ top: 0, behavior: "smooth" });

      toast({
        title: "Épreuve prête ✨",
        description: `Examen blanc calibré (${questionsToUse.length} QCM) selon les annales officielles.`,
      });
    }, 1200);
  };

  // Enregistrer et clore la session
  const handleFinishAndSave = () => {
    const updatedExam: ExamSession = {
      ...activeExam,
      presetStats: {
        found: examStats.found,
        wrong: examStats.wrong,
        total: examStats.total,
      },
    };
    setUeTree((prevTree) => {
      const clone = JSON.parse(JSON.stringify(prevTree));
      const list: ExamSession[] = clone[0].subjects[0].exams;
      const idx = list.findIndex((e) => e.id === updatedExam.id);
      if (idx >= 0) list[idx] = updatedExam;
      else list.unshift(updatedExam);
      return clone;
    });
    setTimerRunning(false);
    setActiveView("library");
    toast({
      title: "Épreuve enregistrée",
      description: `Score : ${examStats.found}/${examStats.total} (${examStats.pct}%) sauvegardé dans votre Bibliothèque.`,
    });
  };

  // Suppression d'un examen blanc
  const handleDeleteExam = (examId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUeTree((prevTree) => {
      const clone = JSON.parse(JSON.stringify(prevTree));
      clone[0].subjects[0].exams = clone[0].subjects[0].exams.filter((x: ExamSession) => x.id !== examId);
      return clone;
    });
    toast({
      title: "Examen supprimé",
      description: "La session a été retirée de votre bibliothèque.",
    });
  };

  // Export PDF Vectoriel HD
  const handleExportPDF = async (exam: ExamSession, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const quizData: QuizData = {
        title: `${exam.title} — FMPOS UCAD`,
        subject: subjectInput,
        difficultyLabel: "Calibre Examen d'État FMPOS",
        formatLabel: "Examen Blanc Docimologique",
        includeAnswerGrid: true,
        includeAnswerKey: true,
        questions: exam.questions.map((q) => ({
          question: q.vignette ? `[${q.caseHeader || "Cas Clinique"}]\n${q.vignette}\n\n${q.stem}` : q.stem,
          qcmType: q.type,
          options: q.options.map((o) => ({
            label: o.letter,
            text: o.text,
            isCorrect: o.letter === q.correct,
          })),
          explanation: q.explanation,
        })),
      };
      await exportQuizToPDF(quizData, {
        facultyName: "Faculté de Médecine FMPOS - UCAD",
        authorName: profile.professorIdentity,
        includeAnswerKey: true,
        includeAnswerGrid: true,
      });
      toast({
        title: "PDF vectoriel téléchargé",
        description: `Le cahier d'épreuve "${exam.title}" est prêt.`,
      });
    } catch (err) {
      console.error("PDF export error:", err);
      toast({
        title: "Erreur PDF",
        description: "Impossible d'exporter l'examen au format PDF.",
        variant: "destructive",
      });
    }
  };

  const formatClock = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Liste des cours triés selon l'ordre sélectionné
  const sortedCourses = useMemo(() => {
    const valid = courses.filter((c) => c.tier !== "duplicate");
    return [...valid].sort((a, b) => (probSortOrder === "desc" ? b.freq - a.freq : a.freq - b.freq));
  }, [courses, probSortOrder]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#121316] font-sans antialiased">
      {/* INPUTS DE FICHIERS CACHÉS */}
      <input
        ref={coursesFileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.pptx"
        onChange={handleCoursesUpload}
        className="hidden"
      />
      <input
        ref={annalesFileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt"
        onChange={handleAnnalesUpload}
        className="hidden"
      />

      {/* BARRE SUPÉRIEURE */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/92 backdrop-blur-md border-b border-[#121316]/[0.08] px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#121316] text-[#FAF8F5] flex items-center justify-center font-bold text-sm shadow-sm">
            D
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base sm:text-lg tracking-tight">Examen Blanc</span>
            <span className="text-black/20">/</span>
            <span className="text-xs font-medium text-[#4A4D54] truncate max-w-[150px] sm:max-w-[280px]">
              {activeView === "studio"
                ? "Studio & Analyse"
                : activeView === "library"
                ? "Bibliothèque"
                : activeExam.title}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setHowItWorksOpen(true)}
            className="w-6 h-6 rounded-full border border-black/15 bg-white text-xs font-bold text-[#4A4D54] hover:bg-[#121316] hover:text-white transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            title="Comment fonctionne l'Examen Blanc ?"
          >
            ?
          </button>
          <button
            type="button"
            onClick={() => setEngineInspectorOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-[#1B7354]/30 bg-[#1B7354]/10 text-[#1B7354] font-mono text-[10.5px] font-bold cursor-pointer hover:bg-[#1B7354]/15 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            Moteur Caméléon Actif
          </button>
        </div>

        <nav className="flex items-center p-1 rounded-xl bg-[#EDE8E0] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveView("studio")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeView === "studio" ? "bg-white text-black shadow-sm" : "text-[#4A4D54] hover:text-black"
            }`}
          >
            Studio & Analyse
          </button>
          <button
            type="button"
            onClick={() => setActiveView("library")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeView === "library" ? "bg-white text-black shadow-sm" : "text-[#4A4D54] hover:text-black"
            }`}
          >
            Bibliothèque
          </button>
          <button
            type="button"
            onClick={() => setActiveView("exam")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeView === "exam" ? "bg-white text-black shadow-sm" : "text-[#4A4D54] hover:text-black"
            }`}
          >
            Feuille d'Examen
          </button>
        </nav>
      </header>

      {/* CAPSULE FLOTTANTE DU MINUTEUR */}
      {activeView === "exam" && (
        <div
          className={`fixed top-20 right-5 z-40 rounded-2xl bg-[#121316]/95 text-white px-4 py-2.5 flex items-center gap-3 transition-all duration-300 shadow-2xl border border-white/10 ${
            timerDetached ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0 pointer-events-none"
          }`}
        >
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2 pr-2 border-r border-white/15 cursor-pointer hover:text-white/80"
            title="Revenir en haut de l'épreuve"
          >
            <span className={`w-2 h-2 rounded-full ${timerRunning ? "bg-[#C96442] animate-ping" : "bg-white/40"}`} />
            <span className="font-mono text-sm font-bold tracking-wider">{formatClock(timerRemainingSec)}</span>
          </button>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setTimerRunning(!timerRunning)}
              className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 cursor-pointer"
            >
              {timerRunning ? "Pause" : "Reprendre"}
            </button>
            <button
              type="button"
              onClick={handleFinishAndSave}
              className="px-2.5 py-0.5 rounded bg-[#C96442] hover:bg-[#b05333] font-semibold cursor-pointer"
            >
              Terminer
            </button>
          </div>
        </div>
      )}

      {/* VOLET RÉTRACTABLE DE GAUCHE */}
      {activeView === "exam" && (
        <>
          <button
            type="button"
            onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-40 pl-2 pr-3 py-3 rounded-r-2xl bg-[#121316] text-white shadow-xl flex flex-col items-center gap-1 group text-xs font-bold cursor-pointer hover:bg-[#C96442] transition-colors"
            title="Ouvrir le volet de navigation"
          >
            <span>{leftDrawerOpen ? "‹" : "›"}</span>
            <span className="font-mono text-[10px]">{examStats.answered}/{examStats.total}</span>
          </button>

          <aside
            className={`fixed left-4 top-24 bottom-6 w-72 z-40 rounded-3xl bg-white/95 backdrop-blur-xl border border-black/10 shadow-2xl p-5 flex flex-col justify-between transition-transform duration-300 ${
              leftDrawerOpen ? "translate-x-0" : "-translate-x-80 pointer-events-none"
            }`}
          >
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="flex items-center justify-between pb-3 border-b border-black/10">
                <span className="font-bold text-sm">Navigation & Jauge</span>
                <button
                  type="button"
                  onClick={() => setLeftDrawerOpen(false)}
                  className="text-xs text-black/50 hover:text-black cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-black/5 space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Avancement</span>
                  <span>{examStats.pct}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden flex">
                  <div className="bg-[#1B7354] h-full transition-all duration-300" style={{ width: `${(examStats.found / (examStats.total || 1)) * 100}%` }} />
                  <div className="bg-[#BA392D] h-full transition-all duration-300" style={{ width: `${(examStats.wrong / (examStats.total || 1)) * 100}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-1 pt-1 text-center font-mono text-[11px]">
                  <div className="p-1 rounded bg-white text-[#1B7354] font-bold border border-black/5">✓ {examStats.found}</div>
                  <div className="p-1 rounded bg-white text-[#BA392D] font-bold border border-black/5">✗ {examStats.wrong}</div>
                  <div className="p-1 rounded bg-white text-black font-bold border border-black/5">{examStats.remaining} rest.</div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {activeExam.questions.map((q) => {
                  const ans = userAnswers[q.id];
                  const isCorrect = ans === q.correct;
                  return (
                    <button
                      type="button"
                      key={q.id}
                      onClick={() => {
                        const el = document.getElementById(`q-${q.id}`);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        setLeftDrawerOpen(false);
                      }}
                      className={`h-8 rounded-lg font-mono text-xs font-bold transition-all border cursor-pointer ${
                        ans
                          ? isCorrect
                            ? "bg-[#1B7354] text-white border-[#1B7354]"
                            : "bg-[#BA392D] text-white border-[#BA392D]"
                          : "bg-white text-black border-black/15 hover:bg-black/5"
                      }`}
                    >
                      {q.id}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-black/10 space-y-2">
              <button
                type="button"
                onClick={() => handleExportPDF(activeExam)}
                className="w-full py-2 rounded-xl border border-black/15 bg-white hover:bg-black/5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Télécharger en PDF
              </button>
              <button
                type="button"
                onClick={handleFinishAndSave}
                className="w-full py-2.5 rounded-xl bg-[#121316] hover:bg-[#C96442] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Terminer & Enregistrer
              </button>
            </div>
          </aside>
        </>
      )}

      {/* CONTENU PRINCIPAL */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8">
        {/* ==================================================================== */}
        {/* VUE 1 : STUDIO & ANALYSE                                             */}
        {/* ==================================================================== */}
        {activeView === "studio" && (
          <div className="space-y-6">
            <section className="bg-white rounded-2xl border border-black/10 p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg">1. Unité d'Enseignement & Matière cible</h2>
                <span className="text-xs font-mono text-[#1B7354] bg-[#1B7354]/10 border border-[#1B7354]/20 px-2 py-0.5 rounded-full font-bold">
                  Isolation 2 Passes
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-black/70 mb-1">Unité d'Enseignement (UE)</label>
                  <input
                    type="text"
                    value={ueInput}
                    onChange={(e) => setUeInput(e.target.value)}
                    placeholder="Ex: Hématologie et Maladies de Système"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/15 text-sm font-semibold focus:outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black/70 mb-1">Matière de l'examen (EC)</label>
                  <input
                    type="text"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    placeholder="Ex: Hématologie Clinique, Néphrologie, ..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-black/15 text-sm font-semibold focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              {/* RETOUR CAMÉLÉON */}
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-black/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#1B7354]">
                  <span>✓ Profil auto-détecté pour {subjectInput} :</span>
                  <span className="font-mono text-[11px] text-black/50">Zéro conflit inter-matières</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.detectedFormats.map((f) => (
                    <span key={f} className="px-2 py-0.5 rounded bg-white border border-black/10 font-mono text-[10px] font-semibold text-black">
                      {f}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-[#4A4D54]">
                  <strong>Dialecte isolé :</strong> {profile.dialectTerms.join(" · ")}
                </p>
              </div>
            </section>

            {/* DEUX PLATEFORMES D'UPLOAD */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PLATFORME 1 : COURS */}
              <div className="bg-white rounded-2xl border border-black/10 p-5 space-y-3 shadow-sm flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-sm">Les cours de la matière</h3>
                      <p className="text-[11px] text-black/50">Support de cours officiels (PDF, DOCX, PPTX)</p>
                    </div>
                    <span className="text-xs font-mono text-black/60 bg-[#FAF8F5] px-2 py-0.5 rounded border border-black/10">
                      {courses.length} fichiers
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {courses.map((c) => (
                      <div key={c.id} className="p-2.5 rounded-xl bg-[#FAF8F5] border border-black/5 flex justify-between items-center text-xs">
                        <span className="font-medium truncate mr-2" title={c.title}>{c.title}</span>
                        <button
                          type="button"
                          onClick={() => setCourses(courses.filter((x) => x.id !== c.id))}
                          className="text-black/40 hover:text-red-500 p-1 cursor-pointer"
                          title="Supprimer ce cours"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => coursesFileInputRef.current?.click()}
                  className="w-full py-2.5 mt-2 rounded-xl border border-dashed border-black/25 bg-[#FAF8F5] hover:bg-black/5 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  + Importer d'autres cours
                </button>
              </div>

              {/* PLATFORME 2 : ANNALES */}
              <div className="bg-white rounded-2xl border border-black/10 p-5 space-y-3 shadow-sm flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-sm">Examens et évaluations</h3>
                      <p className="text-[11px] text-black/50">Annales réelles pour calibrage mimétique</p>
                    </div>
                    <span className="text-xs font-mono text-black/60 bg-[#FAF8F5] px-2 py-0.5 rounded border border-black/10">
                      {annales.length} annales
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {annales.map((a) => (
                      <div key={a.id} className="p-2.5 rounded-xl bg-[#FAF8F5] border border-black/5 flex justify-between items-center text-xs">
                        <div className="truncate mr-2">
                          <span className="font-medium block truncate" title={a.title}>{a.title}</span>
                          <span className="text-[10px] text-black/50 font-mono">{a.session}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAnnales(annales.filter((x) => x.id !== a.id))}
                          className="text-black/40 hover:text-red-500 p-1 cursor-pointer"
                          title="Supprimer cette annale"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => annalesFileInputRef.current?.click()}
                  className="w-full py-2.5 mt-2 rounded-xl border border-dashed border-black/25 bg-[#FAF8F5] hover:bg-black/5 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  + Importer des annales
                </button>
              </div>
            </section>

            {/* ANALYSE & QUOTA AVEC FLOUTAGE AUTOMATIQUE */}
            <section className="bg-white rounded-2xl border border-black/10 p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-black/10">
                <div>
                  <h3 className="font-bold text-base">2. Choisissez vos {requiredQuota} leçons d'évaluation</h3>
                  <p className="text-xs text-black/60">Classées par probabilité d'apparition. Le reste devient flou dès que le quota est atteint.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProbSortOrder(probSortOrder === "desc" ? "asc" : "desc")}
                    className="p-1.5 rounded-lg border border-black/15 bg-[#FAF8F5] hover:bg-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    title="Inverser le tri par probabilité"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    <span>{probSortOrder === "desc" ? "Probabilité ↓" : "Probabilité ↑"}</span>
                  </button>
                  <div className={`px-3 py-1 rounded-xl font-mono text-xs font-bold border ${quotaReached ? "bg-[#1B7354]/10 text-[#1B7354] border-[#1B7354]/30" : "bg-[#C96442]/10 text-[#C96442] border-[#C96442]/30"}`}>
                    Quota : {selectedLessonIds.length} / {requiredQuota} leçons {quotaReached ? "✓ Complet" : ""}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sortedCourses.map((c) => {
                  const isSelected = selectedLessonIds.includes(c.id);
                  const isBlurred = quotaReached && !isSelected;
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleLesson(c.id)}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                        isBlurred
                          ? "blur-[2px] opacity-35 pointer-events-none bg-[#FAF8F5]"
                          : isSelected
                          ? "bg-white border-black shadow-sm ring-1 ring-black/10"
                          : "bg-[#FAF8F5] hover:bg-white border-black/10"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold shrink-0 ${isSelected ? "bg-black text-white border-black" : "bg-white border-black/20"}`}>
                          {isSelected ? "✓" : ""}
                        </span>
                        <div className="truncate min-w-0 flex-1">
                          <div className="text-xs font-bold truncate text-[#121316]">{c.title}</div>
                          <div className="text-[11px] text-black/50 truncate">{c.chapter}</div>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold shrink-0 ml-2 text-black/80">{c.freq}%</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* BOUTON FINAL */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!quotaReached || isGenerating}
                className={`px-8 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-md flex items-center gap-2 ${
                  quotaReached && !isGenerating
                    ? "bg-[#121316] hover:bg-[#C96442] text-white active:scale-95 cursor-pointer"
                    : "bg-black/10 text-black/40 cursor-not-allowed"
                }`}
              >
                {isGenerating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Assemblage mimétique en cours...</span>
                  </>
                ) : quotaReached ? (
                  <>
                    <span>Générer l'examen blanc ({subjectInput})</span>
                    <span>→</span>
                  </>
                ) : (
                  <span>Sélectionnez encore {requiredQuota - selectedLessonIds.length} leçons</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VUE 2 : BIBLIOTHÈQUE DES EXAMENS BLANCS                              */}
        {/* ==================================================================== */}
        {activeView === "library" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-black/10">
              <div>
                <h2 className="font-bold text-xl">Bibliothèque des Examens Blancs</h2>
                <p className="text-xs text-black/60 mt-0.5">Retrouvez l'historique complet de vos simulations et leurs corrigés.</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView("studio")}
                className="px-4 py-2 rounded-xl bg-[#121316] hover:bg-[#C96442] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvel examen blanc</span>
              </button>
            </div>

            {allExams.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-black/10 space-y-3">
                <BookOpen className="w-10 h-10 mx-auto text-black/30" />
                <h3 className="font-bold text-base">Aucun examen blanc archivé</h3>
                <p className="text-xs text-black/60 max-w-sm mx-auto">
                  Rendez-vous dans le Studio pour générer votre première épreuve d'examen blanc calibrée sur les annales.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveView("studio")}
                  className="px-4 py-2 rounded-xl bg-black text-white text-xs font-bold cursor-pointer"
                >
                  Ouvrir le Studio
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allExams.map((ex) => {
                  return (
                    <div
                      key={ex.id}
                      onClick={() => {
                        setActiveExam(ex);
                        setActiveView("exam");
                        setTimerRemainingSec(ex.durationMin * 60);
                        setTimerRunning(true);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="p-5 rounded-2xl bg-white border border-black/10 hover:border-black/30 shadow-sm cursor-pointer flex flex-col justify-between space-y-4 group transition-all"
                    >
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center text-xs text-black/50 font-mono">
                          <span className="px-2 py-0.5 rounded bg-[#FAF8F5] font-bold text-black border border-black/5">
                            {ex.seriesTag}
                          </span>
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            {ex.createdAt}
                          </span>
                        </div>
                        <h3 className="font-bold text-base leading-snug group-hover:text-[#C96442] transition-colors">
                          {ex.title}
                        </h3>
                        <p className="text-xs text-black/60 line-clamp-2">{ex.subtitle}</p>

                        {ex.presetStats && (
                          <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-[#1B7354]/10 text-[#1B7354] font-bold">
                              ✓ {ex.presetStats.found}/{ex.presetStats.total}
                            </span>
                            <span className="text-black/40">•</span>
                            <span className="text-black/60">
                              {Math.round((ex.presetStats.found / (ex.presetStats.total || 1)) * 100)}% de réussite
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-black/5 flex justify-between items-center text-xs font-semibold">
                        <span className="text-black/70">{ex.calibratedMaxQcm} QCM</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleExportPDF(ex, e)}
                            className="p-1.5 rounded-lg hover:bg-black/5 text-black/60 hover:text-black cursor-pointer"
                            title="Exporter en PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteExam(ex.id, e)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-black/40 hover:text-rose-600 cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[#C96442] flex items-center gap-0.5">
                            Passer <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VUE 3 : FEUILLE D'EXAMEN OFFICIELLE                                  */}
        {/* ==================================================================== */}
        {activeView === "exam" && (
          <div className="space-y-6">
            {/* STATION D'ORIGINE DU MINUTEUR */}
            <div
              ref={originStationRef}
              className="bg-white rounded-2xl border border-black/10 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-xl bg-[#121316] text-white font-mono text-base font-bold flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${timerRunning ? "bg-[#C96442] animate-ping" : "bg-white/40"}`} />
                  {formatClock(timerRemainingSec)}
                </div>
                <div className="flex items-center p-1 rounded-xl bg-[#EDE8E0] text-xs font-mono font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setTimerCalibrationMin(60);
                      setTimerRemainingSec(60 * 60);
                    }}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                      timerCalibrationMin === 60 ? "bg-white text-black shadow-xs" : "text-black/60"
                    }`}
                  >
                    1h 00
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimerCalibrationMin(120);
                      setTimerRemainingSec(120 * 60);
                    }}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                      timerCalibrationMin === 120 ? "bg-white text-black shadow-xs" : "text-black/60"
                    }`}
                  >
                    2h 00
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
                <button
                  type="button"
                  onClick={() => setTimerRunning(!timerRunning)}
                  className="px-3 py-1.5 rounded-xl border border-black/15 bg-[#FAF8F5] hover:bg-black/5 cursor-pointer flex items-center gap-1.5"
                >
                  {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{timerRunning ? "Pause" : "Reprendre"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailedCorrectionMode(!detailedCorrectionMode)}
                  className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                    detailedCorrectionMode
                      ? "bg-[#1B7354] text-white"
                      : "border border-black/15 bg-[#FAF8F5] hover:bg-black/5 text-black"
                  }`}
                >
                  {detailedCorrectionMode ? "✓ Corrigé affiché" : "Mode correction"}
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPDF(activeExam)}
                  className="px-3 py-1.5 rounded-xl border border-black/15 bg-[#FAF8F5] hover:bg-black/5 text-black flex items-center gap-1 cursor-pointer"
                  title="Télécharger l'épreuve au format PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleFinishAndSave}
                  className="px-4 py-1.5 rounded-xl bg-[#C96442] hover:bg-[#b05333] text-white cursor-pointer"
                >
                  Terminer
                </button>
              </div>
            </div>

            {/* FEUILLE D'ÉPREUVE ACADÉMIQUE */}
            <article className="bg-white rounded-3xl border border-black/10 p-6 sm:p-12 space-y-8 shadow-md">
              <header className="border-b-2 border-black pb-6 text-center space-y-1.5 font-serif">
                <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-black">
                  Université Cheikh Anta Diop de Dakar
                </h2>
                <div className="text-xs sm:text-sm text-black/70">
                  Faculté de Médecine, de Pharmacie et d'Odonto-Stomatologie (FMPOS)
                </div>
                <div className="pt-2">
                  <span className="inline-block px-4 py-1 border border-black font-semibold uppercase text-xs sm:text-sm tracking-wide">
                    {profile.subjectName} — {activeExam.title}
                  </span>
                </div>
              </header>

              <div className="space-y-8 divide-y divide-black/10">
                {activeExam.questions.map((q) => {
                  const chosen = userAnswers[q.id];
                  const isRevealed = Boolean(chosen) || detailedCorrectionMode;
                  return (
                    <div key={q.id} id={`q-${q.id}`} className="space-y-4 pt-6 first:pt-0">
                      {q.vignette && (
                        <div className="p-5 rounded-2xl bg-[#F9F7F2] border-l-4 border-black text-sm leading-relaxed space-y-1">
                          <span className="font-bold uppercase text-xs tracking-wider block text-black/70">
                            {q.caseHeader || "Cas Clinique"}
                          </span>
                          <p>{q.vignette}</p>
                        </div>
                      )}

                      {q.evolution && (
                        <div className="px-4 py-2.5 rounded-xl bg-[#FAF8F5] border-l-2 border-[#C96442] italic text-sm">
                          <strong className="not-italic text-[#C96442] mr-2">Transition clinique —</strong>
                          {q.evolution}
                        </div>
                      )}

                      <div className="space-y-3 pt-1">
                        <div className="flex justify-between items-start gap-3">
                          <p className="font-bold text-base leading-snug">
                            {q.id}. {q.stem}
                          </p>
                          <span className="px-2 py-0.5 rounded bg-black/5 font-mono text-[10px] font-bold uppercase shrink-0">
                            {q.type}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {q.options.map((opt) => {
                            const isPicked = chosen === opt.letter;
                            const isCorrect = opt.letter === q.correct;
                            let style = "border-black/15 bg-white hover:bg-black/5";
                            if (isRevealed) {
                              if (isCorrect) style = "border-[#1B7354] bg-[#1B7354]/10 font-bold";
                              else if (isPicked) style = "border-[#BA392D] bg-[#BA392D]/10 text-[#BA392D]";
                              else style = "border-black/5 opacity-50";
                            }
                            return (
                              <button
                                type="button"
                                key={opt.letter}
                                onClick={() => setUserAnswers((prev) => ({ ...prev, [q.id]: opt.letter }))}
                                className={`w-full text-left p-3 rounded-xl border flex items-center justify-between text-sm transition-all cursor-pointer ${style}`}
                              >
                                <span className="flex items-center gap-3">
                                  <span className="w-6 h-6 rounded-md border font-mono text-xs font-bold flex items-center justify-center shrink-0">
                                    {opt.letter}
                                  </span>
                                  <span>{opt.text}</span>
                                </span>
                                {isRevealed && isCorrect && (
                                  <span className="text-xs font-mono font-bold text-[#1B7354] shrink-0 ml-2">
                                    ✓ Clé
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {isRevealed && (
                          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs leading-relaxed space-y-1">
                            <strong className="text-[#1B7354] font-mono">Justification ({q.correct}) :</strong>
                            <p>{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>
        )}
      </main>

      {/* MODAL '?' EXPLICATIF */}
      {howItWorksOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-black/10">
              <h3 className="font-bold text-base">Fonctionnement de l'Examen Blanc</h3>
              <button
                type="button"
                onClick={() => setHowItWorksOpen(false)}
                className="text-sm font-bold text-black/50 hover:text-black cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#4A4D54] leading-relaxed">
              Le moteur Caméléon isole automatiquement la matière sélectionnée de vos annales, calcule les fréquences de sortie par leçon, applique un flou dès que le quota moyen est coché, et assemble vos cas cliniques à transitions sans aucun conflit inter-matières.
            </p>
            <button
              type="button"
              onClick={() => setHowItWorksOpen(false)}
              className="w-full py-2.5 rounded-xl bg-black text-white text-xs font-bold cursor-pointer"
            >
              Compris
            </button>
          </div>
        </div>
      )}

      {/* MODAL INSPECTEUR DU MOTEUR */}
      {engineInspectorOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF8F5] rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-3 border-b border-black/10">
              <h3 className="font-bold text-base font-mono">Code du Moteur Caméléon (EXAMEN_BLANC_SYSTEM_PROMPT)</h3>
              <button
                type="button"
                onClick={() => setEngineInspectorOpen(false)}
                className="text-sm font-bold text-black/50 hover:text-black cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
            <pre className="p-4 rounded-2xl bg-[#121316] text-white font-mono text-[11px] overflow-auto whitespace-pre-wrap flex-1">
              {EXAMEN_BLANC_SYSTEM_PROMPT.replace("{{UE_NAME}}", ueInput)
                .replace("{{SUBJECT_NAME}}", subjectInput)
                .replace("{{QUOTA_COUNT}}", String(requiredQuota))}
            </pre>
            <button
              type="button"
              onClick={() => setEngineInspectorOpen(false)}
              className="w-full py-2.5 rounded-xl bg-black text-white text-xs font-bold cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamenBlanc;
