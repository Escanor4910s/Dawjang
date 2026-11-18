export interface StudentProfileSN {
  fullName: string;
  email: string;
  phone: string;
  studyLevel: string;
  university: string;
  faculty?: string;
  credits?: number;
  specialty?: string;
  avatarUrl?: string;
  targetRetention: number;
  dailyCap: number;
  defaultFlashcardMode?: "objectives" | "relevance" | "qcm_error";
  defaultDuelTimer?: number;
  readerFontSize?: "normal" | "confort" | "grand";
  focusMode?: boolean;
  soundEffects?: boolean;
  levelUpAlerts?: boolean;
  dailyReminderTime?: string;
}

export const STUDENT_PROFILE_STORAGE_KEY = "hippocampus_user_profile_sn_v1";
export const STUDENT_AVATAR_STORAGE_KEY = "hippocampus_user_avatar_url";

export const SENEGAL_STUDY_LEVELS: string[] = [
  "Licence 1",
  "Licence 2",
  "Licence 3",
  "Master 1",
  "Master 2",
  "Doctorat 1",
  "Doctorat 2",
  "Doctorat 3",
  "Interne des Hôpitaux",
];

export const SENEGAL_UNIVERSITIES: string[] = [
  "UCAD — Université Cheikh Anta Diop (Dakar)",
  "UGB — Université Gaston Berger (Saint-Louis)",
  "UIDT — Université Iba Der Thiam (Thiès)",
  "UASZ — Université Assane Seck (Ziguinchor)",
  "UADB — Université Alioune Diop (Bambey)",
  "Autre établissement de santé",
];

export const DEFAULT_STUDENT_PROFILE: StudentProfileSN = {
  fullName: "Étudiant Hippocampus",
  email: "",
  phone: "",
  studyLevel: "Licence 3",
  university: SENEGAL_UNIVERSITIES[0],
  specialty: "Médecine Générale",
  targetRetention: 90,
  dailyCap: 50,
  defaultFlashcardMode: "objectives",
  defaultDuelTimer: 30,
  readerFontSize: "confort",
  focusMode: false,
  soundEffects: true,
  levelUpAlerts: true,
  dailyReminderTime: "19:30",
};

function getAvatarStorageValue(): string | undefined {
  if (typeof localStorage === "undefined") return undefined;
  return localStorage.getItem(STUDENT_AVATAR_STORAGE_KEY) || undefined;
}

export function formatFullStudyLevel(rawLevel?: string | null): string {
  if (!rawLevel) return "Licence 3";
  const s = String(rawLevel).trim();
  const lower = s.toLowerCase();
  if (/^l\s*1\b/i.test(s) || lower === "l1") return "Licence 1";
  if (/^l\s*2\b/i.test(s) || lower === "l2") return "Licence 2";
  if (/^l\s*3\b/i.test(s) || lower === "l3" || /dfasm/i.test(s)) return "Licence 3";
  if (/^m\s*1\b/i.test(s) || lower === "m1") return "Master 1";
  if (/^m\s*2\b/i.test(s) || lower === "m2") return "Master 2";
  if (/^d\s*1\b/i.test(s) || lower === "d1") return "Doctorat 1";
  if (/^d\s*2\b/i.test(s) || lower === "d2") return "Doctorat 2";
  if (/^d\s*3\b/i.test(s) || lower === "d3") return "Doctorat 3";
  if (/interne/i.test(s)) return "Interne des Hôpitaux";
  return s;
}

export function getSavedStudentProfile(): StudentProfileSN {
  const avatarUrl = getAvatarStorageValue();
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_STUDENT_PROFILE, avatarUrl };
  }

  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.studyLevel) {
        parsed.studyLevel = formatFullStudyLevel(parsed.studyLevel);
      }
      return {
        ...DEFAULT_STUDENT_PROFILE,
        avatarUrl,
        ...parsed,
      };
    }
  } catch {
    // Un profil local corrompu ne doit pas empêcher l’ouverture des paramètres.
  }

  return { ...DEFAULT_STUDENT_PROFILE, avatarUrl };
}

export function saveStudentProfile(profile: StudentProfileSN): void {
  const normalized: StudentProfileSN = {
    ...profile,
    studyLevel: formatFullStudyLevel(profile.studyLevel),
  };
  localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  if (normalized.avatarUrl) {
    localStorage.setItem(STUDENT_AVATAR_STORAGE_KEY, normalized.avatarUrl);
  } else {
    localStorage.removeItem(STUDENT_AVATAR_STORAGE_KEY);
  }
  window.dispatchEvent(new Event("hippocampus-profile-updated"));
}
