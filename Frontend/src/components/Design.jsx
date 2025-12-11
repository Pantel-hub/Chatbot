// src/components/Design.jsx
import React from "react";
import { useTranslation } from "react-i18next";

const EyeIcon = (props) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		className="h-5 w-5"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={2}
		{...props}
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
		/>
		<circle cx="12" cy="12" r="3" />
	</svg>
);

const FieldWrapper = ({ label, children, hint }) => (
	<div className="mb-5 sm:mb-6">
		<label className="mb-2 block text-xs sm:text-sm font-medium text-slate-600">
			{label}
		</label>
		{children}
		{hint ? (
			<p className="mt-1 text-[11px] sm:text-xs text-slate-500">{hint}</p>
		) : null}
	</div>
);

function PreviewPanel({
	primaryColor = "#3B82F6",
	position = "Bottom Right",
	themeStyle = "Minimal",
	logoPreview,
	botAvatar,
}) {
	const effectiveAvatar = botAvatar || logoPreview;

	const { t } = useTranslation();

	const isRight = /Right/i.test(position);
	const posMap = {
		"Bottom Right": "bottom-3 right-3 sm:bottom-4 sm:right-4 items-end",
		"Bottom Left": "bottom-3 left-3 sm:bottom-4 sm:left-4 items-start",
		"Top Right": "top-3 right-3 sm:top-4 sm:right-4 items-end",
		"Top Left": "top-3 left-3 sm:top-4 sm:left-4 items-start",
	};
	const posCls = posMap[position] || posMap["Bottom Right"];

	const theme = {
		Minimal: {
			panel: "rounded-xl border border-slate-200 bg-white shadow-sm",
			header: "rounded-t-xl",
			bubble: "rounded-xl",
			button: "rounded-xl shadow",
		},
		Modern: {
			panel: "rounded-2xl bg-white shadow-2xl",
			header: "rounded-t-2xl",
			bubble: "rounded-2xl",
			button: "rounded-full shadow-lg",
		},
		Classic: {
			panel: "rounded-md bg-white shadow",
			header: "rounded-t-md",
			bubble: "rounded-lg",
			button: "rounded-full shadow",
		},
	}[themeStyle] || {
		panel: "rounded-xl border border-slate-200 bg-white shadow-sm",
		header: "rounded-t-xl",
		bubble: "rounded-xl",
		button: "rounded-xl shadow",
	};

	return (
		<div className="lg:sticky lg:top-20">
			<div className="mb-2 flex items-center gap-2 text-slate-700">
				<EyeIcon />
				<span className="text-xs sm:text-sm font-medium">
					{t("design.preview.livePreview")}
				</span>
			</div>

			<div className="relative h-[360px] sm:h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
				{/* fake page header colored bar */}
				<div
					className="h-9 sm:h-10 w-full"
					style={{ backgroundColor: primaryColor, opacity: 0.9 }}
				/>

				{/* fake page skeleton */}
				<div className="space-y-3 p-4 sm:p-6">
					<div className="h-5 sm:h-6 w-40 sm:w-52 rounded bg-slate-200" />
					<div className="h-3.5 sm:h-4 w-64 sm:w-80 max-w-[85%] rounded bg-slate-100" />
					<div className="grid grid-cols-3 gap-3 sm:gap-4 pt-2">
						<div className="h-16 sm:h-20 rounded bg-slate-50 border border-slate-200" />
						<div className="h-16 sm:h-20 rounded bg-slate-50 border border-slate-200" />
						<div className="h-16 sm:h-20 rounded bg-slate-50 border border-slate-200" />
					</div>
				</div>

				{/* widget (panel + launcher) anchored to chosen corner */}
				<div className={`absolute ${posCls} z-10 flex`}>
					<div className="flex flex-col gap-3">
						{/* Panel */}
						<div
							className={`${theme.panel} w-64 sm:w-72 overflow-hidden`}
						>
							<div
								className={`${theme.header} px-3 py-2 text-white flex items-center gap-2`}
								style={{ backgroundColor: primaryColor }}
							>
								{effectiveAvatar ? (
									<img
										src={
											typeof effectiveAvatar === "string"
												? effectiveAvatar
												: URL.createObjectURL(
														effectiveAvatar
												  )
										}
										alt="Bot Avatar"
										className="h-5 w-5 sm:h-6 sm:w-6 rounded-full object-cover"
									/>
								) : (
									<div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-white/20" />
								)}
								<div className="min-w-0">
									<div className="text-xs sm:text-sm font-semibold truncate">
										{t("design.preview.headerTitle")}
									</div>
									<div className="text-[11px] sm:text-xs opacity-80 truncate">
										{t("design.preview.headerSubtitle")}
									</div>
								</div>
							</div>

							<div className="space-y-2 p-3">
								{/* Bot message 1 */}
								<div
									className={`flex ${
										isRight
											? "justify-start"
											: "justify-end"
									}`}
								>
									<div
										className={`max-w-[85%] ${
											theme.bubble
										} bg-slate-100 px-3 py-2 text-xs sm:text-sm text-slate-800 flex items-start gap-2 ${
											isRight ? "" : "flex-row-reverse"
										}`}
									>
										{effectiveAvatar ? (
											<img
												src={
													typeof effectiveAvatar ===
													"string"
														? effectiveAvatar
														: URL.createObjectURL(
																effectiveAvatar
														  )
												}
												alt="Bot Avatar"
												className="h-4 w-4 sm:h-5 sm:w-5 rounded-full object-cover mt-0.5"
											/>
										) : (
											<span
												className="h-4 w-4 sm:h-5 sm:w-5 rounded-full"
												style={{
													backgroundColor:
														primaryColor,
													opacity: 0.25,
												}}
											/>
										)}
										<span>
											{t("design.preview.botMessage1")}
										</span>
									</div>
								</div>

								{/* User message */}
								<div
									className={`flex ${
										isRight
											? "justify-end"
											: "justify-start"
									}`}
								>
									<div
										className={`max-w-[85%] ${theme.bubble} px-3 py-2 text-xs sm:text-sm text-white`}
										style={{
											backgroundColor: primaryColor,
										}}
									>
										{t("design.preview.userMessage1")}
									</div>
								</div>

								{/* Bot message 2 */}
								<div
									className={`flex ${
										isRight
											? "justify-start"
											: "justify-end"
									}`}
								>
									<div
										className={`max-w-[80%] ${
											theme.bubble
										} bg-slate-100 px-3 py-2 text-xs sm:text-sm text-slate-800 flex items-start gap-2 ${
											isRight ? "" : "flex-row-reverse"
										}`}
									>
										{effectiveAvatar ? (
											<img
												src={
													typeof effectiveAvatar ===
													"string"
														? effectiveAvatar
														: URL.createObjectURL(
																effectiveAvatar
														  )
												}
												alt="Bot Avatar"
												className="h-4 w-4 sm:h-5 sm:w-5 rounded-full object-cover mt-0.5"
											/>
										) : (
											<span
												className="h-4 w-4 sm:h-5 sm:w-5 rounded-full"
												style={{
													backgroundColor:
														primaryColor,
													opacity: 0.25,
												}}
											/>
										)}
										<span>
											{t("design.preview.botMessage2")}
										</span>
									</div>
								</div>

								{/* Input row */}
								<div
									className={`mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 sm:py-2 ${
										isRight ? "" : "flex-row-reverse"
									}`}
								>
									{effectiveAvatar ? (
										<img
											src={
												typeof effectiveAvatar ===
												"string"
													? effectiveAvatar
													: URL.createObjectURL(
															effectiveAvatar
													  )
											}
											alt="User Avatar"
											className="h-5 w-5 sm:h-6 sm:w-6 rounded-full object-cover"
										/>
									) : (
										<div
											className="h-5 w-5 sm:h-6 sm:w-6 rounded-full"
											style={{
												backgroundColor: primaryColor,
											}}
										/>
									)}
									<input
										readOnly
										value={t(
											"design.preview.inputPlaceholder"
										)}
										className="w-full bg-transparent text-xs sm:text-sm text-slate-500 outline-none"
									/>
									<button
										type="button"
										className="rounded-md px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium text-white"
										style={{
											backgroundColor: primaryColor,
										}}
									>
										{t("design.preview.sendButton")}
									</button>
								</div>
							</div>
						</div>

						{/* Launcher button */}
						<button
							type="button"
							className={`grid h-11 w-11 sm:h-12 sm:w-12 place-items-center ${theme.button}`}
							style={{ backgroundColor: primaryColor }}
							title={t("design.preview.launcherTitle")}
						>
							<svg
								viewBox="0 0 24 24"
								className={`h-5 w-5 sm:h-6 sm:w-6 text-white ${
									isRight ? "" : "-scale-x-100"
								}`}
							>
								<path
									fill="currentColor"
									d="M12 3a9 9 0 00-9 9 9 9 0 0013.5 7.74L21 21l-1.26-4.5A9 9 0 0012 3z"
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>

			<div className="mt-3 flex flex-wrap gap-2 text-[11px] sm:text-xs">
				<span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
					{t("design.preview.positionLabel")}: {position}
				</span>
				<span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
					{t("design.preview.themeLabel")}: {themeStyle}
				</span>
				<span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
					{t("design.preview.colorLabel")}: {primaryColor}
				</span>
			</div>
		</div>
	);
}
export default function Design({
	formData,
	handleInputChange,
	errors,
	logoPreview,
	botAvatar,
}) {
	const { t } = useTranslation();

	const primaryColor = formData.primaryColor || "#3B82F6";
	const position = formData.position || "Bottom Right";
	const themeStyle = formData.themeStyle || "Minimal";
	const effectiveAvatar = botAvatar || logoPreview;

	const positionOptions = [
		{ value: "Bottom Right", label: t("design.positions.bottomRight") },
		{ value: "Bottom Left", label: t("design.positions.bottomLeft") },
	];

	const themeOptions = [
		{ value: "Minimal", label: t("design.themes.minimal") },
		{ value: "Modern", label: t("design.themes.modern") },
		{ value: "Classic", label: t("design.themes.classic") },
	];

	const onAvatarChange = (e) => {
		const file = e.target.files?.[0];
		if (!file) {
			handleInputChange({ target: { name: "botAvatar", files: [] } });
			return;
		}
		// Send the file to FormSteps
		handleInputChange({ target: { name: "botAvatar", files: [file] } });
	};

	return (
		<div className="grid gap-6 lg:gap-8 lg:grid-cols-2">
			<div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
				<div className="mb-3 md:mb-4">
					<h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
						{t("design.title")}
					</h2>
					<p className="mt-1 text-xs sm:text-sm text-slate-500">
						{t("design.subtitle")}
					</p>
				</div>

				<div className="space-y-5 sm:space-y-6">
					{/* Primary color */}
					<FieldWrapper label={t("design.primaryColor")}>
						<div className="flex items-center gap-2 sm:gap-3">
							<input
								type="color"
								name="primaryColor"
								value={primaryColor}
								onChange={handleInputChange}
								className="h-8 w-8 sm:h-9 sm:w-9 cursor-pointer rounded border border-slate-200"
								aria-label={t("design.colorPickerAriaLabel")}
							/>
							<input
								type="text"
								name="primaryColor"
								value={primaryColor}
								onChange={handleInputChange}
								placeholder="#3B82F6"
								className="block w-full rounded border border-slate-300 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
							/>
						</div>
						{errors?.primaryColor && (
							<small className="mt-1 text-[11px] sm:text-xs text-red-600">
								{errors.primaryColor}
							</small>
						)}
					</FieldWrapper>

					{/* Position */}
					<FieldWrapper label={t("design.position")}>
						<div className="grid grid-cols-2 gap-2 sm:gap-3">
							{positionOptions.map((o) => (
								<label key={o.value} className="cursor-pointer">
									<input
										type="radio"
										name="position"
										value={o.value}
										checked={position === o.value}
										onChange={handleInputChange}
										className="peer sr-only"
									/>
									<div className="rounded-lg border px-2 py-2 sm:py-3 text-center text-xs sm:text-sm transition-all peer-checked:border-indigo-600 peer-checked:text-indigo-800 peer-checked:ring-2 peer-checked:ring-indigo-500 peer-checked:font-semibold">
										{o.label}
									</div>
								</label>
							))}
						</div>
					</FieldWrapper>

					{/* Theme */}
					<FieldWrapper label={t("design.themeStyle")}>
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
							{themeOptions.map((o) => (
								<label key={o.value} className="cursor-pointer">
									<input
										type="radio"
										name="themeStyle"
										value={o.value}
										checked={themeStyle === o.value}
										onChange={handleInputChange}
										className="peer sr-only"
									/>
									<div className="rounded-lg border px-2 py-2 sm:py-3 text-center text-xs sm:text-sm transition-all peer-checked:border-indigo-600 peer-checked:text-indigo-800 peer-checked:ring-2 peer-checked:ring-indigo-500 peer-checked:font-semibold">
										{o.label}
									</div>
								</label>
							))}
						</div>
					</FieldWrapper>

					{/* Bot Avatar / Icon */}
					<FieldWrapper
						label={t("design.botAvatar.label")}
						hint={
							logoPreview
								? t("design.botAvatar.usingCompanyLogo")
								: t("design.botAvatar.hint")
						}
					>
						<div className="flex items-center gap-3">
							{/* Preview */}
							<div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 bg-slate-50">
								{effectiveAvatar ? (
									<img
										src={
											typeof effectiveAvatar === "string"
												? effectiveAvatar
												: URL.createObjectURL(
														effectiveAvatar
												  )
										}
										alt="Bot Avatar"
										className="h-full w-full object-cover"
									/>
								) : (
									<div className="h-full w-full grid place-items-center text-[10px] text-slate-400">
										PNG/JPG
									</div>
								)}
							</div>

							{/* Upload button */}
							<label className="cursor-pointer rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 transition">
								{t("design.botAvatar.upload")}
								<input
									type="file"
									accept="image/*"
									onChange={onAvatarChange}
									className="hidden"
									aria-label={t("design.botAvatar.aria")}
								/>
							</label>

							{/* Clear button */}
							{botAvatar && (
								<button
									type="button"
									onClick={() =>
										handleInputChange({
											target: {
												name: "botAvatar",
												value: "",
											},
										})
									}
									className="text-xs text-slate-600 hover:text-slate-800 underline"
								>
									{t("design.botAvatar.clear")}
								</button>
							)}
						</div>
					</FieldWrapper>
				</div>
			</div>

			<PreviewPanel
				primaryColor={primaryColor}
				position={position}
				themeStyle={themeStyle}
				logoPreview={logoPreview}
				botAvatar={botAvatar}
			/>
		</div>
	);
}
