import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MoreHorizontal,
  PenTool,
  Copy,
  FilePlus2,
  Download,
  FileText,
  Trash2,
  HelpCircle,
} from 'lucide-react';

// ============================================================================
// 1. COMPOSANT TOOLTIP (?) EXPLICATIF 100% THÈME NATIF
// ============================================================================
export const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center w-4 h-4 ml-1.5 rounded-full bg-muted text-muted-foreground hover:bg-primary/15 hover:text-primary transition-colors cursor-pointer select-none"
            aria-label="Aide"
          >
            <HelpCircle className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs leading-relaxed bg-popover text-popover-foreground border border-border shadow-lg p-3 rounded-xl z-50"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ============================================================================
// 2. MENU CONTEXTUEL (...) VIA RADIX PORTAL AVEC MODAL={FALSE}
// Pas de floutage, pas d'assombrissement, aucune découpe par overflow
// ============================================================================
export interface FloatingThreeDotsMenuProps {
  onOpenEditor?: () => void;
  onCopy?: () => void;
  onDuplicate?: () => void;
  onDownloadPDF?: () => void;
  onDownloadWord?: () => void;
  onDelete?: () => void;
  openLabel?: string;
  className?: string;
}

export const FloatingThreeDotsMenu: React.FC<FloatingThreeDotsMenuProps> = ({
  onOpenEditor,
  onCopy,
  onDuplicate,
  onDownloadPDF,
  onDownloadWord,
  onDelete,
  openLabel = "Ouvrir dans l’Éditeur",
  className = "",
}) => {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
          }}
          className={`h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 transition-all ${className}`}
          title="Options"
          aria-label="Options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
        className="w-52 rounded-xl bg-popover text-popover-foreground border border-border shadow-xl p-1.5 z-[100]"
      >
        {onOpenEditor && (
          <DropdownMenuItem
            onClick={onOpenEditor}
            className="rounded-lg text-xs font-medium cursor-pointer flex items-center gap-2.5 py-2 text-primary focus:text-primary"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>{openLabel}</span>
          </DropdownMenuItem>
        )}
        {onCopy && (
          <DropdownMenuItem
            onClick={onCopy}
            className="rounded-lg text-xs font-medium cursor-pointer flex items-center gap-2.5 py-2"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copier le contenu</span>
          </DropdownMenuItem>
        )}
        {onDuplicate && (
          <DropdownMenuItem
            onClick={onDuplicate}
            className="rounded-lg text-xs font-medium cursor-pointer flex items-center gap-2.5 py-2"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Dupliquer</span>
          </DropdownMenuItem>
        )}
        {(onDownloadPDF || onDownloadWord) && <DropdownMenuSeparator className="my-1 bg-border" />}
        {onDownloadPDF && (
          <DropdownMenuItem
            onClick={onDownloadPDF}
            className="rounded-lg text-xs font-medium cursor-pointer flex items-center gap-2.5 py-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Télécharger (PDF)</span>
          </DropdownMenuItem>
        )}
        {onDownloadWord && (
          <DropdownMenuItem
            onClick={onDownloadWord}
            className="rounded-lg text-xs font-medium cursor-pointer flex items-center gap-2.5 py-2"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Exporter Word (.docx)</span>
          </DropdownMenuItem>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator className="my-1 bg-border" />
            <DropdownMenuItem
              onClick={onDelete}
              className="rounded-lg text-xs font-medium cursor-pointer flex items-center gap-2.5 py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
