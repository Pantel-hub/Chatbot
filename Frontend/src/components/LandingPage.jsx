// src/components/LandingPage.jsx
import React from "react";
import { Rocket, Shield, Sparkles, ArrowRight, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import chatbotLandingSvg from "../assets/chatbot_landing.svg";

export default function LandingPage({ onStart, onSignIn, onPricing, onContact }) {
  const { t, i18n } = useTranslation();

  // 🔘 Inline κουμπί αλλαγής γλώσσας (χωρίς ξεχωριστό component)
  const isGreek = i18n.language?.startsWith("el");
  const nextLang = isGreek ? "en" : "el";
  const langLabel = isGreek ? "EN" : "EL";
  const langAria = isGreek ? "Switch to English" : "Αλλαγή σε Ελληνικά";
  const toggleLang = () => i18n.changeLanguage(nextLang);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 text-gray-900 flex flex-col animate-fade-in overflow-x-hidden">
      {/* Header */}
      <header className="shrink-0 sticky top-0 z-30 bg-white/70 backdrop-blur border-b border-gray-100 w-full">
        <div className="mx-auto max-w-6xl px-3 sm:px-4">
          {/* Top bar */}
          <div className="py-3 sm:py-4 flex items-center justify-between">
            {/* Brand */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600" />
              <span className="text-base sm:text-lg font-bold tracking-tight">
                {t("landing.brand", "Grimbot")}
              </span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-sm">
              <button className="hover:text-indigo-600 transition-colors">
                {t("landing.nav.features", "Features")}
              </button>
              <button className="hover:text-indigo-600 transition-colors" onClick={onPricing}>
                {t("landing.nav.pricing", "Pricing")}
              </button>
              <button className="hover:text-indigo-600 transition-colors" onClick={onContact}>
                {t("landing.nav.contact", "Contact")}
              </button> 
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Κουμπί αλλαγής γλώσσας μέσα στον ίδιο κώδικα */}
              <button
                onClick={toggleLang}
                aria-label={langAria}
                className="inline-flex items-center justify-center gap-1 sm:gap-2 rounded-lg sm:rounded-xl border border-gray-300 bg-white p-1.5 sm:px-3 sm:py-1.5 text-xs sm:text-sm hover:bg-gray-50 transition-colors"
              >
                <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-700" />
                <span className="hidden sm:inline">{langLabel}</span>
              </button>

              <button
                onClick={onSignIn}
                className="inline-flex items-center justify-center px-2 xs:px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-xs sm:text-sm transition-colors whitespace-nowrap"
                aria-label={t("landing.cta.signIn", "Sign in")}
              >
                <span className="hidden xs:inline">{t("landing.cta.signIn", "Sign in")}</span>
                <span className="xs:hidden text-[10px]">Login</span>
              </button>
              <button
                onClick={onStart}
                className="inline-flex items-center justify-center px-2 xs:px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs sm:text-sm gap-1 transition-colors whitespace-nowrap"
                aria-label={t("landing.cta.getStarted", "Get Started")}
              >
                <span className="hidden xs:inline">{t("landing.cta.getStarted", "Get Started")}</span>
                <span className="xs:hidden text-[10px]">Start</span>
                <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>

          {/* Mobile Nav */}
          <nav className="md:hidden border-t border-gray-200 py-2 flex items-center justify-center gap-4 text-xs">
            <button className="hover:text-indigo-600 transition-colors py-1">
              {t("landing.nav.features", "Features")}
            </button>
            <button className="hover:text-indigo-600 transition-colors py-1" onClick={onPricing}>
              {t("landing.nav.pricing", "Pricing")}
            </button>
            <button className="hover:text-indigo-600 transition-colors py-1" onClick={onContact}>
              {t("landing.nav.contact", "Contact")}
            </button> 
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden w-full">
        <section className="relative min-h-[calc(100vh-64px)] w-full">
          {/* Soft blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-purple-200/40 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
          </div>

          <div className="relative w-full">
            <div className="mx-auto max-w-6xl px-3 sm:px-4 py-8 sm:py-12 lg:py-16 w-full">
              <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center w-full">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-indigo-700">
                    {t("landing.badge", "New: Faster onboarding")}
                  </div>

                  <h1 className="mt-3 sm:mt-4 text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                    {t("landing.hero.title", "Build delightful experiences in minutes.")}
                  </h1>

                  <p className="mt-3 sm:mt-4 text-sm sm:text-lg md:text-xl text-gray-600">
                    {t(
                      "landing.hero.subtitle",
                      "Launch a polished product site with a clean design, responsive layout, and zero fuss."
                    )}
                  </p>

                  <div className="mt-6 sm:mt-8">
                    <button
                      onClick={onStart}
                      className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 font-medium text-sm sm:text-base transition-all shadow-lg hover:shadow-xl"
                      aria-label={t("landing.cta.startFree", "Start for Free")}
                    >
                      {t("landing.cta.startFree", "Start for Free")}
                    </button>
                  </div>

                  {/* Feature cards */}
                  <div className="mt-6 sm:mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 flex items-start gap-3 hover:shadow-lg hover:scale-105 hover:border-indigo-300 transition-all duration-300 animate-slide-up" style={{ animationDelay: '300ms' }}>
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 transition-transform hover:rotate-12">
                        <Sparkles className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {t("landing.features.cleanDesign.title", "Clean Design")}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {t("landing.features.cleanDesign.desc", "Modern typography and balanced layout.")}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5 flex items-start gap-3 hover:shadow-lg hover:scale-105 hover:border-indigo-300 transition-all duration-300 animate-slide-up" style={{ animationDelay: '400ms' }}>
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 transition-transform hover:rotate-12">
                        <Shield className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {t("landing.features.secureFast.title", "Secure & Fast")}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {t("landing.features.secureFast.desc", "Best practices and lightweight assets.")}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5 flex items-start gap-3 hover:shadow-lg hover:scale-105 hover:border-indigo-300 transition-all duration-300 animate-slide-up" style={{ animationDelay: '500ms' }}>
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 transition-transform hover:rotate-12">
                        <Rocket className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {t("landing.features.easyLaunch.title", "Easy to Launch")}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {t("landing.features.easyLaunch.desc", "Copy, paste, customize in seconds.")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SVG Image */}
                <div className="hidden lg:flex items-center justify-center">
                  <img 
                    src={chatbotLandingSvg} 
                    alt="Chatbot Landing" 
                    className="w-full max-w-md animate-fade-in"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="shrink-0 border-t border-gray-200 bg-white mt-auto">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <p className="text-xs sm:text-sm text-gray-500 text-center sm:text-left">
              © {new Date().getFullYear()} {t("landing.brand", "Grimbot")}.{" "}
              {t("landing.footer.allRights", "All rights reserved.")}
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
