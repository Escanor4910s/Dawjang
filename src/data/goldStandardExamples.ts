/**
 * ============================================================================
 * src/data/goldStandardExamples.ts
 * LES 2 RÉSUMÉS MAGISTRAUX DE RÉFÉRENCE (ANÉMIES 34 DIAPOS & HÉMOGLOBINOPATHIES 51 DIAPOS)
 * ============================================================================
 */

import type { AtlasMagistralSummary } from "@/lib/atlasMagistralEngine";

export const HEMOGLOBINOPATHIES_M1_ATLAS_SUMMARY: AtlasMagistralSummary = {
  "id": "hemoglobinopathies_m1_ucad",
  "title": "Hémoglobinopathies : Drépanocytose & Thalassémies",
  "author": "Prof. Saliou Diop • Cours de Master 1 Hématologie Clinique (UCAD)",
  "tag": "Cours Magistral Intégral • 51 diapositives",
  "updatedAt": "10/11/2026",
  "chapters": [
    {
      "id": "hb_chap_1",
      "num": "I",
      "title": "Objectifs, Plan, Généralités, Hémoglobines Humaines & Épidémiologie",
      "slides": "Diapositives 1 à 7",
      "blocks": [
        {
          "slideBadge": "Diapos 1 – 3",
          "heading": "Objectifs d'apprentissage & Plan du cours magistral",
          "body": "\n                    <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4\">\n                      <div class=\"p-3.5 rounded-xl bg-secondary/45 border border-border/70 space-y-1.5\">\n                        <div class=\"text-xs font-semibold text-foreground\">Objectifs pédagogiques (Diapo 2)</div>\n                        <ol class=\"list-decimal list-inside text-xs text-foreground/90 space-y-1 leading-relaxed\">\n                          <li>Définir la drépanocytose</li>\n                          <li>Décrire les étapes du diagnostic positif de la drépanocytose</li>\n                          <li>Décrire les étapes de diagnostic positif des différentes complications de la drépanocytose</li>\n                          <li>Énoncer le principe de la prise en charge de la drépanocytose</li>\n                          <li>Définir les thalassémies</li>\n                          <li>Décrire les étapes du diagnostic positif de la bêta et alpha thalassémie</li>\n                          <li>Décrire les indications thérapeutiques dans les thalassémies</li>\n                        </ol>\n                      </div>\n                      <div class=\"p-3.5 rounded-xl bg-secondary/45 border border-border/70 space-y-1.5\">\n                        <div class=\"text-xs font-semibold text-foreground\">Plan du cours (Diapo 3)</div>\n                        <ul class=\"text-xs text-foreground/90 space-y-1.5 leading-relaxed\">\n                          <li><strong>I- Généralités :</strong> 1. Définition • 2. Rappel sur les hémoglobines humaines et leurs anomalies • 3. Épidémiologie</li>\n                          <li><strong>II- La Drépanocytose :</strong> 1. Définition • 2. Épidémiologie • 3. Physiopathologie • 4. Signes (TDD : Drépanocytose homozygote SS &amp; Formes cliniques) • 5. Traitement</li>\n                          <li><strong>III- Les Thalassémies :</strong> 1. Généralités • 2. Bêta-thalassémies • 3. Alpha-thalassémies</li>\n                        </ul>\n                      </div>\n                    </div>\n                    "
        },
        {
          "slideBadge": "Diapos 4 – 6",
          "heading": "Définition, Hémoglobines humaines normales & Classification des anomalies",
          "body": "\n                    <p class=\"text-xs sm:text-[13px] text-foreground/90 leading-relaxed mb-3\">\n                      <strong>Définition (Diapo 4) :</strong> Anomalies héréditaires de la <strong>structure de l’Hb</strong> ou de la <strong>synthèse des chaînes de globine</strong>. Plus de <span class=\"font-mono-metric font-semibold text-primary\">1 300 Hb anormales</span> identifiées (peu d'entre elles sont symptomatiques ; intérêt anthropologique). Elles sont responsables de la <strong>grande majorité des anémies hémolytiques corpusculaires</strong>.\n                    </p>\n                    <div class=\"overflow-hidden rounded-xl border border-border mb-3\">\n                      <table class=\"course-table\">\n                        <thead>\n                          <tr>\n                            <th>Hémoglobine / Variant</th>\n                            <th>Structure moléculaire &amp; Génétique (Diapos 5 – 6)</th>\n                            <th>Caractéristiques &amp; Exemples du cours</th>\n                          </tr>\n                        </thead>\n                        <tbody>\n                          <tr>\n                            <td><strong>Hémoglobines humaines normales</strong></td>\n                            <td class=\"font-mono-metric font-semibold text-primary\">HbA (&alpha;2&beta;2) • HbA2 (&alpha;2&delta;2) • HbF (&alpha;2&gamma;2)</td>\n                            <td>Cluster &beta; sur le <strong>Chromosome 11</strong> (&epsilon;, G&gamma;, A&gamma;, &psi;&beta;, &delta;, &beta;) • Cluster &alpha; sur le <strong>Chromosome 16</strong> (&zeta;, &psi;&zeta;, &psi;&alpha;1, &alpha;2, &alpha;1, &theta;1)</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Substitution d'1 seule base ADN (95 %)</strong></td>\n                            <td class=\"font-mono-metric\">Hb S, Hb C, Hb E</td>\n                            <td><strong>HbS (&alpha;2&beta;<sup>S</sup>2) :</strong> codon 6 <span class=\"font-mono-metric font-semibold text-primary\">GAG &gt; GTG</span> &rarr; <strong>&beta;6 (A3) Glu &rarr; Val</strong></td>\n                          </tr>\n                          <tr>\n                            <td><strong>Substitution de 2 bases ADN</strong></td>\n                            <td class=\"font-mono-metric\">Hb C Ziguinchor (Hb C zig), Hb C Harlem</td>\n                            <td>Deux mutations ponctuelles sur la même chaîne</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Délétion d'1 ou plusieurs bases ADN</strong></td>\n                            <td class=\"font-mono-metric\">Hb Freiburg, Hb Lyon, Hb Nice</td>\n                            <td><strong>Hb Freiburg :</strong> -&beta;23 (146 &rarr; 145 AA) • <strong>Hb Lyon :</strong> -&beta;17-&beta;18 • <strong>Hb Nice :</strong> -&beta;42-&beta;43-&beta;44</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Allongement ou Fusion de chaîne</strong></td>\n                            <td class=\"font-mono-metric\">Hb Constant Spring • Hb Lepore</td>\n                            <td><strong>Hb Constant Spring :</strong> +31 AA sur la chaîne &alpha; • <strong>Hb Lepore :</strong> crossing-over inégal &delta;&beta;</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Anomalies de synthèse (Thalassémies)</strong></td>\n                            <td class=\"font-mono-metric\">Modifications des gènes de globine</td>\n                            <td>Aboutissent à une <strong>diminution</strong> ou une <strong>absence de synthèse</strong> des chaînes correspondantes</td>\n                          </tr>\n                        </tbody>\n                      </table>\n                    </div>\n                    "
        },
        {
          "slideBadge": "Diapo 7",
          "heading": "Épidémiologie mondiale des hémoglobinopathies (OMS 2008 ; Weatherall, Blood 2010)",
          "body": "\n                    <div class=\"grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs\">\n                      <div class=\"p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1\">\n                        <div class=\"font-semibold text-foreground\">Prévalence &amp; Naissances mondiales</div>\n                        <p class=\"text-foreground/90 leading-relaxed\">\n                          • <span class=\"font-mono-metric font-semibold text-primary\">5,2 %</span> de la population mondiale porte une forme anormale d’Hb.<br/>\n                          • <span class=\"font-mono-metric font-semibold text-primary\">&gt; 350 000 nouveau-nés / an</span> naissent avec une forme grave d’hémoglobinopathie.\n                        </p>\n                      </div>\n                      <div class=\"p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1\">\n                        <div class=\"font-semibold text-foreground\">Impact démographique &amp; Mortalité</div>\n                        <p class=\"text-foreground/90 leading-relaxed\">\n                          • <span class=\"font-mono-metric font-semibold text-primary\">80 %</span> naissent dans les pays à faibles ressources.<br/>\n                          • <span class=\"font-mono-metric font-semibold text-primary\">3,4 %</span> des causes de décès avant l’âge de 5 ans • <span class=\"font-mono-metric font-semibold text-primary\">&gt; 9 millions/an</span> de femmes enceintes porteuses.\n                        </p>\n                      </div>\n                    </div>\n                    "
        }
      ]
    },
    {
      "id": "hb_chap_2",
      "num": "II",
      "title": "La Drépanocytose : Définition, Génétique, Épidémiologie & Physiopathologie",
      "slides": "Diapositives 8 à 15",
      "blocks": [
        {
          "slideBadge": "Diapos 8 – 12",
          "heading": "Définition moléculaire, Fardeau épidémiologique & Transmission génétique",
          "body": "\n                    <p class=\"text-xs sm:text-[13px] text-foreground/90 leading-relaxed mb-3\">\n                      <strong>Définition (Diapo 8) :</strong> Anomalie héréditaire de la structure de l’Hb dans laquelle le <strong>6<sup>e</sup> acide aminé de la chaîne &beta;, l’acide glutamique, est remplacé par la valine</strong> (HbA remplacée par <strong>HbS</strong>), par mutation d’une base du triplet du 6<sup>e</sup> codon du gène &beta; (<span class=\"font-mono-metric font-semibold text-primary\">GAG &rarr; GTG</span>). Transmission <strong>autosomique récessive</strong>.\n                    </p>\n                    <div class=\"overflow-hidden rounded-xl border border-border mb-3\">\n                      <table class=\"course-table\">\n                        <thead>\n                          <tr>\n                            <th>Paramètre épidémiologique / génétique</th>\n                            <th>Données chiffrées &amp; Répartition (Diapos 8 – 12)</th>\n                          </tr>\n                        </thead>\n                        <tbody>\n                          <tr>\n                            <td><strong>Au Sénégal</strong></td>\n                            <td><span class=\"font-mono-metric font-semibold text-primary\">8 à 10 %</span> de porteurs d’HbS (AS) et <span class=\"font-mono-metric font-semibold text-primary\">0,2 à 0,5 %</span> de formes majeures</td>\n                          </tr>\n                          <tr>\n                            <td><strong>En Afrique &amp; Monde (Lancet Haematology 2023)</strong></td>\n                            <td>\n                              • Ceinture sicklémique de Lehmann : trait HbAS de <span class=\"font-mono-metric font-semibold\">5 à 20 %</span> en Afrique de l'Ouest et jusqu'à <span class=\"font-mono-metric font-semibold\">40 %</span> en Afrique centrale.<br/>\n                              • <span class=\"font-mono-metric font-semibold text-primary\">500 000 nouveau-nés / an</span> (90 % dans les pays à faibles ressources) ; hausse de <span class=\"font-mono-metric font-semibold\">+41,4 %</span> de la prévalence entre 2000 et 2021.<br/>\n                              • <strong>Mortalité en Afrique :</strong> <span class=\"font-mono-metric font-semibold text-rose-600\">50 à 90 % avant l’âge de 10 ans</span> (150 000 à 300 000 décès/an, soit <strong>5 à 10 % de la mortalité infantile en Afrique</strong>).\n                            </td>\n                          </tr>\n                          <tr>\n                            <td><strong>Les 5 Haplotypes &amp; Paludisme</strong></td>\n                            <td><strong>5 haplotypes :</strong> Sénégal, Bénin, Bantu, Cameroun, Arabo-indien • Sélection du trait HbAS par protection contre les formes graves à <em>Plasmodium falciparum</em> (Diapo 11).</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Lois de transmission (Diapo 12)</strong></td>\n                            <td>\n                              • Couple <strong>AS &times; AS</strong> &rarr; 25 % AA (normal), 50 % AS (trait), 25 % SS (homozygote)<br/>\n                              • Couple <strong>AS &times; SS</strong> &rarr; 50 % AS, 50 % SS | Couple <strong>AA &times; AS</strong> &rarr; 50 % AA, 50 % AS<br/>\n                              • Syndromes drépanocytaires majeurs : <strong>SS</strong>, <strong>SC</strong> (double hétérozygote), <strong>S&beta;-thalassémie</strong>, S+ autre hémoglobinopathie.\n                            </td>\n                          </tr>\n                        </tbody>\n                      </table>\n                    </div>\n                    "
        },
        {
          "slideBadge": "Diapos 13 – 15",
          "heading": "Physiopathologie : Cascade de falciformation & Les 4 grands mécanismes cliniques",
          "body": "\n                    <p class=\"text-xs sm:text-[13px] text-foreground/90 leading-relaxed mb-2\">\n                      <strong>Cascade physiopathologique en 6 étapes (Diapos 13 – 14) :</strong>\n                    </p>\n                    <div class=\"flex flex-wrap items-center gap-1.5 text-xs font-medium mb-3.5\">\n                      <span class=\"px-2.5 py-1 rounded-lg bg-secondary border border-border\">1. Polymérisation de l’HbS (état désoxygéné)</span>\n                      <span class=\"text-muted-foreground\">&rarr;</span>\n                      <span class=\"px-2.5 py-1 rounded-lg bg-secondary border border-border\">2. Falciformation des GR</span>\n                      <span class=\"text-muted-foreground\">&rarr;</span>\n                      <span class=\"px-2.5 py-1 rounded-lg bg-secondary border border-border\">3. Hypoxie-réoxygénation, inflammation &amp; hyperadhésion endothéliale</span>\n                      <span class=\"text-muted-foreground\">&rarr;</span>\n                      <span class=\"px-2.5 py-1 rounded-lg bg-secondary border border-border\">4. Activation plaquettaire</span>\n                      <span class=\"text-muted-foreground\">&rarr;</span>\n                      <span class=\"px-2.5 py-1 rounded-lg bg-secondary border border-border\">5. Déshydratation des GR</span>\n                      <span class=\"text-muted-foreground\">&rarr;</span>\n                      <span class=\"px-2.5 py-1 rounded-lg bg-primary/12 text-primary border border-primary/30 font-semibold\">6. Hémolyse &rarr; &darr; NO &rarr; Vasoconstriction</span>\n                    </div>\n\n                    <div class=\"grid grid-cols-1 md:grid-cols-2 gap-3 text-xs\">\n                      <div class=\"p-3.5 rounded-xl bg-background border border-border space-y-1\">\n                        <div class=\"font-semibold text-foreground\">1. Phénomènes vaso-occlusifs (Diapo 15)</div>\n                        <p class=\"text-foreground/90 leading-relaxed\">\n                          • Falciformation &rarr; <strong>Ischémie</strong> &rarr; <strong>Douleur (crise vaso-occlusive)</strong><br/>\n                          • <strong>Nécrose</strong> &rarr; Insuffisance des organes (os, œil, rein, poumon, etc.)\n                        </p>\n                      </div>\n                      <div class=\"p-3.5 rounded-xl bg-background border border-border space-y-1\">\n                        <div class=\"font-semibold text-foreground\">2. Hémolyse aiguë</div>\n                        <p class=\"text-foreground/90 leading-relaxed\">\n                          • Crise hémolytique sévère<br/>\n                          • Érythroblastopénie aiguë (<strong>Parvovirus B19</strong>)<br/>\n                          • Séquestration splénique aiguë\n                        </p>\n                      </div>\n                      <div class=\"p-3.5 rounded-xl bg-background border border-border space-y-1\">\n                        <div class=\"font-semibold text-foreground\">3. Hémolyse chronique</div>\n                        <p class=\"text-foreground/90 leading-relaxed\">\n                          • GR anormaux piégés par la rate<br/>\n                          • Conséquences : <strong>lithiase biliaire, ulcère de jambe, insuffisance cardiaque</strong>\n                        </p>\n                      </div>\n                      <div class=\"p-3.5 rounded-xl bg-background border border-border space-y-1\">\n                        <div class=\"font-semibold text-foreground\">4. Susceptibilité aux infections</div>\n                        <p class=\"text-foreground/90 leading-relaxed\">\n                          • <strong>Asplénie fonctionnelle</strong> + baisse de synthèse de <strong>Tuftsine</strong> &rarr; germes encapsulés (<strong><em>H. influenzae</em>, Pneumocoques, Salmonelles</strong>)<br/>\n                          • Baisse de la capacité phagocytaire des polynucléaires\n                        </p>\n                      </div>\n                    </div>\n                    "
        }
      ]
    },
    {
      "id": "hb_chap_3",
      "num": "III",
      "title": "Diagnostic Positif (TDD : Forme SS), Complications & Formes Cliniques",
      "slides": "Diapositives 16 à 27",
      "blocks": [
        {
          "slideBadge": "Diapos 16 – 17",
          "heading": "TDD : La forme homozygote SS — Clinique en phase permanente et crise douloureuse",
          "body": "\n                    <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 text-xs\">\n                      <div class=\"p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1.5\">\n                        <div class=\"font-semibold text-foreground\">Circonstances de découverte &amp; Phase permanente (Diapo 16)</div>\n                        <p class=\"text-foreground/90 leading-relaxed\">\n                          • <strong>Découverte :</strong> <strong>Syndrome pieds-mains</strong> (chez le nourrisson), douleurs osseuses périodiques, bilan systématique ou lors d'une infection/complication.<br/>\n                          • <strong>Phase permanente (intercritique) :</strong> tableau d’anémie hémolytique chronique avec <strong>anémie + subictère + splénomégalie (Triade de Chauffard)</strong>.\n                        </p>\n                      </div>\n                      <div class=\"p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1.5\">\n                        <div class=\"font-semibold text-foreground\">Phase épisodique : Crise vaso-occlusive (Diapo 17)</div>\n                        <p class=\"text-foreground/90 leading-relaxed\">\n                          • <strong>Douleur épisodique</strong> remontant à l'enfance, déclenchée par un facteur induisant <strong>hypoxie, acidose, fièvre ou déshydratation</strong> (froid, effort intense prolongé, haute altitude).<br/>\n                          • <strong>Siège selon l'âge :</strong> syndrome pieds-mains chez le nourrisson, abdomen chez l’enfant, douleurs osseuses chez le grand enfant et l’adulte (« mal partout »).\n                        </p>\n                      </div>\n                    </div>\n                    "
        },
        {
          "slideBadge": "Diapos 18 – 22",
          "heading": "Examens complémentaires : Hémogramme, Test d'Emmel, Électrophorèse, TDR & Biologie moléculaire",
          "body": "\n                    <ul class=\"text-xs sm:text-[13px] text-foreground/90 space-y-1.5 leading-relaxed mb-3\">\n                      <li>• <strong>Hémogramme (Diapo 18) :</strong> Anémie (<span class=\"font-mono-metric font-semibold text-primary\">Hb 7 – 9 g/dl</span>) <strong>normochrome normocytaire régénérative</strong> ; frottis : anisopoïkilocytose et présence de <strong>drépanocytes</strong>.</li>\n                      <li>• <strong>Test d’Emmel (test de falciformation) positif :</strong> à l'état désoxygéné (1 goutte de sang + 1 goutte de <strong>métabisulfite de sodium à 2 %</strong>), les GR contenant de l'HbS falciforment.</li>\n                      <li>• <strong>Biologie moléculaire (Diapo 22) :</strong> Diagnostic prénatal précoce (<strong>biopsie du trophoblaste</strong>) ou tardif (<strong>amniocentèse</strong>), diagnostic préimplantatoire, étude familiale.</li>\n                    </ul>\n                    <div class=\"overflow-hidden rounded-xl border border-border\">\n                      <table class=\"course-table\">\n                        <thead>\n                          <tr>\n                            <th>Méthode diagnostique (Diapos 19 – 21)</th>\n                            <th>Principe &amp; Technique</th>\n                            <th>Résultats / Performances</th>\n                          </tr>\n                        </thead>\n                        <tbody>\n                          <tr>\n                            <td><strong>Électrophorèse de l'Hb (gel, capillaire)</strong></td>\n                            <td>Migration dans un champ électrique selon la charge et le pH (alcalin / acide)</td>\n                            <td>\n                              • <strong>Sujet normal :</strong> <span class=\"font-mono-metric\">HbA : 97–98 % | HbA2 : 1–3 % | HbF &lt; 1 %</span><br/>\n                              • <strong>Drépanocytose SS :</strong> <span class=\"font-mono-metric font-semibold text-primary\">HbS &gt; 80 % | HbA2 : 2–3 % | HbF &lt; 15 %</span> (HbA = 0 %)\n                            </td>\n                          </tr>\n                          <tr>\n                            <td><strong>Sickle SCAN® (TDR / POCT OMS)</strong></td>\n                            <td>Test immunologique à flux latéral sur <span class=\"font-mono-metric font-semibold\">5 &mu;L</span> de sang (piqûre au doigt)</td>\n                            <td>Distingue les phénotypes liés aux <strong>HbA, HbS et HbC</strong> même en présence d'HbF élevée chez le nouveau-né</td>\n                          </tr>\n                          <tr>\n                            <td><strong>HemeChip®</strong></td>\n                            <td>Micro-électrophorèse à l'acétate de cellulose (nécessite une alimentation électrique)</td>\n                            <td>Fournit des mesures <strong>quantitatives</strong> de l'HbA, de l'HbS et de l'HbF</td>\n                          </tr>\n                          <tr>\n                            <td><strong>HemoTypeSC™</strong></td>\n                            <td>Test immunologique à flux latéral par anticorps monoclonaux sur <span class=\"font-mono-metric font-semibold\">1,5 &mu;L</span> de sang</td>\n                            <td>Haute sensibilité pour détecter les hémoglobines <strong>A, S et C</strong> en milieu rural</td>\n                          </tr>\n                        </tbody>\n                      </table>\n                    </div>\n                    "
        },
        {
          "slideBadge": "Diapos 23 – 25",
          "heading": "Évolution : Complications anémiques aiguës, infectieuses, ischémiques et chroniques",
          "body": "\n                    <div class=\"overflow-hidden rounded-xl border border-border mb-3\">\n                      <table class=\"course-table\">\n                        <thead>\n                          <tr>\n                            <th>Complication anémique aiguë (Diapo 23)</th>\n                            <th>Tableau clinique &amp; Biologique caractéristique</th>\n                            <th>Étiologie / Prise en charge immédiate</th>\n                          </tr>\n                        </thead>\n                        <tbody>\n                          <tr>\n                            <td><strong>1. Séquestration splénique aiguë</strong></td>\n                            <td>Douleurs abdominales + <strong>augmentation rapide de la taille de la rate</strong> + signes de collapsus cardiovasculaire</td>\n                            <td>Survenue typique chez l'<strong>enfant de 3 à 5 ans</strong> &rarr; Transfusion d'urgence</td>\n                          </tr>\n                          <tr>\n                            <td><strong>2. Érythroblastopénie aiguë</strong></td>\n                            <td>Tableau infectieux des voies ORL + <strong>accentuation de la pâleur SANS accentuation de l'ictère</strong></td>\n                            <td>Sérologie <strong>Parvovirus B19 positive</strong> &rarr; Transfusion d'urgence</td>\n                          </tr>\n                          <tr>\n                            <td><strong>3. Crise hémolytique aiguë</strong></td>\n                            <td><strong>Accentuation de l'ictère et de la pâleur</strong> + urines très foncées voire rouges</td>\n                            <td>Bilan d'hémolyse positif &rarr; Transfusion si décompensation</td>\n                          </tr>\n                        </tbody>\n                      </table>\n                    </div>\n                    <div class=\"grid grid-cols-1 md:grid-cols-2 gap-3 text-xs\">\n                      <div class=\"p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1\">\n                        <div class=\"font-semibold text-foreground\">Complications infectieuses &amp; ischémiques (Diapo 24)</div>\n                        <p class=\"text-foreground/90 leading-relaxed\">\n                          • <strong>Infectieuses :</strong> Pneumocoques, <em>H. influenzae</em>, Salmonelles.<br/>\n                          • <strong>Syndrome thoracique aigu (STA) :</strong> présence d'un signe respiratoire (douleur thoracique, dyspnée, toux) <strong>ET</strong> d'une opacité pulmonaire radiologique.<br/>\n                          • <strong>Autres ischémies :</strong> Accident vasculaire cérébral (AVC), nécrose osseuse (tête fémorale), atteinte oculaire, <strong>priapisme</strong>.\n                        </p>\n                      </div>\n                      <div class=\"p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1\">\n                        <div class=\"font-semibold text-foreground\">Complications chroniques (Diapos 23 – 25)</div>\n                        <p class=\"text-foreground/90 leading-relaxed\">\n                          • <strong>Conséquences de l'anémie chronique :</strong> Insuffisance cardiaque, ulcères de jambe, lithiase biliaire.<br/>\n                          • <strong>Atteintes organiques dégénératives :</strong> maladie rénale chronique (albuminurie, isosthénurie, nécrose papillaire), insuffisance hépatique et respiratoire (HTAP).\n                        </p>\n                      </div>\n                    </div>\n                    "
        },
        {
          "slideBadge": "Diapos 26 – 27",
          "heading": "Formes cliniques comparées de la drépanocytose (SC, AS, Sβ0 et Sβ+ thalassémie)",
          "body": "\n                    <div class=\"overflow-hidden rounded-xl border border-border\">\n                      <table class=\"course-table\">\n                        <thead>\n                          <tr>\n                            <th>Forme génétique</th>\n                            <th>Clinique &amp; Évolution</th>\n                            <th>Hémogramme &amp; Test d'Emmel</th>\n                            <th>Profil à l'Électrophorèse de l'Hb</th>\n                          </tr>\n                        </thead>\n                        <tbody>\n                          <tr>\n                            <td><strong>Forme SC (double hétérozygote)</strong></td>\n                            <td>Début vers <strong>5 ans</strong> ; douleurs osseuses surtout (pas de signes anémiques) ; complications <strong>oculaires et ostéonécroses</strong></td>\n                            <td>Anémie modérée (<span class=\"font-mono-metric\">9–11 g/dl</span>) microcytaire ou normocytaire hypochrome • Emmel (+)</td>\n                            <td class=\"font-mono-metric font-semibold text-primary\">HbS = HbC = 50 %</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Forme hétérozygote AS (Trait)</strong></td>\n                            <td>Porteur du trait drépanocytaire ; <strong>en principe asymptomatique</strong></td>\n                            <td>Hémogramme <strong>normal</strong> • Emmel (+)</td>\n                            <td class=\"font-mono-metric font-semibold text-primary\">HbA &gt; HbS &gt; 35 %</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Forme S&beta;<sup>0</sup> thalassémie</strong></td>\n                            <td><strong>Même tableau clinique et évolutif que SS</strong> (1 parent HbS + 1 parent &beta;<sup>0</sup>)</td>\n                            <td>Anémie <strong>microcytaire hypochrome</strong> sans trouble du métabolisme du fer</td>\n                            <td class=\"font-mono-metric font-semibold text-primary\">Profil SFA2 (HbF &gt; 15 % et HbA2 &uarr; ; HbA = 0)</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Forme S&beta;<sup>+</sup> thalassémie</strong></td>\n                            <td><strong>Tableau clinique similaire aux formes SC</strong></td>\n                            <td>Anémie <strong>microcytaire hypochrome</strong> sans trouble du métabolisme du fer</td>\n                            <td class=\"font-mono-metric font-semibold text-primary\">Profil SAFA2 (présence d'HbA résiduelle)</td>\n                          </tr>\n                        </tbody>\n                      </table>\n                    </div>\n                    "
        }
      ]
    },
    {
      "id": "hb_chap_4",
      "num": "IV",
      "title": "Traitement de la Drépanocytose : Moyens, Hydroxyurée, Urgences & Enfant",
      "slides": "Diapositives 28 à 41",
      "blocks": [
        {
          "slideBadge": "Diapos 28 – 31",
          "heading": "Buts, Paliers antalgiques (1 à 3) & Règles transfusionnelles",
          "body": "\n                    <div class=\"overflow-hidden rounded-xl border border-border mb-3\">\n                      <table class=\"course-table\">\n                        <thead>\n                          <tr>\n                            <th>Palier Antalgique (Diapo 30)</th>\n                            <th>Indication selon l'EVA (Diapo 38)</th>\n                            <th>Molécules &amp; Posologies exactes du cours</th>\n                          </tr>\n                        </thead>\n                        <tbody>\n                          <tr>\n                            <td><strong>Palier 1</strong></td>\n                            <td class=\"font-mono-metric font-semibold\">EVA entre 1 et 3</td>\n                            <td>\n                              • <strong>Paracétamol :</strong> <span class=\"font-mono-metric\">15 mg/kg / 6h</span> • <strong>Ibuprofène :</strong> <span class=\"font-mono-metric\">10 mg/kg / 8h</span><br/>\n                              • <strong>Kétoprofène :</strong> <span class=\"font-mono-metric\">1 mg/kg / 8 à 12h</span> • <strong>Diclofénac :</strong> <span class=\"font-mono-metric\">2–3 mg/kg / 8 à 12h</span>\n                            </td>\n                          </tr>\n                          <tr>\n                            <td><strong>Palier 2</strong></td>\n                            <td class=\"font-mono-metric font-semibold\">EVA entre 4 et 7</td>\n                            <td>\n                              • <strong>Codéine :</strong> <span class=\"font-mono-metric\">1 mg/kg / 4 à 6h</span> • <strong>Nalbuphine :</strong> <span class=\"font-mono-metric\">0,2 mg/kg / 4h</span><br/>\n                              • <strong>Tramadol :</strong> <span class=\"font-mono-metric\">1 à 2 mg/kg / 6h</span>\n                            </td>\n                          </tr>\n                          <tr>\n                            <td><strong>Palier 3</strong></td>\n                            <td class=\"font-mono-metric font-semibold\">EVA entre 7 et 10</td>\n                            <td>• <strong>Morphine</strong> • <strong>MEOPA</strong> (mélange équimolaire oxygène / protoxyde d’azote)</td>\n                          </tr>\n                        </tbody>\n                      </table>\n                    </div>\n                    <div class=\"p-3.5 rounded-xl bg-primary/8 border border-primary/25 text-xs space-y-1\">\n                      <div class=\"font-semibold text-foreground\">Règles de la Transfusion Sanguine chez le drépanocytaire (Diapo 31)</div>\n                      <p class=\"text-foreground/90 leading-relaxed\">\n                        • <strong>L'objectif N'EST PAS de corriger l'anémie chronique de base (Hb entre 7 et 9 g/dl).</strong><br/>\n                        • Objectifs : restauration rapide de l'oxygénation tissulaire et de la volémie dans les anémies aiguës (<strong>baisse de plus de 2 g/dl d'Hb par rapport au niveau de base</strong>) et <strong>abaisser le taux d'HbS circulant</strong>.<br/>\n                        • Modalités : Transfusion simple ou <strong>Échange transfusionnel</strong> (à la demande ou en programme) avec des <strong>CGR phénotypés et compatibilisés</strong> (dossier transfusionnel, sécurité virale et immunologique).\n                      </p>\n                    </div>\n                    "
        },
        {
          "slideBadge": "Diapos 32 – 35",
          "heading": "Protocole d'utilisation de l'Hydroxyurée (Mécanismes, Indications, Posologie & Seuils d'arrêt)",
          "body": "\n                    <div class=\"overflow-hidden rounded-xl border border-border\">\n                      <table class=\"course-table\">\n                        <thead>\n                          <tr>\n                            <th>Paramètre de l'Hydroxyurée (HU)</th>\n                            <th>Règles cliniques et biologiques exactes (Diapos 32 – 35)</th>\n                          </tr>\n                        </thead>\n                        <tbody>\n                          <tr>\n                            <td><strong>Mécanismes d'action</strong></td>\n                            <td><strong>Augmente le taux d'HbF</strong>, myélosuppression modérée (baisse des PNN et réticulocytes adhérents), diminue l'adhésion endothéliale, améliore la rhéologie, libération de NO. Réduit la fréquence des CVO de <strong>près de 50 %</strong> (<em>Charache et al., NEJM 1995</em>) et réduit la mortalité.</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Indications majeures</strong></td>\n                            <td>• <strong>CVO douloureuses sévères récurrentes</strong> • <strong>Syndrome thoracique aigu (STA) récurrent</strong> • ATCD d'AVC ou prévention de l'AVC en cas d'accélération des vitesses au Doppler transcrânien (si programme transfusionnel non réalisable) • Anémie chronique grave.</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Posologie &amp; Escalade de dose (Diapo 35)</strong></td>\n                            <td>\n                              • <strong>Dose initiale :</strong> <span class=\"font-mono-metric font-semibold text-primary\">15 mg/kg/j</span> (si clairance créatinine <span class=\"font-mono-metric\">&lt; 60 ml/min</span>, réduire la dose de <strong>50 %</strong>).<br/>\n                              • En l'absence de réponse (et après vérification de l'observance) : augmenter de <span class=\"font-mono-metric font-semibold\">2,5 à 5 mg/kg/j toutes les 8 semaines</span> selon la tolérance (NFS).<br/>\n                              • <strong>Dose maximale :</strong> ne pas dépasser <span class=\"font-mono-metric font-semibold text-primary\">35 mg/kg/j</span> (usuellement 15 à 30 mg/kg/j).<br/>\n                              • <strong>Critère d'échec :</strong> si pas de réponse après <strong>3 à 6 mois à 35 mg/kg/j &rarr; ARRÊTER L'HYDROXYURÉE</strong>.\n                            </td>\n                          </tr>\n                          <tr>\n                            <td><strong>Effets secondaires &amp; Seuils d'arrêt (Diapo 34)</strong></td>\n                            <td>\n                              • <strong class=\"text-rose-600 dark:text-rose-400\">Cytopénies : arrêter provisoirement le traitement si PNN &lt; 1 G/L et/ou Plaquettes &lt; 100 G/L</strong> (reprise à la normalisation, souvent au bout de 2 semaines ; une dose toxique ne doit pas être essayée plus de 2 fois).<br/>\n                              • Atteinte réversible des spermatozoïdes / azoospermie.\n                            </td>\n                          </tr>\n                        </tbody>\n                      </table>\n                    </div>\n                    "
        },
        {
          "slideBadge": "Diapos 36 – 37",
          "heading": "Nouveaux médicaments (2017–2024), Greffe de moelle osseuse & Thérapie génique",
          "body": "\n                    <div class=\"overflow-hidden rounded-xl border border-border\">\n                      <table class=\"course-table\">\n                        <thead>\n                          <tr>\n                            <th>Thérapeutique</th>\n                            <th>Cible / Mécanisme d'action</th>\n                            <th>Statut réglementaire &amp; Résultats (Diapos 36 – 37)</th>\n                          </tr>\n                        </thead>\n                        <tbody>\n                          <tr>\n                            <td><strong>L-Glutamine (Andari 5g®)</strong></td>\n                            <td>Poudre orale ; augmente le <strong>NAD intracellulaire</strong> (détoxification oxydative du GR)</td>\n                            <td>Autorisé FDA en <strong>juillet 2017</strong> (&gt; 5 ans) ; réduit la fréquence des CVO</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Crizanlizumab (Adakveo®, Novartis)</strong></td>\n                            <td>Ac monoclonal inhibant la <strong>P-sélectine</strong> (bloque l'hyperadhésion GR-endothélium)</td>\n                            <td>FDA nov. 2019 (&gt; 16 ans), réduisait les CVO de 40–50 % &rarr; <strong class=\"text-rose-600\">Arrêt d'utilisation en 2024 (manque de preuve d'efficacité en vie réelle)</strong></td>\n                          </tr>\n                          <tr>\n                            <td><strong>Voxelotor (Oxbryta®, GBT)</strong></td>\n                            <td>Module l'affinité de l'Hb pour l'O2 &rarr; inhibe la polymérisation et augmente l'Hb</td>\n                            <td>FDA nov. 2019 (&gt; 12 ans) &rarr; <strong class=\"text-rose-600\">Arrêt d'utilisation en 2024 (manque de preuve d'efficacité en vie réelle)</strong></td>\n                          </tr>\n                          <tr>\n                            <td><strong>Greffe de moelle osseuse (CSH)</strong></td>\n                            <td>Remplacement du compartiment érythroïde par celui du donneur HLA-compatible</td>\n                            <td><strong>Seul traitement curatif disponible</strong> : <span class=\"font-mono-metric font-semibold text-primary\">96 % de guérison</span> chez l'enfant &lt; 16 ans (&gt; 2 000 greffes). Limites : rejet, GVH chronique, infertilité, manque de donneurs.</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Thérapie génique</strong></td>\n                            <td>Greffe autologue de CSH génétiquement modifiées</td>\n                            <td>2 médicaments approuvés en <strong>2023 et 2024</strong> : <strong>Lyfgenia®</strong> (Bluebird bio) et <strong>Casgevy®</strong> (Vertex Pharmaceuticals)</td>\n                          </tr>\n                        </tbody>\n                      </table>\n                    </div>\n                    "
        },
        {
          "slideBadge": "Diapos 38 – 41",
          "heading": "Indications d'urgence (CVO, AVC, Priapisme) & Prise en charge chez l'enfant (Oracilline)",
          "body": "\n                    <div class=\"grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs\">\n                      <div class=\"p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1.5\">\n                        <div class=\"font-semibold text-foreground\">Traitement des CVO &amp; de l'AVC (Diapos 38 – 39)</div>\n                        <p class=\"text-foreground/90 leading-relaxed\">\n                          • <strong>CVO :</strong> Antalgiques gradués selon l'EVA + <strong>Hydratation</strong> orale ou IV (<span class=\"font-mono-metric font-semibold\">2 L/m²/24h</span> avec SGI + électrolytes + <strong>sérum bicarbonaté à 14 ‰</strong>) + traitement du facteur déclenchant + échange transfusionnel si crise grave/rebelle.<br/>\n                          • <strong>AVC :</strong> Confirmer par <strong>Scanner / IRM cérébrale</strong> &rarr; Réanimation + <strong>Échange transfusionnel</strong> en urgence. Prévention primaire chez l'enfant par <strong>écho-Doppler transcrânien</strong> (artères cérébrales moyennes / carotides internes).\n                        </p>\n                      </div>\n                      <div class=\"p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1.5\">\n                        <div class=\"font-semibold text-foreground\">Urgence urologique : Le Priapisme (Diapo 40)</div>\n                        <p class=\"text-foreground/90 leading-relaxed\">\n                          • <strong>Traitement médical (&lt; 4h) :</strong> Hydratation (<span class=\"font-mono-metric\">2 L sérum salé + 1 L bicarbonate 14 ‰</span>) + diazépam + antalgiques + vasodilatateurs + <strong>perfusion d’étiléfrine</strong>.<br/>\n                          • <strong>Traitement urologique :</strong> <strong class=\"text-rose-600\">Référer en Urologie après 4h d’évolution</strong> &rarr; ponction-lavage des corps caverneux, injection intracaverneuse d’étiléfrine, ou dérivation des corps caverneux.\n                        </p>\n                      </div>\n                    </div>\n                    <div class=\"p-3.5 rounded-xl bg-primary/8 border border-primary/25 text-xs space-y-1 mt-3\">\n                      <div class=\"font-semibold text-foreground\">Les grands axes de la prise en charge chez l'enfant (Diapo 41)</div>\n                      <p class=\"text-foreground/90 leading-relaxed\">\n                        • <strong>Dépistage néonatal précoce (J7 à M1) :</strong> par isoélectrofocalisation (IEF) ou CLHP (HPLC).<br/>\n                        • <strong>Antibioprophylaxie par Oracilline (Pénicilline V) :</strong> <span class=\"font-mono-metric font-semibold text-primary\">100 000 UI/kg/j si &le; 10 kg</span> ; <span class=\"font-mono-metric font-semibold text-primary\">50 000 UI/kg/j si &gt; 10 kg</span> en 2 à 3 prises/j, <strong>jusqu’à l’âge de 10 ans</strong> (jusqu’à <strong>15 ans</strong> si ATCD d'infections à pneumocoque ou ORL/bronchiques récidivantes ; et pendant <strong>au moins 5 ans après splénectomie</strong>).<br/>\n                        • Vaccinations + supplément en acide folique + éducation des parents (hyperhydratation, reconnaissance des signes d'alerte).\n                      </p>\n                    </div>\n                    "
        }
      ]
    },
    {
      "id": "hb_chap_5",
      "num": "V",
      "title": "Les Thalassémies : Généralités, Bêta-Thalassémies & Chélateurs du Fer",
      "slides": "Diapositives 42 à 46",
      "blocks": [
        {
          "slideBadge": "Diapos 42 – 43",
          "heading": "Définition des thalassémies & Physiopathologie des Bêta-thalassémies",
          "body": "\n                    <ul class=\"text-xs sm:text-[13px] text-foreground/90 space-y-1.5 leading-relaxed\">\n                      <li>• <strong>Définition (Diapo 42) :</strong> Anomalies génétiques entraînant une <strong>diminution (&alpha;<sup>+</sup> ou &beta;<sup>+</sup>)</strong> ou une <strong>absence complète (&alpha;<sup>0</sup> ou &beta;<sup>0</sup>)</strong> de synthèse des chaînes &alpha; ou &beta; de l’Hb. On distingue les &alpha;-thalassémies, &beta;-thalassémies et &delta;&beta;-thalassémies. Transmission <strong>autosomique codominante</strong> (pourtour méditerranéen, Asie du Sud-Est ; formes asymptomatiques en Afrique noire).</li>\n                      <li>• <strong>Pathogénie des &beta;-thalassémies (Diapo 43) :</strong> <strong>Mutations ponctuelles du gène &beta; (+++)</strong> entraînant un défaut de transcription, d’épissage ou de traduction de l’ARNm (les délétions du gène &beta; sont rares).</li>\n                      <li>• <strong>Triple conséquence physiopathologique :</strong> 1) Baisse de synthèse des chaînes &beta; &rarr; <strong>anémie hypochrome microcytaire hypersidérémique</strong> ; 2) <strong>Excès de chaînes &alpha; libres</strong> &rarr; érythropoïèse inefficace intramédullaire et hémolyse périphérique ; 3) Compensation &rarr; <strong>excès d’HbF et d’HbA2</strong>.</li>\n                    </ul>\n                    "
        },
        {
          "slideBadge": "Diapos 44 – 45",
          "heading": "Diagnostic positif des 3 formes de Bêta-thalassémie (Cooley, Intermédiaire, Mineure)",
          "body": "\n                    <div class=\"overflow-hidden rounded-xl border border-border\">\n                      <table class=\"course-table\">\n                        <thead>\n                          <tr>\n                            <th>Forme clinique</th>\n                            <th>Tableau clinique &amp; Évolution</th>\n                            <th>Hémogramme &amp; Métabolisme du fer</th>\n                            <th>Électrophorèse de l'Hb</th>\n                          </tr>\n                        </thead>\n                        <tbody>\n                          <tr>\n                            <td><strong>&beta;-thalassémie majeure (Maladie de Cooley)</strong></td>\n                            <td>Début vers <strong>6 mois</strong> ; anémie hémolytique chronique, <strong>retard staturo-pondéral très net</strong>, déformations squelettiques (<strong>faciès mongoloïde</strong>). Risque de surcharge martiale et d'infections.</td>\n                            <td>Anémie sévère hypochrome microcytaire modérément régénérative • Fer sérique et ferritine <strong>normaux ou &uarr;</strong>, CTFS &darr;, CS &uarr;</td>\n                            <td class=\"font-mono-metric font-semibold text-primary\">HbF : 60 – 98 %<br/>HbA2 : 3 – 5 %<br/>HbA : diminuée / 0</td>\n                          </tr>\n                          <tr>\n                            <td><strong>&beta;-thalassémie intermédiaire</strong></td>\n                            <td>Signes cliniques moins prononcés, meilleure tolérance</td>\n                            <td>Anémie modérée hypochrome microcytaire • Métabolisme du fer normal</td>\n                            <td class=\"font-mono-metric font-semibold text-primary\">HbF : 20 – 59 %<br/>HbA2 : 3 – 5 %<br/>HbA : diminuée</td>\n                          </tr>\n                          <tr>\n                            <td><strong>&beta;-thalassémie mineure (Trait)</strong></td>\n                            <td>Forme <strong>cliniquement asymptomatique</strong></td>\n                            <td>2 formes (avec microcytose + hypochromie et fer normal) :<br/>1) <strong>Pseudo-polyglobulie :</strong> GR &uarr; et Hb/Ht N<br/>2) <strong>Forme anémique :</strong> Hb légèrement &darr;</td>\n                            <td class=\"font-mono-metric font-semibold text-primary\">HbA2 : 4 – 8 % (&uarr;&uarr;)<br/>HbF : 1 – 5 %<br/>HbA : lég. diminuée</td>\n                          </tr>\n                        </tbody>\n                      </table>\n                    </div>\n                    "
        },
        {
          "slideBadge": "Diapo 46",
          "heading": "Traitement des Bêta-thalassémies & Tableau comparatif des 3 Chélateurs du fer",
          "body": "\n                    <p class=\"text-xs sm:text-[13px] text-foreground/90 leading-relaxed mb-3\">\n                      • <strong>Formes mineures :</strong> pas de traitement, conseil génétique et <strong>éviter toute prise régulière de fer</strong>.<br/>\n                      • <strong>Formes dépendantes de la transfusion (majeures et intermédiaires) :</strong> régime hypertransfusionnel pour maintenir <span class=\"font-mono-metric font-semibold text-primary\">Hb &gt; 10 g/dl</span> + acide folique + splénectomie si hypersplénisme + <strong>Chélateur du fer obligatoire</strong> :\n                    </p>\n                    <div class=\"overflow-hidden rounded-xl border border-border\">\n                      <table class=\"course-table\">\n                        <thead>\n                          <tr>\n                            <th>Variable</th>\n                            <th>DÉFÉROXAMINE (Desferal®)</th>\n                            <th>DÉFÉRASIROX (Exjade®)</th>\n                            <th>DÉFÉRIPRONE (Ferriprox®)</th>\n                          </tr>\n                        </thead>\n                        <tbody>\n                          <tr>\n                            <td><strong>Posologie (mg/kg/jour)</strong></td>\n                            <td class=\"font-mono-metric font-semibold text-primary\">25 – 50 mg/kg/j</td>\n                            <td class=\"font-mono-metric font-semibold text-primary\">20 – 40 mg/kg/j</td>\n                            <td class=\"font-mono-metric font-semibold text-primary\">75 – 100 mg/kg/j</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Voie d'administration</strong></td>\n                            <td>SC ou IV lente (8–10h/j, 5 à 7 j/sem)</td>\n                            <td><strong>Per os</strong> (1 prise / jour)</td>\n                            <td><strong>Per os</strong> (3 prises / jour)</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Demi-vie plasmatique</strong></td>\n                            <td class=\"font-mono-metric\">20 – 30 min</td>\n                            <td class=\"font-mono-metric\">8 – 16 heures</td>\n                            <td class=\"font-mono-metric\">2 – 3 heures</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Voie d'élimination</strong></td>\n                            <td>Biliaire et urinaire</td>\n                            <td>Surtout biliaire</td>\n                            <td>Surtout urinaire</td>\n                          </tr>\n                          <tr>\n                            <td><strong>Effets secondaires clés</strong></td>\n                            <td>Irritation locale, troubles oculaires et auditifs, retard de croissance, allergie</td>\n                            <td>Troubles digestifs, hypercréatininémie, insuffisance rénale ou hépatique</td>\n                            <td><strong>Agranulocytose</strong>, troubles digestifs, arthropathies, atteinte hépatique</td>\n                          </tr>\n                        </tbody>\n                      </table>\n                    </div>\n                    "
        }
      ]
    },
    {
      "id": "hb_chap_6",
      "num": "VI",
      "title": "Les Alpha-Thalassémies & Diagnostic Différentiel des Anémies Microcytaires",
      "slides": "Diapositives 47 à 51",
      "blocks": [
        {
          "slideBadge": "Diapos 47 – 49",
          "heading": "Pathogénie génétique (délétions α) & Les 4 formes cliniques d'Alpha-thalassémie",
          "body": "\n                    <p class=\"text-xs sm:text-[13px] text-foreground/90 leading-relaxed mb-3\">\n                      <strong>Pathogénie (Diapo 47) :</strong> Délétions d'un ou plusieurs des 4 gènes &alpha; (génotype normal : <span class=\"font-mono-metric font-semibold\">&alpha;&alpha;/&alpha;&alpha;</span>). L'excès de chaînes non-&alpha; entraîne la formation de <strong>tétramères rapides</strong> (migrant en avant de l'HbA) : <strong>Tétramères &gamma;4 = Hb Bart’s</strong> (vie fœtale / naissance) et <strong>Tétramères &beta;4 = Hb H</strong> (après 6 mois).\n                    </p>\n                    <div class=\"overflow-hidden rounded-xl border border-border\">\n                      <table class=\"course-table\">\n                        <thead>\n                          <tr>\n                            <th>Entité clinique</th>\n                            <th>Génotype</th>\n                            <th>Clinique &amp; Hémogramme</th>\n                            <th>Électrophorèse de l'Hb &amp; Traitement (Diapos 48 – 49)</th>\n                          </tr>\n                        </thead>\n                        <tbody>\n                          <tr>\n                            <td><strong>1. Hydrops foetalis (Anasarque fœto-placentaire)</strong></td>\n                            <td class=\"font-mono-metric font-semibold text-rose-600\">-- / --<br/>(4 gènes délétés)</td>\n                            <td><strong>Incompatible avec la vie :</strong> mort-né avec œdème généralisé, anémie hémolytique sévère microcytaire, placenta œdématié</td>\n                            <td><span class=\"font-mono-metric font-semibold\">Hb Bart’s : 80 % | Hb H : 10 % | Hb Portland : 10 %</span></td>\n                          </tr>\n                          <tr>\n                            <td><strong>2. Hémoglobinose H</strong></td>\n                            <td class=\"font-mono-metric font-semibold text-primary\">&alpha;- / --<br/>(3 gènes délétés)</td>\n                            <td>Anémie hémolytique chronique dès la naissance ; microcytose hypochrome à fer normal</td>\n                            <td>\n                              • <strong>Naissance :</strong> <span class=\"font-mono-metric\">Hb Bart’s 20–40 % | HbF 65–90 % | Hb H traces</span><br/>\n                              • <strong>&gt; 6 mois :</strong> <span class=\"font-mono-metric font-semibold text-primary\">Hb H : 5–30 %</span> | HbA 65–90 % • <em>Transfusion à la demande</em>\n                            </td>\n                          </tr>\n                          <tr>\n                            <td><strong>3. &alpha;-thalassémie mineure</strong></td>\n                            <td class=\"font-mono-metric\">&alpha;&alpha;/-- (cis) ou &alpha;-/&alpha;- (trans)</td>\n                            <td>Cliniquement asymptomatique ; hypochromie et microcytose familiale à fer normal</td>\n                            <td>• <strong>Naissance :</strong> <span class=\"font-mono-metric\">Hb Bart’s : 4 – 5 %</span><br/>• <strong>Après 6 mois :</strong> électrophorèse normale • <em>Éviter le fer</em></td>\n                          </tr>\n                          <tr>\n                            <td><strong>4. &alpha;-thalassémie silencieuse</strong></td>\n                            <td class=\"font-mono-metric\">&alpha;&alpha; / &alpha;-<br/>(1 gène délété)</td>\n                            <td>Asymptomatique ; hémogramme et bilan du fer <strong>strictement normaux</strong></td>\n                            <td>Électrophorèse normale &rarr; diagnostic uniquement par <strong>biologie moléculaire</strong></td>\n                          </tr>\n                        </tbody>\n                      </table>\n                    </div>\n                    "
        },
        {
          "slideBadge": "Diapos 50 – 51",
          "heading": "Diagnostic différentiel des anémies microcytaires hypochromes & Conclusion",
          "body": "\n                    <div class=\"overflow-hidden rounded-xl border border-border mb-3\">\n                      <table class=\"course-table\">\n                        <thead>\n                          <tr>\n                            <th>Étiologie microcytaire (Diapo 50)</th>\n                            <th>Fer sérique (FS)</th>\n                            <th>Ferritinémie</th>\n                            <th>CTFS</th>\n                            <th>Coefficient de saturation (CS = FS/CTFS)</th>\n                          </tr>\n                        </thead>\n                        <tbody>\n                          <tr>\n                            <td><strong>Thalassémie</strong></td>\n                            <td>Normal ou <strong>augmenté (&uarr;)</strong></td>\n                            <td><strong>Augmentée (&uarr;)</strong></td>\n                            <td><strong>Diminuée (&darr;)</strong></td>\n                            <td><strong>Augmenté (&uarr;)</strong></td>\n                          </tr>\n                          <tr>\n                            <td><strong>Carence en fer</strong></td>\n                            <td><strong>Diminué (&darr;)</strong></td>\n                            <td><strong>Diminuée (&darr;)</strong></td>\n                            <td><strong>Augmentée (&uarr;)</strong></td>\n                            <td><strong>Diminué (&darr;)</strong></td>\n                          </tr>\n                          <tr>\n                            <td><strong>Anémie inflammatoire</strong></td>\n                            <td><strong>Diminué (&darr;)</strong></td>\n                            <td>Normale ou <strong>augmentée (&uarr;)</strong></td>\n                            <td><strong>Diminuée (&darr;)</strong></td>\n                            <td>Variable</td>\n                          </tr>\n                        </tbody>\n                      </table>\n                    </div>\n                    <p class=\"text-xs text-muted-foreground leading-relaxed\">\n                      <strong>Conclusion (Diapo 51) :</strong> Les hémoglobinopathies sont des anomalies génétiques très fréquentes dans le monde : la <strong>drépanocytose</strong> est un problème majeur de santé publique en Afrique, tandis que les <strong>syndromes thalassémiques</strong> prédominent en Asie du Sud-Est et autour du bassin méditerranéen.\n                    </p>\n                    "
        }
      ]
    }
  ]
};

