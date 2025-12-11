// Use relative URLs for Docker (proxied through nginx), absolute for local dev
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export const API_ENDPOINTS = {
	// CMS endpoints - προσθήκη /api/cms prefix
	createChatbot: `${BASE_URL}/api/cms/create_chatbot`,
	updateChatbot: `${BASE_URL}/api/cms/update_chatbot`,
	chat: `${BASE_URL}/api/cms/chat`,
	cleanupTestSession: `${BASE_URL}/api/cms/cleanup-test-session`,
	sendOtp: `${BASE_URL}/api/cms/send-otp`,
	verifyOtp: `${BASE_URL}/api/cms/verify-otp`,
	sendLoginOtp: `${BASE_URL}/api/cms/send-login-otp`,
	verifyLoginOtp: `${BASE_URL}/api/cms/verify-login-otp`,
	logout: `${BASE_URL}/api/cms/logout`,
	analytics: `${BASE_URL}/api/cms/analytics/company`,
	getUserChatbots: `${BASE_URL}/api/cms/user-chatbots`,
	getChatbot: (chatbotId) => `${BASE_URL}/api/cms/chatbot/${chatbotId}`,
	checkSession: `${BASE_URL}/api/cms/check-session`,

	// 🆕 FILE endpoints
	getChatbotFiles: (chatbotId) => `${BASE_URL}/api/cms/files/${chatbotId}`,
	deleteChatbotFile: (chatbotId, filename) =>
		`${BASE_URL}/api/cms/files/${chatbotId}/${encodeURIComponent(
			filename
		)}`,

	deleteChatbot: (chatbotId) =>
		`${BASE_URL}/api/cms/delete_chatbot/${chatbotId}`,

	// Widget/Public endpoints - προσθήκη /api/public prefix
	calendarAuth: (apiKey) => `${BASE_URL}/api/public/calendar-auth/${apiKey}`,
	availableSlots: (apiKey, date) =>
		`${BASE_URL}/api/public/available-slots/${apiKey}?date=${date}`,
};

export { BASE_URL };
export default BASE_URL;
