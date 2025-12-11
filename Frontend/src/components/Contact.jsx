import React from "react";
import { ArrowLeft, Mail, Phone, MapPin } from "lucide-react";
import chatbotLogo from "../assets/chatbot_logo.svg";
import { useTranslation } from "react-i18next";

export default function Contact({ onBack }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 flex flex-col animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur border-b border-gray-100 shrink-0">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-xs sm:text-sm transition-colors"
            >
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">{t("contact.back")}</span>
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <img
                src={chatbotLogo}
                alt="Chatbot Logo"
                className="h-7 w-7 sm:h-9 sm:w-9"
              />
              <span className="text-base sm:text-lg font-bold tracking-tight">grimbot</span>
            </div>
          </div>
          <span className="text-sm sm:text-lg font-semibold text-gray-700">{t("contact.title")}</span>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 py-8 flex-1">
        {/* Page Title */}
        <div className="mb-8 sm:mb-12 text-center animate-fade-in">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2 sm:mb-3 animate-slide-up">
            {t("contact.pageTitle")}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '100ms' }}>
            {t("contact.subtitle")}
          </p>
        </div>

        {/* Contact Info Cards - Centered */}
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm p-6 hover:shadow-lg hover:scale-105 hover:border-indigo-300 transition-all duration-300 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4 transition-transform hover:rotate-12">
                <Mail className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{t("contact.email")}</h3>
              <p className="text-gray-600 text-sm">info@softbiz.eu</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm p-6 hover:shadow-lg hover:scale-105 hover:border-purple-300 transition-all duration-300 animate-slide-up" style={{ animationDelay: '300ms' }}>
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4 transition-transform hover:rotate-12">
                <Phone className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{t("contact.phone")}</h3>
              <p className="text-gray-600 text-sm">+30 210.684.6329</p>
              <p className="text-gray-600 text-sm">{t("contact.phoneHours")}</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm p-6 hover:shadow-lg hover:scale-105 hover:border-green-300 transition-all duration-300 animate-slide-up" style={{ animationDelay: '400ms' }}>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4 transition-transform hover:rotate-12">
                <MapPin className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{t("contact.office")}</h3>
              <p className="text-gray-600 text-sm">Ανδρέα Παπανδρέου 47</p>
              <p className="text-gray-600 text-sm">15232 Χαλάνδρι Αττική Ελλάδα</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <p className="text-xs sm:text-sm text-gray-500 text-center sm:text-left">
              © {new Date().getFullYear()} {t("landing.brand", "Grimbot")}. {t("landing.footer.allRights", "All rights reserved.")}
            </p>
            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
              <button className="text-gray-600 hover:text-indigo-600 transition-colors">
                {t("landing.footer.privacy", "Privacy")}
              </button>
              <button className="text-gray-600 hover:text-indigo-600 transition-colors">
                {t("landing.footer.terms", "Terms")}
              </button>
              <button className="text-gray-600 hover:text-indigo-600 transition-colors">
                {t("landing.footer.support", "Support")}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
