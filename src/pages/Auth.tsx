// src/pages/Auth.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { getErrorMessage } from "@/lib/errorUtils";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Mail,
  Lock,
  User,
  Phone,
  GraduationCap,
  Building2,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  KeyRound,
  Wand2,
  Camera,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DawJangDragonIcon,
  DawJangWordmark,
} from "@/components/landing/HippocampusLogo";
import {
  SENEGAL_STUDY_LEVELS,
  SENEGAL_UNIVERSITIES,
  saveStudentProfile,
  getSavedStudentProfile,
} from "@/pages/Settings";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type AuthMode = "signin" | "signup" | "magic" | "reset";

/**
 * Logo vectoriel officiel de Google
 */
function GoogleOfficialIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/**
 * Illustration vectorielle du Coureur hachuré (sans filigrane)
 */
function KineticHatchedRunnerArtwork({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 1080"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("select-none", className)}
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {/* 1. Tête & Visage hachuré */}
        <path
          d="M385 38 L405 15 M398 36 L422 12 M412 36 L438 14 M425 38 L452 18 M438 42 L465 25 M450 47 L476 34 M462 54 L485 45 M372 45 L388 24 M364 56 L376 38"
          strokeWidth="6.5"
        />
        <path
          d="M362 66 C350 66, 348 92, 358 98 M478 82 C490 82, 488 108, 474 114"
          strokeWidth="4.5"
        />
        <path
          d="M372 52 L435 28 M366 66 L458 34 M364 80 L472 42 M364 94 L478 54 M365 108 L478 68 M368 122 L476 82 M372 135 L472 98 M378 148 L465 114 M388 158 L456 132 M402 165 L445 148"
          strokeWidth="7.5"
        />

        {/* 2. Cou & Trapèzes */}
        <path
          d="M270 135 Q315 118, 352 122 M468 145 Q498 162, 522 182"
          strokeWidth="4"
        />
        <path
          d="M332 124 L368 195 M340 122 L376 205 M348 125 L384 212 M356 135 L392 218 M365 152 L400 222 M326 135 L358 198"
          strokeWidth="6.5"
        />
        <path
          d="M402 178 L466 142 M400 190 L474 152 M396 202 L478 164 M392 214 L476 178 M390 225 L472 192 M392 236 L465 208 M398 245 L455 224 M408 250 L444 238"
          strokeWidth="7"
        />

        {/* 3. Épaule & Bras droit replié au premier plan */}
        <path
          d="M262 140 C195 148, 155 188, 152 232 C120 250, 96 286, 82 335 C74 358, 86 382, 118 380 L282 325"
          strokeWidth="4"
        />
        <path
          d="M205 152 L258 140 M182 168 L268 148 M168 184 L274 158 M160 200 L276 170 M156 215 L276 182 M158 228 L274 195 M172 238 L268 210 M195 245 L258 226"
          strokeWidth="7.5"
        />
        <path
          d="M124 248 L205 242 M112 262 L212 254 M102 276 L215 268 M96 290 L198 282 M90 304 L175 298 M86 318 L158 315"
          strokeWidth="7"
        />
        <path
          d="M82 332 L145 375 M92 324 L165 374 M106 318 L185 370 M122 312 L205 364 M140 305 L222 358 M158 298 L238 352 M176 290 L254 345 M194 282 L268 338 M212 274 L280 330 M228 266 L292 320"
          strokeWidth="7.5"
        />
        <path
          d="M248 258 L302 312 M260 252 L314 306 M274 250 L325 300 M288 254 L336 298 M305 246 L345 286 M318 238 L354 274 M330 228 L360 258"
          strokeWidth="9"
        />

        {/* 4. Bras gauche tendu à droite */}
        <path
          d="M526 188 L492 275 M540 192 L502 292 M554 198 L510 308 M566 208 L518 322 M576 222 L526 334 M584 240 L535 344 M588 262 L545 352"
          strokeWidth="7.5"
        />
        <path
          d="M512 318 L575 285 M505 335 L572 302 M498 352 L568 318 M492 368 L562 335 M485 385 L556 352 M480 402 L550 368 M475 418 L544 385 M470 434 L538 402 M466 450 L534 418 M462 466 L528 435 M458 482 L522 452 M455 498 L515 468 M452 514 L508 485 M450 530 L502 502"
          strokeWidth="7"
        />
        <path
          d="M448 542 L496 518 M446 555 L495 532 M448 568 L498 545 M452 582 L502 558 M456 595 L505 572 M460 608 L485 595"
          strokeWidth="6.5"
        />

        {/* 5. Ceinture abdominale & Bassin */}
        <path
          d="M250 355 L312 338 M218 372 L302 352 M195 388 L292 368 M176 404 L288 384 M155 420 L385 375 M138 434 L398 386 M126 446 L405 398 M118 458 L402 412 M115 470 L398 426 M115 482 L394 440 M116 494 L390 454 M268 480 L388 468 M272 492 L386 482 M270 504 L382 495 M266 516 L378 508"
          strokeWidth="7"
        />

        {/* 6. Cuisses & Foulée */}
        <path
          d="M116 505 L82 625 M128 504 L98 648 M140 502 L114 668 M152 500 L130 685 M164 498 L146 700 M176 496 L162 712 M188 495 L178 720 M200 496 L192 695 M212 498 L206 665 M225 500 L220 635 M238 502 L235 605 M250 504 L250 575 M68 585 L52 675 M55 612 L42 695 M42 638 L32 712 M28 665 L22 725"
          strokeWidth="7.5"
        />
        <path
          d="M262 508 L188 615 M282 508 L195 632 M302 510 L202 648 M322 515 L210 662 M342 522 L218 675 M362 530 L226 688 M375 542 L236 700 M382 558 L248 710 M382 578 L262 718 M376 602 L278 724 M365 630 L295 728"
          strokeWidth="7.5"
        />
        <path
          d="M18 738 L128 732 M14 750 L125 745 M12 762 L122 758 M12 774 L118 770 M14 786 L115 782 M16 798 L112 794 M20 810 L108 806 M25 822 L102 818 M32 834 L95 830 M42 846 L88 842"
          strokeWidth="6.5"
        />
        <path
          d="M185 725 L268 708 M178 738 L272 720 M172 750 L268 732 M168 762 L262 745 M168 774 L256 758 M172 786 L250 772 M155 798 L248 785 M144 810 L262 796 M135 822 L270 808 M128 834 L272 820 M122 846 L268 832 M116 858 L262 844 M112 870 L256 856 M108 882 L250 868 M104 894 L244 880 M100 906 L236 892 M96 918 L228 904 M92 930 L218 916 M88 942 L208 928 M85 954 L198 940 M82 966 L188 952"
          strokeWidth="7.5"
        />
      </g>
    </svg>
  );
}

