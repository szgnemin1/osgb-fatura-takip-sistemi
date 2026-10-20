
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Firm } from '../types';

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

  // --- FİYAT GÜNCELLEME ŞABLONU ---
  exportFirmsForEditing: (firms: Firm[]) => {
    try {
      const workbook = XLSX.utils.book_new();

      // 1. SAYFA: GENEL FİYATLAR
      const generalData = firms.map(f => ({
        "ID (DOKUNMAYIN)": f.id,
        "Firma Adı": f.name,
        "Taban Ücret": f.baseFee,
        "Taban Kişi Limiti": f.basePersonLimit,
        "Ekstra Kişi Ücreti": f.extraPersonFee,
        "Yıllık İşlem Ücreti": f.yearlyFee || 0,
        "Model (STANDART/KADEMELI)": f.pricingModel,
        "Tolerans (%)": f.tolerancePercentage || 0
      }));
      const wsGeneral = XLSX.utils.json_to_sheet(generalData);
      XLSX.utils.book_append_sheet(workbook, wsGeneral, "Genel Fiyatlar");

      // 2. SAYFA: KADEMELER
      const tierData: any[] = [];
      firms.forEach(f => {
        if (f.tiers && f.tiers.length > 0) {
          f.tiers.forEach(t => {
            tierData.push({
              "Firma ID (DOKUNMAYIN)": f.id,
              "Firma Adı": f.name,
              "Min Kişi": t.min,
              "Max Kişi": t.max,
              "Fiyat": t.price
            });
          });
        }
      });
      
      // Boşsa bile header olsun
      if (tierData.length === 0) {
          tierData.push({ "Firma ID (DOKUNMAYIN)": "", "Firma Adı": "", "Min Kişi": 0, "Max Kişi": 0, "Fiyat": 0 });
      }
      
      const wsTiers = XLSX.utils.json_to_sheet(tierData);
      XLSX.utils.book_append_sheet(workbook, wsTiers, "Kademeler");

      const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '_');
      XLSX.writeFile(workbook, `Fiyat_Guncelleme_Sablonu_${dateStr}.xlsx`);
    } catch (error) {
      console.error("Template export error", error);
      alert("Şablon oluşturulamadı.");
    }
  },

  // --- YENİ KAYIT ŞABLONU ---
  exportAdvancedTemplate: () => {
    try {
      const workbook = XLSX.utils.book_new();
      const firmsData = [{
          "Firma Adı": "Örnek Firma A.Ş.",
          "Fatura Tipi": "E-Fatura",
          "Fiyatlandırma Modeli": "STANDART",
          "Taban Kişi": 10,
          "Taban Ücret": 1000,
          "Ekstra Kişi Ücreti": 50,
          "Tolerans Yüzdesi": 0,
          "Fiyatlar KDV Hariç mi?": "Hayır",
          "Başlangıç Borcu": 0
      }];
      const firmsSheet = XLSX.utils.json_to_sheet(firmsData);
      XLSX.utils.book_append_sheet(workbook, firmsSheet, "Firmalar");
      XLSX.writeFile(workbook, "Yeni_Firma_Kayit_Sablonu.xlsx");
    } catch (error) {
      alert("Şablon oluşturulamadı.");
    }
  },

  exportToPDF: (title: string, columns: string[], data: any[], fileName: string) => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(title, 14, 20);
      doc.setFontSize(10);
      doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

      (doc as any).autoTable({
        startY: 35,
        head: [columns],
        body: data,
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [41, 128, 185] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        theme: 'grid'
      });

      doc.save(`${fileName}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("PDF hatası.");
    }
  }
};
