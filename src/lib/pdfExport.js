import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

export async function exportScriptToPDF(script) {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const lineHeight = 6;
    let yPos = margin;

    // Title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(script.title, margin, yPos);
    yPos += lineHeight * 2;

    // Metadata
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Rôle: ${script.my_character || 'Non défini'}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Répliques: ${script.lines?.length || 0}`, margin, yPos);
    yPos += lineHeight * 2;

    // Lines
    doc.setFontSize(9);
    if (script.lines && script.lines.length > 0) {
      script.lines.forEach((line) => {
        const isMyLine = line.character?.trim().toLowerCase() === script.my_character?.trim().toLowerCase();
        
        // Check page break
        if (yPos > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }

        // Character name
        doc.setFont(undefined, 'bold');
        if (isMyLine) {
          doc.setTextColor(0, 102, 204);
        } else {
          doc.setTextColor(0, 0, 0);
        }
        doc.text(line.character || 'UNKNOWN', margin, yPos);
        yPos += lineHeight;

        // Line text
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        const textLines = doc.splitTextToSize(line.text || '', pageWidth - margin * 2);
        textLines.forEach((textLine) => {
          if (yPos > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
          }
          doc.text(textLine, margin + 5, yPos);
          yPos += lineHeight;
        });

        yPos += lineHeight * 0.5;
      });
    }

    doc.save(`${script.title}.pdf`);
    toast.success('📄 PDF téléchargé');
    return true;
  } catch (error) {
    console.error('[exportScriptToPDF]', error);
    toast.error('Erreur lors de l\'export PDF');
    return false;
  }
}