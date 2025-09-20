import React, { useState } from 'react';
import type { Source } from '../types';
import { PlusIcon, BookIcon, TrashIcon, UploadIcon, FileTextIcon, ImageIcon, TableIcon, ArrowPathIcon } from './Icons';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source for pdf.js. This is required for the library to work correctly in the browser.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.mjs`;

interface SourcePanelProps {
  sources: Source[];
  onAddSource: (title: string, content: { mimeType: string, data: string }, fileName?: string) => void;
  onDeleteSource: (id: string) => void;
  onStartNewChat: () => void;
}

const SourcePanel: React.FC<SourcePanelProps> = ({ sources, onAddSource, onDeleteSource, onStartNewChat }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState<{ mimeType: string; data: string } | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  
  const resetForm = () => {
    setNewTitle('');
    setNewContent(null);
    setUploadedFileName(null);
    setStatus('');
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setStatus("Tệp quá lớn. Kích thước tối đa là 10MB.");
        return;
    }
    
    const reader = new FileReader();
    const mimeType = file.type;
    const isExcel = file.name.match(/\.(xlsx|xls)$/i);
    const isPdf = file.type === 'application/pdf' || file.name.match(/\.pdf$/i);
    const isWord = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type) || file.name.match(/\.(doc|docx)$/i);

    reader.onload = async (event) => {
        const result = event.target?.result;
        if (!result) {
            setStatus("Không thể đọc tệp.");
            return;
        }

        setNewTitle(file.name);
        setUploadedFileName(file.name);
        setStatus('');

        if (mimeType.startsWith('image/')) {
            try {
                setStatus("Đang khởi tạo công cụ OCR...");
                const Tesseract = (window as any).Tesseract;
                if (!Tesseract) {
                    throw new Error("Thư viện Tesseract.js chưa được tải. Vui lòng kiểm tra kết nối internet và làm mới trang.");
                }

                const worker = await Tesseract.createWorker('eng', 1, {
                    logger: (m: any) => {
                        if (m.status === 'recognizing text') {
                            const progress = (m.progress * 100).toFixed(0);
                            setStatus(`Đang thực hiện OCR trên ảnh... ${progress}%`);
                        }
                    },
                });

                setStatus("Đang thực hiện OCR trên ảnh... 0%");
                const { data: { text } } = await worker.recognize(result as string);
                await worker.terminate();

                // After OCR, treat it as a plain text source.
                setNewContent({ mimeType: 'text/plain', data: text.trim() });
                setStatus(''); // Clear status on success

            } catch (ocrError: any) {
                 console.error("Error performing OCR on image:", ocrError);
                 setStatus(ocrError.message || "Thực hiện OCR trên ảnh thất bại.");
            }
        } else if (isExcel) {
            try {
                const XLSX = (window as any).XLSX;
                if (!XLSX) throw new Error("Thư viện XLSX chưa được tải.");
                
                const workbook = XLSX.read(result, { type: 'array' });
                let fullTextContent = '';
                workbook.SheetNames.forEach(sheetName => {
                    fullTextContent += `--- BẢNG TÍNH: ${sheetName} ---\n\n`;
                    const worksheet = workbook.Sheets[sheetName];
                    const csvText = XLSX.utils.sheet_to_csv(worksheet);
                    fullTextContent += csvText + '\n\n';
                });
                setNewContent({ mimeType: 'text/plain', data: fullTextContent });
            } catch (excelError) {
                console.error("Error parsing Excel file:", excelError);
                setStatus("Phân tích tệp Excel thất bại.");
            }
        } else if (isPdf) {
            try {
                setStatus("Đang phân tích PDF...");
                const loadingTask = pdfjsLib.getDocument({ data: result as ArrayBuffer });
                const pdf = await loadingTask.promise;
                let fullText = '';
                let hasMeaningfulText = false;

                // Pass 1: Attempt direct text extraction
                for (let i = 1; i <= pdf.numPages; i++) {
                    try {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map((item: any) => item.str).join(' ');
                        if (pageText.replace(/\s/g, '').length > 50) {
                            hasMeaningfulText = true;
                        }
                        fullText += pageText + '\n\n';
                    } catch (e) {
                        console.warn(`Could not get text content for page ${i}, might be an image.`, e);
                    }
                }
                
                const averageCharsPerPage = fullText.replace(/\s/g, '').length / pdf.numPages;

                // If text is sparse, assume it's a scanned PDF and perform OCR
                if (!hasMeaningfulText || averageCharsPerPage < 50) {
                    setStatus('Phát hiện PDF dạng ảnh. Đang thử OCR...');
                    fullText = ''; // Reset for OCR content
                    
                    const Tesseract = (window as any).Tesseract;
                    if (!Tesseract) {
                        throw new Error("Thư viện Tesseract.js chưa được tải. Vui lòng kiểm tra kết nối internet và làm mới trang.");
                    }
                    
                    const worker = await Tesseract.createWorker('eng');
                    for (let i = 1; i <= pdf.numPages; i++) {
                        setStatus(`Đang OCR trang ${i} trên ${pdf.numPages}...`);
                        const page = await pdf.getPage(i);
                        const viewport = page.getViewport({ scale: 2.0 }); // Scale up for better accuracy
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        
                        if (!context) throw new Error('Không thể tạo canvas context cho OCR.');
                        
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        
                        await page.render({ canvasContext: context, viewport: viewport, canvas }).promise;
                        
                        const { data: { text } } = await worker.recognize(canvas);
                        fullText += text + '\n\n';
                        
                        canvas.width = 0;
                        canvas.height = 0;
                    }
                    await worker.terminate();
                }
                
                setNewContent({ mimeType: 'text/plain', data: fullText.trim() });
                setStatus('');

            } catch (pdfError: any) {
                console.error("Error parsing PDF file:", pdfError);
                if (pdfError.message.includes("Tesseract.js")) {
                    setStatus(pdfError.message);
                } else {
                    setStatus("Phân tích PDF thất bại. Tệp có thể bị hỏng hoặc không được hỗ trợ.");
                }
            }
        } else if (isWord) {
             try {
                const mammoth = (window as any).mammoth;
                if (!mammoth) throw new Error("Thư viện mammoth.js chưa được tải.");

                const { value } = await mammoth.extractRawText({ arrayBuffer: result as ArrayBuffer });
                setNewContent({ mimeType: 'text/plain', data: value });
            } catch (wordError) {
                console.error("Error parsing Word file:", wordError);
                setStatus("Phân tích tệp Word thất bại.");
            }
        }
        else { // Assume text for everything else
            setNewContent({ mimeType: 'text/plain', data: result as string });
        }
    };

    reader.onerror = () => {
        setStatus("Đọc tệp thất bại.");
    };

    if (isExcel || isPdf || isWord) {
        reader.readAsArrayBuffer(file);
    } else if (mimeType.startsWith('image/')) {
        reader.readAsDataURL(file);
    } else {
        reader.readAsText(file, 'UTF-8');
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewContent({ mimeType: 'text/plain', data: e.target.value });
    if (uploadedFileName) {
        setUploadedFileName(null);
    }
  };

  const handleAddClick = () => {
    setStatus('');
    if (!newTitle.trim() || !newContent || !newContent.data.trim()) {
      setStatus('Tiêu đề và nội dung không được để trống.');
      return;
    }
    onAddSource(newTitle, newContent, uploadedFileName || undefined);
    resetForm();
    setIsAdding(false);
  };

  const handleCancelClick = () => {
    resetForm();
    setIsAdding(false);
  }
  
  const getSourceIcon = (source: Source) => {
      if (source.fileName?.match(/\.(jpeg|jpg|png|webp)$/i)) {
          return <ImageIcon className="w-5 h-5 text-slate-600 flex-shrink-0" />;
      }
      if (source.fileName?.match(/\.(xlsx|xls)$/)) {
          return <TableIcon className="w-5 h-5 text-slate-600 flex-shrink-0" />;
      }
      return <FileTextIcon className="w-5 h-5 text-slate-600 flex-shrink-0" />;
  }

  return (
    <div className="bg-gray-100 flex flex-col h-full">
      <div className="p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold text-[#161D6F] flex items-center gap-2">
          <BookIcon className="w-6 h-6"/>
          Nguồn
        </h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`p-3 rounded-full neumorph-button neumorph-raised ${isAdding ? 'active' : ''}`}
          aria-label="Thêm nguồn mới"
          title="Thêm nguồn mới"
        >
          <PlusIcon className="w-5 h-5 text-slate-700" />
        </button>
      </div>

      {isAdding && (
        <div className="p-4 space-y-4">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Tiêu đề nguồn"
            className="w-full bg-transparent neumorph-pressed p-3 focus:outline-none text-sm"
          />
          
          <div>
              <label htmlFor="file-upload" className="cursor-pointer w-full flex items-center justify-center gap-2 px-3 py-3 neumorph-raised neumorph-button text-sm text-slate-700 font-medium">
                  <UploadIcon className="w-5 h-5" />
                  <span>Tải tệp lên (Văn bản, Hình ảnh, Excel, PDF, Word)</span>
              </label>
              <input 
                id="file-upload" 
                type="file" 
                className="hidden" 
                onChange={handleFileChange} 
                accept=".txt,.md,.csv,.jpeg,.jpg,.png,.webp,.xlsx,.xls,.pdf,.doc,.docx"
              />
               <div className="mt-3 text-xs text-slate-600 p-2 rounded-md">
                    <p className="font-semibold mb-1">Hệ thống sẽ tự động xử lý các tệp của bạn:</p>
                    <ul className="list-disc list-inside pl-2 space-y-1">
                        <li><b>Tài liệu (.pdf, .docx, .txt):</b> Văn bản được trích xuất. PDF dạng ảnh sẽ được quét bằng công nghệ nhận dạng ký tự quang học (OCR).</li>
                        <li><b>Bảng tính (.xlsx, .xls):</b> Dữ liệu từ mỗi trang tính được chuyển đổi thành văn bản có cấu trúc để phân tích.</li>
                        <li><b>Hình ảnh (.png, .jpg, .webp):</b> Văn bản trong hình ảnh được trích xuất bằng OCR.</li>
                    </ul>
                </div>
          </div>

          {uploadedFileName && (
            <div className="text-xs text-slate-600 neumorph-pressed p-2 flex justify-between items-center">
              <span className="truncate" title={uploadedFileName}>{uploadedFileName}</span>
              <button onClick={resetForm} className="text-red-500 hover:text-red-700 font-bold text-lg leading-none p-1 flex-shrink-0">&times;</button>
            </div>
          )}

          <textarea
            value={newContent?.data || ''}
            onChange={handleTextChange}
            placeholder="Dán nội dung hoặc tải tệp lên..."
            rows={5}
            className="w-full bg-transparent neumorph-pressed p-3 focus:outline-none text-sm"
          />
          
          {(status && !status.startsWith('Đang')) && <p className="text-red-500 text-sm">{status}</p>}
          {status && status.startsWith('Đang') && <p className="text-slate-600 text-sm animate-pulse">{status}</p>}

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleCancelClick}
              className="px-5 py-2 neumorph-raised neumorph-button text-sm font-medium text-slate-800"
            >
              Hủy
            </button>
            <button
              onClick={handleAddClick}
              className="px-5 py-2 neumorph-raised neumorph-button text-sm font-semibold text-slate-800"
            >
              Thêm nguồn
            </button>
          </div>
        </div>
      )}

      <div className="p-4">
        <button
            onClick={onStartNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 neumorph-raised neumorph-button text-sm text-slate-800 font-semibold"
        >
            <ArrowPathIcon className="w-5 h-5" />
            <span>Trò chuyện mới</span>
        </button>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-3">
        {sources.length === 0 && !isAdding && (
          <div className="text-center text-slate-500 p-8">
            <p className="font-medium">Chưa có nguồn nào.</p>
            <p className="text-sm mt-1">Nhấn nút '+' để thêm nguồn đầu tiên của bạn.</p>
          </div>
        )}
        
        {sources.map(source => (
          <div key={source.id} className="neumorph-raised p-3 group">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3 min-w-0">
                {getSourceIcon(source)}
                <p className="font-semibold text-slate-800 truncate" title={source.title}>{source.title}</p>
              </div>
              <button 
                onClick={() => onDeleteSource(source.id)} 
                className="p-1 rounded-full text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                aria-label={`Xóa ${source.title}`}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1 pl-8">{source.content.data.substring(0, 70)}...</p>
          </div>
        ))}
        
      </div>
    </div>
  );
};

export default SourcePanel;