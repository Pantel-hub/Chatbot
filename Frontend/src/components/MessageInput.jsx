// src/components/MessageInput.jsx

import React, { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";

export default function MessageInput({
	inputValue,
	onInputChange,
	onSendMessage,
	isLoading,
}) {
	const { t } = useTranslation();
	const textareaRef = useRef(null);
	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
		}
	}, [inputValue]);
	const handleKeyDown = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			onSendMessage(e);
		}
	};

	return (
		// --- ΑΛΛΑΓΕΣ ΕΔΩ ---
		// Αλλάξαμε το φόντο σε λευκό (bg-white) και το περίγραμμα σε ένα απαλό γκρι (border-slate-200)
		<div className="p-4 border-t border-slate-200 bg-white">
			<form
				className="flex items-center space-x-3"
				onSubmit={onSendMessage}
			>
				{/* --- ΚΑΙ ΕΔΩ --- */}
				{/* Αλλάξαμε το φόντο, το χρώμα κειμένου και το χρώμα του placeholder */}
				<textarea
					ref={textareaRef}
					className="flex-1 bg-slate-100 text-slate-900 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-fuchsia-500 placeholder-slate-500"
					value={inputValue}
					onChange={onInputChange}
					onKeyDown={handleKeyDown}
					placeholder={t("messagePlaceholder")}
					rows={1}
					disabled={isLoading}
				/>
				{/* --- ΤΟ ΚΟΥΜΠΙ ΠΑΡΑΜΕΝΕΙ ΙΔΙΟ --- */}
				{/* Το gradient δείχνει υπέροχο και στα δύο θέματα */}
				<button
					type="submit"
					className="w-12 h-12 flex-shrink-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={isLoading || !inputValue.trim()}
				>
					<PaperAirplaneIcon className="w-6 h-6" />
				</button>
			</form>
		</div>
	);
}
