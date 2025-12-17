import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

export default function FeaturesPage({ onClose }) {
	const { t } = useTranslation();

	return (
		<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
			<div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
				{/* Header */}
				<div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 flex items-center justify-between">
					<h2 className="text-2xl sm:text-3xl font-bold">
						{t("landing.features.title", "Powerful Features")}
					</h2>
					<button
						onClick={onClose}
						className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
						aria-label="Close"
					>
						<X className="h-6 w-6" />
					</button>
				</div>

				{/* Features Grid */}
				<div className="p-4 sm:p-6">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
						{/* Feature 1: AI Chatbot */}
						<div className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 sm:p-6 hover:shadow-lg transition-shadow">
							<div className="text-3xl mb-3">🤖</div>
							<h3 className="font-bold text-base sm:text-lg mb-2">
								{t(
									"landing.features.aiChatbot.title",
									"AI-Powered Chatbot"
								)}
							</h3>
							<p className="text-sm sm:text-base text-gray-600">
								{t(
									"landing.features.aiChatbot.desc",
									"Create intelligent chatbots without coding using GPT-4."
								)}
							</p>
						</div>

						{/* Feature 2: Website Scraping */}
						<div className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 sm:p-6 hover:shadow-lg transition-shadow">
							<div className="text-3xl mb-3">🌐</div>
							<h3 className="font-bold text-base sm:text-lg mb-2">
								{t(
									"landing.features.websiteKnowledge.title",
									"Website Knowledge Base"
								)}
							</h3>
							<p className="text-sm sm:text-base text-gray-600">
								{t(
									"landing.features.websiteKnowledge.desc",
									"Automatically scrape and index your company website for instant AI knowledge."
								)}
							</p>
						</div>

						{/* Feature 3: Multi-Language */}
						<div className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 sm:p-6 hover:shadow-lg transition-shadow">
							<div className="text-3xl mb-3">🗣️</div>
							<h3 className="font-bold text-base sm:text-lg mb-2">
								{t(
									"landing.features.multiLanguage.title",
									"Multi-Language Support"
								)}
							</h3>
							<p className="text-sm sm:text-base text-gray-600">
								{t(
									"landing.features.multiLanguage.desc",
									"Support customers in Greek, English, and many other languages."
								)}
							</p>
						</div>

						{/* Feature 4: Widget Deployment */}
						<div className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 sm:p-6 hover:shadow-lg transition-shadow">
							<div className="text-3xl mb-3">📱</div>
							<h3 className="font-bold text-base sm:text-lg mb-2">
								{t(
									"landing.features.easyDeployment.title",
									"Easy Widget Deployment"
								)}
							</h3>
							<p className="text-sm sm:text-base text-gray-600">
								{t(
									"landing.features.easyDeployment.desc",
									"Deploy chatbot to your website with just a few lines of code."
								)}
							</p>
						</div>

						{/* Feature 5: Face Recognition */}
						<div className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 sm:p-6 hover:shadow-lg transition-shadow">
							<div className="text-3xl mb-3">👤</div>
							<h3 className="font-bold text-base sm:text-lg mb-2">
								{t(
									"landing.features.faceAuth.title",
									"Face Recognition Login"
								)}
							</h3>
							<p className="text-sm sm:text-base text-gray-600">
								{t(
									"landing.features.faceAuth.desc",
									"Secure account access using biometric face recognition technology."
								)}
							</p>
						</div>

						{/* Feature 6: Lead Capture */}
						<div className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 sm:p-6 hover:shadow-lg transition-shadow">
							<div className="text-3xl mb-3">📋</div>
							<h3 className="font-bold text-base sm:text-lg mb-2">
								{t(
									"landing.features.leadCapture.title",
									"Lead Capture Forms"
								)}
							</h3>
							<p className="text-sm sm:text-base text-gray-600">
								{t(
									"landing.features.leadCapture.desc",
									"Collect customer information and convert conversations into qualified leads."
								)}
							</p>
						</div>

						{/* Feature 7: Appointments */}
						<div className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 sm:p-6 hover:shadow-lg transition-shadow">
							<div className="text-3xl mb-3">📅</div>
							<h3 className="font-bold text-base sm:text-lg mb-2">
								{t(
									"landing.features.appointments.title",
									"Appointment Scheduling"
								)}
							</h3>
							<p className="text-sm sm:text-base text-gray-600">
								{t(
									"landing.features.appointments.desc",
									"Allow customers to book appointments directly through the chatbot."
								)}
							</p>
						</div>

						{/* Feature 8: Real-Time */}
						<div className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 sm:p-6 hover:shadow-lg transition-shadow">
							<div className="text-3xl mb-3">⚡</div>
							<h3 className="font-bold text-base sm:text-lg mb-2">
								{t(
									"landing.features.realTime.title",
									"Real-Time Conversations"
								)}
							</h3>
							<p className="text-sm sm:text-base text-gray-600">
								{t(
									"landing.features.realTime.desc",
									"Instant responses and live chat with your customers 24/7."
								)}
							</p>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="border-t border-gray-200 p-4 sm:p-6 bg-gradient-to-r from-indigo-50 to-purple-50">
					<button
						onClick={onClose}
						className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 font-medium transition-all shadow-lg hover:shadow-xl"
					>
						{t("common.close", "Close")}
					</button>
				</div>
			</div>
		</div>
	);
}
