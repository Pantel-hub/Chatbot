// src/FormSteps.jsx
import React, { useState, useRef, useCallback, Fragment, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import BasicInfo from './components/BasicInfo.jsx';
import UploadFiles from './components/UploadFiles.jsx';
import Settings from './components/Settings.jsx';
import Design from './components/Design.jsx';
import Capabilities from './components/Capabilities.jsx';
import Test from './components/Test.jsx';
import Deploy from './components/Deploy.jsx';

import GreekFlag from './assets/greekflag.jpg';
import UkFlag from './assets/ukflag.jpg';
import { BASE_URL, API_ENDPOINTS } from './config/api';




export default function FormSteps({
  currentPage,
  steps,
  onNext,
  onPrev,
  onFormSubmit,
  onGoToDashboard,
  apiKey,
  widgetScript,
  inheritedFormData,
  initialData = {},
  editMode,
  activeChatbotId,
  setApiKey,
  setWidgetScript
}) {
  const { t, i18n } = useTranslation();

  const [formData, setFormData] = useState({
    botName: '',
    greeting: '',
    persona: '',
    botRestrictions: '',
    companyName: '',
    contactEmail: '', 
    websiteURL: '',
    industry: '',
    industryOther: '',
    description: '',
    allowedDomains: '',
    primaryColor: '#4f46e5',
    position: 'Bottom Right',
    themeStyle: 'Minimal',
    suggestedPrompts: '',
      // 👇 ΠΡΟΣΘΗΚΗ
    appointmentSettings: {
      mode: 'bot_managed',   // προεπιλογή
      calendar_id: null,
      user_managed: { duration_minutes: 60 },
      slotDuration: 30,         // 15/30/45/60
      workStart: '09:00',       // ώρα έναρξης
      workEnd: '17:00',         // ώρα λήξης
      workDays: ['Mon','Tue','Wed','Thu','Fri'],
      maxAppointmentsPerSlot: 1,
      timeZone: 'Europe/Athens',
      ...((initialData && initialData.appointmentSettings) || {})
    },
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const uploadFilesRef = useRef(null);

  const [logoFile, setLogoFile] = useState(null); //new
  const [botAvatarFile, setBotAvatarFile] = useState(null); //new
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [faqItems, setFaqItems] = useState([{ question: '', answer: '' }]);
  
  //για τα website data στο edit//
  const [editWebsiteData, setEditWebsiteData] = useState('');
  const [isEditingWebsiteData, setIsEditingWebsiteData] = useState(false);
  const [isRescraping, setIsRescraping] = useState(false);
  const [existingFiles, setExistingFiles] = useState([]); // [{ filename, uploaded_at }]




// Auto-fill effect
  // Auto-fill effect
  useEffect(() => {
    if (formData.botTypePreset) {
      setFormData(prev => ({
        ...prev,
        botName: t(`botTypeDefaults.${formData.botTypePreset}.botName`),
        greeting: t(`botTypeDefaults.${formData.botTypePreset}.greeting`),
        personaSelect: t(`botTypeDefaults.${formData.botTypePreset}.persona`, { lng: 'en' })
      }));
    } else if (formData.botTypePreset === '') {
      setFormData(prev => ({
        ...prev,
        botName: '',
        greeting: '',
        personaSelect: ''
      }));
    }
  }, [formData.botTypePreset, t]);

  // Edit mode: Fetch chatbot data , ελέγχει αν είναι σε edit mode και καλει την fetchchatbotdata
  useEffect(() => {
    if (editMode?.chatbot_id) {
      console.log('%c[FormSteps.jsx] ✏️ Edit mode detected', 'color:purple; font-weight:bold;');
      console.log('Fetching chatbot data for ID:', editMode.chatbot_id);
      fetchChatbotData(editMode.chatbot_id);
    }
  }, [editMode]);

  // Edit mode: Load existing files list
  useEffect(() => {
    const loadExistingFiles = async (chatbotId) => {
      try {
        const res = await fetch(API_ENDPOINTS.getChatbotFiles(chatbotId), { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch files');
        const data = await res.json();
        setExistingFiles(Array.isArray(data.files) ? data.files : []);
      } catch (err) {
        console.error('Load files error:', err);
        setExistingFiles([]);
      }
    };

    if (editMode?.chatbot_id) {
      loadExistingFiles(editMode.chatbot_id);
    }
  }, [editMode?.chatbot_id]);
   
  //διαγραφή αρχείου από υπάρχοντα αρχεία (edit mode)
  const handleDeleteExistingFile = useCallback(async (filename) => {
  // προστασία: μόνο σε Edit mode
    if (!editMode?.chatbot_id) return;

    // επιβεβαίωση χρήστη
    if (!window.confirm(`Να διαγραφεί το αρχείο "${filename}" ;`)) return;

    try {
      const res = await fetch(
        API_ENDPOINTS.deleteChatbotFile(editMode.chatbot_id, filename),
        { method: 'DELETE', credentials: 'include' }
      );

      if (!res.ok) {
        // προσπάθησε να διαβάσεις μήνυμα λάθους από backend
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || 'Delete failed');
      }

      // ✅ αισιόδοξο update του UI: βγάλε το αρχείο από τη λίστα
      setExistingFiles(prev => prev.filter(f => f.filename !== filename));
    } catch (err) {
      console.error('Delete file error:', err);
      alert('Η διαγραφή απέτυχε. Δοκίμασε ξανά.');
    }
  }, [editMode?.chatbot_id, setExistingFiles]);


  //request στο endpoint getchatbot παίρνει τα στοιχεία της εταιρίας από την βάση
  const fetchChatbotData = async (chatbotId) => {
    try {
      console.log('%c[FormSteps.jsx] 🌐 Fetching chatbot data...', 'color:blue; font-weight:bold;');
      const res = await fetch(`${API_ENDPOINTS.getChatbot(chatbotId)}`, {
        credentials: 'include'
      });
    
      if (!res.ok) {
        throw new Error('Failed to fetch chatbot data');
      } 
    
      const bot = await res.json();
      console.log('%c[FormSteps.jsx] ✅ Chatbot data loaded', 'color:green; font-weight:bold;', bot);

      setApiKey(bot.api_key);
      setWidgetScript(bot.script);

      setEditWebsiteData(bot.website_data || '');
      console.log('%c[FormSteps.jsx] 📝 Loaded website data for editing', 'color:blue; font-weight:bold;', `Length: ${(bot.website_data || '').length} characters`);
    
      // Pre-fill formData with existing values
      setFormData({
        botName: bot.botName || '',
        greeting: bot.greeting || '',
        botRestrictions: bot.botRestrictions || '',
        companyName: bot.companyName || '',
        contactEmail: bot.contactEmail || '', 
        websiteURL: bot.websiteURL || '',
        industry: bot.industry || '',
        industryOther: bot.industryOther || '',
        description: bot.description || '',
        allowedDomains: bot.allowedDomains || '',
        primaryColor: bot.primaryColor || '#4f46e5',
        position: bot.position || 'Bottom Right',
        themeStyle: bot.themeStyle || 'Minimal',
        suggestedPrompts: bot.suggestedPrompts || '',
        chatbotLanguage: bot.chatbotLanguage || '',
        personaSelect: bot.personaSelect || '',
        defaultFailResponse: bot.defaultFailResponse || '',
        botTypePreset: bot.botTypePreset || '',
        files_data: bot.files_data || '',
  
  // ← ΠΡΟΣΘΗΚΗ αυτών
        coreFeatures: bot.coreFeatures || {},
        leadCaptureFields: bot.leadCaptureFields || {},
  
        appointmentSettings: bot.appointment_settings ? {
          ...bot.appointment_settings,
          timeZone: bot.appointment_settings.timeZone || 'Europe/Athens'
        } : {
          slotDuration: 30,
          workStart: '09:00',
          workEnd: '17:00',
          workDays: ['Mon','Tue','Wed','Thu','Fri'],
          timeZone: 'Europe/Athens'
        }

  });
    
    // Parse FAQ data
      // Parse FAQ data
      if (bot.faq_data) {
  // Το backend ήδη έκανε parse, οπότε το faq_data είναι array
        const faqParsed = Array.isArray(bot.faq_data) 
          ? bot.faq_data 
          : JSON.parse(bot.faq_data);
  
        setFaqItems(faqParsed.length > 0 ? faqParsed : [{ question: '', answer: '' }]);
}
    } catch (error) {
      console.error('Error fetching chatbot:', error);
      alert('Failed to load chatbot data');
    }
  };

  const handleNextGuarded = () => {
    // Έλεγχος μόνο στο βήμα Capabilities (index 3)
    if (currentPage === 3) {
      const settings = formData?.appointmentSettings || {};
      console.log('🔍 Appointment settings:', settings);
      console.log('🔍 Mode:', settings?.mode);
      console.log('🔍 Booking URL:', settings?.booking_page_url);
      
      // Έλεγχος για user_managed mode: απαιτείται το booking_page_url
      if (settings?.mode === 'user_managed' && !settings?.booking_page_url?.trim()) {
        alert('Παρακαλώ εισάγετε το Google Booking Page URL για να συνεχίσετε.');
        return;
      }
    }
    onNext(); // αν όλα ΟΚ, προχώρα στο επόμενο βήμα
  };


  const handleInputChange = useCallback(
    (e) => {
      const { name, value, files } = e.target;
    
    // Handle file inputs
      if (files && files.length > 0) {
        if (name === 'logo') {
          setLogoFile(files[0]);
    // Αν δεν υπάρχει botAvatar, χρησιμοποίησε το λογότυπο
          if (!botAvatarFile) {
            setBotAvatarFile(files[0]);
          }
      } else if (name === 'botAvatar') {
        setBotAvatarFile(files[0]);
      }
      return;
    }
    
    // Handle regular inputs
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    },
    [errors]
 );

  const handleSubmit = async (e) => {
  if (e) e.preventDefault();
  setIsSubmitting(true);
  try {
    const files = selectedFiles;
    const faqData = faqItems
    // Get FAQ data from UploadFiles component
    
    console.log("FAQ data from UploadFiles:", faqData);
    
    // Add FAQ to form data
    const formDataWithFaq = {...formData, faqItems: faqData,websiteURL: formData.websiteURL?.trim() || null };
    console.log("Form data with FAQ:", formDataWithFaq);
    
    const formDataToSend = new FormData();
    formDataToSend.append('company_info', JSON.stringify(formDataWithFaq));
    files.forEach((file) => formDataToSend.append('files', file));
    
    // Add logo and botAvatar files
    if (logoFile) {
      formDataToSend.append('logo', logoFile);
    }
    if (botAvatarFile) {
      formDataToSend.append('botAvatar', botAvatarFile);
    }
    // για τα website_data στην περίπτωση του edit
    if (editMode) {
      formDataToSend.append('rescrape', isRescraping);
      if (isEditingWebsiteData && editWebsiteData) {
        formDataToSend.append('edited_website_data', editWebsiteData);
      }
    }
    console.log("Files from upload:", files);
    console.log("Logo file:", logoFile);  
    console.log("Bot avatar file:", botAvatarFile);
    console.log("FormData entries:");
    for (let [key, value] of formDataToSend.entries()) {
      console.log(key, value);
    }
    
    await onFormSubmit(formDataToSend);
  } finally {
    setTimeout(() => setIsSubmitting(false), 400);
  }
};

  const commonProps = { 
    formData, 
    handleInputChange, 
    errors, 
    logoPreview: logoFile, 
    botAvatar: botAvatarFile,
    selectedFiles,
    onFilesChange: setSelectedFiles,
    faqItems,
    onFaqChange: setFaqItems,
    editMode,
    existingFiles,
    onDeleteExistingFile: handleDeleteExistingFile, 
 };
  const changeLang = (lng) => i18n.changeLanguage(lng);

  // ---- Compact mobile stepper (numbers only) ----
  const MobileStep = ({ index }) => {
    const isDone = index < currentPage;
    const isActive = index === currentPage;

    const base =
      'relative flex items-center justify-center rounded-full border shrink-0 ' +
      'w-6 h-6 text-[11px] max-[360px]:w-5 max-[360px]:h-5 max-[360px]:text-[10px] ' +
      'max-[320px]:w-4 max-[320px]:h-4 max-[320px]:text-[9px] ' +
      'transition-transform';

    let cls = '';
    if (isDone) {
      cls = `${base} bg-indigo-600 border-indigo-600 text-white`;
    } else if (isActive) {
      // ΠΙΟ ΕΝΤΟΝΟ active: παχύτερο περίγραμμα + ring
      cls = `${base} bg-white border-2 border-indigo-600 text-indigo-700 ring-2 ring-indigo-300`;
    } else {
      cls = `${base} bg-white border-slate-300 text-slate-500`;
    }

    return (
      <div className="flex items-center">
        <div
          className={cls}
          aria-current={isActive ? 'step' : undefined}
          aria-label={t('formSteps.stepOfTotal', {
            defaultValue: 'Step {{current}} of {{total}}',
            current: index + 1,
            total: steps.length,
          })}
        >
          {isDone ? (
            <svg
              viewBox="0 0 24 24"
              className="w-3 h-3 max-[360px]:w-2.5 max-[360px]:h-2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <span className="font-semibold">{index + 1}</span>
          )}
        </div>
      </div>
    );
  };

  const MobileStepper = () => (
    <div className="lg:hidden mt-2">
      <div className="px-2 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between w-full">
          {steps.map((_, idx) => (
            <Fragment key={idx}>
              <MobileStep index={idx} />
              {idx < steps.length - 1 && (
                <div
                  className={[
                    'flex-1 h-0.5 mx-1',
                    idx < currentPage ? 'bg-indigo-600' : 'bg-slate-300',
                  ].join(' ')}
                  aria-hidden="true"
                />
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Header (flags + title + mobile stepper) */}
      <div className="mb-8">
        {/* γλώσσες */}
        <div className="flex justify-end gap-3 mb-4">
          <img
            src={UkFlag}
            alt={t('formSteps.altEnglish', 'English')}
            className={`w-7 h-5 cursor-pointer rounded shadow ${i18n.language === 'en' ? 'ring-2 ring-indigo-500' : ''}`}
            onClick={() => changeLang('en')}
          />
        <img
            src={GreekFlag}
            alt={t('formSteps.altGreek', 'Ελληνικά')}
            className={`w-7 h-5 cursor-pointer rounded shadow ${i18n.language === 'el' ? 'ring-2 ring-indigo-500' : ''}`}
            onClick={() => changeLang('el')}
          />
        </div>

        {/* Τίτλος τρέχοντος βήματος – με αριθμό μπροστά (π.χ. "5. Εμφάνιση & Branding") */}
        <p className="text-sm font-medium text-indigo-600" aria-live="polite" aria-atomic="true">
          {(currentPage + 1) + '. '}{steps[currentPage]}
        </p>

        {/* Compact numeric stepper μόνο στο mobile */}
        <MobileStepper />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="min-h-[450px]">
          {currentPage === 0 && 
            <BasicInfo 
              {...commonProps}
              editMode={editMode}
              editWebsiteData={editWebsiteData}
              onWebsiteDataChange={setEditWebsiteData}
              isEditingWebsiteData={isEditingWebsiteData}
              setIsEditingWebsiteData={setIsEditingWebsiteData}
              isRescraping={isRescraping}
              setIsRescraping={setIsRescraping} 
          />}
          {currentPage === 1 && <UploadFiles {...commonProps} ref={uploadFilesRef} />}
          {currentPage === 2 && <Settings {...commonProps} />}
          {currentPage === 3 && <Capabilities {...commonProps} />}
          {currentPage === 4 && <Design {...commonProps} />}
          {currentPage === 5 && (
            <Test
              formData={inheritedFormData || formData}
              chatbotId={activeChatbotId}   
            />
          )}
          {currentPage === 6 && <Deploy {...commonProps} apiKey={apiKey} widgetScript={widgetScript} />}
        </div>

        <div className={`flex pt-6 ${currentPage > 0 ? 'justify-between' : 'justify-end'}`}>
          {currentPage > 0 && (
            <button
              type="button"
              onClick={onPrev}
              className="text-slate-600 font-medium py-3 px-6 rounded-lg bg-slate-100"
            >
              {t('back')}
            </button>
          )}

          {currentPage < steps.length - 1 && (
            <button
              type="button"
              onClick={currentPage === 4 ? handleSubmit : handleNextGuarded}
              className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg"
              disabled={currentPage === 4 && isSubmitting}
            >

              {currentPage === 4 
                ? (isSubmitting 
                  ? t('submitting') 
                  : editMode 
                    ? t('updateChatbot', 'Update Chatbot')
                    : t('createChatbot', 'Create Chatbot')
                 )
                : t('next')
              }
            </button>
          )}

          {currentPage === steps.length - 1 && (
            <button
              type="button"
                onClick={onGoToDashboard}
                className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {t('goToDashboard', 'Go to Dashboard')}
            </button>
          )}
        </div>
      </form>
    </>
  );
}