interface LiveStudyShowcaseItem {
  category: string;
  status: string;
  title: string;
  filledSegments: number;
  totalSegments: number;
  caption: string;
}

const SHOWCASE_PROGRESS_ITEMS: LiveStudyShowcaseItem[] = [
  {
    category: "Maîtrise du cours",
    status: "En cours",
    title: "Généralités — Infections & Transmission",
    filledSegments: 11,
    totalSegments: 16,
    caption: "11 objectifs validés sur 16 • Ancrage FSRS actif",
  },
  {
    category: "Simulateur d'Examen",
    status: "Chronométré",
    title: "Douleur thoracique aiguë & SCA",
    filledSegments: 14,
    totalSegments: 16,
    caption: "14 QCM réussis sur 16 • Précision 87%",
  },
  {
    category: "Arène & Flashcards",
    status: "Calibré",
    title: "Insuffisance Respiratoire Chronique",
    filledSegments: 12,
    totalSegments: 16,
    caption: "12 nœuds mémorisés sur 16 • Palier LV. 7",
  },
];

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Modes de la colonne gauche (Avant-dernière version conservée à 100%)
  const [mode, setMode] = useState<AuthMode>("signin");

  // Champs Connexion & Inscription complète
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+221 77 ");
  const [studyLevel, setStudyLevel] = useState("Licence 3");
  const [university, setUniversity] = useState(SENEGAL_UNIVERSITIES[0]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    localStorage.getItem("hippocampus_user_avatar_url")
  );

  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // États d'animation et de lumière pour le panneau droit
  const [lightPos, setLightPos] = useState({ x: 52, y: 34 });
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard", { replace: true });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate("/dashboard", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Rotation douce de la carte de progression en bas à droite toutes les 5.5s
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCardIdx((prev) => (prev + 1) % SHOWCASE_PROGRESS_ITEMS.length);
    }, 5500);
    return () => clearInterval(interval);
  }, []);

  const handleKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState("CapsLock"));
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setAvatarPreview(dataUrl);
        localStorage.setItem("hippocampus_user_avatar_url", dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "bg-border" };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

    const map: Record<number, { label: string; color: string }> = {
      1: { label: "Faible", color: "bg-destructive" },
      2: { label: "Moyen", color: "bg-amber-500" },
      3: { label: "Robuste", color: "bg-primary" },
      4: { label: "Excellent", color: "bg-emerald-600" },
    };
    return { score, ...(map[score] || { label: "Court", color: "bg-border" }) };
  }, [password]);

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setIsGoogleLoading(false);
      setErrorMessage(
        getErrorMessage(err, "") || "La connexion Google n'a pas pu être initialisée."
      );
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage(
        "Veuillez renseigner votre adresse e-mail et votre mot de passe."
      );
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        const meta = data.user.user_metadata || {};
        const currentLocal = getSavedStudentProfile();
        saveStudentProfile({
          ...currentLocal,
          email: data.user.email || email.trim(),
          fullName: meta.full_name || meta.name || currentLocal.fullName,
          phone: meta.phone || currentLocal.phone,
          studyLevel: meta.study_level || currentLocal.studyLevel,
          university: meta.university || currentLocal.university,
        });
        if (meta.avatar_url) {
          localStorage.setItem("hippocampus_user_avatar_url", meta.avatar_url);
        }
      }

      toast({
        title: "Connexion réussie",
        description: "Bienvenue dans votre Studio DawJang.",
      });
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const msg =
        getErrorMessage(err, "") === "Invalid login credentials"
          ? "Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe."
          : getErrorMessage(err, "") || "Erreur lors de la connexion.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage("Veuillez renseigner votre nom complet.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Veuillez saisir une adresse e-mail valide.");
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setErrorMessage("Veuillez renseigner votre numéro de téléphone.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Votre mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setIsLoading(true);
    try {
      const currentLocal = getSavedStudentProfile();
      saveStudentProfile({
        ...currentLocal,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        studyLevel,
        university,
      });

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            study_level: studyLevel,
            university,
            avatar_url: avatarPreview || undefined,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        toast({
          title: "Compte DawJang créé avec succès",
          description: `Bienvenue ${fullName.trim()} (${studyLevel}).`,
        });
        navigate("/dashboard", { replace: true });
      } else {
        toast({
          title: "Vérifiez votre boîte e-mail",
          description: `Un lien d'activation a été envoyé à ${email.trim()}.`,
        });
        setMode("signin");
      }
    } catch (err: unknown) {
      setErrorMessage(
        getErrorMessage(err, "") || "Une erreur est survenue lors de l'inscription."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email.trim()) {
      setErrorMessage("Saisissez votre adresse e-mail.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      setMagicLinkSent(true);
      toast({
        title: "Lien magique envoyé",
        description: `Consultez votre boîte mail (${email.trim()}).`,
      });
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err, "") || "Impossible d'envoyer le lien magique.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email.trim()) {
      setErrorMessage("Veuillez saisir votre adresse e-mail.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/settings`,
        }
      );
      if (error) throw error;
      setResetEmailSent(true);
      toast({
        title: "E-mail envoyé",
        description: "Suivez le lien reçu pour réinitialiser votre mot de passe.",
      });
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err, "") || "Erreur lors de l'envoi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowcaseMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setLightPos({ x, y });
  };

  const currentShowcase = SHOWCASE_PROGRESS_ITEMS[activeCardIdx];

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col lg:flex-row selection:bg-primary/15 selection:text-primary overflow-x-hidden">
      {/* Chorégraphies d'ouverture, d'éclairage et de balayage des 16 segments */}
      <style>{`
        @keyframes dawjangArtCurtain {
          from {
            clip-path: inset(0 0 100% 0);
            transform: scale(1.06);
          }
          to {
            clip-path: inset(0 0 0% 0);
            transform: scale(1);
          }
        }
        @keyframes dawjangRunnerFloat {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-8px) scale(1.015);
          }
        }
        @keyframes dawjangBlurredHalo {
          0%, 100% {
            transform: translate3d(24px, -10px, 0) scale(1.38) rotate(2deg);
            opacity: 0.14;
          }
          50% {
            transform: translate3d(40px, 8px, 0) scale(1.48) rotate(-1deg);
            opacity: 0.22;
          }
        }
        @keyframes dawjangSegmentsWipe {
          from {
            clip-path: inset(0 100% 0 0);
          }
          to {
            clip-path: inset(0 0 0 0);
          }
        }
        .dawjang-art-mask {
          -webkit-mask-image: linear-gradient(to bottom, #000 36%, rgba(0,0,0,0.65) 62%, transparent 88%);
          mask-image: linear-gradient(to bottom, #000 36%, rgba(0,0,0,0.65) 62%, transparent 88%);
          animation: dawjangArtCurtain 2.2s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .dawjang-runner-float {
          animation: dawjangRunnerFloat 5s ease-in-out infinite;
        }
        .dawjang-runner-echo {
          animation: dawjangBlurredHalo 7.5s ease-in-out infinite;
        }
        .dawjang-segments-wipe {
          animation: dawjangSegmentsWipe 1.05s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
      `}</style>

      {/* =====================================================================
          BANNIÈRE MOBILE SUPÉRIEURE (Adaptation mobile inspirée du modèle)
          S'affiche uniquement sur mobile/tablette (< 1024px)
         ===================================================================== */}
      <div className="lg:hidden relative h-[188px] w-full bg-[#151413] text-[#FAF8F5] overflow-hidden flex flex-col justify-between p-5 select-none">
        {/* Halos lumineux mobiles */}
        <div className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-primary/35 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-10 h-40 w-40 rounded-full bg-amber-500/15 blur-2xl" />

        {/* Le coureur hachuré en filigrane supérieur mobile */}
        <div className="pointer-events-none absolute inset-x-0 -top-6 h-[240px] flex justify-center opacity-35">
          <KineticHatchedRunnerArtwork className="h-full w-auto text-white" />
        </div>

        {/* En-tête mobile : Logo DawJang blanc + Thème */}
        <div className="relative z-10 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 focus:outline-none"
          >
            <DawJangDragonIcon className="h-8 w-8 text-white" />
            <div className="flex flex-col items-center">
              <DawJangWordmark
                size="sm"
                className="[&_span]:!text-white"
              />
              <span className="text-[9.5px] font-sans font-medium text-white/70 leading-none mt-0.5">
                Studio Académique
              </span>
            </div>
          </Link>

          <div className="rounded-xl bg-white/10 backdrop-blur-md p-0.5">
            <ThemeToggle />
          </div>
        </div>

        {/* Slogan mobile court avant le chevauchement de la carte */}
        <div className="relative z-10 pb-6">
          <p className="font-serif text-xl text-white leading-tight">
            Chaque réussite commence par un{" "}
            <em className="font-daw-scribble text-primary not-italic">
              objectif
            </em>
            .
          </p>
        </div>
      </div>

      {/* =====================================================================
          PARTIE GAUCHE : CONSOLE D'AUTHENTIFICATION (100% AVANT-DERNIÈRE VERSION)
          Sur mobile, remonte par-dessus la bannière avec coins arrondis (-mt-7)
         ===================================================================== */}
      <section className="relative z-20 flex-1 flex flex-col justify-between -mt-7 lg:mt-0 rounded-t-[28px] lg:rounded-none px-6 py-7 sm:px-12 lg:px-14 xl:px-20 lg:max-w-[560px] xl:max-w-[620px] bg-card lg:bg-card/85 backdrop-blur-md shadow-[0_-10px_30px_rgba(0,0,0,0.08)] lg:shadow-none">
        {/* En-tête Desktop : Logo Dragon "D" + DawJang + Thème (masqué sur mobile car déjà dans la bannière) */}
        <div className="hidden lg:flex items-center justify-between">
          <Link
            to="/"
            className="group/brand inline-flex items-center gap-2.5 focus:outline-none"
          >
            <DawJangDragonIcon className="h-9 w-9 text-foreground transition-transform duration-300 group-hover/brand:scale-105" />
            <div className="flex flex-col items-center">
              <DawJangWordmark size="md" />
              <span className="text-[10px] font-sans font-medium text-muted-foreground leading-none mt-0.5">
                Studio Académique
              </span>
            </div>
          </Link>

          <ThemeToggle />
        </div>

        {/* Formulaire Central (Strictement identique à l'avant-dernière version) */}
        <div className="w-full max-w-[430px] mx-auto my-4 lg:my-8 space-y-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.09em] text-primary font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                {mode === "signin"
                  ? "Portail d'accès sécurisé"
                  : mode === "signup"
                  ? "Création de profil étudiant complet"
                  : mode === "magic"
                  ? "Accès rapide sans mot de passe"
                  : "Récupération d'accès"}
              </span>
            </div>

            <h1 className="font-serif text-3xl sm:text-[34px] font-normal text-foreground tracking-tight leading-[1.12]">
              {mode === "signin"
                ? "Bon retour dans votre studio."
                : mode === "signup"
                ? "Rejoignez l'élite DawJang."
                : mode === "magic"
                ? "Connexion par Lien Magique."
                : "Réinitialiser votre accès."}
            </h1>

            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {mode === "signin"
                ? "Accédez à votre bibliothèque de cours, vos QCM, vos flashcards calibrées et l'arène des duels."
                : mode === "signup"
                ? "Renseignez votre profil complet (photo, téléphone, année d'études et faculté) pour calibrer votre studio."
                : mode === "magic"
                ? "Recevez un lien unique par e-mail pour ouvrir votre session en un clic."
                : "Indiquez votre adresse e-mail pour définir un nouveau mot de passe."}
            </p>
          </div>

          {/* Sélecteur d'onglets (Connexion | Inscription | Lien Magique) */}
          {mode !== "reset" && (
            <div className="grid grid-cols-3 rounded-xl border border-border bg-secondary/75 p-1">
              {[
                { id: "signin" as const, label: "Connexion" },
                { id: "signup" as const, label: "Inscription" },
                { id: "magic" as const, label: "Lien Magique" },
              ].map((tab) => {
                const active = mode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setMode(tab.id);
                      setErrorMessage(null);
                      setMagicLinkSent(false);
                    }}
                    className={cn(
                      "rounded-lg py-2 text-[12.5px] font-medium transition-all duration-200",
                      active
                        ? "bg-card text-foreground font-semibold shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Alerte d'erreur */}
          {errorMessage && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/[0.08] p-3 flex items-start gap-2.5 text-[12.5px] text-destructive animate-in fade-in duration-150">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Bouton Google OAuth */}
          {(mode === "signin" || mode === "signup") && (
            <div className="space-y-3.5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isLoading}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-border bg-background hover:bg-secondary/60 hover:border-foreground/30 h-10 px-4 text-[13px] font-semibold text-foreground transition-all duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              >
                {isGoogleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <GoogleOfficialIcon className="h-4 w-4" />
                )}
                <span>Continuer avec Google</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-border/80 w-full" />
                <span className="bg-card px-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                  ou par e-mail
                </span>
                <div className="border-t border-border/80 w-full" />
              </div>
            </div>
          )}

          {/* ONGLET 1 : CONNEXION */}
          {mode === "signin" && (
            <form
              onSubmit={handleSignIn}
              className="space-y-4 animate-in fade-in duration-150"
            >
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  Adresse e-mail
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom.nom@ucad.edu.sn"
                  autoComplete="email"
                  className="h-10 text-[13.5px]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-primary" />
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setErrorMessage(null);
                      setResetEmailSent(false);
                    }}
                    className="text-[11.5px] font-medium text-primary hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>

                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={handleKeyEvent}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="h-10 pr-10 text-[13.5px]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {capsLockActive && (
                  <p className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                    ⚠ Touche Verr. Maj activée
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-xl text-[13.5px] font-semibold shadow-sm mt-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Connexion en cours…</span>
                  </>
                ) : (
                  <>
                    <span>Accéder à mon espace DawJang</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* ONGLET 2 : INSCRIPTION COMPLÈTE */}
          {mode === "signup" && (
            <form
              onSubmit={handleCompleteSignUp}
              className="space-y-3.5 animate-in fade-in duration-150"
            >
              <div className="flex items-center gap-3.5 rounded-xl border border-border/80 bg-background/50 p-2.5">
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className="group relative h-12 w-12 shrink-0 cursor-pointer rounded-xl border border-dashed border-primary/50 bg-secondary/70 hover:border-primary flex items-center justify-center overflow-hidden transition-all"
                  title="Ajouter une photo de profil"
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Aperçu profil"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Camera className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                  )}
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>

                <div className="flex-1 space-y-1">
                  <label className="text-[11.5px] font-medium text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3 text-primary" /> Nom complet
                    </span>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="text-[10.5px] text-primary hover:underline font-mono"
                    >
                      {avatarPreview ? "Changer photo" : "+ Photo de profil"}
                    </button>
                  </label>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Talla Thiam"
                    className="h-9 text-[13px]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11.5px] font-medium text-foreground flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-primary" />
                    Adresse e-mail
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="etudiant@ucad.edu.sn"
                    className="h-9 text-[13px]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11.5px] font-medium text-foreground flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-primary" />
                    Numéro de téléphone
                  </label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+221 77 123 45 67"
                    className="h-9 text-[13px]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11.5px] font-medium text-foreground flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-primary" />
                    Niveau / Année d'études
                  </label>
                  <select
                    value={studyLevel}
                    onChange={(e) => setStudyLevel(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border bg-card px-2.5 text-[12.5px] font-semibold text-foreground focus:outline-none focus:border-primary"
                  >
                    {SENEGAL_STUDY_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11.5px] font-medium text-foreground flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-primary" />
                    Université / Faculté
                  </label>
                  <select
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border bg-card px-2.5 text-[12px] text-foreground focus:outline-none focus:border-primary"
                  >
                    {SENEGAL_UNIVERSITIES.map((uni) => (
                      <option key={uni} value={uni}>
                        {uni.split("—")[0].trim()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11.5px] font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-primary" />
                  Mot de passe
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 caractères…"
                    className="h-9 pr-10 text-[13px]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {password.length > 0 && (
                  <div className="pt-1 space-y-1">
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map((bar) => (
                        <div
                          key={bar}
                          className={cn(
                            "h-1 rounded-full transition-colors duration-200",
                            passwordStrength.score >= bar
                              ? passwordStrength.color
                              : "bg-secondary"
                          )}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                      <span>Robustesse</span>
                      <span className="font-semibold text-foreground">
                        {passwordStrength.label}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 rounded-xl text-[13.5px] font-semibold shadow-sm mt-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Création du profil…</span>
                  </>
                ) : (
                  <>
                    <span>Créer mon compte DawJang</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* ONGLET 3 : LIEN MAGIQUE */}
          {mode === "magic" && (
            <div className="animate-in fade-in duration-150">
              {magicLinkSent ? (
                <div className="rounded-2xl border border-primary/40 bg-primary/[0.06] p-5 text-center space-y-3">
                  <CheckCircle2 className="h-7 w-7 text-primary mx-auto" />
                  <h3 className="text-[15.5px] font-semibold text-foreground">
                    Lien magique envoyé !
                  </h3>
                  <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                    Cliquez sur le lien reçu dans{" "}
                    <strong className="text-foreground">{email}</strong> pour ouvrir directement votre studio.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMagicLinkSent(false)}
                  >
                    Utiliser une autre adresse
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSendMagicLink} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                      <Wand2 className="h-3.5 w-3.5 text-primary" />
                      Votre adresse e-mail
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="prenom.nom@ucad.edu.sn"
                      className="h-10 text-[13.5px]"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl text-[13.5px] font-semibold"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        <span>Recevoir mon lien de connexion</span>
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* ONGLET 4 : RÉINITIALISATION DU MOT DE PASSE */}
          {mode === "reset" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {resetEmailSent ? (
                <div className="rounded-2xl border border-primary/40 bg-primary/[0.06] p-5 text-center space-y-3">
                  <CheckCircle2 className="h-7 w-7 text-primary mx-auto" />
                  <h3 className="text-[15px] font-semibold text-foreground">
                    Lien de récupération envoyé
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMode("signin")}
                  >
                    Retour à la connexion
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-primary" />
                      Adresse e-mail du compte
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="prenom.nom@ucad.edu.sn"
                      className="h-10 text-[13.5px]"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setMode("signin")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Retour</span>
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 h-10 rounded-xl font-semibold"
                    >
                      Envoyer le lien
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Pied de colonne gauche */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted-foreground border-t border-border/60 pt-4">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Chiffrement de bout en bout • Sauvegarde Cloud & Locale
          </span>
          <span className="font-mono text-[11px]">DawJang © 2026</span>
        </div>
      </section>

      {/* =====================================================================
          PARTIE DROITE : MONOLITHE ARTISTIQUE DAWJANG
          (Disposition inspirée de la maquette : Coureur masqué en fondu +
           Écho flouté lumineux + Section messages & Carte à 16 segments animés)
         ===================================================================== */}
      <aside
        onMouseMove={handleShowcaseMouseMove}
        className="hidden lg:flex relative flex-[1.15_1_0%] min-w-0 flex-col justify-end gap-4 m-3.5 ml-0 p-10 xl:p-14 overflow-hidden rounded-[28px] bg-[#141312] text-[#FAF8F5] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.35)] select-none"
      >
        {/* 1. Faisceau lumineux interactif suivant le curseur + Halos de profondeur */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(620px circle at ${lightPos.x}% ${lightPos.y}%, rgba(201, 100, 66, 0.24), transparent 68%)`,
          }}
        />
        <div className="pointer-events-none absolute -top-28 -right-20 h-[480px] w-[480px] rounded-full bg-primary/25 blur-[110px]" />
        <div className="pointer-events-none absolute top-1/4 -left-24 h-[380px] w-[380px] rounded-full bg-amber-500/10 blur-[95px]" />

        {/* 2. AGRANDISSEMENT FLOUTÉ LATÉRAL (Jeu d'optique et de lumière en arrière-plan) */}
        <div className="pointer-events-none absolute -right-24 -top-12 h-[92%] w-[540px] filter blur-[6px] dawjang-runner-echo">
          <KineticHatchedRunnerArtwork className="w-full h-full text-primary" />
        </div>

        {/* 3. LE COUREUR HACHURÉ PRINCIPAL EN FONDU VERTICAL (.dawjang-art-mask) */}
        <div className="pointer-events-none absolute inset-0 flex justify-center items-start pt-4 dawjang-art-mask">
          <div className="dawjang-runner-float h-[88%] flex justify-center">
            <KineticHatchedRunnerArtwork className="h-full w-auto text-[#FAF8F5] opacity-[0.42] drop-shadow-[0_18px_40px_rgba(201,100,66,0.28)]" />
          </div>
        </div>

        {/* Badge supérieur discret en haut du monolithe */}
        <div className="relative z-10 mb-auto flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md px-3.5 py-1.5 font-mono text-[11px] font-medium text-white/85">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            Studio DawJang • L1 à Doctorat
          </span>

          {/* Sélecteur discret pour tester les 3 cartes de progression */}
          <div className="flex items-center gap-1.5">
            {SHOWCASE_PROGRESS_ITEMS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveCardIdx(idx)}
                aria-label={`Aperçu ${idx + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  activeCardIdx === idx
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-white/25 hover:bg-white/50"
                )}
              />
            ))}
          </div>
        </div>

        {/* 4. SECTION DES MESSAGES ÉDITORIAUX (Inspirée de la disposition de référence) */}
        <div className="relative z-10 space-y-3 max-w-[560px]">
          <h2 className="font-serif text-[38px] xl:text-[50px] font-normal leading-[1.06] tracking-[-0.01em] text-white">
            Chaque réussite commence par un{" "}
            <em className="font-daw-scribble text-primary not-italic">
              objectif
            </em>
            .
          </h2>
          <p className="text-[15.5px] text-white/80 max-w-[450px] leading-relaxed">
            Du premier cours importé jusqu'au jour de l'examen, objectif par
            objectif, sans jamais perdre le fil.
          </p>
        </div>

        {/* 5. CARTE BLANCHE DE PROGRESSION À 16 SEGMENTS ANIMÉS */}
        <div
          key={currentShowcase.title}
          onClick={() =>
            setActiveCardIdx(
              (prev) => (prev + 1) % SHOWCASE_PROGRESS_ITEMS.length
            )
          }
          title="Cliquez pour faire défiler vos modules"
          className="relative z-10 max-w-[430px] mt-2 rounded-[18px] bg-[#FAF8F5] text-[#141413] p-[18px_20px] shadow-[0_20px_48px_-12px_rgba(0,0,0,0.45)] border border-white/20 cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
        >
          {/* En-tête de la carte : Catégorie + Pastille de statut */}
          <div className="flex items-center justify-between text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#5E5D59]">
            <span>{currentShowcase.category}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6E7C8] px-2.5 py-0.5 text-[11.5px] font-semibold normal-case tracking-normal text-[#8A5A00]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8A5A00]" />
              {currentShowcase.status}
            </span>
          </div>

          {/* Titre du cours/module en Serif */}
          <strong className="block font-serif text-[22px] font-normal leading-[1.2] text-[#141413] my-2">
            {currentShowcase.title}
          </strong>

          {/* Jauge de 16 bâtonnets groupés en 4 paliers (espacements aux 5e, 10e et 14e bâtonnets) */}
          <div className="relative flex gap-[2.5px] mt-3">
            {Array.from({ length: 16 }).map((_, i) => (
              <i
                key={`bg-${i}`}
                className={cn(
                  "flex-1 h-[18px] rounded-[3px] bg-[#E5E2DC]",
                  (i === 4 || i === 9 || i === 13) && "ml-1.5"
                )}
              />
            ))}

            {/* Couche de remplissage animée par balayage (dawjang-segments-wipe) */}
            <div className="dawjang-segments-wipe absolute inset-0 flex gap-[2.5px]">
              {Array.from({ length: 16 }).map((_, i) => (
                <i
                  key={`fill-${i}`}
                  className={cn(
                    "flex-1 h-[18px] rounded-[3px] transition-colors",
                    (i === 4 || i === 9 || i === 13) && "ml-1.5",
                    i < currentShowcase.filledSegments
                      ? "bg-[#C96442]"
                      : "bg-transparent"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Légende inférieure */}
          <small className="block mt-2.5 text-[12.5px] font-medium text-[#5E5D59]">
            {currentShowcase.caption}
          </small>
        </div>
      </aside>
    </div>
  );
}
