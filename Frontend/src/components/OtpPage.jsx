import React, { useState } from "react";
import { Mail, Shield, Globe, Smartphone, Camera } from "lucide-react";
import { useTranslation } from "react-i18next";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { API_ENDPOINTS } from "../config/api";
import FaceCapture from "./FaceCapture";

/**
 * Full-page OTP login (email + 6-digit code)
 * Props:
 * - onSubmit: function() -> καλείται όταν γίνει επιτυχής σύνδεση
 * - onResend: optional function() -> καλείται όταν γίνεται resend OTP
 */
export default function OtpPage({ onSubmit, onResend, onCancel }) {
	const { t, i18n } = useTranslation();

	const [contact, setContact] = useState("");
	const [contactMethod, setContactMethod] = useState("email"); // 'email', 'phone', or 'camera'
	const [phoneNumber, setPhoneNumber] = useState("");
	const [otp, setOtp] = useState("");
	const [otpSent, setOtpSent] = useState(false);
	const [showFaceCapture, setShowFaceCapture] = useState(false);

	const [isSendingOtp, setIsSendingOtp] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const toggleLang = () => {
		i18n.changeLanguage(i18n.language === "el" ? "en" : "el");
	};

	const handleSendOtp = async () => {
		setError("");
		if (!contact || contact.trim() === "") {
			return setError(
				contactMethod === "email"
					? "Παρακαλώ εισάγετε email."
					: "Παρακαλώ εισάγετε τηλέφωνο."
			);
		}

		setIsSendingOtp(true);

		try {
			const res = await fetch(API_ENDPOINTS.sendLoginOtp, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					contact: contact,
				}),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.detail || "Αποτυχία αποστολής OTP");
			}

			setOtpSent(true);
			onResend && onResend();
		} catch (err) {
			setError(err.message);
		} finally {
			setIsSendingOtp(false);
		}
	};

	const handleFaceLogin = async (imageData) => {
		setError("");
		setIsLoading(true);
		setShowFaceCapture(false);

		try {
			const res = await fetch(API_ENDPOINTS.faceLogin, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ image: imageData }),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.detail || "Face login failed");
			}

			// Επιτυχής σύνδεση με face
			if (typeof onSubmit === "function") onSubmit();
		} catch (err) {
			setError(err.message);
			setIsLoading(false);
		}
	};

	const handleSubmit = async (e) => {
		e?.preventDefault();
		setError("");

		if (!otpSent) {
			handleSendOtp();
			return;
		}

		if (!otp || otp.length !== 6) {
			return setError(t("login.enterOtp", "Συμπλήρωσε 6-ψήφιο OTP."));
		}

		setIsLoading(true);

		try {
			const res = await fetch(API_ENDPOINTS.verifyLoginOtp, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include", // ΣΗΜΑΝΤΙΚΟ: για cookies
				body: JSON.stringify({
					contact: contact,
					otp_code: otp,
				}),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.detail || "Αποτυχία σύνδεσης");
			}

			// Επιτυχής σύνδεση
			if (typeof onSubmit === "function") onSubmit();
		} catch (err) {
			setError(err.message);
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 flex items-center justify-center px-4">
			<div className="w-full max-w-md rounded-2xl overflow-hidden bg-white shadow-xl border border-gray-100">
				{/* Header */}
				<div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 relative">
				<button
					type="button"
					onClick={() => {
						if (onCancel) {
							onCancel();
						}
					}}
					className="absolute top-4 left-4 p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
					title="Close"
				>
					<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
				<button
					onClick={toggleLang}
						className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 flex items-center gap-1 text-sm"
					>
						<Globe className="h-4 w-4" />
						{i18n.language === "el" ? "EN" : "EL"}
					</button>
					<h1 className="text-2xl font-bold text-white text-center">
						{t("login.title", "Σύνδεση")}
					</h1>
					<p className="text-indigo-100 text-center mt-2">
						{otpSent
							? t(
									"login.enterCode",
									"Εισάγετε τον κωδικό που λάβατε"
							  )
							: t("login.welcomeBack", "Καλώς ήρθες!")}
					</p>
				</div>

				{/* Content */}
				<form
					onSubmit={handleSubmit}
					className="p-8 bg-transparent space-y-6"
				>
					{/* Tabs για Email/Phone/Camera */}
					{!otpSent && (
						<div className="flex bg-gray-100 rounded-lg p-1">
							<button
								type="button"
								onClick={() => setContactMethod("email")}
								className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-md transition-all text-sm ${
									contactMethod === "email"
										? "bg-white text-indigo-600 shadow-sm font-semibold"
										: "text-gray-600 hover:text-gray-900"
								}`}
							>
								<Mail className="h-4 w-4" />
								<span className="hidden sm:inline">Email</span>
							</button>
							<button
								type="button"
								onClick={() => setContactMethod("phone")}
								className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-md transition-all text-sm ${
									contactMethod === "phone"
										? "bg-white text-indigo-600 shadow-sm font-semibold"
										: "text-gray-600 hover:text-gray-900"
								}`}
							>
								<Smartphone className="h-4 w-4" />
								<span className="hidden sm:inline">Phone</span>
							</button>
							<button
								type="button"
								onClick={() => setShowFaceCapture(true)}
								className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-md transition-all text-sm ${
									contactMethod === "camera"
										? "bg-white text-indigo-600 shadow-sm font-semibold"
										: "text-gray-600 hover:text-gray-900"
								}`}
							>
								<Camera className="h-4 w-4" />
								<span className="hidden sm:inline">Face</span>
							</button>
						</div>
					)}
					{/* Email Input */}
					{!otpSent && contactMethod === "email" && (
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Email
							</label>
							<div className="relative">
								<Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
								<input
									type="email"
									value={contact}
									onChange={(e) => setContact(e.target.value)}
									onKeyDown={(e) =>
										e.key === "Enter" && handleSubmit(e)
									}
									className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 outline-none"
									placeholder="you@example.com"
								/>
							</div>
							<p className="text-xs text-gray-500 mt-1">
								Εισάγετε το email που χρησιμοποιήσατε στην
								εγγραφή
							</p>
						</div>
					)}

					{/* Phone Input */}
					{!otpSent && contactMethod === "phone" && (
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Τηλέφωνο
							</label>
							<PhoneInput
								country={"gr"}
								value={phoneNumber}
								onChange={(phone) => {
									setPhoneNumber(phone);
									setContact("+" + phone);
								}}
								enableSearch={true}
								containerClass="w-full"
								inputClass="!w-full !py-3 !border !border-gray-300 !rounded-lg focus:!ring-2 focus:!ring-indigo-500 focus:!border-transparent !transition-all !duration-200 !outline-none"
								buttonClass="!border-gray-300 !rounded-l-lg"
								dropdownClass="!text-sm"
							/>
							<p className="text-xs text-gray-500 mt-1">
								Εισάγετε το τηλέφωνο που χρησιμοποιήσατε στην
								εγγραφή
							</p>
						</div>
					)}

					{/* Αν έχει σταλεί OTP, δείξε το contact */}
					{otpSent && (
						<div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
							<p className="text-indigo-800">
								Κωδικός στάλθηκε στο: <strong>{contact}</strong>
							</p>
						</div>
					)}

					{/* OTP */}
					{otpSent && (
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("login.otpCode", "Κωδικός OTP")}
							</label>
							<div className="relative">
								<Shield className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
								<input
									type="text"
									value={otp}
									onChange={(e) =>
										setOtp(
											e.target.value
												.replace(/\D/g, "")
												.slice(0, 6)
										)
									}
									onKeyDown={(e) =>
										e.key === "Enter" && handleSubmit(e)
									}
									className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-center text-lg tracking-widest font-mono"
									placeholder="123456"
									maxLength={6}
								/>
							</div>
							<p className="text-xs text-gray-500 mt-1">
								{t("login.otpSentTo", "Στάλθηκε κωδικός στο")}{" "}
								{contact}
							</p>
						</div>
					)}

					{/* Errors */}
					{error && (
						<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
							{error}
						</div>
					)}

					{/* Actions row */}
					<div className="flex items-center justify-between">
						{otpSent ? (
							<button
								type="button"
								onClick={() => {
									setOtpSent(false);
									setOtp("");
									setError("");
								}}
								className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
							>
								{t(
									"login.changeContact",
									"Αλλαγή στοιχείων επαλήθευσης"
								)}
							</button>
						) : (
							<span />
						)}

						<button
							type="button"
							onClick={handleSendOtp}
							disabled={isSendingOtp}
							className="text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
						>
							{isSendingOtp
								? t("login.sending", "Αποστολή…")
								: otpSent
								? t("login.resendOtp", "Επαναποστολή OTP")
								: t("login.sendOtp", "Αποστολή OTP")}
						</button>
					</div>

					{/* Main CTA */}
					<button
						type="submit"
						disabled={isLoading || isSendingOtp}
						className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
					>
						{isLoading
							? t("login.loggingIn", "Γίνεται σύνδεση…")
							: otpSent
							? t("login.login", "Σύνδεση")
							: t("login.sendOtp", "Αποστολή OTP")}
					</button>
				</form>
			</div>

			{/* Face Capture Modal */}
			{showFaceCapture && (
				<FaceCapture
					onCapture={handleFaceLogin}
					onCancel={() => setShowFaceCapture(false)}
					mode="login"
				/>
			)}
		</div>
	);
}
