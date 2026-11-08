import type { Monograph } from '@/components/pdf/MonographPDF';

// Contenu officiel DawJang Press repris de « 1-Anemies 2026 » (Pr Saliou Diop)
export const anemies: Monograph = {
  title: 'Anémies',
  discipline: 'Médecine générale',
  faculty: 'Faculté de médecine, cursus hospitalo-universitaire',
  date: '2 novembre 2026',
  ref: 'DWJ-2026-1633',
  owner: 'Escanor4910s',
  readingMinutes: 2,
  readingPasses: [
    { name: '1re lecture', goal: 'compréhension globale' },
    { name: '2e lecture', goal: 'ancrage des seuils et des définitions' },
    { name: '3e lecture', goal: 'validation avant l’examen, avec QCM' },
  ],
  objectives: [
    {
      n: 1,
      title: 'Définir l’anémie',
      blocks: [
        { k: 'p', text: 'L’anémie est une baisse du taux d’hémoglobine (Hb) sous les seuils suivants, avec un volume plasmatique normal :' },
        {
          k: 'scale',
          caption: 'Seuil d’hémoglobine, en g/dl',
          marks: [
            { label: 'Femme enceinte / enfant', value: 11 },
            { label: 'Femme adulte', value: 12 },
            { label: 'Homme adulte', value: 13 },
            { label: 'Nouveau-né', value: 14 },
          ],
        },
        { k: 'warn', text: 'Attention aux fausses anémies par hémodilution (hyperhydratation, splénomégalie).' },
      ],
    },
    {
      n: 2,
      title: 'Décrire les différents mécanismes d’une anémie',
      blocks: [
        { k: 'p', text: 'Les anémies résultent de deux mécanismes principaux :' },
        {
          k: 'branches',
          items: [
            {
              title: 'Origine centrale', kind: 'arégénérative', retic: 'Taux de réticulocytes abaissé', dir: 'down',
              lines: [
                'Insuffisance médullaire quantitative (aplasie, EPO basse, envahissement).',
                'Insuffisance médullaire qualitative (déficit en fer, B9/B12/B6, myélodysplasies).',
              ],
            },
            {
              title: 'Origine périphérique', kind: 'régénérative', retic: 'Taux de réticulocytes augmenté', dir: 'up',
              lines: ['Anémies hémolytiques (corpusculaires, extra-corpusculaires).', 'Hémorragies aiguës et abondantes.'],
            },
          ],
        },
      ],
    },
    {
      n: 3,
      title: 'Énumérer les différents signes cliniques d’une anémie',
      blocks: [
        {
          k: 'rows',
          rows: [
            { label: 'Signes cutanéo-muqueux', text: 'Pâleur (muqueuses, conjonctives).' },
            { label: 'Signes cardiovasculaires', text: 'Tachycardie, palpitations, douleurs angineuses, dyspnée, souffle anorganique, insuffisance cardiaque.' },
            { label: 'Signes neurosensoriels', text: 'Céphalées, asthénie, bourdonnements d’oreille, vertiges, lipothymie, coma.' },
          ],
        },
      ],
    },
    {
      n: 4,
      title: 'Savoir interpréter un hémogramme',
      blocks: [
        { k: 'rows', rows: [{ label: 'Anémies macrocytaires normochromes', text: 'Éliminer régénération (réticulocytes), doser vitamines B9/B12.' }] },
        {
          k: 'gap',
          title: 'Passage incomplet',
          text: 'Le texte de cet objectif s’arrête en cours de phrase. Voici ce qui a été conservé :',
          fragments: [
            'L’hémogramme évalue l’Hb pour diagnostiquer l’anémie (inférieur à 13 g/dl homme, …',
            '… 80 000/mm³ : Régénérative (hémolyse, hémorragie aiguë).',
          ],
        },
      ],
    },
    {
      n: 5,
      title: 'Savoir mener la démarche du diagnostic étiologique d’une anémie en fonction de son type',
      blocks: [{ k: 'gap', title: 'Objectif absent du résumé', text: 'Ce passage n’a pas été généré. Relancez la génération pour le compléter.' }],
    },
    {
      n: 6,
      title: 'Énoncer les principes du traitement des anémies',
      blocks: [
        {
          k: 'rows',
          rows: [
            { label: 'Buts', text: 'Corriger l’hypoxie et traiter la cause.' },
            { label: 'Indications', text: 'Dépendent de la gravité et tolérance. Anémie sévère = traitement immédiat après prélèvements.' },
            { label: 'Déficit en fer', text: 'Sels ferreux (100-200 mg/j adulte, 10 mg/kg enfant) jusqu’à correction + demi-dose pour réserves (2-3 mois). Traiter la cause.' },
            { label: 'Anémie inflammatoire', text: 'Traiter la cause. Fer contre-indiqué. Transfusion si mal tolérée. EPO si maladies chroniques.' },
            { label: 'Déficit acide folique', text: '5 mg/j per os.' },
            { label: 'Déficit vitamine B12', text: 'B12 injectable (1000 µg/3j x 2 semaines, puis 1000 µg/mois).' },
            { label: 'Anémies hémolytiques', text: 'Transfusion si mal tolérée, traiter la cause.' },
            { label: 'Érythropoïétine (EPO)', text: 'IRC, maladies chroniques, érythroblastopénies, alternative polytransfusés.' },
            { label: 'Transfusion sanguine', text: 'Corriger mauvaise tolérance, maintenir Hb, réduire HbS. Risques à considérer.' },
          ],
        },
      ],
    },
  ],
};
