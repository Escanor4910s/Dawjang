import { Button } from "@/components/ui/button";
import { Share2, Twitter, Facebook, Linkedin, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ShareResultsProps {
  score: number;
  total: number;
  title: string;
}

export const ShareResults = ({ score, total, title }: ShareResultsProps) => {
  const [copied, setCopied] = useState(false);
  const pct = Math.round((score / total) * 100);
  
  const shareText = `🩺 J'ai obtenu ${pct}% (${score}/${total}) sur "${title}" avec Hippocampus ! 🧠\n\nRejoins la communauté médicale sur`;
  const shareUrl = "https://hipocampus2026.lovable.app";
  const fullText = `${shareText} ${shareUrl}`;

  const shareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}`, "_blank");
  };

  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, "_blank");
  };

  const shareLinkedin = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, "_blank");
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, "_blank");
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Copié dans le presse-papier !");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Share2 className="h-4 w-4" /> Partager ton résultat
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={shareTwitter}>
          <Twitter className="h-4 w-4 mr-1" /> Twitter
        </Button>
        <Button variant="outline" size="sm" onClick={shareFacebook}>
          <Facebook className="h-4 w-4 mr-1" /> Facebook
        </Button>
        <Button variant="outline" size="sm" onClick={shareLinkedin}>
          <Linkedin className="h-4 w-4 mr-1" /> LinkedIn
        </Button>
        <Button variant="outline" size="sm" onClick={shareWhatsApp}>
          📱 WhatsApp
        </Button>
        <Button variant="outline" size="sm" onClick={copyToClipboard}>
          {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
          {copied ? "Copié" : "Copier"}
        </Button>
      </div>
    </div>
  );
};
