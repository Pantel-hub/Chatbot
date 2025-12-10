// src/components/UploadFiles.jsx
import React, { useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpTrayIcon, DocumentTextIcon, PaperClipIcon, XCircleIcon,
  PlusCircleIcon, QuestionMarkCircleIcon, ChatBubbleLeftRightIcon, TrashIcon
} from '@heroicons/react/24/outline';
import TextareaAutosize from 'react-textarea-autosize';

const UploadFiles = forwardRef(({
  errors, formData, handleInputChange,
  selectedFiles = [], onFilesChange,
  faqItems = [], onFaqChange,

  // 🆕 νέα props (μόνο για Edit mode)
  editMode,
  existingFiles = [],
  onDeleteExistingFile,
}, ref) => {

  const { t } = useTranslation();

  const [fileError, setFileError] = useState('');
  const [rejectedFiles, setRejectedFiles] = useState([]);

  const ALLOWED_EXTENSIONS = [
  '.c', '.cpp', '.cs', '.css', '.doc', '.docx', 
  '.go', '.html', '.java', '.js', '.json', '.md', 
  '.pdf', '.php', '.pptx', '.py', '.rb', '.sh', 
  '.tex', '.ts', '.txt'
  ];

  const ALLOWED_EXTENSIONS_DISPLAY = 'TXT, PDF, DOCX, MD, HTML, PPTX, JSON, JS, PY, CPP, JAVA, CSS, PHP, GO, TS, RB, SH, TEX';

  

  const handleFileSelect = useCallback((event) => {
  const newFiles = Array.from(event.target.files);
  const validFiles = [];      // 📦 Λίστα για τα ΕΓΚΥΡΑ αρχεία
  const invalid = [];          // ❌ Λίστα για τα ΜΗ ΕΓΚΥΡΑ αρχεία

  // 🔍 ΕΛΕΓΧΟΣ: Για κάθε αρχείο που επέλεξε ο χρήστης
  newFiles.forEach(file => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();  // Παίρνει την επέκταση (π.χ. ".pdf")
    
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      validFiles.push(file);    // ✅ Έγκυρο → στη λίστα validFiles
    } else {
      invalid.push(file.name);  // ❌ Μη έγκυρο → στη λίστα invalid
    }
  });

  // ✅ Προσθέτει ΜΟΝΟ τα έγκυρα αρχεία
  if (validFiles.length > 0) {
    onFilesChange([...selectedFiles, ...validFiles]);
  }

  // ❌ Αν υπάρχουν μη έγκυρα, δείχνει error message
  if (invalid.length > 0) {
    setRejectedFiles(invalid);
    setFileError(
      invalid.length === 1
        ? `Το αρχείο "${invalid[0]}" δεν υποστηρίζεται.`
        : `Τα αρχεία ${invalid.map(f => `"${f}"`).join(', ')} δεν υποστηρίζονται.`
    );
    
    // ⏱️ Εξαφανίζει το error μετά από 5 δευτερόλεπτα
    setTimeout(() => {
      setFileError('');
      setRejectedFiles([]);
    }, 7000);
  }

  // 🔄 Reset το input
  event.target.value = '';
}, [selectedFiles, onFilesChange]);

const handleRemoveFile = useCallback((fileName) => {
  onFilesChange(selectedFiles.filter(file => file.name !== fileName));
}, [selectedFiles, onFilesChange]);

  const handleAddFaq = useCallback(() => {
  onFaqChange([...faqItems, { question: '', answer: '' }]);
}, [faqItems, onFaqChange]);

const handleUpdateFaq = useCallback((index, field, value) => {
  const next = [...faqItems];
  next[index] = { ...next[index], [field]: value };
  onFaqChange(next);
}, [faqItems, onFaqChange]);