export const ANEMIES_2026_ATLAS_SUMMARY: AtlasMagistralSummary = {
  id: "anemies_2026_ucad",
  title: "Anémies : Diagnostic et prise en charge",
  author: "Prof. Saliou Diop • Service d'Hématologie & CNTS — Université Cheikh Anta Diop (Dakar)",
  tag: "Cours Magistral Intégral • 34 diapositives",
  updatedAt: "09/11/2026",
  chapters: [
    {
      id: "chap_1",
      num: "I",
      title: "Objectifs, Plan, Définition & Épidémiologie",
      slides: "Diapositives 1 à 7",
      blocks: [
        {
          slideBadge: "Diapos 1 – 3",
          heading: "Objectifs pédagogiques & Plan du cours magistral",
          body: `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-3.5 rounded-xl bg-secondary/45 border border-border/70 space-y-1.5">
                <div class="text-xs font-semibold text-foreground">Objectifs d'apprentissage</div>
                <ol class="list-decimal list-inside text-xs text-foreground/90 space-y-1 leading-relaxed">
                  <li>Définir l’anémie</li>
                  <li>Décrire les différents mécanismes d’une anémie</li>
                  <li>Énumérer les différents signes cliniques d’une anémie</li>
                  <li>Savoir interpréter un hémogramme</li>
                  <li>Savoir mener la démarche du diagnostic étiologique d’une anémie en fonction de son type</li>
                  <li>Énoncer les principes du traitement des anémies</li>
                </ol>
              </div>
              <div class="p-3.5 rounded-xl bg-secondary/45 border border-border/70 space-y-1.5">
                <div class="text-xs font-semibold text-foreground">Plan du cours</div>
                <ul class="text-xs text-foreground/90 space-y-1 leading-relaxed">
                  <li><strong>1. Généralités :</strong> Définition, Épidémiologie, Mécanismes de l’anémie, Physiopathologie</li>
                  <li><strong>2. Diagnostic positif :</strong> Syndrome anémique &amp; Hémogramme</li>
                  <li><strong>3. Diagnostic étiologique :</strong> Microcytaires, Normocytaires, Macrocytaires</li>
                  <li><strong>4. Prise en charge des anémies :</strong> Buts, Moyens, Transfusion</li>
                </ul>
              </div>
            </div>
          `,
        },
        {
          slideBadge: "Diapos 4 – 5",
          heading: "Définition biologique de l'anémie & Fausses anémies par hémodilution",
          body: `
            <p class="text-xs sm:text-[13px] text-foreground/90 leading-relaxed mb-3">
              L’anémie se définit comme la <strong>baisse du taux d’hémoglobine</strong> en dessous des valeurs suivantes (<strong>Condition impérative : Volume plasmatique normal</strong>) :
            </p>
            <div class="overflow-hidden rounded-xl border border-border mb-3">
              <table class="course-table">
                <thead>
                  <tr>
                    <th>Terrain / Population</th>
                    <th>Seuil diagnostique d'Hémoglobine (Hb)</th>
                    <th>Condition physiologique</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Adulte — Homme</strong></td>
                    <td class="font-mono-metric font-semibold text-primary">Hb &lt; 13 g/dl</td>
                    <td>Volume plasmatique normal</td>
                  </tr>
                  <tr>
                    <td><strong>Adulte — Femme</strong></td>
                    <td class="font-mono-metric font-semibold text-primary">Hb &lt; 12 g/dl</td>
                    <td>Volume plasmatique normal</td>
                  </tr>
                  <tr>
                    <td><strong>Femmes enceintes et enfants</strong></td>
                    <td class="font-mono-metric font-semibold text-primary">Hb &lt; 11 g/dl</td>
                    <td>Volume plasmatique normal</td>
                  </tr>
                  <tr>
                    <td><strong>Nouveaux-nés</strong></td>
                    <td class="font-mono-metric font-semibold text-primary">Hb &lt; 14 g/dl</td>
                    <td>Volume plasmatique normal</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="p-3.5 rounded-xl bg-primary/8 border border-primary/25 text-xs space-y-1">
              <div class="font-semibold text-foreground">Fausses anémies par hémodilution (Diapo 5)</div>
              <p class="text-foreground/90 leading-relaxed">
                • <strong>Circonstances :</strong> Hyperhydratation, Splénomégalie volumineuse, grossesse, pic monoclonal.<br/>
                • Diminution apparente de l'Hématocrite (Ht), des Globules Rouges (GR) et de l'Hb par expansion du volume plasmatique, mais masse globulaire totale normale.<br/>
                • <em>Attention :</em> Ne pas méconnaître à l'inverse une vraie anémie masquée par une <strong>hémoconcentration</strong> (déshydratation).
              </p>
            </div>
          `,
        },
        {
          slideBadge: "Diapos 6 – 7",
          heading: "Fardeau mondial de l'anémie & Épidémiologie (OMS)",
          body: `
            <p class="text-xs sm:text-[13px] text-foreground/90 leading-relaxed">
              • <strong>Problème majeur de santé publique :</strong> Étude <em>Global Burden of Disease (1990–2019, Afiri S et al., J Hematol Oncol 2021)</em>.<br/>
              • Prévalence particulièrement élevée en Afrique subsaharienne et en Asie du Sud-Est, touchant en priorité les <strong>femmes enceintes (15–49 ans)</strong> et les jeunes enfants (indicateurs mondiaux OMS).
            </p>
          `,
        },
      ],
    },
    {
      id: "chap_2",
      num: "II",
      title: "Érythropoïèse, Mécanismes & Physiopathologie",
      slides: "Diapositives 8 à 13",
      blocks: [
        {
          slideBadge: "Diapos 8 – 9",
          heading: "Rappel sur l'hématopoïèse et la lignée érythroblastique",
          body: `
            <p class="text-xs sm:text-[13px] text-foreground/90 leading-relaxed mb-2.5">
              Séquence de différenciation médullaire (du stade précoce au stade tardif) :
            </p>
            <div class="flex flex-wrap items-center gap-1.5 text-xs font-medium">
              <span class="px-2.5 py-1 rounded-lg bg-secondary border border-border">1. Proérythroblaste</span>
              <span class="text-muted-foreground">→</span>
              <span class="px-2.5 py-1 rounded-lg bg-secondary border border-border">2. Érythroblaste basophile</span>
              <span class="text-muted-foreground">→</span>
              <span class="px-2.5 py-1 rounded-lg bg-secondary border border-border">3. É. polychromatophile</span>
              <span class="text-muted-foreground">→</span>
              <span class="px-2.5 py-1 rounded-lg bg-secondary border border-border">4. É. acidophile</span>
              <span class="text-muted-foreground">→</span>
              <span class="px-2.5 py-1 rounded-lg bg-primary/12 text-primary border border-primary/30 font-semibold">5. Réticulocyte</span>
              <span class="text-muted-foreground">→</span>
              <span class="px-2.5 py-1 rounded-lg bg-foreground text-background font-semibold">6. Érythrocyte (GR mature)</span>
            </div>
          `,
        },
        {
          slideBadge: "Diapos 10 – 11",
          heading: "Mécanismes d'une anémie : Origine Centrale vs Origine Périphérique",
          body: `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-4 rounded-xl bg-background border border-border space-y-2">
                <div class="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>1. Origine Centrale (Arégénérative)</span>
                  <span class="font-mono-metric text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground">Réticulocytes abaissés</span>
                </div>
                <p class="text-xs text-foreground/90 leading-relaxed">
                  <strong>A. Insuffisance médullaire quantitative :</strong><br/>
                  • Atteinte de la cellule souche : <em>Aplasie médullaire</em><br/>
                  • Défaut de production d’EPO (<em>Insuffisance rénale chronique</em>), endocrinopathies<br/>
                  • Envahissement médullaire : <em>Leucémies et métastases médullaires</em><br/>
                  <span class="text-[11px] font-mono-metric text-primary">→ Frottis sanguin : PAS D’ANOMALIES MORPHOLOGIQUES DES HÉMATIES</span>
                </p>
                <p class="text-xs text-foreground/90 leading-relaxed pt-1 border-t border-border/60">
                  <strong>B. Insuffisance médullaire qualitative :</strong><br/>
                  • Défaut en matériaux de production : <em>Déficit en fer</em>, <em>Détournement du fer</em> (macrophages / inflammation), <em>Déficit en vitamines B9, B12, B6</em><br/>
                  • Trouble de la différenciation : <em>Myélodysplasies</em><br/>
                  <span class="text-[11px] font-mono-metric text-primary">→ Frottis sanguin : PRÉSENCE D’ANOMALIES MORPHOLOGIQUES DES HÉMATIES</span>
                </p>
              </div>

              <div class="p-4 rounded-xl bg-background border border-border space-y-2">
                <div class="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>2. Origine Périphérique (Régénérative)</span>
                  <span class="font-mono-metric text-[10px] px-2 py-0.5 rounded bg-primary/15 text-primary">Réticulocytes augmentés</span>
                </div>
                <p class="text-xs text-foreground/90 leading-relaxed">
                  <strong>A. Hémorragies aiguës et abondantes</strong>
                </p>
                <p class="text-xs text-foreground/90 leading-relaxed pt-1 border-t border-border/60">
                  <strong>B. Anémies hémolytiques :</strong><br/>
                  • <strong>Hémolyses corpusculaires (congénitales) :</strong> Hémoglobinopathies (drépanocytose, thalassémies), Enzymopathies (G6PD, PK), Anomalies de la membrane érythrocytaire (Minkowski-Chauffard).<br/>
                  • <strong>Hémolyses extra-corpusculaires (acquises) :</strong> Causes immunologiques (AHAI, allo-immunisation), Causes infectieuses (paludisme), Causes mécaniques, Causes toxiques, <em>Hémoglobinurie nocturne paroxystique (HNP)</em>.
                </p>
              </div>
            </div>
          `,
        },
        {
          slideBadge: "Diapos 12 – 13",
          heading: "Physiopathologie : Hypoxie & Systèmes de compensation",
          body: `
            <ul class="text-xs sm:text-[13px] text-foreground/90 space-y-2 leading-relaxed">
              <li>• <strong>Conséquence directe :</strong> La baisse du taux d’Hb entraîne une <strong>hypoxie tissulaire</strong>.</li>
              <li>• <strong>Mécanisme intra-érythrocytaire :</strong> Augmentation du <strong>2,3-Diphosphoglycérate (2,3-DPG)</strong> qui diminue l’affinité de l’Hb pour l’O2 (libération accrue d'O2 aux tissus). Permet de maintenir l’oxygénation tissulaire pour des variations de <strong>2 à 3 g/dl d’Hb</strong>.</li>
              <li>• <strong>Mécanisme extra-érythrocytaire :</strong> Déviation (redistribution) de la circulation sanguine des organes non vitaux (peau et muqueuses → <strong>pâleur cutanéo-muqueuse</strong>) pour compenser les organes vitaux (<strong>cœur, système nerveux central</strong>).</li>
              <li>• <strong>Décompensation (Diapo 13) :</strong> Si le système de compensation est dépassé, les signes cliniques apparaissent : <strong>signes de souffrance cardiovasculaire</strong> et <strong>signes de souffrance du système nerveux</strong>.</li>
            </ul>
          `,
        },
      ],
    },
    {
      id: "chap_3",
      num: "III",
      title: "Diagnostic Positif : Syndrome Anémique & Hémogramme",
      slides: "Diapositives 14 à 18",
      blocks: [
        {
          slideBadge: "Diapo 14",
          heading: "Signes cliniques : Le syndrome anémique",
          body: `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div class="p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1">
                <div class="font-semibold text-foreground">1. Signes cutanéo-muqueux</div>
                <p class="text-foreground/90 leading-relaxed">
                  • Pâleur des muqueuses et des conjonctives<br/>
                  • Intensité variable : absente, modérée, franche, intense
                </p>
              </div>
              <div class="p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1">
                <div class="font-semibold text-foreground">2. Signes cardiovasculaires</div>
                <p class="text-foreground/90 leading-relaxed">
                  • Tachycardie, palpitations<br/>
                  • Douleurs angineuses<br/>
                  • Dyspnée d’effort puis permanente<br/>
                  • Souffle anorganique (systolique fonctionnel)<br/>
                  • Tableau d’insuffisance cardiaque globale
                </p>
              </div>
              <div class="p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1">
                <div class="font-semibold text-foreground">3. Signes neurosensoriels</div>
                <p class="text-foreground/90 leading-relaxed">
                  • Céphalées, asthénie<br/>
                  • Bourdonnements d’oreilles (acouphènes)<br/>
                  • Vertiges, lipothymie, coma
                </p>
              </div>
            </div>
          `,
        },
        {
          slideBadge: "Diapos 15 – 18",
          heading: "Signes biologiques : Constantes érythrocytaires (VGM, TCMH, CCMH), IDR & Frottis",
          body: `
            <div class="overflow-hidden rounded-xl border border-border mb-3">
              <table class="course-table">
                <thead>
                  <tr>
                    <th>Constante érythrocytaire</th>
                    <th>Formule de calcul (Diapo 16)</th>
                    <th>Valeurs normales</th>
                    <th>Interprétation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>VGM</strong> (Volume Globulaire Moyen)</td>
                    <td class="font-mono-metric">Ht (%) × 10 / GR (en millions)</td>
                    <td class="font-mono-metric font-semibold text-primary">80 – 90 fl (ou 80–100 fl)</td>
                    <td>&lt; 80 fl : Microcytaire | &gt; 100 fl : Macrocytaire</td>
                  </tr>
                  <tr>
                    <td><strong>TCMH</strong> (Teneur Corpusculaire Moyenne en Hb)</td>
                    <td class="font-mono-metric">Hb (g/dl) × 10 / GR (en millions)</td>
                    <td class="font-mono-metric font-semibold text-primary">27 – 31 pg</td>
                    <td>&lt; 27 pg : Hypochromie</td>
                  </tr>
                  <tr>
                    <td><strong>CCMH</strong> (Concentration Corpusculaire Moyenne en Hb)</td>
                    <td class="font-mono-metric">Hb (g/dl) × 100 / Ht (en %)</td>
                    <td class="font-mono-metric font-semibold text-primary">32 – 36 %</td>
                    <td>&lt; 32 % : Hypochromie | 32–36 % : Normochrome</td>
                  </tr>
                  <tr>
                    <td><strong>Indice de distribution cellulaire (IDR / CV)</strong></td>
                    <td class="font-mono-metric">Coefficient de variation du volume des GR</td>
                    <td class="font-mono-metric font-semibold text-primary">12 – 15 %</td>
                    <td>Augmenté si anisocytose, double population, réticulocytose importante (Diapo 17)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="text-xs text-muted-foreground">
              Ces constantes permettent de classer l'anémie en <strong>3 grands types</strong> : 1) Anémies hypochromes microcytaires, 2) Anémies normochromes normocytaires, 3) Anémies macrocytaires. Le <strong>frottis sanguin</strong> (Diapo 18) permet d’étudier directement la morphologie des globules rouges.
            </p>
          `,
        },
      ],
    },
    {
      id: "chap_4",
      num: "IV",
      title: "Diagnostic Étiologique : Anémies Microcytaires & Bilan Martial",
      slides: "Diapositives 19 à 23",
      blocks: [
        {
          slideBadge: "Diapos 19 – 20",
          heading: "Exploration du métabolisme du fer : Valeurs normales, Signification & Limites",
          body: `
            <p class="text-xs sm:text-[13px] text-foreground/90 leading-relaxed mb-3">
              <strong>Valeurs usuelles du bilan martial (Diapo 19) :</strong> Fer sérique = <span class="font-mono-metric font-semibold">0,8 – 1,3 mg/l</span> | Capacité totale de fixation de la sidérophiline (CTFS) = <span class="font-mono-metric font-semibold">2,5 – 3,5 mg/l</span> | Coefficient de saturation de la transferrine (CS = Fer sérique / CTFS) = <span class="font-mono-metric font-semibold">30 – 35 %</span> | Nouveaux paramètres : Ferritine érythrocytaire, Récepteur soluble de la transferrine (<strong>sTfR</strong>).
            </p>
            <div class="overflow-hidden rounded-xl border border-border">
              <table class="course-table">
                <thead>
                  <tr>
                    <th>Test biologique (Diapo 20)</th>
                    <th>Signification physiologique</th>
                    <th>Limites d'interprétation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Fer sérique</strong></td>
                    <td>Mesure le fer fixé à la transferrine dans le plasma</td>
                    <td>Variabilité intra et interindividuelle ; peu sensible, peu spécifique</td>
                  </tr>
                  <tr>
                    <td><strong>Ferritine</strong></td>
                    <td>Évalue les réserves en fer de l'organisme</td>
                    <td><strong>Élevée dans les états inflammatoires</strong> ; n’évalue pas directement l’érythropoïèse</td>
                  </tr>
                  <tr>
                    <td><strong>Transferrine</strong></td>
                    <td>Protéine transporteuse du fer dans le plasma</td>
                    <td>Évalue uniquement la demande en fer mais non la disponibilité pour l’érythropoïèse</td>
                  </tr>
                  <tr>
                    <td><strong>Coefficient de saturation (CS)</strong></td>
                    <td>Pourcentage de transferrine qui fixe le fer</td>
                    <td>Nécessite deux mesures (transferrine + fer) ; sensible aux états inflammatoires</td>
                  </tr>
                  <tr>
                    <td><strong>Récepteur soluble de la transferrine (sTfR)</strong></td>
                    <td>Fragment sécrété du récepteur de la transferrine</td>
                    <td><strong>N’augmente pas avec l’inflammation</strong> (augmenté dans la carence en fer) ; coûteux et peu disponible</td>
                  </tr>
                  <tr>
                    <td><strong>Index sTfR / Ferritine</strong></td>
                    <td>Rapport sTfR / log Ferritine</td>
                    <td>Nécessite deux mesures ; test coûteux et assez complexe</td>
                  </tr>
                </tbody>
              </table>
            </div>
          `,
        },
        {
          slideBadge: "Diapos 21 – 22",
          heading: "Diagnostic différentiel des 4 anémies hypochromes microcytaires",
          body: `
            <div class="overflow-hidden rounded-xl border border-border">
              <table class="course-table">
                <thead>
                  <tr>
                    <th>Étiologie microcytaire</th>
                    <th>Fer sérique</th>
                    <th>Ferritinémie</th>
                    <th>CTFS</th>
                    <th>CS (FS/CTFS)</th>
                    <th>sTfR &amp; Index sTfR/Ferritine</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>1. Déficit en fer (Carence martiale)</strong></td>
                    <td>abaissé (↓)</td>
                    <td><strong>effondrée (↓)</strong></td>
                    <td><strong>augmentée (↑)</strong></td>
                    <td>abaissé (↓)</td>
                    <td><strong>sTfR ↑ | Index ↑↑</strong></td>
                  </tr>
                  <tr>
                    <td><strong>2. Anémie inflammatoire</strong></td>
                    <td>abaissé (↓)</td>
                    <td><strong>normale ou ↑</strong></td>
                    <td>normale ou ↓</td>
                    <td>abaissé ou N</td>
                    <td><strong>sTfR normal | Index normal</strong></td>
                  </tr>
                  <tr>
                    <td><strong>3. Déficit en fer + Inflammation</strong></td>
                    <td>abaissé (↓)</td>
                    <td>normale</td>
                    <td>variable</td>
                    <td>abaissé (↓)</td>
                    <td><strong>sTfR ↑ | Index ↑</strong></td>
                  </tr>
                  <tr>
                    <td><strong>4. Thalassémie / Anémie sidéroblastique (SMD)</strong></td>
                    <td>normal ou ↑</td>
                    <td>normale ou ↑</td>
                    <td>normale</td>
                    <td>normal ou ↑</td>
                    <td>variable</td>
                  </tr>
                </tbody>
              </table>
            </div>
          `,
        },
      ],
    },
    {
      id: "chap_5",
      num: "V",
      title: "Réticulocytes, RET-He, Anémies Normocytaires & Macrocytaires",
      slides: "Diapositives 24 à 29",
      blocks: [
        {
          slideBadge: "Diapos 24 – 26",
          heading: "Physiologie des réticulocytes & Intérêt diagnostique du RET-He (< 28 pg)",
          body: `
            <ul class="text-xs sm:text-[13px] text-foreground/90 space-y-2 leading-relaxed">
              <li>• <strong>Coloration supravitale (Diapo 24) :</strong> Le « réticulum » (fragments d'ARN) devient visible après coloration au <strong>bleu de crésyl brillant</strong> ou au <strong>bleu de méthylène</strong>.</li>
              <li>• <strong>Cinétique :</strong> Le réticulocyte reste dans la moelle osseuse pendant <strong>3 jours</strong> supplémentaires et pendant <strong>1 jour</strong> dans le flux sanguin périphérique.</li>
              <li>• <strong>Paramètres automatisés (Diapo 25) :</strong> RET (% et valeur absolue ++++), <strong>LFR</strong> (faible fluorescence, matures), <strong>MFR</strong> (fluorescence moyenne, semi-matures), <strong>HFR</strong> (haute fluorescence, immatures), <strong>IRF</strong> (fraction immature = MFR + HFR).</li>
              <li>• <strong>RET-He (Teneur en Hb des réticulocytes — Diapos 25–26) :</strong> Reflète l’hémoglobinisation des érythrocytes produits par la moelle au cours des <strong>1 à 2 derniers jours</strong>. Fournit une information directe sur la <strong>biodisponibilité actuelle du fer</strong>.<br/>
                <span class="font-mono-metric text-primary font-semibold">→ Une valeur de RET-He &lt; 28 pg signe une carence en fer ou une indisponibilité du fer pour l'érythropoïèse.</span><br/>
                Permet de distinguer une carence martiale d'une anémie inflammatoire et de dépister la carence chez l'insuffisant rénal chronique, l'enfant et la femme enceinte.
              </li>
            </ul>
          `,
        },
        {
          slideBadge: "Diapos 27 – 29",
          heading: "Étiologies des anémies normocytaires (seuil 80 000/mm³) et macrocytaires",
          body: `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1.5 text-xs">
                <div class="font-semibold text-foreground">Anémies normochromes normocytaires (Diapo 27)</div>
                <p class="text-foreground/90 leading-relaxed">
                  • <strong>Réticulocytes &lt; 80 000/mm³ (Anémie arégénérative) :</strong> Aplasie médullaire, Leucémies, Myélodysplasies → <em>Prescrire un Myélogramme</em> à la recherche d'une cause centrale.<br/>
                  • <strong>Réticulocytes &gt; 80 000/mm³ (Anémie régénérative) :</strong> 2 causes majeures : <strong>1) Anémies hémolytiques</strong> (bilan d'hémolyse, électrophorèse Hb, G6PD, frottis, Coombs, goutte épaisse), <strong>2) Hémorragies aiguës et abondantes</strong>.
                </p>
              </div>
              <div class="p-3.5 rounded-xl bg-secondary/40 border border-border/70 space-y-1.5 text-xs">
                <div class="font-semibold text-foreground">Anémies macrocytaires normochromes (Diapo 28)</div>
                <p class="text-foreground/90 leading-relaxed">
                  • Éliminer d'abord une régénération d'anémie hémolytique (taux des réticulocytes).<br/>
                  • <strong>Moelle mégaloblastique (bi ou pancytopénie) :</strong> dosages vitaminiques :<br/>
                  — <strong>Acide folique (B9) :</strong> carence d’apport<br/>
                  — <strong>Vitamine B12 :</strong> défaut d’absorption (maladie de Biermer)<br/>
                  • <strong>Autres causes :</strong> Myélodysplasies (frottis et myélogramme), Hémopathies malignes.
                </p>
              </div>
            </div>
          `,
        },
      ],
    },
    {
      id: "chap_6",
      num: "VI",
      title: "Traitement Médical, Posologies & Règles Transfusionnelles",
      slides: "Diapositives 30 à 34",
      blocks: [
        {
          slideBadge: "Diapos 30 – 32",
          heading: "Protocoles thérapeutiques spécifiques (Fer, Folates, Vitamine B12, EPO)",
          body: `
            <div class="overflow-hidden rounded-xl border border-border">
              <table class="course-table">
                <thead>
                  <tr>
                    <th>Étiologie</th>
                    <th>Protocole thérapeutique &amp; Posologies exactes du cours (Diapos 31–32)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Carence en fer</strong></td>
                    <td>
                      • <strong>Traitement curatif :</strong> Sels ferreux <strong>100 à 200 mg/jour chez l’adulte</strong> et <strong>10 mg/kg chez l’enfant</strong> jusqu’à correction de l’anémie, puis <strong>demi-dose</strong> pour recharger les réserves.<br/>
                      • <strong>Durée :</strong> <strong>2 à 3 mois</strong> (Problèmes : absorption et tolérance digestive).<br/>
                      • Traitement préventif chez la femme enceinte + <strong>Traitement de la cause</strong>.
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Anémie inflammatoire</strong></td>
                    <td>
                      • Traitement de la cause.<br/>
                      • <strong class="text-rose-600 dark:text-rose-400">Administration de fer CONTRE-INDIQUÉE.</strong><br/>
                      • Transfusion sanguine si mal tolérée ; Érythropoïétine (EPO) dans l'anémie des maladies chroniques.
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Déficit en acide folique (B9)</strong></td>
                    <td>
                      • <strong>5 mg par jour per os</strong>.
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Déficit en vitamine B12</strong></td>
                    <td>
                      • <strong>Vitamine B12 injectable :</strong> <strong>1000 microgrammes tous les 3 jours pendant 2 semaines</strong>, puis <strong>1000 microgrammes par mois</strong>.
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Érythropoïétine (EPO)</strong></td>
                    <td>
                      • Indications : Insuffisance rénale chronique, maladies chroniques, érythroblastopénies, alternative chez les polytransfusés.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          `,
        },
        {
          slideBadge: "Diapos 33 – 34",
          heading: "Place de la transfusion sanguine & Conclusion",
          body: `
            <ul class="text-xs sm:text-[13px] text-foreground/90 space-y-1.5 leading-relaxed">
              <li>• <strong>Objectifs variables selon la pathologie :</strong> corriger les signes de mauvaise tolérance dans les anémies aiguës ; maintenir un taux d’Hb prévenant les complications dans les thalassémies ; réduire le % d’Hb S sans augmenter la viscosité sanguine (échanges transfusionnels chez le drépanocytaire).</li>
              <li>• <strong>Règle d'or :</strong> Prendre en compte les risques liés à la transfusion sanguine ; <strong>ne transfuser que s’il n’y a pas d’autres alternatives</strong> ; utiliser des <strong>concentrés de globules rouges (CGR)</strong> dans les anémies chroniques.</li>
            </ul>
          `,
        },
      ],
    },
  ],
};
