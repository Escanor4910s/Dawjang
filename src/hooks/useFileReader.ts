import { useState } from 'react';
import * as pdfjs from 'pdfjs-dist';

// Configuration de pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FileReaderResult {
  content: string;
  success: boolean;
  error?: string;
}

export const useFileReader = () => {
  const [isReading, setIsReading] = useState(false);

  const readFile = async (file: File): Promise<FileReaderResult> => {
    setIsReading(true);
    
    try {
      let content = '';
      
      if (file.type === 'application/pdf') {
        // Lecture PDF avec pdfjs
        content = await readPDF(file);
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        // Lecture fichier texte
        content = await readTextFile(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.docx')
      ) {
        // Pour les fichiers Word, on essaie de les lire comme du texte
        content = await readTextFile(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        file.type === 'application/vnd.ms-powerpoint' ||
        file.name.endsWith('.pptx') ||
        file.name.endsWith('.ppt')
      ) {
        // Lecture PowerPoint
        content = await readPowerPoint(file);
      } else {
        throw new Error(`Type de fichier non supporté: ${file.type}`);
      }

      if (!content.trim()) {
        throw new Error('Le fichier semble vide ou le contenu n\'a pas pu être extrait');
      }

      return {
        content: content.trim(),
        success: true
      };

    } catch (error) {
      console.error('Erreur lors de la lecture du fichier:', error);
      return {
        content: '',
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    } finally {
      setIsReading(false);
    }
  };

  const readPDF = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      
      fileReader.onload = async function() {
        try {
          const typedArray = new Uint8Array(this.result as ArrayBuffer);
          
          // Charger le document PDF
          const pdf = await pdfjs.getDocument({
            data: typedArray,
            verbosity: 0, // Réduire les logs
            cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
            cMapPacked: true,
          }).promise;
          
          let fullText = '';
          
          // Extraire le texte de chaque page
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            const pageText = textContent.items
              .filter((item: any) => item.str && item.str.trim())
              .map((item: any) => item.str)
              .join(' ')
              .replace(/\s+/g, ' ');
            
            if (pageText.trim()) {
              fullText += pageText + '\n\n';
            }
          }
          
          if (!fullText.trim()) {
            reject(new Error('Aucun texte n\'a pu être extrait du PDF. Le fichier contient peut-être seulement des images.'));
          } else {
            resolve(fullText.trim());
          }
          
        } catch (error) {
          console.error('PDF parsing error:', error);
          reject(new Error(`Erreur lors de la lecture du PDF: ${error instanceof Error ? error.message : 'Erreur inconnue'}`));
        }
      };
      
      fileReader.onerror = () => {
        reject(new Error('Erreur lors de la lecture du fichier'));
      };
      
      fileReader.readAsArrayBuffer(file);
    });
  };

  const readTextFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      
      fileReader.onload = function() {
        const text = this.result as string;
        if (!text.trim()) {
          reject(new Error('Le fichier texte est vide'));
        } else {
          resolve(text);
        }
      };
      
      fileReader.onerror = () => {
        reject(new Error('Erreur lors de la lecture du fichier texte'));
      };
      
      // Essayer d'abord en UTF-8, puis en Latin-1 si ça échoue
      try {
        fileReader.readAsText(file, 'UTF-8');
      } catch (error) {
        fileReader.readAsText(file, 'ISO-8859-1');
      }
    });
  };

  const readPowerPoint = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      
      fileReader.onload = async function() {
        try {
          const arrayBuffer = this.result as ArrayBuffer;
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(arrayBuffer);
          
          let fullText = '';
          const slideFiles: string[] = [];
          
          // Trouver tous les fichiers de slides
          zip.forEach((relativePath, zipEntry) => {
            if (relativePath.match(/ppt\/slides\/slide\d+\.xml$/)) {
              slideFiles.push(relativePath);
            }
          });
          
          // Trier les slides par numéro
          slideFiles.sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || '0');
            const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || '0');
            return numA - numB;
          });
          
          // Extraire le texte de chaque slide
          for (const slidePath of slideFiles) {
            const slideContent = await zip.file(slidePath)?.async('text');
            if (slideContent) {
              // Parser le XML et extraire le texte
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(slideContent, 'text/xml');
              
              // Trouver tous les éléments de texte (a:t)
              const textElements = xmlDoc.getElementsByTagName('a:t');
              const slideTexts: string[] = [];
              
              for (let i = 0; i < textElements.length; i++) {
                const text = textElements[i].textContent?.trim();
                if (text) {
                  slideTexts.push(text);
                }
              }
              
              if (slideTexts.length > 0) {
                const slideNum = slidePath.match(/slide(\d+)\.xml$/)?.[1];
                fullText += `\n\n--- Slide ${slideNum} ---\n${slideTexts.join('\n')}`;
              }
            }
          }
          
          if (!fullText.trim()) {
            reject(new Error('Aucun texte n\'a pu être extrait du PowerPoint. Le fichier contient peut-être seulement des images.'));
          } else {
            resolve(fullText.trim());
          }
          
        } catch (error) {
          console.error('PowerPoint parsing error:', error);
          reject(new Error(`Erreur lors de la lecture du PowerPoint: ${error instanceof Error ? error.message : 'Erreur inconnue'}`));
        }
      };
      
      fileReader.onerror = () => {
        reject(new Error('Erreur lors de la lecture du fichier PowerPoint'));
      };
      
      fileReader.readAsArrayBuffer(file);
    });
  };

  return {
    readFile,
    isReading
  };
};