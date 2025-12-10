// src/components/LandingPage.jsx
import React from "react";
import { Rocket, Shield, Sparkles, ArrowRight, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function LandingPage({ onStart, onSignIn }) {
  const { t, i18n } = useTranslation();

  // 🔘 Inline κουμπί αλλαγής γλώσσας (χωρίς ξεχωριστό component)
  const isGreek = i18n.language?.startsWith("el");
  const nextLang = isGreek ? "en" : "el";
  const langLabel = isGreek ? "EN" : "EL";
  const langAria = isGreek ? "Switch to English" : "Αλλαγή σε Ελληνικά";
  const toggleLang = () => i18n.changeLanguage(nextLang);

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-b from-white to-zinc-50 text-gray-900 flex flex-col">
      {/* Header */}
      <header className="shrink-0 sticky top-0 z-30 bg-white/70 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600" />
            <span className="text-lg font-bold tracking-tight">
              {t("landing.brand", "YourBrand")}
            </span>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <button className="hover:text-indigo-600">
              {t("landing.nav.features", "Features")}
            </button>
            <button className="hover:text-indigo-600">
              {t("landing.nav.pricing", "Pricing")}
            </button>
            <button className="hover:text-indigo-600">
              {t("landing.nav.contact", "Contact")}
            </button>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Κουμπί αλλαγής γλώσσας μέσα στον ίδιο κώδικα */}
            <button
              onClick={toggleLang}
              aria-label={langAria}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              <Globe className="h-4 w-4 text-gray-700" />
              {langLabel}
            </button>

            <button
              onClick={onSignIn}
              className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
              aria-label={t("landing.cta.signIn", "Sign in")}
            >
              {t("landing.cta.signIn", "Sign in")}
            </button>
            <button
              onClick={onStart}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm flex items-center gap-1"
              aria-label={t("landing.cta.getStarted", "Get Started")}
            >
              {t("landing.cta.getStarted", "Get Started")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        <section className="relative h-full">
          {/* Soft blobs */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-purple-200/40 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
          </div>

          <div className="relative h-full">
            <div className="mx-auto max-w-6xl h-full px-4">
              <div className="grid h-full items-center">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                    {t("landing.badge", "New: Faster onboarding")}
                  </div>

                  <h1 className="mt-4 text-4xl md:text-6xl font-extrabold tracking-tight">
                    {t("landing.hero.title", "Build delightful experiences in minutes.")}
                  </h1>

                  <p className="mt-4 text-lg md:text-xl text-gray-600">
                    {t(
                      "landing.hero.subtitle",
                      "Launch a polished product site with a clean design, responsive layout, and zero fuss."
                    )}
                  </p>

                  <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={onStart}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 font-medium"
                      aria-label={t("landing.cta.startFree", "Start for Free")}
                    >
                      {t("landing.cta.startFree", "Start for Free")}
                    </button>
                    <button
                      onClick={onStart}
                      className="px-6 py-3 rounded-xl border border-gray-300 hover:bg-gray-50 font-medium"
                      aria-label={t("landing.cta.liveDemo", "Live Demo")}
                    >
                      {t("landing.cta.liveDemo", "Live Demo")}
                    </button>
                  </div>

                  {/* Feature cards */}
                  <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
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

                    <div className="rounded-2xl border border-gray-200 bg-white p-5 flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
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

                    <div className="rounded-2xl border border-gray-200 bg-white p-5 flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
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

                {/* Optional right visual could go here */}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="shrink-0 border-t border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} {t("landing.brand", "YourBrand")}.{" "}
            {t("landing.footer.allRights", "All rights reserved.")}
          </p>
          <div className="flex items-center gap-4 text-sm">
            <button className="text-gray-600 hover:text-indigo-600">
              {t("landing.footer.privacy", "Privacy")}
            </button>
            <button className="text-gray-600 hover:text-indigo-600">
              {t("landing.footer.terms", "Terms")}
            </button>
            <button className="text-gray-600 hover:text-indigo-600">
              {t("landing.footer.support", "Support")}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
