// src/components/BasicInfo.jsx
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	BuildingOfficeIcon,
	GlobeAltIcon,
	WrenchScrewdriverIcon,
	PencilSquareIcon,
	PhotoIcon,
	LanguageIcon,
	ArrowUpTrayIcon,
	XMarkIcon,
	UserCircleIcon, // ➕ για το Bot Type (Preset)
} from "@heroicons/react/24/outline";
import TextareaAutosize from "react-textarea-autosize";

/* =========================
   Elegant Logo Uploader
   ========================= */
const LogoUploader = ({ logoPreview, handleInputChange, disabled, t }) => {
	const [isDragging, setIsDragging] = useState(false);

	const onDrop = useCallback(
		(e) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);
			if (disabled) return;

			const file = e.dataTransfer?.files?.[0];
			if (!file) return;

			// Send to FormSteps handleInputChange
			handleInputChange({
				target: { name: "logo", files: [file] },
			});
		},
		[handleInputChange, disabled]
	);

	const onRemove = useCallback(() => {
		if (disabled) return;
		handleInputChange({
			target: { name: "logo", files: [], value: null },
		});
	}, [handleInputChange, disabled]);

	return (
		<div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
			{/* Preview */}
			<div className="flex items-center justify-center">
				<div className="relative">
					{/* Decorative ring */}
					<div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-indigo-200 via-violet-200 to-rose-200 blur-sm opacity-70" />
					<div className="relative h-24 w-24 overflow-hidden rounded-full ring-1 ring-slate-200">
						{logoPreview ? (
							<img
								src={
									typeof logoPreview === "string"
										? logoPreview
										: URL.createObjectURL(logoPreview)
								}
								alt={t("logoUploader.previewAlt")}
								className="h-full w-full object-cover"
							/>
						) : (
							<div className="flex h-full w-full items-center justify-center bg-slate-50">
								<PhotoIcon className="h-10 w-10 text-slate-400" />
							</div>
						)}
					</div>

					{/* Remove button */}
					{logoPreview ? (
						<button
							type="button"
							onClick={onRemove}
							disabled={disabled}
							title={t("logoUploader.remove")}
							aria-label={t("logoUploader.remove")}
							className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white shadow ring-1 ring-slate-200 transition hover:shadow-md disabled:opacity-50"
						>
							<XMarkIcon className="h-4 w-4 text-slate-500" />
						</button>
					) : null}
				</div>
			</div>

			{/* Uploader */}
			<div className="sm:col-span-2">
				<label
					htmlFor="logo-upload"
					className="block text-xs sm:text-sm font-medium text-slate-600 mb-2"
				>
					{t("logoUploader.title")}
				</label>

				<div
					onDragOver={(e) => {
						e.preventDefault();
						if (!disabled) setIsDragging(true);
					}}
					onDragLeave={() => setIsDragging(false)}
					onDrop={onDrop}
					className={[
						"relative flex w-full items-center justify-between gap-4 rounded-2xl border p-4 sm:p-5 transition",
						isDragging
							? "border-indigo-500 bg-indigo-50/60"
							: "border-slate-200 bg-slate-50 hover:bg-white",
						disabled
							? "opacity-60 cursor-not-allowed"
							: "cursor-pointer",
					].join(" ")}
					onClick={() => {
						if (!disabled)
							document.getElementById("logo-upload")?.click();
					}}
					role="button"
					aria-disabled={disabled}
				>
					<div className="flex items-center gap-3">
						<span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 shadow-sm">
							<ArrowUpTrayIcon className="h-5 w-5 text-slate-600" />
						</span>
						<div className="text-sm">
							<p className="font-medium text-slate-800">
								{t("logoUploader.action")}
								<span className="text-slate-500">
									{" "}
									{t("logoUploader.orDragAndDrop")}
								</span>
							</p>
							<p className="text-xs text-slate-500">
								{t("logoUploader.hint")}
							</p>
						</div>
					</div>

					<div className="hidden sm:block text-xs text-right text-slate-500">
						<p>
							<span className="font-medium text-slate-700">
								{t("logoUploader.recommended")}
							</span>{" "}
							256×256 (1:1)
						</p>
						<p>{t("logoUploader.maxSize")} 2MB · PNG/JPG/SVG</p>
					</div>

					<input
						type="file"
						id="logo-upload"
						name="logo"
						onChange={handleInputChange}
						disabled={disabled}
						className="sr-only"
						accept="image/png, image/jpeg, image/gif, image/svg+xml"
					/>
				</div>

				{/* Caption / small helper text */}
				<p className="mt-2 text-xs text-slate-500">
					{t("logoUploader.caption")}
				</p>
			</div>
		</div>
	);
};

