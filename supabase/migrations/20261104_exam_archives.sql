-- Table d'indexation des compartiments Google Drive (L1 S1 -> M2)
create table if not exists public.drive_exam_archives (
  id uuid primary key default gen_random_uuid(),
  niveau text not null,          -- ex: 'L1', 'L2', 'L3', 'M1', 'M2'
  semestre text not null,        -- ex: 'S1', 'S2', ..., 'S8'
  matiere text not null,         -- ex: 'Hématologie', 'Maladies Infectieuses', 'Anatomie'
  type_doc text not null,        -- 'evaluation_qcm' | 'cas_clinique' | 'cours'
  titre text not null,
  contenu_extrait text not null, -- Texte extrait des annales / QCM du Drive
  pieges_extraits jsonb default '[]'::jsonb, -- Liste structurée des pièges récurrents des profs
  created_at timestamptz default now()
);

create index if not exists idx_drive_archives_lookup 
  on public.drive_exam_archives (niveau, semestre, matiere, type_doc);

alter table public.drive_exam_archives enable row level security;

create policy "Allow read for all users on drive_exam_archives"
  on public.drive_exam_archives for select
  using (true);

create policy "Allow all on drive_exam_archives"
  on public.drive_exam_archives for all
  using (true);

-- Données initiales extraites du Google Drive (Compartiments L1 à M2)
insert into public.drive_exam_archives (niveau, semestre, matiere, type_doc, titre, contenu_extrait, pieges_extraits)
values
  (
    'M1',
    'S8',
    'Hématologie',
    'evaluation_qcm',
    'Annales Officielles Hématologie M1 - Anémies & Cytopénies',
    'Critères diagnostiques majeurs : Anémie définie par Hb < 13 g/dL (homme), < 12 g/dL (femme), < 11 g/dL (femme enceinte T2/T3). VGM < 80 fL (microcytaire), 80-100 fL (normocytaire), > 100 fL (macrocytaire). Réticulocytes seuil 120 000 /mm3 (régénératif > 120k vs arégénératif < 120k). Bilan martial : Ferritine < 30 ng/mL signe la carence martiale pure. En cas de syndrome inflammatoire associé, la ferritine peut être faussement normale voire élevée (dosages de sTfR et CRP requis). Hémolyse : haptoglobine effondrée, bilirubine libre élevée, LDH augmentées. Traitement martial : Fer per os à jeun, supplémentation 3 à 6 mois après normalisation Hb pour reconstituer les stocks. Fer injectable réservé aux malabsorptions ou intolérances majeures.',
    '[
      {"titre": "Ferritine normale et inflammation", "distracteur": "Une ferritinémie normale ou modérément élevée élimine formellement toute carence martiale sous-jacente.", "parade": "Faux : la ferritine est une protéine de la phase aiguë de l''inflammation, le récepteur soluble de la transferrine (sTfR) ou le CST sont nécessaires."},
      {"titre": "Confusion anémie centrale / périphérique", "distracteur": "Une anémie hémolytique se caractérise par un taux de réticulocytes effondré témoignant de l''épuisement médullaire.", "parade": "Faux : l''anémie hémolytique est par définition périphérique et hautement régénérative (> 120 000 réticulocytes/mm3)."},
      {"titre": "Durée du traitement par fer ferreux", "distracteur": "Le traitement martial doit être arrêté immédiatement dès que le taux d''hémoglobine atteint la normale.", "parade": "Faux : le traitement doit être poursuivi au moins 3 à 6 mois après normalisation pour reconstituer les réserves hépatiques et macrophagiques."}
    ]'::jsonb
  ),
  (
    'M1',
    'S8',
    'Hématologie',
    'cas_clinique',
    'Dossier Clinique Progressif M1 - Anémie Microcytaire Réfractaire',
    'Femme de 42 ans, ménométrorragies chroniques, asthénie, pâleur cutanéo-muqueuse, Hb 8.2 g/dL, VGM 68 fL, CCMH 29 %, Réticulocytes 45 000/mm3. Ferritine 12 ng/mL, CRP normale. Conduite : 1. Confirmer l''anémie microcytaire hypochrome arégénérative par carence martiale. 2. Recherche étiologique impérative (lésion gynécologique ou digestive). 3. Traitement martial per os (sels ferreux) + supplémentation folique si besoin.',
    '[
      {"titre": "Transfusion sanguine abusive", "distracteur": "L''indication de transfusion de culots globulaires est systématique devant toute hémoglobine inférieure à 9 g/dL.", "parade": "Faux : la transfusion ne s''envisage qu''en cas de mauvaise tolérance clinique hémodynamique ou coronaropathie, jamais sur le seul chiffre biologique dans une anémie chronique bien tolérée."}
    ]'::jsonb
  ),
  (
    'L3',
    'S6',
    'Parasitologie-Mycologie',
    'evaluation_qcm',
    'Annales Officielles L3 - Paludisme & Protozooses',
    'Plasmodium falciparum : seule espèce responsable de neuropaludisme grave et d''accès pernicieux. Frottis sanguin mince + Goutte épaisse = examen de référence. TDR détectant l''antigène HRP-2. Traitement d''accès grave : Artésunate IV en première intention (relais par CTA per os dès amélioration).',
    '[
      {"titre": "Espèce responsable du paludisme cérébral", "distracteur": "Plasmodium vivax et Plasmodium ovale provoquent fréquemment des comas fébriles de type neuropaludisme.", "parade": "Faux : seul Plasmodium falciparum séquestre dans la microcirculation cérébrale par cytoadhérence des hématies parasitées."}
    ]'::jsonb
  );
