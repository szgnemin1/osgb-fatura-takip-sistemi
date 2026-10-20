import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exporter = {
  exportToExcel: (fileName: string, data: any[]) => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Rapor");
      XLSX.writeFile(workbook, `${fileName}.xlsx`);
    } catch (error) {
      console.error("Excel export error:", error);
      alert("Excel oluşturulurken bir hata oluştu.");
    }
  },

  exportToPDF: (title: string, columns: string[], data: any[], fileName: string) => {
    try {
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(16);
      doc.text(title, 14, 20);
      doc.setFontSize(10);
      doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

      // Table
      (doc as any).autoTable({
        startY: 35,
        head: [columns],
        body: data,
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [41, 128, 185] }, // Blue header
        alternateRowStyles: { fillColor: [245, 245, 245] },
        theme: 'grid'
      });

      doc.save(`${fileName}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("PDF oluşturulurken bir hata oluştu.");
    }
  }
};