export default function BasicInfo({
	formData,
	handleInputChange,
	logoPreview,
	errors,
	disabled = false,
	editMode,
	editWebsiteData,
	onWebsiteDataChange,
	isEditingWebsiteData,
	setIsEditingWebsiteData,
	isRescraping,
	setIsRescraping,
}) {
	const { t } = useTranslation();

	const industryOptions = useMemo(
		() => [
			"technology",
			"finance",
			"healthcare",
			"education",
			"retail",
			"manufacturing",
			"hospitality",
			"media",
			"real_estate",
			"transportation",
			"energy",
			"government",
			"non_profit",
			"other",
		],
		[]
	);

	const languageOptions = useMemo(() => ["en", "el"], []);
	const botPresetOptions = useMemo(
		() => ["Sales", "Support", "FAQ", "Onboarding"],
		[]
	);

	const baseInputClasses =
		"w-full p-3 pl-9 sm:pl-10 border rounded-xl transition duration-200 bg-slate-50 focus:bg-white focus:outline-none text-base sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed";
	const normalClasses =
		"border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
	const errorClasses =
		"border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500";
	const labelClasses =
		"block text-xs sm:text-sm font-medium text-slate-600 mb-2";
	const errorTextClasses = "text-red-600 text-xs mt-1";
	const sectionTitle = "text-lg sm:text-xl font-semibold text-slate-800";
	const requiredMark = <span className="text-red-600 ml-1">*</span>;

	const normalizeUrl = useCallback((value) => {
		if (!value) return value;
		const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);
		return hasScheme ? value : `https://${value}`;
	}, []);

	const handleWebsiteBlur = (e) => {
		const v = e.target.value?.trim();
		if (!v) return;
		const normalized = normalizeUrl(v);
		if (normalized !== v) {
			handleInputChange({
				target: { name: "websiteURL", value: normalized },
			});
		}
	};

	const showOtherIndustry = formData.industry === "other";

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
			<div className="mb-4 sm:mb-6 flex items-center justify-between">
				<h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
					{t("basicInfo")}
				</h2>
			</div>

			<div className="space-y-6 sm:space-y-8">
				{/* Company Details */}
				<div className="space-y-4 sm:space-y-6">
					<h3 className={sectionTitle}>{t("companyDetails")}</h3>
					<div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
						<div className="md:col-span-2">
							<label
								htmlFor="company-name"
								className={labelClasses}
							>
								{t("companyName")}
								{errors.companyName ? requiredMark : null}
							</label>
							<div className="relative">
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 sm:pl-3">
									<BuildingOfficeIcon className="h-5 w-5 text-slate-400" />
								</div>
								<TextareaAutosize
									id="company-name"
									name="companyName"
									value={formData.companyName}
									onChange={handleInputChange}
									className={`${baseInputClasses} ${
										errors.companyName
											? errorClasses
											: normalClasses
									} resize-none`}
									placeholder={t(
										"placeholders.companyExample"
									)}
									minRows={1}
									disabled={disabled}
								/>
							</div>
							{errors.companyName && (
								<small className={errorTextClasses}>
									{t("required")}
								</small>
							)}
						</div>

						<div className="md:col-span-2">
							<label className={labelClasses}>
								{t("companyLogo")}
							</label>
							<LogoUploader
								logoPreview={logoPreview}
								handleInputChange={handleInputChange}
								disabled={disabled}
								t={t}
							/>
						</div>

						{/* 🆕 CONTACT EMAIL - ΠΡΟΣΘΗΚΗ ΕΔΩ */}
						<div className="md:col-span-2">
							<label
								htmlFor="contactEmail"
								className={labelClasses}
							>
								{t("contactEmail", "Email Επικοινωνίας")}
								{requiredMark}
							</label>
							<div className="relative">
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 sm:pl-3">
									<svg
										className="h-5 w-5 text-slate-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
										/>
									</svg>
								</div>
								<input
									type="email"
									id="contactEmail"
									name="contactEmail"
									value={formData.contactEmail || ""}
									onChange={handleInputChange}
									className={`${baseInputClasses} ${
										errors.contactEmail
											? errorClasses
											: normalClasses
									}`}
									placeholder="info@company.gr"
									required
									disabled={disabled}
								/>
							</div>
							{errors.contactEmail && (
								<small className={errorTextClasses}>
									{t("required")}
								</small>
							)}
						</div>
						{/* 🆕 ΤΕΛΟΣ CONTACT EMAIL */}

						<div>
							<label htmlFor="industry" className={labelClasses}>
								{t("industry")}
								{errors.industry ? requiredMark : null}
							</label>
							<div className="relative">
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 sm:pl-3">
									<WrenchScrewdriverIcon className="h-5 w-5 text-slate-400" />
								</div>
								<select
									id="industry"
									name="industry"
									value={formData.industry}
									onChange={handleInputChange}
									className={`${baseInputClasses} ${
										errors.industry
											? errorClasses
											: normalClasses
									}`}
									disabled={disabled}
								>
									<option value="">
										{t("selectIndustry")}
									</option>
									{industryOptions.map((key) => (
										<option key={key} value={key}>
											{t(`industries.${key}`)}
										</option>
									))}
								</select>
							</div>
							{errors.industry && (
								<small className={errorTextClasses}>
									{t("required")}
								</small>
							)}
						</div>

						{showOtherIndustry && (
							<div className="md:col-start-2">
								<label
									htmlFor="industryOther"
									className={labelClasses}
								>
									{t("other")}
									{errors.industryOther ? requiredMark : null}
								</label>
								<TextareaAutosize
									id="industryOther"
									name="industryOther"
									value={formData.industryOther}
									onChange={handleInputChange}
									className={`w-full p-3 border rounded-xl bg-slate-50 ${
										errors.industryOther
											? errorClasses
											: normalClasses
									} resize-none pl-3 text-base sm:text-sm`}
									placeholder={t(
										"placeholders.industryOther"
									)}
									minRows={1}
									disabled={disabled}
								/>
								{errors.industryOther && (
									<small className={errorTextClasses}>
										{t("required")}
									</small>
								)}
							</div>
						)}
					</div>
				</div>
				<div className="h-px w-full bg-slate-200" />
				{/* Chatbot Configuration */}
				<div className="space-y-4 sm:space-y-6">
					<h3 className={sectionTitle}>
						{t("conversationSettings")}
					</h3>
					<div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
						{/* Chatbot Language */}
						<div>
							<label
								htmlFor="chatbotLanguage"
								className={labelClasses}
							>
								{t("chatbotLanguage")}
								{errors.chatbotLanguage ? requiredMark : null}
							</label>
							<div className="relative">
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 sm:pl-3">
									<LanguageIcon className="h-5 w-5 text-slate-400" />
								</div>
								<select
									id="chatbotLanguage"
									name="chatbotLanguage"
									value={formData.chatbotLanguage}
									onChange={handleInputChange}
									className={`${baseInputClasses} ${
										errors.chatbotLanguage
											? errorClasses
											: normalClasses
									}`}
									disabled={disabled}
								>
									<option value="">
										{t("selectLanguage")}
									</option>
									{languageOptions.map((lang) => (
										<option key={lang} value={lang}>
											{t(`languages.${lang}`)}
										</option>
									))}
								</select>
							</div>
							{errors.chatbotLanguage && (
								<small className={errorTextClasses}>
									{t("required")}
								</small>
							)}
						</div>

						{/* ➕ Bot Type (Preset) */}
						<div>
							<label
								htmlFor="bot-type-preset"
								className={labelClasses}
							>
								{t("botTypePreset")}
							</label>
							<div className="relative">
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 sm:pl-3">
									<UserCircleIcon className="h-5 w-5 text-slate-400" />
								</div>
								<select
									id="bot-type-preset"
									name="botTypePreset"
									value={formData.botTypePreset || ""}
									onChange={handleInputChange}
									className={`${baseInputClasses} ${normalClasses}`}
									disabled={disabled}
								>
									<option value="">
										{t("placeholders.botTypePreset")}
									</option>
									{botPresetOptions.map((opt) => (
										<option key={opt} value={opt}>
											{t(`personas.${opt.toLowerCase()}`)}
										</option>
									))}
								</select>
							</div>
						</div>
					</div>
				</div>
				<div className="h-px w-full bg-slate-200" />
				{/* Web Presence */}
				<div className="space-y-4 sm:space-y-6">
					<h3 className={sectionTitle}>{t("webPresence")}</h3>
					<div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
						<div>
							<label htmlFor="website" className={labelClasses}>
								{t("website")}
								{errors.websiteURL ? requiredMark : null}
							</label>
							<div className="relative">
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 sm:pl-3">
									<GlobeAltIcon className="h-5 w-5 text-slate-400" />
								</div>
								<input
									type="url"
									id="website"
									name="websiteURL"
									value={formData.websiteURL}
									onChange={handleInputChange}
									onBlur={handleWebsiteBlur}
									className={`${baseInputClasses} ${
										errors.websiteURL
											? errorClasses
											: normalClasses
									}`}
									placeholder={t("placeholders.website")}
									inputMode="url"
									disabled={disabled}
								/>
							</div>
							{errors.websiteURL && (
								<small className={errorTextClasses}>
									{t("required")}
								</small>
							)}
						</div>
						<div>
							<label
								htmlFor="allowedDomains"
								className={labelClasses}
							>
								{t("domain")}
								{errors.allowedDomains ? requiredMark : null}
							</label>
							<div className="relative">
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 sm:pl-3">
									<GlobeAltIcon className="h-5 w-5 text-slate-400" />
								</div>
								<input
									type="text"
									id="allowedDomains"
									name="allowedDomains"
									value={formData.allowedDomains}
									onChange={handleInputChange}
									className={`${baseInputClasses} ${
										errors.allowedDomains
											? errorClasses
											: normalClasses
									}`}
									placeholder={t("placeholders.domain")}
									inputMode="url"
									disabled={disabled}
								/>
							</div>
							{errors.allowedDomains && (
								<small className={errorTextClasses}>
									{t("required")}
								</small>
							)}
						</div>
						{editMode && editWebsiteData && (
							<div className="md:col-span-2 mt-4">
								<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
									<h4 className="text-sm font-semibold text-slate-800 mb-3">
										{t(
											"websiteDataOptions",
											"Website Data Options"
										)}
									</h4>

									{/* Επιλογές */}
									<div className="space-y-3 mb-4">
										<label className="flex items-center space-x-3 cursor-pointer">
											<input
												type="radio"
												name="websiteDataOption"
												checked={
													!isEditingWebsiteData &&
													!isRescraping
												}
												onChange={() => {
													setIsEditingWebsiteData(
														false
													);
													setIsRescraping(false);
												}}
												className="w-4 h-4 text-indigo-600"
											/>
											<span className="text-sm text-slate-700">
												{t(
													"keepExistingData",
													"Keep existing website data"
												)}
											</span>
										</label>

										<label className="flex items-center space-x-3 cursor-pointer">
											<input
												type="radio"
												name="websiteDataOption"
												checked={isEditingWebsiteData}
												onChange={() => {
													setIsEditingWebsiteData(
														true
													);
													setIsRescraping(false);
												}}
												className="w-4 h-4 text-indigo-600"
											/>
											<span className="text-sm text-slate-700">
												{t(
													"editWebsiteData",
													"Edit website data manually"
												)}
											</span>
										</label>

										<label className="flex items-center space-x-3 cursor-pointer">
											<input
												type="radio"
												name="websiteDataOption"
												checked={isRescraping}
												onChange={() => {
													setIsRescraping(true);
													setIsEditingWebsiteData(
														false
													);
												}}
												className="w-4 h-4 text-indigo-600"
											/>
											<span className="text-sm text-slate-700">
												{t(
													"rescrapeWebsite",
													"Re-scrape website (get fresh data)"
												)}
											</span>
										</label>
									</div>

									{/* Textarea για manual edit */}
									{isEditingWebsiteData && (
										<div className="mt-4">
											<label className="block text-xs sm:text-sm font-medium text-slate-600 mb-2">
												{t(
													"websiteDataContent",
													"Website Content"
												)}
											</label>
											<textarea
												value={editWebsiteData}
												onChange={(e) =>
													onWebsiteDataChange(
														e.target.value
													)
												}
												className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm font-mono"
												rows={12}
												placeholder={t(
													"editWebsiteDataPlaceholder",
													"Edit the scraped website content here..."
												)}
											/>
											<p className="mt-2 text-xs text-slate-500">
												📊{" "}
												{editWebsiteData.length.toLocaleString()}{" "}
												characters
											</p>
										</div>
									)}

									{/* Info για rescraping */}
									{isRescraping && (
										<div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
											<p className="text-sm text-blue-800">
												⚠️{" "}
												{t(
													"rescrapingWarning",
													"The website will be scraped again when you update the chatbot. This may take a few moments."
												)}
											</p>
										</div>
									)}
								</div>{" "}
								{/* ✅ Κλείνει το Website Data Options container */}
							</div>
						)}{" "}
						{/* ✅ Κλείνει το conditional block */}
					</div>{" "}
					{/* ✅ Κλείνει το grid */}
				</div>{" "}
				{/* ✅ Κλείνει το Web Presence section */}
				<div className="h-px w-full bg-slate-200" />
				{/* Audience & Description */}
				<div className="space-y-4 sm:space-y-6"></div>
				{/* Audience & Description */}
				<div className="space-y-4 sm:space-y-6">
					<h3 className={sectionTitle}>
						{t("audienceAndDescription")}
					</h3>
					<div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
						<div className="md:col-span-2">
							<label
								htmlFor="description"
								className={labelClasses}
							>
								{t("description")}
								{errors.description ? requiredMark : null}
							</label>
							<div className="relative">
								<div className="pointer-events-none absolute top-3 left-0 flex items-center pl-2 sm:pl-3">
									<PencilSquareIcon className="h-5 w-5 text-slate-400" />
								</div>
								<TextareaAutosize
									id="description"
									name="description"
									value={formData.description}
									onChange={handleInputChange}
									className={`${baseInputClasses} ${
										errors.description
											? errorClasses
											: normalClasses
									} resize-none`}
									placeholder={t("placeholders.description")}
									minRows={3}
									disabled={disabled}
								/>
							</div>
							{errors.description && (
								<small className={errorTextClasses}>
									{t("required")}
								</small>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
