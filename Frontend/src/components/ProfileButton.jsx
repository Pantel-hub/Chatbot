import React, { useState, useRef, useEffect } from "react";
import { Mail, User, LogOut, Loader, ChevronDown, Camera } from "lucide-react";
import { useTranslation } from "react-i18next";
import { API_ENDPOINTS } from "../config/api";

export default function ProfileButton({ onLogout }) {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);
	const [userProfile, setUserProfile] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const dropdownRef = useRef(null);
	const buttonRef = useRef(null);

	// Fetch user profile when dropdown opens
	useEffect(() => {
		if (isOpen && !userProfile) {
			fetchUserProfile();
		}
	}, [isOpen]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target) &&
				buttonRef.current &&
				!buttonRef.current.contains(e.target)
			) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen]);

	const fetchUserProfile = async () => {
		setLoading(true);
		setError(null);

		try {
			const res = await fetch(API_ENDPOINTS.getUserProfile, {
				credentials: "include",
				method: "GET",
				headers: { "Content-Type": "application/json" },
			});

			if (!res.ok) {
				throw new Error("Failed to fetch user profile");
			}

			const data = await res.json();
			setUserProfile(data);
		} catch (err) {
			console.error("Error fetching user profile:", err);
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const handleLogout = () => {
		setIsOpen(false);
		if (typeof onLogout === "function") {
			onLogout();
		}
	};

	// Get first letter of user's name for avatar
	const getInitial = () => {
		if (userProfile?.first_name) {
			return userProfile.first_name.charAt(0).toUpperCase();
		}
		return "U";
	};

	// Get login method label
	const getLoginMethodLabel = () => {
		if (userProfile?.login_method === "face") return "Face Login";
		if (userProfile?.login_method === "phone") return "Phone Login";
		return "Email Login";
	};

	return (
		<div className="relative">
			{/* Profile Button */}
			<button
				ref={buttonRef}
				onClick={() => setIsOpen(!isOpen)}
				className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs sm:text-sm shadow-sm transition-all duration-200"
				aria-label="Profile"
				title="Profile"
			>
				<User className="h-4 w-4" />
				<ChevronDown
					className={`h-3 w-3 transition-transform duration-200 ${
						isOpen ? "rotate-180" : ""
					}`}
				/>
			</button>

			{/* Dropdown Menu */}
			{isOpen && (
				<div
					ref={dropdownRef}
					className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50"
				>
					{/* Loading State */}
					{loading && (
						<div className="p-6 flex flex-col items-center justify-center">
							<Loader className="h-5 w-5 text-indigo-600 animate-spin mb-2" />
							<p className="text-xs sm:text-sm text-gray-600">
								Loading...
							</p>
						</div>
					)}

					{/* Error State */}
					{error && !loading && (
						<div className="p-4 text-center">
							<p className="text-xs sm:text-sm text-red-600">
								{error}
							</p>
						</div>
					)}

					{/* User Profile Content */}
					{userProfile && !loading && (
						<>
							{/* Header */}
							<div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 sm:px-5 py-4 sm:py-5">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-semibold text-white text-lg">
										{getInitial()}
									</div>
									<div className="text-left">
										<h3 className="text-sm sm:text-base font-semibold text-white truncate">
											{userProfile.first_name}{" "}
											{userProfile.last_name}
										</h3>
										<p className="text-xs text-white/80">
											{getLoginMethodLabel()}
										</p>
										{/* Show phone under name if logged via phone */}
										{userProfile.login_method ===
											"phone" && (
											<p className="text-xs text-white/70 mt-1">
												{userProfile.phone}
											</p>
										)}
									</div>
								</div>
							</div>

							{/* Details Section */}
							<div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100">
								<div className="space-y-3">
									{/* Name */}
									<div>
										<p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
											Name
										</p>
										<p className="text-sm text-gray-900 font-medium">
											{userProfile.first_name}{" "}
											{userProfile.last_name}
										</p>
									</div>

									{/* Email - only if email login */}
									{userProfile.login_method ===
										"email" && (
										<div>
											<p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
												Email
											</p>
											<p className="text-sm text-gray-900 font-medium break-all">
												{userProfile.email}
											</p>
										</div>
									)}

									{/* Phone - for email or phone login */}
									{(userProfile.login_method ===
										"email" ||
										userProfile.login_method ===
											"phone") &&
										userProfile.phone && (
											<div>
												<p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
													Phone
												</p>
												<p className="text-sm text-gray-900 font-medium">
													{userProfile.phone}
												</p>
											</div>
										)}
								</div>
							</div>

							{/* Logout Button */}
							<button
								onClick={handleLogout}
								className="w-full px-4 sm:px-5 py-3 sm:py-4 flex items-center gap-2 text-left hover:bg-red-50 transition-colors duration-200 text-red-600 font-medium text-sm"
							>
								<LogOut className="h-4 w-4" />
								Logout
							</button>
						</>
					)}
				</div>
			)}
		</div>
	);
}
