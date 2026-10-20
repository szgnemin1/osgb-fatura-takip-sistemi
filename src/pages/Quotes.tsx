import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Firm, PricingModel, GlobalSettings } from '../types';
import { FileSignature, Search, Download, Settings, X, Save, CheckCircle, Clock } from 'lucide-react';
import { COMPANY_LOGO_BASE64 } from '../assets/logoBase64';
import { ARIAL_BASE64 } from '../assets/arialBase64';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { toPng } from 'html-to-image';

interface QuoteItem {
  firmId: string;
  firmName: string;
  currentModel: PricingModel;
  
  currentBasePersonLimit: number;
  currentBaseFee: number;
  currentExtraPersonFee: number;

  newBasePersonLimit: number;
  newBaseFee: number;
  newExtraPersonFee: number;
}

const DEFAULT_INTRO = `<p><b>KONU:</b> {{YIL}} Yılı Fiyat Teklifi</p><br/><p>Sayın; <b>{{FIRMA_ADI}} Yetkilisi</b></p><p>{{ESKI_YIL}} yılı için ülke şartlarını da değerlendirerek her yıl olduğu gibi bu yıl da en uygun fiyatlandırmayı yapmaya çalıştık.</p><p>{{YIL}} yılı için belirlediğimiz fiyat aşağıdaki gibi olacaktır.</p><p>Sizlerle uzun yıllar çalışmak ümidiyle</p><p>Gereğini saygılarımızla bilginize sunarız.</p>`;
const DEFAULT_FOOTER = `<p><b>Soner KAYA</b></p><p>Çankaya OSGB Sorumlu Müdür</p><br/><p><span style="font-size: 12px;">*Fiyatlara K.D.V. Dahildir.</span></p><p><span style="font-size: 12px;">*Asgari ücrete yıl içinde zam yapılması durumunda fiyatlama değişecektir.</span></p><p><span style="font-size: 12px;">*Tehlike sınıfı değişirse fiyat değişecektir.</span></p><p><span style="font-size: 12px;">*Tetkikler fiyata dahil değil.</span></p>`;

