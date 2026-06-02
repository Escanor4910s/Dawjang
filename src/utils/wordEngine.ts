import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { parseHierarchicalSummary } from "./pdfEngine";

const parseFormattedText = (rawText: string): TextRun[] => {
  const parts = rawText.split(/(\*\*.*?\*\*)/g);
  return parts.map((part) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return new TextRun({ text: part.slice(2, -2), bold: true });
    }
    return new TextRun({ text: part });
  });
};

export const exportSummaryToWord = async (title: string, rawContent: string) => {
  const toastId = toast.loading("Génération du document Word...", {
    description: "Formatage en cours..."
  });

  try {
    const cleanText = rawContent
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u00A0\u200B\u202F\uFEFF]/g, " ");

    const roots = parseHierarchicalSummary(cleanText);
    const children: any[] = [];

    // Titre principal
    children.push(
      new Paragraph({
        text: title.toUpperCase(),
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    const writeParagraphs = (content: string[]) => {
      content.forEach(line => {
        const isBullet = /^[\-\*]\s/.test(line);
        let rawText = isBullet ? line.substring(1).trim() : line;
        
        children.push(
          new Paragraph({
            children: parseFormattedText(rawText),
            bullet: isBullet ? { level: 0 } : undefined,
            spacing: { after: 120 }
          })
        );
      });
    };

    roots.forEach((h1, i) => {
       children.push(
         new Paragraph({
           text: `${i+1}. ${h1.title}`,
           heading: HeadingLevel.HEADING_2,
           spacing: { before: 400, after: 200 }
         })
       );

       if (h1.content.length > 0) {
           writeParagraphs(h1.content);
       }

       h1.children.forEach((h2, j) => {
          children.push(
            new Paragraph({
              text: `${j+1}. ${h2.title}`,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 300, after: 150 }
            })
          );

          if (h2.content.length > 0) {
             writeParagraphs(h2.content);
          }

          h2.children.forEach((h3, k) => {
              children.push(
                new Paragraph({
                  text: `${String.fromCharCode(64 + k + 1)}. ${h3.title}`,
                  heading: HeadingLevel.HEADING_4,
                  spacing: { before: 200, after: 100 }
                })
              );

              if (h3.content.length > 0) {
                 writeParagraphs(h3.content);
              }
          });
       });
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    const safeFileName = title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    saveAs(blob, `Hippocampus_${safeFileName}.docx`);

    toast.success("Document exporté avec succès.", {
      id: toastId,
      description: "Le fichier Word a été téléchargé."
    });
  } catch (error) {
    console.error("Erreur Word :", error);
    toast.error("Échec de la génération Word.", { id: toastId });
  }
};

export const exportQuizToWord = async (quizData: { title: string, questions: any[] }) => {
  const toastId = toast.loading("Génération du QCM au format Word...");

  try {
    const children: any[] = [];

    children.push(
      new Paragraph({
        text: quizData.title.toUpperCase(),
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    quizData.questions.forEach((q, index) => {
      // Question
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Question ${index + 1} : `, bold: true }), new TextRun({ text: q.question })],
          spacing: { before: 300, after: 150 }
        })
      );

      // Options
      q.options.forEach((opt: string, optIndex: number) => {
        children.push(
          new Paragraph({
            text: `${String.fromCharCode(65 + optIndex)}. ${opt}`,
            bullet: { level: 0 },
            spacing: { after: 80 }
          })
        );
      });

      // Explication
      if (q.explanation) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Explication : ", bold: true, color: "5B21B6" }),
              new TextRun({ text: q.explanation })
            ],
            spacing: { before: 150, after: 200 }
          })
        );
      }
    });

    const doc = new Document({
      sections: [{ properties: {}, children: children }],
    });

    const blob = await Packer.toBlob(doc);
    const safeFileName = quizData.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    saveAs(blob, `QCM_${safeFileName}.docx`);

    toast.success("QCM exporté avec succès.", { id: toastId });
  } catch (error) {
    console.error("Erreur Word :", error);
    toast.error("Échec de l'export Word.", { id: toastId });
  }
};
