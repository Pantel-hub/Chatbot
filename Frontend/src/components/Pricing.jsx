import React, { useEffect, useState } from "react";
import { ArrowLeft, DollarSign, Users, MessageSquare } from "lucide-react";
import chatbotLogo from "../assets/chatbot_logo.svg";
import { useTranslation } from "react-i18next";

export default function Pricing({ onBack }) {
  const { t } = useTranslation();
  const [userStats, setUserStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/cms/user-usage-stats")
      .then((res) => res.json())
      .then((data) => {
        setUserStats(data.users || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(t("pricing.noData"));
        setLoading(false);
      });
  }, [t]);

  // Calculate totals
  const totalUsers = userStats.length;
  const totalMessages = userStats.reduce((sum, user) => sum + (user.total_messages || 0), 0);
  const totalCost = userStats.reduce((sum, user) => sum + (user.cost_usd || 0), 0);

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
              <span className="hidden xs:inline">{t("pricing.back")}</span>
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
          <span className="text-sm sm:text-lg font-semibold text-gray-700">{t("pricing.title")}</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 mx-auto max-w-6xl px-4 py-8">
        {/* Page Title */}
        <div className="mb-6 sm:mb-8 animate-fade-in">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2 sm:mb-3 animate-slide-up">
            {t("pricing.pageTitle")}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-2xl animate-slide-up" style={{ animationDelay: '100ms' }}>
            {t("pricing.subtitle")}
          </p>
        </div>

        {/* Stats Cards */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm p-5 hover:shadow-lg hover:scale-105 hover:border-indigo-300 transition-all duration-300 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center transition-transform hover:rotate-12">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t("pricing.totalUsers")}</p>
                  <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm p-5 hover:shadow-lg hover:scale-105 hover:border-purple-300 transition-all duration-300 animate-slide-up" style={{ animationDelay: '300ms' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center transition-transform hover:rotate-12">
                  <MessageSquare className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t("pricing.totalMessages")}</p>
                  <p className="text-2xl font-bold text-gray-900">{totalMessages.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm p-5 hover:shadow-lg hover:scale-105 hover:border-green-300 transition-all duration-300 animate-slide-up" style={{ animationDelay: '400ms' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center transition-transform hover:rotate-12">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t("pricing.totalCost")}</p>
                  <p className="text-2xl font-bold text-gray-900">${totalCost.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table Card */}
        <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200/80 bg-gradient-to-b from-white to-gray-50">
            <h2 className="text-base font-semibold text-gray-900">{t("pricing.perUserBreakdown")}</h2>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600 font-medium">{error}</p>
              </div>
            ) : userStats.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">{t("pricing.noData")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("pricing.user")}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("pricing.messages")}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t("pricing.cost")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {userStats.map((user) => (
                      <tr key={user.user_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-gray-900 font-medium">
                          {(user.total_messages || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                            ${(user.cost_usd || 0).toFixed(4)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