const Quotes = () => {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteItem>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [quoteYear, setQuoteYear] = useState<number>(new Date().getFullYear() + 1);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [introText, setIntroText] = useState(DEFAULT_INTRO);
  const [footerText, setFooterText] = useState(DEFAULT_FOOTER);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const loadedFirms = db.getFirms() || [];
    setFirms(loadedFirms);
    
    const settings = db.getGlobalSettings() || {} as GlobalSettings;
    if (settings.quoteIntroTemplate) setIntroText(settings.quoteIntroTemplate);
    if (settings.quoteFooterTemplate) setFooterText(settings.quoteFooterTemplate);

    const initialQuotes: Record<string, QuoteItem> = {};
    loadedFirms.forEach(firm => {
      initialQuotes[firm.id] = {
        firmId: firm.id,
        firmName: firm.name,
        currentModel: firm.pricingModel,
        currentBasePersonLimit: firm.basePersonLimit || 0,
        currentBaseFee: firm.baseFee || 0,
        currentExtraPersonFee: firm.extraPersonFee || 0,
        newBasePersonLimit: firm.proposedBasePersonLimit || firm.basePersonLimit || 0,
        newBaseFee: firm.proposedBaseFee || firm.baseFee || 0,
        newExtraPersonFee: firm.proposedExtraPersonFee || firm.extraPersonFee || 0
      };
    });
    setQuotes(initialQuotes);
  };

  const handleNewValueChange = (firmId: string, field: keyof QuoteItem, value: string) => {
    const numVal = parseFloat(value);
    setQuotes(prev => ({
      ...prev,
      [firmId]: {
        ...prev[firmId],
        [field]: isNaN(numVal) ? 0 : numVal
      }
    }));
  };

  const handleSaveTemplates = () => {
    const currentSettings = db.getGlobalSettings() || {} as GlobalSettings;
    currentSettings.quoteIntroTemplate = introText;
    currentSettings.quoteFooterTemplate = footerText;
    db.saveGlobalSettings(currentSettings);
    setIsEditorOpen(false);
    alert('Şablonlar başarıyla kaydedildi!');
  };

  const createHtmlToImage = async (html: string, widthPx: number = 800) => {
    const div = document.createElement('div');
    // Sayfa içinde görünmez ama viewport içinde kalacak şekilde ayarlıyoruz
    div.style.position = 'absolute';
    div.style.top = '0px';
    div.style.left = '0px';
    div.style.width = `${widthPx}px`;
    div.style.padding = '20px'; // Render hatasını önlemek için biraz padding
    div.style.margin = '0';
    div.style.backgroundColor = '#ffffff';
    div.style.fontFamily = 'Arial, sans-serif';
    div.style.fontSize = '16px'; 
    div.style.color = '#000000';
    div.style.lineHeight = '1.5';
    div.style.zIndex = '-1000'; // Arkada kalmasını sağlar
    div.style.pointerEvents = 'none';
    div.innerHTML = html;
    document.body.appendChild(div);
    
    // Tarayıcının DOM'u tam render etmesi için bekliyoruz (blank image hatasını çözer)
    await new Promise(r => setTimeout(r, 300));
    
    try {
        // İlk render genellikle boştur, bu yüzden iki kez çağırarak garantiye alıyoruz
        await toPng(div, { pixelRatio: 2, backgroundColor: '#ffffff' });
        const dataUrl = await toPng(div, { pixelRatio: 2, backgroundColor: '#ffffff' });
        document.body.removeChild(div);
        return dataUrl;
    } catch (e) {
        console.error('html-to-image hatası:', e);
        document.body.removeChild(div);
        return null;
    }
  };

  const handleDownloadSingleQuote = async (firmId: string) => {
    const quote = quotes[firmId];
    if (!quote) return;
    setIsGenerating(firmId);

    try {
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');

      const processedIntro = introText
        .replace(/{{FIRMA_ADI}}/g, quote.firmName)
        .replace(/{{YIL}}/g, quoteYear.toString())
        .replace(/{{ESKI_YIL}}/g, (quoteYear - 1).toString());
        
      const processedFooter = footerText
        .replace(/{{FIRMA_ADI}}/g, quote.firmName)
        .replace(/{{YIL}}/g, quoteYear.toString())
        .replace(/{{ESKI_YIL}}/g, (quoteYear - 1).toString());

      const introDataUrl = await createHtmlToImage(processedIntro, 800);
      const footerDataUrl = await createHtmlToImage(processedFooter, 800);

      const doc = new jsPDF();
      
      doc.addFileToVFS("Arial.ttf", ARIAL_BASE64);
      doc.addFont("Arial.ttf", "Arial", "normal");
      doc.addFont("Arial.ttf", "Arial", "bold"); 
      
      let currentY = 15;

      if (COMPANY_LOGO_BASE64 && COMPANY_LOGO_BASE64.startsWith('data:image')) {
          try {
              const imgProps = doc.getImageProperties(COMPANY_LOGO_BASE64);
              const maxLogoWidth = 40;
              let finalW = maxLogoWidth;
              let finalH = (imgProps.height * maxLogoWidth) / imgProps.width;
              
              if (finalH > 25) {
                  finalH = 25;
                  finalW = (imgProps.width * finalH) / imgProps.height;
              }
              
              doc.addImage(COMPANY_LOGO_BASE64, 'PNG', 14, currentY, finalW, finalH);
              currentY += finalH + 15;
          } catch (e) {
              doc.addImage(COMPANY_LOGO_BASE64, 'PNG', 14, currentY, 30, 30);
              currentY += 45;
          }
      } else {
          currentY += 10;
      }

      const rightX = 196;
      const today = new Date().toLocaleDateString('tr-TR');
      doc.setFont("Arial", "normal");
      doc.setFontSize(12);
      doc.text(`Tarih: ${today}`, rightX, 25, { align: 'right' });

      if (introDataUrl) {
          const props = doc.getImageProperties(introDataUrl);
          const renderW = 180;
          const renderH = (props.height * renderW) / props.width;
          doc.addImage(introDataUrl, 'PNG', 14, currentY, renderW, renderH);
          currentY += renderH + 10;
      }

      (doc as any).autoTable({
          startY: currentY,
          head: [['Kalem', 'Eski Değer / Fiyat', 'Yeni Değer / Fiyat']],
          body: [
              [
                  'Taban Kişi Limiti',
                  `${quote.currentBasePersonLimit} Kişi`,
                  `${quote.newBasePersonLimit || quote.currentBasePersonLimit} Kişi`
              ],
              [
                  'Taban Ücret (Aylık)',
                  `${quote.currentBaseFee.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`,
                  `${quote.newBaseFee.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`
              ],
              [
                  'Ekstra Kişi Başı Ücret',
                  `${quote.currentExtraPersonFee.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`,
                  `${quote.newExtraPersonFee.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`
              ]
          ],
          styles: { font: 'Arial', fontStyle: 'normal', fontSize: 11, cellPadding: 5, textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.1 },
          headStyles: { fillColor: [255, 255, 255], textColor: [0,0,0] },
          bodyStyles: { fillColor: [255, 255, 255] },
          theme: 'plain',
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;

      if (footerDataUrl) {
          const props = doc.getImageProperties(footerDataUrl);
          const renderW = 180;
          const renderH = (props.height * renderW) / props.width;
          
          if (currentY + renderH > 280) {
              doc.addPage();
              currentY = 20;
          }

          doc.addImage(footerDataUrl, 'PNG', 14, currentY, renderW, renderH);
      }

      const safeName = quote.firmName.substring(0,20).replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/g, '_');
      doc.save(`${quoteYear}_Fiyat_Teklifi_${safeName}.pdf`);

      // Gncelle ve Kaydet
      const firmIndex = firms.findIndex(f => f.id === firmId);
      if (firmIndex !== -1) {
        const firm = firms[firmIndex];
        firm.quoteStatus = 'ONAYDA';
        firm.proposedBasePersonLimit = quote.newBasePersonLimit;
        firm.proposedBaseFee = quote.newBaseFee;
        firm.proposedExtraPersonFee = quote.newExtraPersonFee;
        db.updateFirm(firm);
        loadData(); // yeniden ykle
      }

    } catch (err) {
      console.error(err);
      alert('PDF oluşturulurken bir hata oluştu.');
    } finally {
      setIsGenerating(null);
    }
  };

  const handleApproveQuote = (firmId: string) => {
    if (!window.confirm("Teklifi onaylamak istediğinize emin misiniz? Firmanın güncel fiyatları kalıcı olarak değişecektir.")) return;

    const firmIndex = firms.findIndex(f => f.id === firmId);
    if (firmIndex !== -1) {
      const firm = firms[firmIndex];
      firm.quoteStatus = 'ONAYLANDI';
      if (firm.proposedBasePersonLimit !== undefined) firm.basePersonLimit = firm.proposedBasePersonLimit;
      if (firm.proposedBaseFee !== undefined) firm.baseFee = firm.proposedBaseFee;
      if (firm.proposedExtraPersonFee !== undefined) firm.extraPersonFee = firm.proposedExtraPersonFee;
      
      db.updateFirm(firm);
      loadData();
    }
  };

  const filteredFirms = firms.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) && (f.pricingModel === PricingModel.STANDARD || f.pricingModel === PricingModel.TOLERANCE || f.pricingModel === PricingModel.PER_CAPITA));

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ],
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <FileSignature className="w-8 h-8 text-blue-500" />
            Fiyat Teklifi Hazırlama
          </h1>
          <p className="text-slate-400 mt-1">Sözleşmesi yenilenecek firmalar için teklif kağıdı oluşturun.</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 border border-slate-700">
                <span className="text-sm text-slate-300">Teklif Yılı:</span>
                <input 
                    type="number" 
                    value={quoteYear} 
                    onChange={e => setQuoteYear(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm w-20 outline-none focus:border-blue-500"
                />
            </div>
            <button 
                onClick={() => setIsEditorOpen(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-purple-900/20"
            >
                <Settings size={18} /> Şablonu Düzenle
            </button>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 shadow-xl overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/80">
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                type="text"
                placeholder="Firma Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
            </div>
        </div>

        <div className="w-full">
            <table className="w-full text-left border-collapse table-fixed">
            <thead>
                <tr className="bg-slate-900/50 text-slate-400 text-[10px] sm:text-[11px] uppercase tracking-wider border-b border-slate-700">
                <th className="px-2 py-3 font-medium">Firma Adı & Durum</th>
                <th className="px-2 py-3 font-medium text-center w-20 sm:w-24">Taban Kişi</th>
                <th className="px-2 py-3 font-medium text-center w-24 sm:w-28">Taban Ücret (TL)</th>
                <th className="px-2 py-3 font-medium text-center w-24 sm:w-28">Ekstra Kişi (TL)</th>
                <th className="px-2 py-3 font-medium text-center w-20 sm:w-24">İşlemler</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
                {filteredFirms.length === 0 ? (
                <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Kayıtlı veya aranan kriterde uygun firma bulunamadı.
                    </td>
                </tr>
                ) : (
                filteredFirms.map(firm => {
                    const q = quotes[firm.id];
                    if (!q) return null;
                    return (
                    <tr key={firm.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-2 py-3 align-middle overflow-hidden">
                            <div className="text-xs sm:text-sm font-medium text-slate-200 truncate" title={firm.name}>{firm.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] sm:text-[10px] text-slate-500 truncate">Model: {q.currentModel}</span>
                                {firm.quoteStatus === 'ONAYDA' && (
                                    <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                        <Clock size={10} /> Onay Bekliyor
                                    </span>
                                )}
                                {firm.quoteStatus === 'ONAYLANDI' && (
                                    <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                                        <CheckCircle size={10} /> Onaylandı
                                    </span>
                                )}
                            </div>
                        </td>
                        <td className="px-2 py-3 align-middle">
                            <div className="flex flex-col gap-1 items-center">
                                <div className="text-[9px] sm:text-[11px] text-slate-400 line-through">{q.currentBasePersonLimit} Kişi</div>
                                <input 
                                    type="number"
                                    min="0"
                                    value={q.newBasePersonLimit || ''}
                                    onChange={(e) => handleNewValueChange(firm.id, 'newBasePersonLimit', e.target.value)}
                                    placeholder="Yeni"
                                    className="w-full max-w-[4rem] sm:max-w-[5rem] bg-slate-900 border border-slate-600 text-white rounded px-1 py-1 text-[10px] sm:text-xs text-center focus:border-blue-500 outline-none"
                                />
                            </div>
                        </td>
                        <td className="px-2 py-3 align-middle">
                            <div className="flex flex-col gap-1 items-center">
                                <div className="text-[9px] sm:text-[11px] text-slate-400 line-through truncate w-full text-center" title={`${q.currentBaseFee.toLocaleString('tr-TR')} TL`}>{`${q.currentBaseFee.toLocaleString('tr-TR')} TL`}</div>
                                <input 
                                    type="number"
                                    min="0"
                                    value={q.newBaseFee || ''}
                                    onChange={(e) => handleNewValueChange(firm.id, 'newBaseFee', e.target.value)}
                                    placeholder="Yeni"
                                    className="w-full max-w-[5rem] sm:max-w-[6rem] bg-slate-900 border border-slate-600 text-white rounded px-1 py-1 text-[10px] sm:text-xs text-center focus:border-blue-500 outline-none"
                                />
                            </div>
                        </td>
                        <td className="px-2 py-3 align-middle">
                            <div className="flex flex-col gap-1 items-center">
                                <div className="text-[9px] sm:text-[11px] text-slate-400 line-through truncate w-full text-center" title={`${q.currentExtraPersonFee.toLocaleString('tr-TR')} TL`}>{`${q.currentExtraPersonFee.toLocaleString('tr-TR')} TL`}</div>
                                <input 
                                    type="number"
                                    min="0"
                                    value={q.newExtraPersonFee || ''}
                                    onChange={(e) => handleNewValueChange(firm.id, 'newExtraPersonFee', e.target.value)}
                                    placeholder="Yeni"
                                    className="w-full max-w-[5rem] sm:max-w-[6rem] bg-slate-900 border border-slate-600 text-white rounded px-1 py-1 text-[10px] sm:text-xs text-center focus:border-blue-500 outline-none"
                                />
                            </div>
                        </td>
                        <td className="px-2 py-3 align-middle text-center">
                            <div className="flex gap-2 justify-center">
                                <button 
                                    onClick={() => handleDownloadSingleQuote(firm.id)} 
                                    disabled={isGenerating === firm.id}
                                    className={`${isGenerating === firm.id ? 'bg-slate-600' : 'bg-blue-600 hover:bg-blue-500'} text-white p-2 rounded-lg transition-colors inline-flex justify-center items-center`}
                                    title="Fiyat Teklifi PDF İndir (İndirince Onaya Düşer)"
                                >
                                    <Download size={16} className={isGenerating === firm.id ? 'animate-pulse' : ''} />
                                </button>

                                {firm.quoteStatus === 'ONAYDA' && (
                                    <button 
                                        onClick={() => handleApproveQuote(firm.id)}
                                        className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-lg transition-colors inline-flex justify-center items-center"
                                        title="Teklifi Onayla (Yeni Fiyatları Uygula)"
                                    >
                                        <CheckCircle size={16} />
                                    </button>
                                )}
                            </div>
                        </td>
                    </tr>
                    );
                })
                )}
            </tbody>
            </table>
        </div>
      </div>

      {isEditorOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/80 rounded-t-xl">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Şablon Düzenleyici
              </h2>
              <button 
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                <div className="bg-blue-900/20 text-blue-300 p-4 rounded-lg border border-blue-900/50 text-sm">
                    <strong>Kullanabileceğiniz Değişkenler:</strong> PDF oluşturulurken bu metinler otomatik olarak değiştirilir.
                    <ul className="list-disc ml-5 mt-2 space-y-1">
                        <li><code>{`{{FIRMA_ADI}}`}</code> : Tablodaki firmanın adı</li>
                        <li><code>{`{{YIL}}`}</code> : Seçilen Teklif Yılı (Örn: 2026)</li>
                        <li><code>{`{{ESKI_YIL}}`}</code> : Seçilen Teklif Yılı - 1 (Örn: 2025)</li>
                    </ul>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 block">Üst Metin (Tablodan Önceki Kısım)</label>
                    <div className="bg-white text-black rounded-lg overflow-hidden border border-slate-600">
                        <ReactQuill theme="snow" value={introText} onChange={setIntroText} modules={modules} className="h-48" />
                    </div>
                    <div className="h-10"></div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 block">Alt Metin (Tablodan Sonraki Kısım)</label>
                    <div className="bg-white text-black rounded-lg overflow-hidden border border-slate-600">
                        <ReactQuill theme="snow" value={footerText} onChange={setFooterText} modules={modules} className="h-48" />
                    </div>
                    <div className="h-10"></div>
                </div>
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-800/80 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSaveTemplates}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 transition-colors flex items-center gap-2 shadow-lg shadow-purple-900/20"
              >
                <Save size={16} /> Şablonu Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotes;
