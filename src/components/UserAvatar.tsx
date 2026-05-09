import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { User as UserIcon, LogOut, FileText, Settings, LayoutDashboard, Plus, RotateCcw, CreditCard as FlashcardIcon, Users, History, CreditCard } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserAvatarProps {
  user: User | null;
}

const UserAvatar = ({ user }: UserAvatarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de se déconnecter",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Déconnexion réussie",
        description: "À bientôt !",
      });
      navigate("/auth");
    }
  };

  const getInitials = (email?: string) => {
    if (!email) return "U";
    return email.charAt(0).toUpperCase();
  };

  if (!user) {
    return (
      <Link to="/auth">
        <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-smooth cursor-pointer">
          <Avatar className="h-8 w-8 border-2 border-primary/20">
            <AvatarFallback className="bg-muted text-muted-foreground">
              <UserIcon className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start">
            <span className="text-sm font-medium text-foreground">Se connecter</span>
            <Badge variant="outline" className="text-xs px-1 py-0">
              Hors ligne
            </Badge>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-smooth cursor-pointer">
          <Avatar className="h-8 w-8 border-2 border-primary">
            <AvatarImage src={user.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {getInitials(user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start">
            <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
              {user.email?.split("@")[0]}
            </span>
            <Badge variant="default" className="text-xs px-1 py-0 bg-success">
              Connecté
            </Badge>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover border-border z-50">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium text-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">Compte utilisateur</p>
        </div>
        <DropdownMenuSeparator />
        
        {/* Navigation principale */}
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/dashboard" className="flex items-center space-x-2">
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/add-course" className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Ajouter un cours</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/review" className="flex items-center space-x-2">
            <RotateCcw className="h-4 w-4" />
            <span>Révision</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/flashcards" className="flex items-center space-x-2">
            <FlashcardIcon className="h-4 w-4" />
            <span>Flashcards</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/community" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Communauté</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Mes contenus */}
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/quiz-library" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Mes QCM</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center space-x-2 cursor-pointer">
          <History className="h-4 w-4" />
          <span>Historique</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center space-x-2 cursor-pointer">
          <CreditCard className="h-4 w-4" />
          <span>Mon abonnement</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Paramètres */}
        <DropdownMenuItem className="flex items-center space-x-2 cursor-pointer">
          <Settings className="h-4 w-4" />
          <span>Paramètres</span>
        </DropdownMenuItem>
        <div className="px-2 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm">Thème</span>
            <ThemeToggle />
          </div>
        </div>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={handleLogout}
          className="flex items-center space-x-2 cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span>Se déconnecter</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserAvatar;
