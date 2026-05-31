import jsPDF from "jspdf";
import { toast } from "sonner";

export interface SummaryNode {
  title: string;
  level: number;
  content: string[];
  children: SummaryNode[];
}

const cleanTitle = (t: string) => {
    return t.replace(/^(?:Objectif\s+\d+\s*[:\-]?\s*|[IVXLC]+[\.\-\)]\s*|\d+[\.\-\)]\s*|[A-Z][\.\-\)]\s*)/i, "").trim();
};

const toRoman = (num: number) => {
  const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV"];
  return roman[num] || num.toString();
}

const toChar = (num: number) => {
  return String.fromCharCode(64 + num); // 1->A, 2->B
}

const parseHierarchicalSummary = (text: string): SummaryNode[] => {
  const roots: SummaryNode[] = [];
  let currentH1: SummaryNode | null = null;
  let currentH2: SummaryNode | null = null;
  let currentH3: SummaryNode | null = null;

  let defaultNode: SummaryNode = { title: "Généralités", level: 1, content: [], children: [] };
  let startedWithHeader = false;

  const lines = text.split('\n');

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let level = 0;
    let title = "";

    if (trimmed.startsWith("### ")) { level = 3; title = trimmed.substring(4).trim(); }
    else if (trimmed.startsWith("## ")) { level = 2; title = trimmed.substring(3).trim(); }
    else if (trimmed.startsWith("# ")) { level = 1; title = trimmed.substring(2).trim(); }
    else if (trimmed.match(/^===\s*(.+?)\s*===$/)) {
      level = 1;
      title = trimmed.match(/^===\s*(.+?)\s*===$/)![1];
    }
    else if (trimmed.match(/^--\s*(.+?)\s*--$/)) {
      level = 2;
      title = trimmed.match(/^--\s*(.+?)\s*--$/)![1];
    }

    if (level === 1) {
       currentH1 = { title, level: 1, content: [], children: [] };
       roots.push(currentH1);
       currentH2 = null;
       currentH3 = null;
       startedWithHeader = true;
    } else if (level === 2) {
       currentH2 = { title, level: 2, content: [], children: [] };
       if (currentH1) currentH1.children.push(currentH2);
       else {
          currentH1 = { title: "Section Principale", level: 1, content: [], children: [currentH2] };
          roots.push(currentH1);
       }
       currentH3 = null;
       startedWithHeader = true;
    } else if (level === 3) {
       currentH3 = { title, level: 3, content: [], children: [] };
       if (currentH2) currentH2.children.push(currentH3);
       else if (currentH1) currentH1.children.push(currentH3);
       else {
          currentH2 = { title: "Sous-section", level: 2, content: [], children: [currentH3] };
          currentH1 = { title: "Section Principale", level: 1, content: [], children: [currentH2] };
          roots.push(currentH1);
       }
       startedWithHeader = true;
    } else {
       if (currentH3) currentH3.content.push(trimmed);
       else if (currentH2) currentH2.content.push(trimmed);
       else if (currentH1) currentH1.content.push(trimmed);
       else {
          if (!startedWithHeader) defaultNode.content.push(trimmed);
          else {
             if(roots.length > 0) roots[roots.length - 1].content.push(trimmed);
          }
       }
    }
  });

  if (!startedWithHeader && defaultNode.content.length > 0) roots.push(defaultNode);
  else if (startedWithHeader && defaultNode.content.length > 0) roots.unshift(defaultNode);

  return roots;
};

