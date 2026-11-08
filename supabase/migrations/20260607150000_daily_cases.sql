-- Migration pour Cas Clinique du Jour

CREATE TABLE public.daily_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date_for DATE UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    questions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.daily_case_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES public.daily_cases(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    time_taken_seconds INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, case_id)
);

-- RLS
ALTER TABLE public.daily_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_case_results ENABLE ROW LEVEL SECURITY;

-- Les daily cases sont lisibles par tout utilisateur authentifié
CREATE POLICY "Users can view daily cases"
    ON public.daily_cases
    FOR SELECT
    TO authenticated
    USING (true);

-- Les résultats peuvent être lus par tout le monde (pour le leaderboard)
CREATE POLICY "Users can view all daily case results"
    ON public.daily_case_results
    FOR SELECT
    TO authenticated
    USING (true);

-- L'utilisateur peut créer son propre résultat
CREATE POLICY "Users can insert their own daily case result"
    ON public.daily_case_results
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Seed de données pour les prochains jours
INSERT INTO public.daily_cases (date_for, title, content, questions) VALUES
(CURRENT_DATE, 'Douleur Thoracique Aiguë', 
'Un patient de 58 ans se présente aux urgences pour une douleur thoracique rétrosternale constrictive irradiant dans la mâchoire et le bras gauche, évoluant depuis 45 minutes. Il est fumeur (40 PA) et hypertendu. L''ECG montre un sus-décalage du segment ST en V1-V4.',
'[
  {
    "question": "Quel est le diagnostic le plus probable ?",
    "options": ["Péricardite aiguë", "Infarctus du myocarde antérieur", "Embolie pulmonaire", "Dissection aortique"],
    "correctAnswer": "Infarctus du myocarde antérieur",
    "explanation": "La douleur typique associée à un sus-décalage ST en V1-V4 (territoire antérieur) signe un syndrome coronarien aigu avec sus-décalage du segment ST (SCA ST+), probablement un infarctus antérieur."
  },
  {
    "question": "Quelle est la première action thérapeutique immédiate parmi les suivantes ?",
    "options": ["Anti-inflammatoires non stéroïdiens (AINS)", "Oxygénothérapie à fort débit (si SpO2 > 95%)", "Aspirine et Clopidogrel", "Anticoagulation par AVK"],
    "correctAnswer": "Aspirine et Clopidogrel",
    "explanation": "L''administration de la double anti-agrégation plaquettaire (Aspirine + inhibiteur P2Y12) est fondamentale en urgence dans le SCA ST+."
  },
  {
    "question": "Quelle enzyme cardiaque est la plus spécifique et sensible à doser ?",
    "options": ["Troponine hyper-sensible", "CPK-MB", "Myoglobine", "LDH"],
    "correctAnswer": "Troponine hyper-sensible",
    "explanation": "La troponine hyper-sensible est le biomarqueur de choix, même si dans un SCA ST+ on n''attend pas le résultat pour reperfuser."
  },
  {
    "question": "Quel est le traitement de reperfusion de choix si disponible en moins de 90 minutes ?",
    "options": ["Thrombolyse intraveineuse", "Coronarographie avec angioplastie primaire", "Pontage aorto-coronarien", "Héparinothérapie seule"],
    "correctAnswer": "Coronarographie avec angioplastie primaire",
    "explanation": "L''angioplastie primaire est le traitement de choix si elle peut être réalisée dans les délais (porte-ballon < 90 min)."
  },
  {
    "question": "Quelle anomalie à l''auscultation rechercheriez-vous pour éliminer une complication mécanique ?",
    "options": ["Frottement péricardique", "Souffle systolique râpeux (rupture septale)", "Souffle diastolique aortique", "Bruits du cœur assourdis"],
    "correctAnswer": "Souffle systolique râpeux (rupture septale)",
    "explanation": "Un souffle systolique intense et nouveau dans ce contexte peut indiquer une rupture du septum interventriculaire ou une insuffisance mitrale aiguë par rupture de pilier."
  }
]'),
(CURRENT_DATE + INTERVAL '1 day', 'Dyspnée et Fièvre', 
'Une patiente de 72 ans consulte pour l''apparition depuis 3 jours d''une fièvre à 39°C, de frissons, d''une toux grasse ramenant des crachats purulents et d''une dyspnée. L''auscultation pulmonaire retrouve des crépitants en foyer à la base droite. Saturation à 91% en air ambiant.',
'[
  {
    "question": "Quel est le diagnostic à évoquer en priorité ?",
    "options": ["Pneumonie aiguë communautaire", "Exacerbation de BPCO", "OEdème aigu du poumon", "Embolie pulmonaire"],
    "correctAnswer": "Pneumonie aiguë communautaire",
    "explanation": "Le syndrome infectieux fébrile associé à des signes focaux (crépitants en foyer) est très évocateur d''une pneumonie."
  },
  {
    "question": "Quel germe est le plus fréquemment en cause ?",
    "options": ["Staphylococcus aureus", "Streptococcus pneumoniae", "Mycoplasma pneumoniae", "Pseudomonas aeruginosa"],
    "correctAnswer": "Streptococcus pneumoniae",
    "explanation": "Le pneumocoque est l''agent pathogène le plus fréquent et le plus sévère des pneumonies communautaires de l''adulte."
  },
  {
    "question": "Quel examen d''imagerie prescrivez-vous en première intention ?",
    "options": ["TDM thoracique sans injection", "Radiographie thoracique de face", "Échographie pleuro-pulmonaire", "Angioscanner thoracique"],
    "correctAnswer": "Radiographie thoracique de face",
    "explanation": "La radio de thorax est l''examen de première intention pour confirmer un foyer alvéolaire."
  },
  {
    "question": "Quel traitement antibiotique probabiliste de première intention proposez-vous si elle est soignée en ambulatoire (hors facteurs de risque spécifiques) ?",
    "options": ["Amoxicilline", "Ceftriaxone", "Gentamicine", "Ciprofloxacine"],
    "correctAnswer": "Amoxicilline",
    "explanation": "L''amoxicilline est le traitement de première intention recommandé pour cibler le pneumocoque."
  },
  {
    "question": "Quel signe clinique serait un critère de gravité majeur nécessitant une hospitalisation immédiate ?",
    "options": ["Fièvre à 39.5°C", "Fréquence respiratoire à 32/min", "Toux très productive", "Douleur thoracique basi-thoracique droite"],
    "correctAnswer": "Fréquence respiratoire à 32/min",
    "explanation": "La tachypnée (FR >= 30/min) est un critère de gravité respiratoire majeur selon le score CRB-65."
  }
]');
