// App.jsx
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import FormSteps from "./FormSteps";
import SidebarPreview from "./components/SidebarPreview";
import LoadingPage from "./components/LoadingPage";
import CreateAccountModal from "./components/CreateAccountModal";
import LandingPage from "./components/LandingPage";
import Pricing from "./components/Pricing";
import Contact from "./components/Contact";
import OtpPage from "./components/OtpPage";
import Dashboard from "./components/Dashboard";
import { API_ENDPOINTS } from "./config/api";

export default function App() {
	const { t } = useTranslation();
	const controllersRef = React.useRef(new Set());

	// --- State ---
	const [formData, setFormData] = useState({});
	const [formSubmitted, setFormSubmitted] = useState(false);
	const [leftWebsite, setLeftWebsite] = useState("");
	const [apiKey, setApiKey] = useState(null);
	const [widgetScript, setWidgetScript] = useState(null);
	const [pendingFormData, setPendingFormData] = useState(null);
	const [currentView, setCurrentView] = useState("loading");
	// 'landing' | 'login' | 'form' | 'dashboard' | 'pricing' | 'contact'
	const [showOtpModal, setShowOtpModal] = useState(false);
	const [editingChatbot, setEditingChatbot] = useState(null);
	const [activeChatbotId, setActiveChatbotId] = useState(null);
	// Loading/Progress
	const [formLoading, setFormLoading] = useState(false);
	const [formProgress, setFormProgress] = useState(null);

	// loggin State
	const [isLoggedIn, setIsLoggedIn] = useState(false);

	// --- Πλοήγηση βημάτων ---
	const [currentPage, setCurrentPage] = useState(0);
	const [maxVisitedPage, setMaxVisitedPage] = useState(0);

	// --- Mobile steps dropdown state ---
	const [showMobileSteps, setShowMobileSteps] = useState(false);

	// Παίρνει τις μεταφράσεις των βημάτων
	const stepLabels = t("steps", { returnObjects: true }) || {};
	const steps = Object.values(stepLabels);

	//όταν φορτώνει η σελίδα κάνει fetch στο endpoint checksession
	useEffect(() => {
		const verifySession = async () => {
			try {
				const res = await fetch(API_ENDPOINTS.checkSession, {
					credentials: "include", // στέλνει το cookie
					cache: "no-store",
				});
				if (res.ok) {
					console.log("[Auth] ✅ Session valid");
					setIsLoggedIn(true);
					setCurrentView("dashboard");
				} else {
					console.log("[Auth] ❌ Invalid session");
					setIsLoggedIn(false);
					setCurrentView("landing");
				}
			} catch (err) {
				console.error("[Auth] Error verifying session:", err);
				setCurrentView("landing");
			}
		};
		verifySession();
	}, []);

	const handleNext = () => {
		if (currentPage < steps.length - 1) {
			const newPage = currentPage + 1;
			setCurrentPage(newPage);
			if (newPage > maxVisitedPage) setMaxVisitedPage(newPage);
		}
	};

	const handlePrev = () => {
		if (currentPage > 0) setCurrentPage(currentPage - 1);
	};

	const handleGoToPage = (pageIndex) => {
		if (pageIndex <= maxVisitedPage) {
			setCurrentPage(pageIndex);
			setShowMobileSteps(false); // κλείσιμο dropdown μετά την επιλογή
		}
	};

	const ACCENT_TITLE = "indigo";
	const titleClass = {
		indigo: "text-indigo-400",
		teal: "text-teal-400",
		amber: "text-amber-400",
		cyan: "text-cyan-400",
	}[ACCENT_TITLE];

	// Υποβολή φόρμας
	const performRealSubmit = async (finalData) => {
		let interval = null;
		try {
			setFormLoading(true);
			setFormProgress(8);
			interval = setInterval(() => {
				setFormProgress((p) =>
					p === null ? 8 : Math.min(p + Math.random() * 8, 92)
				);
			}, 700);

			const res = await fetch(API_ENDPOINTS.createChatbot, {
				method: "POST",
				credentials: "include",
				body: finalData,
			});
			if (!res.ok) throw new Error("create_chatbot failed");

			const responseData = await res.json();
			console.log(
				"%c[App.jsx] ✅ performRealSubmit -> New chatbot created",
				"color:green; font-weight:bold;"
			);
			console.log("Previous activeChatbotId:", activeChatbotId);
			console.log(
				"New chatbot_id from backend:",
				responseData.chatbot_id
			);

			setApiKey(responseData.api_key);
			setWidgetScript(responseData.widget_script);
			setActiveChatbotId(responseData.chatbot_id);

			console.log(
				"%c[App.jsx] 🔄 activeChatbotId updated!",
				"color:orange; font-weight:bold;",
				responseData.chatbot_id
			);

			clearInterval(interval);
			setFormProgress(100);
			setTimeout(() => {
				const companyInfoStr = finalData.get("company_info");
				const companyData = JSON.parse(companyInfoStr);
				setFormData((prev) => ({ ...prev, ...companyData }));
				setLeftWebsite(companyData.websiteURL || "");
				setFormLoading(false);
				setFormProgress(null);
				setCurrentPage((prev) => prev + 1);
			}, 300);
		} catch (error) {
			if (interval) clearInterval(interval);
			setFormLoading(false);
			setFormProgress(null);
			console.error(error);
			alert("Κάτι πήγε στραβά. Δοκίμασε ξανά.");
		}
	};

	const performUpdate = async (finalData, chatbotId) => {
		let interval = null;
		try {
			setFormLoading(true);
			setFormProgress(8);
			interval = setInterval(() => {
				setFormProgress((p) =>
					p === null ? 8 : Math.min(p + Math.random() * 8, 92)
				);
			}, 700);

			const res = await fetch(
				`${API_ENDPOINTS.updateChatbot}/${chatbotId}`,
				{
					method: "PUT",
					credentials: "include",
					body: finalData,
				}
			);
			if (!res.ok) throw new Error("update_chatbot failed");

			clearInterval(interval);
			setFormProgress(100);

			console.log(
				"%c[App.jsx] ✏️ performUpdate -> Updating existing chatbot",
				"color:deepskyblue; font-weight:bold;"
			);
			console.log("Chatbot ID to update:", chatbotId);
			console.log("Previous activeChatbotId:", activeChatbotId);

			setTimeout(() => {
				const companyInfoStr = finalData.get("company_info");
				const companyData = JSON.parse(companyInfoStr || "{}");
				setFormData((prev) => ({ ...prev, ...companyData }));
				setLeftWebsite(companyData.websiteURL || "");

				setActiveChatbotId(chatbotId); // Θέτει ποιο chatbot είναι ενεργό

				console.log(
					"%c[App.jsx] 🔄 activeChatbotId updated after edit!",
					"color:orange; font-weight:bold;",
					chatbotId
				);

				setCurrentPage(5); // Πηγαίνει στο Test tab (index 5 = 6ο βήμα)
				setEditingChatbot(null); // Καθαρίζει το edit mode flag

				setFormLoading(false);
				setFormProgress(null);
			}, 300);
		} catch (error) {
			if (interval) clearInterval(interval);
			setFormLoading(false);
			setFormProgress(null);
			console.error(error);
			alert("Κάτι πήγε στραβά. Δοκίμασε ξανά.");
		}
	};

	//
	const handleFormSubmit = async (finalData) => {
		if (editingChatbot) {
			// Edit mode → UPDATE (PUT), χωρίς OTP
			await performUpdate(finalData, editingChatbot.chatbot_id);
			return;
		}
		// Create mode → loggin
		if (isLoggedIn) {
			await performRealSubmit(finalData);
			return;
		}
		// first time , create mode , show otp
		setPendingFormData(finalData);
		setShowOtpModal(true);
	};

	const handleLogout = async () => {
		try {
			await fetch(API_ENDPOINTS.logout, {
				method: "POST",
				credentials: "include",
			});
		} catch (error) {
			console.error("Logout failed:", error);
		} finally {
			controllersRef.current.forEach((c) => c.abort());
			controllersRef.current.clear();

			setIsLoggedIn(false);
			setActiveChatbotId(null);
			setEditingChatbot(null);

			setFormData({});
			setPendingFormData(null);
			setFormSubmitted(false);
			setCurrentPage(0);
			setMaxVisitedPage(0);
			setShowMobileSteps(false);
			setFormLoading(false);
			setFormProgress(null);

			setApiKey(null);
			setWidgetScript(null);
			setLeftWebsite("");
			setShowOtpModal(false);
			setCurrentView("landing");
		}
	};

	//edit σε πάει στο form
	const handleEditBot = (chatbotId) => {
		console.log(
			"%c[App.jsx] 🛠 handleEditBot called",
			"color:purple; font-weight:bold;"
		);
		console.log("Selected chatbotId from Dashboard:", chatbotId);
		console.log("Previous activeChatbotId:", activeChatbotId);

		setEditingChatbot({ chatbot_id: chatbotId });

		console.log(
			"%c[App.jsx] 🔄 activeChatbotId set via handleEditBot",
			"color:orange; font-weight:bold;",
			chatbotId
		);

		setActiveChatbotId(chatbotId);
		setCurrentPage(0);
		setCurrentView("form");
	};

	const handleGoToDashboard = () => {
		setEditingChatbot(null);
		setActiveChatbotId(null);
		setCurrentView("dashboard");
	};

	const handleCreateNewBot = () => {
		// Καθαρίζει το edit mode
		setEditingChatbot(null);
		setActiveChatbotId(null);

		// Νέο bot ⇒ καθαρά κλειδιά
		setApiKey("");
		setWidgetScript("");

		// Καθαρά δεδομένα φόρμας
		setFormData({});
		setPendingFormData(null);
		setShowOtpModal(false);

		// Επαναφέρει τη φόρμα στην αρχή
		setCurrentPage(0);
		setMaxVisitedPage(0);

		// Μετάβαση στη φόρμα
		setCurrentView("form");
	};

	const mobileStepLabel = t("formSteps.stepShortOfTotal", {
		defaultValue: "Βήμα {{current}} από {{total}}",
		current: currentPage + 1,
		total: steps.length,
	});

	if (currentView === "loading") {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
					<p className="mt-4 text-gray-600">Έλεγχος συνεδρίας...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen font-sans">
			{currentView === "landing" && (
				<LandingPage
					onStart={() => setCurrentView("form")}
					onSignIn={() => setCurrentView("login")}
					onPricing={() => setCurrentView("pricing")}
					onContact={() => setCurrentView("contact")}
				/>
			)}
			{currentView === "pricing" && (
				<Pricing onBack={() => setCurrentView("landing")} />
			)}
			{currentView === "contact" && (
				<Contact onBack={() => setCurrentView("landing")} />
			)}

			{currentView === "login" && (
				<OtpPage
					onSubmit={() => {
						setIsLoggedIn(true);
						setCurrentView("dashboard");
					}}
				/>
			)}

			{currentView === "dashboard" && (
				<div className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
					<Dashboard
						onLogout={handleLogout}
						onCreateNewBot={handleCreateNewBot}
						onEditBot={handleEditBot}
						activeChatbotId={activeChatbotId} // ✅ προσθήκη
						onSelectBot={(id) => {
							console.log(
								"%c[App.jsx] 🎯 onSelectBot called",
								"color:orange; font-weight:bold;"
							);
							console.log(
								"Previous activeChatbotId:",
								activeChatbotId
							);
							console.log(
								"New selected bot ID from Dashboard:",
								id
							);

							setActiveChatbotId(id);

							console.log(
								"%c[App.jsx] ✅ activeChatbotId updated via Dashboard click",
								"color:green; font-weight:bold;",
								id
							);
						}}
					/>
				</div>
			)}

			{currentView === "form" && (
				<>
					{/* Mobile Header */}
					<div className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
						<div className="px-3 sm:px-4 py-3 flex items-center justify-between">
							<h1
								className={`text-base sm:text-xl font-bold ${titleClass} truncate max-w-[60%]`}
							>
								{t("appTitle")}
							</h1>

							{!formSubmitted && !formLoading && (
								<button
									onClick={() =>
										setShowMobileSteps((s) => !s)
									}
									className="flex items-center space-x-1 sm:space-x-2 text-gray-700 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100"
									aria-expanded={showMobileSteps}
									aria-controls="mobile-steps"
								>
									<span className="text-xs sm:text-sm font-medium">
										{mobileStepLabel}
									</span>
									<svg
										className={`w-3 h-3 sm:w-4 sm:h-4 transform transition-transform ${
											showMobileSteps ? "rotate-180" : ""
										}`}
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M19 9l-7 7-7-7"
										/>
									</svg>
								</button>
							)}
						</div>

						{showMobileSteps && !formSubmitted && !formLoading && (
							<div
								id="mobile-steps"
								className="border-t border-gray-200 bg-white shadow-lg"
							>
								<div className="px-4 py-2">
									<SidebarPreview
										steps={steps}
										currentPage={currentPage}
										maxVisitedPage={maxVisitedPage}
										onGoToPage={handleGoToPage}
										isMobile={true}
									/>
								</div>
							</div>
						)}
					</div>

					<div className="flex min-h-screen lg:min-h-screen">
						{/* Desktop Sidebar */}
						<div className="hidden lg:flex bg-gray-100 pl-6 pr-4 py-8 flex-col border-r border-gray-200 lg:w-72 flex-none">
							{!formSubmitted ? (
								<SidebarPreview
									steps={steps}
									currentPage={currentPage}
									maxVisitedPage={maxVisitedPage}
									onGoToPage={handleGoToPage}
								/>
							) : (
								<div className="z-10 flex flex-col justify-between h-full">
									<div>
										<h1
											className={`text-3xl font-bold ${titleClass}`}
										>
											{t("appTitle")}
										</h1>
										<p className="mt-4 text-gray-600 font-light tracking-wide">
											{t("chatActiveSubtitle")}
										</p>
									</div>
									<div className="mt-10 flex items-center justify-center min-h-[280px]" />
									<div>
										<p className="text-sm text-gray-500">
											© 2025 Your Company
										</p>
									</div>
								</div>
							)}
						</div>

						{/* Main content */}
						<div className="w-full lg:flex-1 bg-zinc-50 min-h-screen lg:min-h-auto">
							<div
								className={`w-full ${
									formLoading
										? "flex items-center justify-center min-h-screen lg:min-h-auto"
										: ""
								}`}
							>
								<div className="px-3 sm:px-4 md:px-6 lg:px-10 py-3 sm:py-4 md:py-6 lg:py-10">
									<div className="max-w-full sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto">
										{formSubmitted ? (
											<div className="w-full">
												<ChatBubble
													chatbotData={formData}
													apiKey={apiKey}
												/>
											</div>
										) : formLoading ? (
											<div className="w-full max-w-2xl">
												<LoadingPage
													title={t(
														"creatingChatbotTitle"
													)}
													subtitle={t(
														"creatingChatbotSubtitle"
													)}
													progress={formProgress}
													tips={[
														t("dontClosePage"),
														t(
															"willNotifyWhenReady"
														),
													]}
												/>
											</div>
										) : (
											<div className="w-full pt-4 lg:pt-0">
												<FormSteps
													key={String(
														activeChatbotId ??
															"create"
													)}
													currentPage={currentPage}
													steps={steps}
													onNext={handleNext}
													onPrev={handlePrev}
													onFormSubmit={
														handleFormSubmit
													}
													onGoToDashboard={
														handleGoToDashboard
													}
													apiKey={apiKey}
													widgetScript={widgetScript}
													inheritedFormData={formData}
													editMode={editingChatbot}
													activeChatbotId={
														activeChatbotId
													}
													setApiKey={setApiKey}
													setWidgetScript={
														setWidgetScript
													}
												/>
											</div>
										)}
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Overlay for mobile dropdown */}
					{showMobileSteps && (
						<div
							className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
							onClick={() => setShowMobileSteps(false)}
						/>
					)}

					{/* OTP Modal */}
					{showOtpModal && (
						<div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
							<CreateAccountModal
								onSuccess={async () => {
									setShowOtpModal(false);
									await performRealSubmit(pendingFormData);
								}}
								onCancel={() => setShowOtpModal(false)}
							/>
						</div>
					)}
				</>
			)}
		</div>
	);
}
