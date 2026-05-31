const url = "https://vhzdbhdyytvaipkbcsvs.supabase.co/functions/v1/generate-quiz-openai";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemRiaGR5eXR2YWlwa2Jjc3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NzU0ODMsImV4cCI6MjA3MjM1MTQ4M30.7PRgMDBgf8ZSPbsgmfmBTqS46r5b0dIhxNSL97KWb7A";

fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${anonKey}`
  },
  body: JSON.stringify({
    content: "Le syndrome coronaire aigu (SCA) désigne un ensemble de symptômes cliniques évocateurs d'une ischémie myocardique aiguë. Le SCA avec sus-décalage du segment ST (SCA ST+) nécessite une reperfusion en urgence. L'angioplastie primaire est le traitement de choix si elle peut être réalisée dans les 120 minutes suivant le premier contact médical. Sinon, la thrombolyse pré-hospitalière est recommandée. Les complications incluent les arythmies ventriculaires, le choc cardiogénique, et la rupture de la paroi libre du ventricule gauche.",
    nbQuestions: 2,
    type: "groupage",
    difficulty: "facile"
  })
})
.then(res => res.json().then(data => ({status: res.status, data})))
.then(console.log)
.catch(console.error);
