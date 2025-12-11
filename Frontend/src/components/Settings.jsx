// src/components/Settings.jsx
import React from "react";
import { useTranslation } from "react-i18next";
import {
	SparklesIcon,
	ArrowRightOnRectangleIcon,
	UserCircleIcon,
} from "@heroicons/react/24/outline";
import TextareaAutosize from "react-textarea-autosize";

export default function Settings({
	formData,
	handleInputChange,
	errors,
	disabled = false,
}) {
	const { t } = useTranslation();

	const baseInputClasses =
		"w-full p-2.5 sm:p-3 pl-9 sm:pl-10 border rounded-xl transition duration-200 bg-slate-50 focus:bg-white focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed";
	const normalClasses =
		"border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
	const errorClasses =
		"border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500";
	const labelClasses =
		"block text-xs sm:text-sm font-medium text-slate-600 mb-2";
	const errorTextClasses = "text-red-600 text-[11px] sm:text-xs mt-1";
	const requiredMark = <span className="text-red-600 ml-1">*</span>;

	// σταθερά options με slug values + i18n labels (με fallback)
	const personaOptions = [
		{
			value: "friendly",
			label: t("personas.friendly", "Friendly & Approachable"),
		},
		{ value: "support", label: t("personas.support", "Supportive") },
		{
			value: "professional",
			label: t("personas.professional", "Professional & Formal"),
		},
		{ value: "tech", label: t("personas.tech", "Technical Support") },
	];

	const handlePersonaSelect = (e) => {
		const value = e.target.value;
		handleInputChange({ target: { name: "personaSelect", value } });
		if (value && value !== "__custom__") {
			const selected = personaOptions.find((p) => p.value === value);
			handleInputChange({
				target: { name: "persona", value: selected?.label || "" },
			});
		}
	};

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
			<div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
				<h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
					{t("conversationSettings")}
				</h2>
			</div>

			<div className="space-y-6 md:space-y-8">
				{/* Bot Name */}
				<div>
					<label htmlFor="bot-name" className={labelClasses}>
						{t("botName")}
						{errors.botName ? requiredMark : null}
					</label>
					<div className="relative">
						<div className="pointer-events-none absolute top-2.5 sm:top-3 left-0 flex items-center pl-3">
							<ArrowRightOnRectangleIcon className="h-5 w-5 text-slate-400" />
						</div>
						<TextareaAutosize
							id="bot-name"
							name="botName"
							value={formData.botName}
							onChange={handleInputChange}
							className={`${baseInputClasses} ${
								errors.botName ? errorClasses : normalClasses
							} resize-none`}
							placeholder={t("placeholders.botName")}
							minRows={1}
							aria-invalid={Boolean(errors.botName)}
							aria-describedby={
								errors.botName ? "botName-error" : undefined
							}
							disabled={disabled}
						/>
					</div>
					{errors.botName && (
						<small id="botName-error" className={errorTextClasses}>
							{t("required")}
						</small>
					)}
				</div>

				{/* Greeting */}
				<div>
					<label htmlFor="greeting" className={labelClasses}>
						{t("greeting")}
						{errors.greeting ? requiredMark : null}
					</label>
					<div className="relative">
						<div className="pointer-events-none absolute top-2.5 sm:top-3 left-0 flex items-center pl-3">
							<SparklesIcon className="h-5 w-5 text-slate-400" />
						</div>
						<TextareaAutosize
							id="greeting"
							name="greeting"
							value={formData.greeting}
							onChange={handleInputChange}
							className={`${baseInputClasses} ${
								errors.greeting ? errorClasses : normalClasses
							} resize-none`}
							placeholder={t("placeholders.greeting")}
							minRows={2}
							aria-invalid={Boolean(errors.greeting)}
							aria-describedby={
								errors.greeting ? "greeting-error" : undefined
							}
							disabled={disabled}
						/>
					</div>
					{errors.greeting && (
						<small id="greeting-error" className={errorTextClasses}>
							{t("required")}
						</small>
					)}
				</div>

				{/* Persona (dropdown + optional free text) */}
				{/* Persona */}
				<div>
					<label htmlFor="persona" className={labelClasses}>
						{t("persona")}
						{errors.personaSelect ? requiredMark : null}
					</label>
					<div className="relative">
						<div className="pointer-events-none absolute top-2.5 sm:top-3 left-0 flex items-center pl-3">
							<UserCircleIcon className="h-5 w-5 text-slate-400" />
						</div>
						<TextareaAutosize
							id="persona"
							name="personaSelect"
							value={formData.personaSelect}
							onChange={handleInputChange}
							className={`${baseInputClasses} ${
								errors.personaSelect
									? errorClasses
									: normalClasses
							} resize-none`}
							placeholder={t("placeholders.persona")}
							minRows={3}
							aria-invalid={Boolean(errors.personaSelect)}
							aria-describedby={
								errors.personaSelect
									? "personaSelect-error"
									: undefined
							}
							disabled={disabled}
						/>
					</div>
					{errors.personaSelect && (
						<small
							id="personaSelect-error"
							className={errorTextClasses}
						>
							{t("required")}
						</small>
					)}
				</div>

				{/* Bot Restrictions */}
				<div>
					<label htmlFor="bot-restrictions" className={labelClasses}>
						{t("botRestrictions")}
						{errors.botRestrictions ? requiredMark : null}
					</label>
					<div className="relative">
						<div className="pointer-events-none absolute top-2.5 sm:top-3 left-0 flex items-center pl-3">
							<SparklesIcon className="h-5 w-5 text-slate-400" />
						</div>
						<TextareaAutosize
							id="bot-restrictions"
							name="botRestrictions"
							value={formData.botRestrictions}
							onChange={handleInputChange}
							className={`${baseInputClasses} ${
								errors.botRestrictions
									? errorClasses
									: normalClasses
							} resize-none`}
							placeholder={t("placeholders.botRestrictions")}
							minRows={3}
							aria-invalid={Boolean(errors.botRestrictions)}
							aria-describedby={
								errors.botRestrictions
									? "botRestrictions-error"
									: undefined
							}
							disabled={disabled}
						/>
					</div>
					{errors.botRestrictions && (
						<small
							id="botRestrictions-error"
							className={errorTextClasses}
						>
							{t("required")}
						</small>
					)}
				</div>

				{/* Default Fail Response */}
				<div>
					<label
						htmlFor="default-fail-response"
						className={labelClasses}
					>
						{t("defaultFailResponse")}
						{errors.defaultFailResponse ? requiredMark : null}
					</label>
					<div className="relative">
						<div className="pointer-events-none absolute top-2.5 sm:top-3 left-0 flex items-center pl-3">
							<SparklesIcon className="h-5 w-5 text-slate-400" />
						</div>
						<TextareaAutosize
							id="default-fail-response"
							name="defaultFailResponse"
							value={formData.defaultFailResponse}
							onChange={handleInputChange}
							className={`${baseInputClasses} ${
								errors.defaultFailResponse
									? errorClasses
									: normalClasses
							} resize-none`}
							placeholder={t("placeholders.defaultFailResponse")}
							minRows={2}
							aria-invalid={Boolean(errors.defaultFailResponse)}
							aria-describedby={
								errors.defaultFailResponse
									? "defaultFailResponse-error"
									: undefined
							}
							disabled={disabled}
						/>
					</div>
					{errors.defaultFailResponse && (
						<small
							id="defaultFailResponse-error"
							className={errorTextClasses}
						>
							{t("required")}
						</small>
					)}
				</div>
			</div>
		</div>
	);
}
