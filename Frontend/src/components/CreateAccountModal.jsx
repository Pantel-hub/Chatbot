import React, { useState } from "react";
import { Globe, User2, Mail, Shield, Smartphone, Camera } from "lucide-react";
import { useTranslation } from "react-i18next";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { API_ENDPOINTS } from "../config/api";
import FaceCapture from "./FaceCapture";

export default function CreateAccountModal({ onSuccess, onCancel }) {
	const { t, i18n } = useTranslation();

	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [verificationMethod, setVerificationMethod] = useState("email"); // 'email' | 'sms' | 'face'
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [otp, setOtp] = useState("");
	const [faceData, setFaceData] = useState(null);
	const [showFaceCapture, setShowFaceCapture] = useState(false);

	const [otpSent, setOtpSent] = useState(false);
	const [isSendingOtp, setIsSendingOtp] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const validateContact = () => {
		if (verificationMethod === "email") {
			if (!email || !email.includes("@")) {
				setError(t("signup.emailInvalid", "Μη έγκυρο email."));
				return false;
			}
		} else if (verificationMethod === "sms") {
			const phoneLength = phone.replace(/\D/g, "").length;
			if (!phone || phoneLength < 10 || phoneLength > 15) {
				setError("Μη έγκυρο τηλέφωνο (10-15 ψηφία).");
				return false;
			}
		} else if (verificationMethod === "face") {
			if (!faceData) {
				setError("Please capture your face first.");
				return false;
			}
		}
		return true;
	};

	const handleFaceCapture = (imageData) => {
		setFaceData(imageData);
		setShowFaceCapture(false);
		setError("");
	};

	const toggleLang = () => {
		const next = i18n.language === "el" ? "en" : "el";
		i18n.changeLanguage(next);
	};

	const sendOtp = async () => {
		setError("");
		if (!validateContact()) return;
		
		// Skip OTP for face registration
		if (verificationMethod === "face") return;
		
		setIsSendingOtp(true);

		try {
			const res = await fetch(API_ENDPOINTS.sendOtp, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					contact:
						verificationMethod === "email" ? email : "+" + phone,
					method: verificationMethod,
					language: i18n.language,
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.detail || "Αποστολή απέτυχε");

			setOtpSent(true);
		} catch (err) {
			setError(err.message);
		} finally {
			setIsSendingOtp(false);
		}
	};

	const handleSubmit = async (e) => {
		e?.preventDefault();
		setError("");

		if (!firstName)
			return setError(t("signup.fullNameRequired", "Συμπλήρωσε όνομα."));
		if (!lastName)
			return setError(
				t("signup.lastNameRequired", "Συμπλήρωσε επίθετο.")
			);
		if (!validateContact()) return;
		
		// Face registration flow
		if (verificationMethod === "face") {
			if (!faceData) {
				return setError("Please capture your face first.");
			}
			setIsLoading(true);
			
			try {
			// STEP 1: Check if face already exists BEFORE creating account
			console.log("Checking if face already exists...");
			const checkRes = await fetch(API_ENDPOINTS.checkFaceExists, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ image: faceData, language: i18n.language }),
			});
			
			const checkData = await checkRes.json();
			console.log("Face check response:", checkData);
			
			if (!checkRes.ok) {
				throw new Error(checkData.detail || "Failed to verify face");
			}
			
			if (checkData.exists) {
				// Face already exists - do NOT create account
				throw new Error(checkData.message || "This face is already registered to another account. Please login instead.");
			}
			
			// STEP 2: Face is unique - now create user with face authentication method
			const tempEmail = `face_${Date.now()}@temp.local`;
			
			console.log("Registering user with face auth...");
			const registerRes = await fetch(API_ENDPOINTS.verifyOtp, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					contact: tempEmail,
					method: "email",
					otp_code: "000000",
					first_name: firstName,
					last_name: lastName,
					skip_otp_verify: true,
				}),
			});
			
			console.log("Register response status:", registerRes.status);
			
			if (!registerRes.ok) {
				const errorData = await registerRes.json().catch(() => ({}));
				throw new Error(errorData.detail || "Failed to create account");
			}
			
			const userData = await registerRes.json();
			console.log("User created successfully:", userData);
			
			// Extract session ID from response
			const authSessionId = userData.auth_session_id;
			if (!authSessionId) {
				throw new Error("No auth session ID returned");
			}
			
			// STEP 3: Register face with explicit authorization
			console.log("Registering face embedding with session:", authSessionId);
			const faceRes = await fetch(API_ENDPOINTS.registerFace, {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"Authorization": authSessionId,
				},
				credentials: "include",
				body: JSON.stringify({ image: faceData }),
			});
			
			console.log("Face register response status:", faceRes.status);
			
			if (!faceRes.ok) {
				const errorData = await faceRes.json().catch(() => ({}));
				throw new Error(errorData.detail || "Failed to register face");
			}
			
			const faceData2 = await faceRes.json();
			console.log("Face registered successfully:", faceData2);
			
			onSuccess?.({
				firstName,
				lastName,
				method: "face",
			});
			return;
		} catch (err) {
			console.error("Face registration error:", err);
			setError(err.message || "Failed to register. Please try again.");
			setIsLoading(false);
			return;
		}
	}
	
	// Traditional email/SMS flow
	if (!otpSent) return setError(t("login.sendOtp", "Στείλε κωδικό OTP."));
	if (!otp || otp.length !== 6)
		return setError(t("login.enterOtp", "Συμπλήρωσε 6-ψήφιο OTP."));

		setIsLoading(true);

		try {
			const res = await fetch(API_ENDPOINTS.verifyOtp, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					contact:
						verificationMethod === "email" ? email : "+" + phone,
					method: verificationMethod,
					otp_code: otp,
					first_name: firstName,
					last_name: lastName,
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.detail || "Επαλήθευση απέτυχε");

			onSuccess?.({
				firstName,
				lastName,
				contact: verificationMethod === "email" ? email : phone,
				method: verificationMethod,
			});
		} catch (err) {
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="w-full max-w-md mx-3 sm:mx-0 max-h-[90vh] flex flex-col">
			<div className="rounded-xl sm:rounded-2xl overflow-hidden bg-white shadow-xl flex flex-col max-h-full">
				<div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 sm:px-8 py-4 sm:py-6 relative rounded-t-xl sm:rounded-t-2xl flex-shrink-0">
				<button
					onClick={onCancel}
					className="absolute top-3 left-3 sm:top-4 sm:left-4 p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
					title="Close"
				>
					<svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
				<button
					onClick={toggleLang}
						className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 flex items-center gap-1 text-xs sm:text-sm"
					>
						<Globe className="h-3 w-3 sm:h-4 sm:w-4" />
						<span className="hidden xs:inline">
							{i18n.language === "el" ? "EN" : "EL"}
						</span>
					</button>
					<h1 className="text-xl sm:text-2xl font-bold text-white text-center pr-8 sm:pr-0">
						{t("createAccount.title", "Δημιουργία λογαριασμού")}
					</h1>
					<p className="text-indigo-100 text-center mt-2 text-sm sm:text-base">
						{t(
							"createAccount.subtitle",
							"Συμπλήρωσε τα στοιχεία σου για να συνεχίσεις"
						)}
					</p>
				</div>

				<form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-2 overflow-y-auto flex-1">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							{t("signup.firstName", "Όνομα")}
						</label>
						<div className="relative">
							<User2 className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
							<input
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
								placeholder={t(
									"signup.firstNamePlaceholder",
									"π.χ. Γιάννης"
								)}
							/>
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							{t("signup.lastName", "Επίθετο")}
						</label>
						<div className="relative">
							<User2 className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
							<input
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
								placeholder={t(
									"signup.lastNamePlaceholder",
									"π.χ. Παπαδόπουλος"
								)}
							/>
						</div>
					</div>

					{/* Επιλογή μεθόδου επαλήθευσης */}
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-3">
							{t(
								"signup.verificationMethod",
								"Επιλέξτε μέθοδο επαλήθευσης"
							)}
						</label>
						<div className="grid grid-cols-3 gap-3">
							<label
								className={`flex flex-col items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
									verificationMethod === "email"
										? "border-indigo-600 bg-indigo-50"
										: "border-gray-300 hover:border-gray-400"
								}`}
							>
								<input
									type="radio"
									name="verificationMethod"
									value="email"
									checked={verificationMethod === "email"}
									onChange={(e) =>
										setVerificationMethod(e.target.value)
									}
									className="sr-only"
								/>
								<Mail className="h-5 w-5" />
								<span className="font-medium text-sm">Email</span>
							</label>

							<label
								className={`flex flex-col items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
									verificationMethod === "sms"
										? "border-indigo-600 bg-indigo-50"
										: "border-gray-300 hover:border-gray-400"
								}`}
							>
								<input
									type="radio"
									name="verificationMethod"
									value="sms"
									checked={verificationMethod === "sms"}
									onChange={(e) =>
										setVerificationMethod(e.target.value)
									}
									className="sr-only"
								/>
								<Smartphone className="h-5 w-5" />
								<span className="font-medium text-sm">SMS</span>
							</label>

							<label
								className={`flex flex-col items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
									verificationMethod === "face"
										? "border-indigo-600 bg-indigo-50"
										: "border-gray-300 hover:border-gray-400"
								}`}
							>
								<input
									type="radio"
									name="verificationMethod"
									value="face"
									checked={verificationMethod === "face"}
									onChange={(e) =>
										setVerificationMethod(e.target.value)
									}
									className="sr-only"
								/>
								<Camera className="h-5 w-5" />
								<span className="font-medium text-sm">Face</span>
							</label>
						</div>
					</div>

					{/* Email, Phone, or Face based on selection */}
					{verificationMethod === "email" ? (
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("signup.email", "Email")}
							</label>
							<div className="relative">
								<Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
								<input
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
									placeholder="example@email.com"
								/>
							</div>
							<button
								type="button"
								onClick={sendOtp}
								disabled={isSendingOtp}
								className="mt-2 w-full py-2 px-4 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60"
							>
								{isSendingOtp
									? t("login.sending", "Αποστολή…")
									: otpSent
									? t("login.resendOtp", "Επαναποστολή")
									: t("login.sendOtp", "Αποστολή OTP")}
							</button>
							{otpSent && (
								<p className="text-xs text-gray-500 mt-1">
									{t(
										"login.otpSentTo",
										"Στάλθηκε κωδικός στο"
									)}{" "}
									{email}
								</p>
							)}
						</div>
					) : verificationMethod === "sms" ? (
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("signup.phone", "Τηλέφωνο")}
							</label>
							<PhoneInput
								country={"gr"}
								value={phone}
								onChange={setPhone}
								inputStyle={{
									width: "100%",
									height: "48px",
									paddingLeft: "48px",
									fontSize: "16px",
									borderRadius: "0.5rem",
									border: "1px solid #d1d5db",
								}}
								buttonStyle={{
									borderRadius: "0.5rem 0 0 0.5rem",
									border: "1px solid #d1d5db",
									borderRight: "none",
								}}
								containerClass="phone-input-container"
							/>
							<button
								type="button"
								onClick={sendOtp}
								disabled={isSendingOtp}
								className="mt-2 w-full py-2 px-4 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60"
							>
								{isSendingOtp
									? t("login.sending", "Αποστολή…")
									: otpSent
									? t("login.resendOtp", "Επαναποστολή")
									: t("login.sendOtp", "Αποστολή OTP")}
							</button>
							{otpSent && (
								<p className="text-xs text-gray-500 mt-1">
									{t(
										"login.otpSentTo",
										"Στάλθηκε κωδικός στο"
									)}{" "}
									+{phone}
								</p>
							)}
						</div>
					) : (
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("signup.faceRegistration", "Face Registration")}
							</label>
							<button
								type="button"
								onClick={() => setShowFaceCapture(true)}
								className={`w-full py-4 px-4 rounded-lg border-2 border-dashed transition-all ${
									faceData
										? "border-green-500 bg-green-50"
										: "border-gray-300 hover:border-indigo-400 bg-gray-50"
								}`}
							>
								<div className="flex items-center justify-center gap-3">
									<Camera className={`h-6 w-6 ${faceData ? "text-green-600" : "text-gray-400"}`} />
									<span className={`font-medium ${faceData ? "text-green-700" : "text-gray-600"}`}>
										{faceData
											? "✓ Face captured"
											: "Click to capture face"}
									</span>
								</div>
							</button>
							{faceData && (
								<p className="text-xs text-green-600 mt-2 text-center">
									Face data ready for registration
								</p>
							)}
						</div>
					)}

					{/* OTP Input - only show for email/SMS */}
					{verificationMethod !== "face" && (
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								{t("login.otpCode", "Κωδικός OTP")}
							</label>
							<div className="relative">
								<Shield className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
								<input
									value={otp}
									onChange={(e) =>
										setOtp(
											e.target.value
												.replace(/\D/g, "")
												.slice(0, 6)
										)
									}
									className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center text-lg tracking-widest font-mono"
									placeholder="123456"
									maxLength={6}
									disabled={!otpSent}
								/>
							</div>
						</div>
					)}

					{error && (
						<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
							{error}
						</div>
					)}

					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={onCancel}
							className="flex-1 border border-gray-300 text-gray-800 rounded-lg py-3 hover:bg-gray-50"
						>
							{t("cancel", "Άκυρο")}
						</button>
						<button
							type="submit"
							disabled={isLoading}
							className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-60"
						>
							{isLoading
								? t("submitting", "Γίνεται…")
								: t(
										"createAccount.cta",
										"Δημιουργία λογαριασμού"
								  )}
						</button>
					</div>
				</form>
			</div>

			{/* Face Capture Modal */}
			{showFaceCapture && (
				<FaceCapture
					onCapture={handleFaceCapture}
					onCancel={() => setShowFaceCapture(false)}
					mode="register"
				/>
			)}
		</div>
	);
}