export const exportCanvaStylePDF = async (title: string, rawContent: string) => {
  toast.loading("Génération du document Masterclass...", { id: "pdf-toast" });

  try {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const marginX = 15;
    let cursorY = 15;

    const cleanText = rawContent
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u00A0\u200B\u202F\uFEFF]/g, " ");

    const roots = parseHierarchicalSummary(cleanText);

    // ─── HEADER GÉNÉRAL ───
    pdf.setFillColor(245, 158, 11); // Amber 500
    pdf.rect(0, 0, pageW, 30, "F");
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`FICHE DE REVISION : ${title.toUpperCase()}`, pageW / 2, 18, { align: "center" });
    
    cursorY = 40;
    
    const writeParagraphs = (content: string[], indentX: number, contentWidth: number, baseSize: number = 10) => {
      pdf.setFontSize(baseSize);
      content.forEach(line => {
        const isBullet = /^[\-\*]\s/.test(line);
        let rawText = isBullet ? line.substring(1).trim() : line;
        
        const isBold = rawText.startsWith("**") && rawText.endsWith("**");
        rawText = rawText.replace(/\*\*/g, "");

        pdf.setFont("helvetica", isBold ? "bold" : "normal");
        
        const textX = isBullet ? indentX + 5 : indentX;
        const bulletWidth = isBullet ? 5 : 0;
        const splitLines = pdf.splitTextToSize(rawText, contentWidth - bulletWidth);
        
        if (cursorY + (splitLines.length * 5) > pageH - 15) {
            pdf.addPage();
            cursorY = 20;
        }

        for (let j = 0; j < splitLines.length; j++) {
          if (j === 0 && isBullet) {
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(245, 158, 11);
            pdf.text("•", indentX, cursorY);
            pdf.setFont("helvetica", isBold ? "bold" : "normal");
            pdf.setTextColor(40, 40, 40);
          }
          pdf.text(splitLines[j], textX, cursorY);
          cursorY += 5;
        }
        cursorY += 2;
      });
    };

    roots.forEach((h1, i) => {
       if (cursorY + 20 > pageH - 15) { pdf.addPage(); cursorY = 20; }
       
       pdf.setFillColor(254, 243, 199); 
       pdf.rect(marginX, cursorY, pageW - 2*marginX, 12, "F");
       pdf.setDrawColor(245, 158, 11); 
       pdf.setLineWidth(1.5);
       pdf.line(marginX, cursorY, marginX, cursorY + 12);
       
       pdf.setFont("helvetica", "bold");
       pdf.setFontSize(14);
       pdf.setTextColor(17, 17, 17);
       pdf.text(`${toRoman(i+1)}. ${cleanTitle(h1.title).toUpperCase()}`, marginX + 5, cursorY + 8);
       
       cursorY += 18;

       if (h1.content.length > 0) {
           pdf.setTextColor(60, 60, 60);
           writeParagraphs(h1.content, marginX + 5, pageW - 2*marginX - 5);
           cursorY += 5;
       }

       h1.children.forEach((h2, j) => {
          if (cursorY + 15 > pageH - 15) { pdf.addPage(); cursorY = 20; }

          const h2IndentX = marginX + 10;
          const h2Width = pageW - marginX - h2IndentX;

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(12);
          pdf.setTextColor(245, 158, 11); 
          pdf.text(`${j+1}.`, h2IndentX, cursorY);
          pdf.setTextColor(17, 17, 17);
          pdf.text(cleanTitle(h2.title), h2IndentX + 6, cursorY);
          
          cursorY += 7;

          if (h2.content.length > 0) {
             pdf.setTextColor(60, 60, 60);
             writeParagraphs(h2.content, h2IndentX + 6, h2Width - 6);
             cursorY += 3;
          }

          h2.children.forEach((h3, k) => {
              if (cursorY + 10 > pageH - 15) { pdf.addPage(); cursorY = 20; }
              
              const h3IndentX = h2IndentX + 6;
              const h3Width = pageW - marginX - h3IndentX;

              pdf.setFont("helvetica", "bold");
              pdf.setFontSize(11);
              pdf.setTextColor(100, 100, 100);
              pdf.text(`${toChar(k+1)}.`, h3IndentX, cursorY);
              pdf.setTextColor(30, 30, 30);
              pdf.text(cleanTitle(h3.title), h3IndentX + 6, cursorY);
              
              cursorY += 6;

              if (h3.content.length > 0) {
                 pdf.setTextColor(80, 80, 80);
                 writeParagraphs(h3.content, h3IndentX + 6, h3Width - 6);
              }
              cursorY += 2;
          });

          cursorY += 5;
       });
       cursorY += 8;
    });

    const safeFileName = title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    pdf.save(`Masterclass_${safeFileName}.pdf`);
    toast.success("Document formaté et exporté avec succès !", { id: "pdf-toast" });

  } catch (error) {
    console.error(error);
    toast.error("Erreur lors de la génération du PDF.", { id: "pdf-toast" });
  }
};
