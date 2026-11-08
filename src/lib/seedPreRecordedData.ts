import { untypedTable } from "@/lib/untypedDb";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errorUtils";

export interface SeedResult {
  success: boolean;
  coursesCount: number;
  flashcardsCount: number;
  summariesCount: number;
  qcmsCount: number;
  error?: string;
}

export const PRE_RECORDED_COURSES = [
  {
    code: "ITEM 230",
    title: "ITEM 230 — Douleur thoracique aiguë et chronique",
    category: "Cardiologie",
    summary: `## ITEM 230 : Douleur thoracique aiguë et chronique
### Collège National des Enseignants de Cardiologie (R2C)

#### 1. Urgences Vitales Immédiates — Le mnémotechnique "PIED"
Devant toute douleur thoracique aiguë non traumatique, éliminer en priorité les 4 urgences vitales :
* **P — Péricardite aiguë** (tamponnade cardiaque)
* **I — Infarctus du myocarde** (Syndrome Coronarien Aigu STEMI / NSTEMI)
* **E — Embolie pulmonaire** grave
* **D — Dissection aortique** aiguë

#### 2. Sémiologie Clinique Comparative
| Pathologie | Type de douleur | Irradiation | Facteur modifiant | Examen clé immédiat |
| :--- | :--- | :--- | :--- | :--- |
| **SCA ST+** | Constrictive, rétrosternale, angoissante | Mâchoire, bras gauche | Trinitrine inefficace | **ECG 18 dérivations** (&lt;10 min) |
| **Dissection** | Déchirante, brutale, maximale d'emblée | Dorsale, interscapulaire, migratrice | Asymétrie tensionnelle (&gt;20 mmHg) | **Angioscanner aortique** |
| **Embolie Pulm.** | Pleuralgique, point de côté brutal | Non spécifique | Polypnée, tachypnée, hémoptysie | **Angioscanner thoracique** |
| **Péricardite** | Brûlure/piqûre, prolongée | Épaules, trapèzes | Soulagée par antéflexion | **ECG + Échocardiographie** |

#### 3. Points Incontournables (Rang A)
* Un ECG normal **n'élimine jamais** un SCA sans sus-décalage de ST (NSTEMI) : dosage de troponine ultrasensible à H0 et H1/H2 indispensable.
* En cas de suspicion de dissection aortique : **contre-indication absolue** aux anticoagulants et antiagrégants plaquettaires.
* Tamponnade : Triade de Beck (hypotension, turgescence jugulaire, assourdissement des bruits du cœur) + pouls paradoxal de Kussmaul.`,
    flashcards: [
      {
        question: "Quelles sont les 4 urgences vitales à éliminer immédiatement devant une douleur thoracique aiguë ?",
        answer: "Mnémotechnique PIED :\n1. Péricardite aiguë / Tamponnade\n2. Infarctus du myocarde (SCA)\n3. Embolie pulmonaire\n4. Dissection aortique",
      },
      {
        question: "Quel est le délai maximal recommandé pour réaliser et interpréter l'ECG 18 dérivations devant une douleur thoracique ?",
        answer: "Moins de 10 minutes dès le premier contact médical.",
      },
      {
        question: "Quels sont les signes cliniques cardinaux d'une dissection aortique aiguë ?",
        answer: "1. Douleur déchirante, brutale, maximale d'emblée, migratrice vers le dos\n2. Asymétrie tensionnelle (> 20 mmHg entre les 2 bras)\n3. Abolition d'un pouls périphérique\n4. Souffle d'insuffisance aortique d'apparition récente",
      },
      {
        question: "Quelle est la triade de Beck évocatrice de tamponnade péricardique ?",
        answer: "1. Hypotension artérielle\n2. Turgescence jugulaire bilatérale\n3. Assourdissement des bruits du cœur",
      },
    ],
    qcm: {
      title: "Évaluation Clinique : Douleurs Thoraciques Aiguës",
      questions: [
        {
          question: "Un homme de 62 ans consulte pour une douleur rétrosternale constrictive irradiant au bras gauche apparue il y a 45 minutes. Quelle est l'attitude initiale prioritaire ?",
          choices: [
            "Prescrire une radiographie pulmonaire de face",
            "Réaliser un ECG 18 dérivations dans les 10 minutes",
            "Attendre le résultat de la troponine avant tout traitement",
            "Administrer un antalgique de palier 1 et surveiller",
            "Demander un angioscanner thoracique d'emblée"
          ],
          correct: [1],
          explanation: "Recommandation ESC / SFC de Rang A : tout syndrome douloureux thoracique suspect impose un ECG 18 dérivations (incluant V7, V8, V9, V3R, V4R) sous 10 minutes."
        },
        {
          question: "Concernant la dissection aortique aiguë de type A de Stanford, quelles propositions sont exactes ?",
          choices: [
            "Elle intéresse obligatoirement l'aorte ascendante",
            "Le traitement est une urgence chirurgicale immédiate",
            "L'héparine à dose curative doit être débutée sans délai",
            "L'angioscanner thoracique est l'examen diagnostique de référence chez le patient stable",
            "Une asymétrie tensionnelle supérieure à 20 mmHg est un signe d'orientation majeur"
          ],
          correct: [0, 1, 3, 4],
          explanation: "La dissection de type A intéresse l'aorte ascendante et constitue une urgence chirurgicale. Les anticoagulants sont formellement contre-indiqués (risque d'hémopéricarde cataclysmique)."
        }
      ]
    }
  },
  {
    code: "ITEM 199",
    title: "ITEM 199 — Dyspnée aiguë et chronique",
    category: "Pneumologie",
    summary: `## ITEM 199 : Dyspnée aiguë et chronique
### Collège des Enseignants de Pneumologie

#### 1. Signes de Gravité Immédiate (Détresse Respiratoire Aiguë)
* **Signes de lutte** : tirage intercostal, sus-sternal, battement des ailes du nez, mise en jeu des sterno-cléido-mastoïdiens.
* **Signes de faillite** : respiration abdominale paradoxale, bradypnée (&lt;10/min), pauses respiratoires, cyanose, sueurs.
* **Signes hémodynamiques** : tachycardie &gt;120/min, collapsus, marbrures, pouls paradoxal.
* **Signes neurologiques** : agitation, confusion, obnubilation, astérixis (encéphalopathie hypercapnique).

#### 2. Orientation Étiologique Rapide
* **OAP cardiogénique** : râles crépitants bilatéraux en marée montante, orthopnée, HTA, galop B3.
* **Exacerbation de BPCO** : râles sibilants, freinage expiratoire, toux productive, tabagisme chronique.
* **Pneumothorax spontané** : douleur brutale unilatérale, tympanisme, abolition du murmure vésiculaire et des vibrations vocales.
* **Asthme aigu grave** : silence auscultatoire, débit de pointe &lt;150 L/min, parole impossible.`,
    flashcards: [
      {
        question: "Quel signe clinique traduit l'épuisement diaphragmatique et la faillite respiratoire imminente ?",
        answer: "La respiration abdominale paradoxale (balancement thoraco-abdominal) signant l'épuisement du diaphragme.",
      },
      {
        question: "Quelle est la triade sémiologique auscultatoire du pneumothorax complet ?",
        answer: "1. Abolition du murmure vésiculaire\n2. Abolition des vibrations vocales\n3. Tympanisme à la percussion",
      },
      {
        question: "Quels sont les signes cliniques d'encéphalopathie hypercapnique ?",
        answer: "Astérixis (flapping tremor), sueurs profuses, hypertension artérielle, céphalées pulsatiles, confusion, désorientation, obnubilation.",
      }
    ],
    qcm: {
      title: "Urgences Respiratoires : Diagnostic et Gravité",
      questions: [
        {
          question: "Un patient BPCO de 68 ans présente une dyspnée aiguë avec astérixis, sueurs profuses et confusion. Quel désordre gazométrique suspectez-vous en priorité ?",
          choices: [
            "Une alcalose respiratoire pure décompensée",
            "Une hypercapnie aiguë avec acidose respiratoire",
            "Une hypoxémie isolée sans variation du pH",
            "Une acidose métabolique lactique isolée",
            "Une intoxication au monoxyde de carbone"
          ],
          correct: [1],
          explanation: "L'astérixis, les sueurs et la somnolence constituent les signes cliniques cardinaux de l'encéphalopathie hypercapnique avec acidose respiratoire aiguë."
        }
      ]
    }
  },
  {
    code: "ITEM 345",
    title: "ITEM 345 — Malaise, perte de connaissance, crise comitiale",
    category: "Neurologie",
    summary: `## ITEM 345 : Malaise et perte de connaissance brève
### Collège des Enseignants de Neurologie

#### 1. Arbre Décisionnel
Une perte de connaissance brève (PDCB) impose de distinguer :
1. **Syncope** : hypoperfusion cérébrale globale, brève, avec récupération spontanée et ad integrum.
2. **Crise d'épilepsie généralisée tonico-clonique** : décharge neuronale hypersynchrone.
3. **Pseudosyncope psychogène** : yeux fermés résistant à l'ouverture, durée prolongée, EEG normal.

#### 2. Syncope vs Crise Épileptique
| Critères | Syncope | Crise Tonico-Clonique |
| :--- | :--- | :--- |
| **Début** | Prodromes fréquents (sueurs, vision trouble) | Aura brève ou début brutal |
| **Durée** | &lt; 30 secondes | 1 à 3 minutes |
| **Yeux** | Souvent ouverts, révulsés | Ouverts, fixité du regard |
| **Secousses** | Possibles (myoclonies brèves et asynchrones) | Clonies synchrones, bilatérales |
| **Morsure de langue** | Pointe de la langue | **Bord latéral de la langue** (très spécifique) |
| **Récupération** | Immédiate, lucidité rapide | Confusion post-critique prolongée, stertor |`,
    flashcards: [
      {
        question: "Quel siège de morsure de langue est pathognomonique d'une crise d'épilepsie généralisée tonico-clonique ?",
        answer: "La morsure du bord latéral de la langue. La morsure de la pointe est plus fréquente dans les syncopes traumatiques.",
      },
      {
        question: "Quelles sont les caractéristiques d'une syncope d'origine vaso-vagale typique ?",
        answer: "1. Facteur déclenchant (station debout prolongée, chaleur, douleur, vue du sang)\n2. Prodromes neurovégétatifs (nausées, sueurs, pâleur, bâillements, flou visuel)\n3. Récupération rapide en décubitus",
      }
    ],
    qcm: {
      title: "Malaise & Perte de Connaissance : Sémiologie d'Urgence",
      questions: [
        {
          question: "Parmi les éléments suivants, lequel plaide le plus fortement en faveur d'une crise d'épilepsie généralisée plutôt que d'une syncope ?",
          choices: [
            "La survenue au lever brutal d'une chaise",
            "La présence de sueurs profuses avant la chute",
            "Une morsure du bord latéral de la langue",
            "Une récupération d'une lucidité complète en 15 secondes",
            "La survenue chez un patient sous diurétique"
          ],
          correct: [2],
          explanation: "La morsure du bord latéral de la langue a une spécificité proche de 100% pour une crise généralisée tonico-clonique."
        }
      ]
    }
  },
  {
    code: "ITEM 267",
    title: "ITEM 267 — Troubles hydro-électrolytiques et acido-basiques",
    category: "Néphrologie",
    summary: `## ITEM 267 : Troubles hydro-électrolytiques
### Collège Universitaire des Enseignants de Néphrologie (CUEN)

#### 1. Hyperkaliémie (Urgence Cardiaque Absolue si &gt;6.0 mmol/L ou signes ECG)
* **Signes ECG successifs** :
  1. Ondes T amples, pointues, symétriques en dôme de tente.
  2. Aplatissement puis disparition de l'onde P, allongement du PR.
  3. Élargissement des QRS.
  4. Tracé sinusoïdal pré-fibrillatoire, arrêt cardiaque en asystolie ou FV.
* **Traitement d'urgence immédiat** :
  - **Gluconate de calcium 10% IV** (ou chlorure de calcium) pour stabiliser la membrane myocardique (CI si intoxication digitalique).
  - Insuline rapide + sérum glucosé 10% (transfert intracellulaire).
  - Nébulisation de Salbutamol à forte dose (10 à 20 mg).
  - Élimination : Résines échangeuses d'ions (Kayexalate), diurétiques de l'anse, ou hémodialyse d'urgence.`,
    flashcards: [
      {
        question: "Quels sont les signes ECG ordonnés de l'hyperkaliémie menaçante ?",
        answer: "1. Ondes T pointues, amples, symétriques\n2. Allongement de l'intervalle PR puis disparition de l'onde P\n3. Élargissement progressif du QRS\n4. Rythme sinusoïdal puis fibrillation ventriculaire ou asystolie",
      },
      {
        question: "Quel est le traitement médicamenteux immédiat de première ligne en cas d'anomalies ECG liées à une hyperkaliémie ?",
        answer: "Le Gluconate de calcium 10% en IV lente (10 mL en 2 à 3 minutes) pour cardioprotection (stabilisation de membrane).",
      }
    ],
    qcm: {
      title: "Troubles du Potassium & Cardioprotection",
      questions: [
        {
          question: "Un patient hémodialysé présente une kaliémie à 7.2 mmol/L avec des ondes T pointues et un élargissement du QRS à l'ECG. Quel est le premier geste thérapeutique à administrer immédiatement ?",
          choices: [
            "Perfusion de bicarbonate de sodium 1.4%",
            "Injection intraveineuse de 1 ampoule de gluconate de calcium 10%",
            "Administration de 30 g de résine échangeuse d'ions par voie orale",
            "Nébulisation de 5 mg de salbutamol",
            "Prescription d'un régime pauvre en potassium"
          ],
          correct: [1],
          explanation: "La priorité absolue est la stabilisation de membrane myocardique par les sels de calcium (gluconate de calcium 10% IV) en moins de 3 minutes."
        }
      ]
    }
  }
];