const handleRemoveFaq = useCallback((index) => {
  onFaqChange(faqItems.filter((_, i) => i !== index));
}, [faqItems, onFaqChange]);
  useImperativeHandle(ref, () => ({
  getFiles: () => selectedFiles,
  clearFiles: () => onFilesChange([]),
  getFaq: () => faqItems.filter(item => item.question.trim() || item.answer.trim()),
  clearFaq: () => onFaqChange([{ question: '', answer: '' }])
}), [selectedFiles, onFilesChange, faqItems, onFaqChange]);

  const baseInputClasses = "w-full p-3 pl-10 border rounded-lg transition duration-200 bg-slate-50 focus:bg-white focus:outline-none";
  const normalClasses = "border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
  const labelClasses = "block text-sm font-medium text-slate-600 mb-2";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">{t('uploadFiles')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('uploadOptional')}</p>
      </div>

      <div>
        <label className={labelClasses}>{t('selectFiles')}</label>
        <label htmlFor="files-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <ArrowUpTrayIcon className="w-8 h-8 mb-3 text-slate-400" />
            <p className="mb-2 text-sm text-slate-500">
              <span className="font-semibold text-indigo-600">{t('clickToUpload')}</span> {t('dragAndDrop')}
            </p>
            <p className="text-xs text-slate-400">{t('fileTypes')}</p>
          </div>
          <input id="files-upload" name="files" type="file" className="sr-only" multiple onChange={handleFileSelect} />
        </label>
      </div>

      {/* ✅ Error message για μη έγκυρα αρχεία */}
      {fileError && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <XCircleIcon className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-red-800">{fileError}</p>
              <p className="text-xs text-red-600 mt-1">
                Επιτρεπτοί τύποι: {ALLOWED_EXTENSIONS_DISPLAY}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- Existing files (only in Edit mode) --- */}
      {editMode?.chatbot_id && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium text-slate-600">Αρχεία που έχουν ήδη ανέβει</h3>

          {existingFiles.length === 0 ? (
            <p className="text-sm text-slate-500">Δεν υπάρχουν αποθηκευμένα αρχεία.</p>
          ) : (
            <ul className="border border-slate-200 rounded-lg divide-y divide-slate-200">
              {existingFiles.map((f, idx) => (
                <li key={idx} className="px-3 py-2 flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <PaperClipIcon className="h-5 w-5 text-slate-400" />
                    <span className="text-slate-700">{f.filename}</span>
                    {f.uploaded_at && (
                      <span className="ml-2 text-xs text-slate-400">
                        ({new Date(f.uploaded_at).toLocaleString()})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteExistingFile?.(f.filename)}
                    className="text-slate-400 hover:text-red-600 transition"
                    title="Διαγραφή"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}


      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium text-slate-600">{t('selectedFiles')}</h3>
          <ul className="border border-slate-200 rounded-lg divide-y divide-slate-200">
            {selectedFiles.map((file, index) => (
              <li key={index} className="px-3 py-2 flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <PaperClipIcon className="h-5 w-5 text-slate-400" />
                  <span className="text-slate-700">{file.name}</span>
                </div>
                <button type="button" onClick={() => handleRemoveFile(file.name)} className="text-slate-400 hover:text-red-600 transition">
                  <XCircleIcon className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">{t('faq.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('faq.subtitle')}</p>
        </div>

        <div className="space-y-4">
          {faqItems.map((item, index) => (
            <div key={index} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={labelClasses}>{t('faq.question')}</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute top-3 left-0 flex items-center pl-3">
                      <QuestionMarkCircleIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={item.question}
                      onChange={(e) => handleUpdateFaq(index, 'question', e.target.value)}
                      className={`${baseInputClasses} ${normalClasses}`}
                      placeholder={t('faq.placeholders.question')}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClasses}>{t('faq.answer')}</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute top-3 left-0 flex items-center pl-3">
                      <ChatBubbleLeftRightIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <TextareaAutosize
                      value={item.answer}
                      onChange={(e) => handleUpdateFaq(index, 'answer', e.target.value)}
                      className={`${baseInputClasses} ${normalClasses} resize-none`}
                      placeholder={t('faq.placeholders.answer')}
                      minRows={3}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleRemoveFaq(index)}
                  className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 transition"
                >
                  <TrashIcon className="h-4 w-4" />
                  {t('faq.remove')}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex">
          <button
            type="button"
            onClick={handleAddFaq}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm"
          >
            <PlusCircleIcon className="h-5 w-5" />
            {t('faq.add')}
          </button>
        </div>
      </div>
    </div>
  );
});

export default UploadFiles;
