// src/SidebarPreview.jsx
import React from "react";
import { useTranslation } from "react-i18next";

export default function SidebarPreview({
	steps,
	currentPage,
	maxVisitedPage,
	onGoToPage,
	isMobile = false,
	showHeader = true,
}) {
	const { t } = useTranslation();
	const renderHeader = !isMobile && showHeader;

	// Η λογική για το πότε ξεκλειδώνει το κουμπί Analytics παραμένει
	const isAnalyticsUnlocked = maxVisitedPage >= steps.length - 1;

	return (
		<aside className="w-full sticky top-0 max-h-screen overflow-hidden py-4">
			{/* Header: μόνο στο desktop */}
			{renderHeader && (
				<div className="mb-4">
					<h1 className="text-xl font-bold text-indigo-600">
						{t("appTitle")}
					</h1>
					<p className="mt-2 text-sm text-gray-600">
						{t(
							"sidebarSubtitle",
							"Δημιουργήστε το AI chatbot σας σε μερικά βήματα."
						)}
					</p>
				</div>
			)}

			{/* Λίστα βημάτων */}
			<nav
				aria-label={t("stepsTitle", "Βήματα")}
				className={isMobile ? "mt-0" : "mt-4"}
			>
				{/* Ο container πρέπει να είναι 'relative' για να τοποθετηθεί σωστά η γραμμή */}
				<div className="relative">
					{/* --- ΝΕΟ: Η ΕΝΙΑΙΑ, ΣΥΝΕΧΗΣ ΓΡΑΜΜΗ --- */}
					{/* Αυτή η γραμμή τοποθετείται μία φορά, πίσω από όλα τα βήματα. */}
					<div
						aria-hidden="true"
						className="absolute left-3.5 top-3.5 bottom-3.5 w-0.5 -translate-x-1/2 bg-slate-200"
					/>
					{/* --- ΤΕΛΟΣ ΝΕΟΥ ΣΤΟΙΧΕΙΟΥ --- */}

					{steps.map((label, idx) => {
						const unlocked = idx <= maxVisitedPage;
						const active = idx === currentPage;

						return (
							<button
								key={idx}
								type="button"
								onClick={() => unlocked && onGoToPage(idx)}
								disabled={!unlocked}
								className={[
									"w-full flex items-center gap-3 py-3 text-left",
									unlocked
										? "cursor-pointer"
										: "opacity-50 cursor-not-allowed",
								].join(" ")}
							>
								{/* 
                  ΕΧΕΙ ΑΦΑΙΡΕΘΕΙ η παλιά, τμηματική γραμμή από εδώ μέσα.
                */}

								<span
									className={[
										"flex items-center justify-center w-7 h-7 rounded-full border",
										// Το 'relative' εξασφαλίζει ότι ο κύκλος θα εμφανιστεί ΠΑΝΩ από την γκρι γραμμή
										"relative",
										active
											? "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-300"
											: unlocked
											? "bg-indigo-600 text-white border-indigo-600" // Ολοκληρωμένο αλλά όχι active
											: "bg-white text-slate-600 border-slate-300", // Μη ολοκληρωμένο
									].join(" ")}
								>
									{unlocked && !active ? (
										<svg
											viewBox="0 0 24 24"
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											strokeWidth="3"
										>
											<path d="M20 6L9 17l-5-5" />
										</svg>
									) : (
										idx + 1
									)}
								</span>
								<span
									className={
										active
											? "text-indigo-600 font-medium"
											: "text-slate-700"
									}
								>
									{label}
								</span>
							</button>
						);
					})}
				</div>
			</nav>

			{/* Κουμπί για Analytics */}
			<div className="mt-4 pt-4 border-t border-slate-200">
				<a
					href="/analytics"
					className={[
						"w-full flex items-center gap-3 py-3 text-left transition-opacity",
						isAnalyticsUnlocked
							? "cursor-pointer"
							: "opacity-50 cursor-not-allowed",
					].join(" ")}
					onClick={(e) => {
						if (!isAnalyticsUnlocked) e.preventDefault();
					}}
					aria-disabled={!isAnalyticsUnlocked}
				>
					{/* Εικονίδιο */}
					<span className="flex items-center justify-center w-7 h-7 rounded-full border bg-white text-slate-600 border-slate-300">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							/>
						</svg>
					</span>
					<span className="text-slate-700">
						{t("analyticsPage", "Analytics")}
					</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="h-4 w-4 ml-auto text-slate-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
						/>
					</svg>
				</a>
			</div>

			{/* Powered by Conferience.com */}
			<div className="mt-4 pt-4 border-t border-slate-200">
				<p className="text-xs text-center">
					<span className="text-[#5B8BB8]">Powered by </span>
					<a 
						href="https://conferience.com/" 
						target="_blank" 
						rel="noopener noreferrer"
						className="text-[#5B8BB8] hover:text-indigo-700 hover:underline transition-colors"
					>
						Conferience.com
					</a>
					<span className="text-[#5B8BB8]"> © 🐿️</span>
				</p>
			</div>
		</aside>
	);
}