/**
 * Insère ou réactive les données pré-enregistrées dans le compte de l'utilisateur actif
 */
export async function seedPreRecordedDataForUser(targetUserId?: string): Promise<SeedResult> {
  try {
    let uid = targetUserId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, coursesCount: 0, flashcardsCount: 0, summariesCount: 0, qcmsCount: 0, error: "Utilisateur non authentifié." };
      }
      uid = user.id;
    }

    let coursesCreated = 0;
    let flashcardsCreated = 0;
    let summariesCreated = 0;
    let qcmsCreated = 0;

    for (const item of PRE_RECORDED_COURSES) {
      // 1. Vérifier si le cours existe déjà
      const { data: existingCourse } = await supabase
        .from("courses")
        .select("id")
        .eq("user_id", uid)
        .eq("title", item.title)
        .maybeSingle();

      let courseId = existingCourse?.id;

      if (!courseId) {
        const { data: newCourse, error: courseErr } = await supabase
          .from("courses")
          .insert({
            user_id: uid,
            title: item.title,
            category: item.category,
            content: item.summary,
            file_name: `${item.code.toLowerCase().replace(" ", "_")}_r2c.pdf`,
          })
          .select("id")
          .single();

        if (courseErr) {
          console.warn(`[Seed] Erreur création cours ${item.code}:`, courseErr);
          continue;
        }
        courseId = newCourse.id;
        coursesCreated++;
      }

      // 2. Insérer ou mettre à jour la Synthèse
      const { data: existingSummary } = await supabase
        .from("summaries")
        .select("id")
        .eq("user_id", uid)
        .eq("course_id", courseId)
        .maybeSingle();

      if (!existingSummary) {
        const { error: sumErr } = await supabase
          .from("summaries")
          .insert({
            user_id: uid,
            course_id: courseId,
            title: item.title,
            content: item.summary,
            summary_type: "structured",
          });

        if (!sumErr) summariesCreated++;
      }

      // 3. Insérer les Flashcards
      for (const fc of item.flashcards) {
        const { data: existingFc } = await supabase
          .from("flashcards")
          .select("id")
          .eq("user_id", uid)
          .eq("course_id", courseId)
          .eq("question", fc.question)
          .maybeSingle();

        if (!existingFc) {
          const now = new Date();
          const { error: fcErr } = await supabase
            .from("flashcards")
            .insert({
              user_id: uid,
              course_id: courseId,
              question: fc.question,
              answer: fc.answer,
              ease_factor: 2.5,
              interval: 1,
              repetitions: 0,
              next_review: now.toISOString(),
            });

          if (!fcErr) flashcardsCreated++;
        }
      }

      // 4. Insérer la session QCM
      const { data: existingQcm } = await supabase
        .from("qcm_sessions")
        .select("id")
        .eq("user_id", uid)
        .eq("title", item.qcm.title)
        .maybeSingle();

      if (!existingQcm) {
        const { error: qcmErr } = await untypedTable("qcm_sessions")
          .insert({
            user_id: uid,
            title: item.qcm.title,
            questions: item.qcm.questions,
            question_count: item.qcm.questions.length,
            question_type: "groupage",
            ai_model: "claude-3-5-sonnet",
            status: "ready",
          });

        if (!qcmErr) qcmsCreated++;
      }
    }

    // 5. Mettre à jour le profil pour s'assurer que le plan et l'accès sont actifs
    await supabase
      .from("profiles")
      .update({
        plan: "pro",
        streak_days: Math.max(3, Math.floor(Math.random() * 12) + 3),
        target_specialty: "Cardiologie & Soins Intensifs",
        university: "Faculté de Médecine — Paris Cité",
        study_level: "DFASM2"
      })
      .eq("id", uid);

    return {
      success: true,
      coursesCount: coursesCreated,
      flashcardsCount: flashcardsCreated,
      summariesCount: summariesCreated,
      qcmsCount: qcmsCreated,
    };
  } catch (err: unknown) {
    console.error("[seedPreRecordedDataForUser] Erreur:", err);
    return {
      success: false,
      coursesCount: 0,
      flashcardsCount: 0,
      summariesCount: 0,
      qcmsCount: 0,
      error: getErrorMessage(err, "") || "Erreur de réactivation des données."
    };
  }
}
