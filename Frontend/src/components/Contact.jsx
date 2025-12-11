import React from "react";
import { ArrowLeft, Mail, Phone, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Contact({ onBack }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 flex flex-col animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("contact.back")}
            </button>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600" />
              <span className="text-lg font-bold tracking-tight">grimbot</span>
            </div>
          </div>
          <span className="text-lg font-semibold text-gray-700">{t("contact.title")}</span>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 py-8 flex-1">
        {/* Page Title */}
        <div className="mb-12 text-center animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 animate-slide-up">
            {t("contact.pageTitle")}
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '100ms' }}>
            {t("contact.subtitle")}
          </p>
        </div>

        {/* Contact Info Cards - Centered */}
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600" />
              <span className="font-semibold text-gray-900">grimbot</span>
            </div>
            <p className="text-sm text-gray-600">
              © {new Date().getFullYear()} grimbot. {t("contact.footer")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
