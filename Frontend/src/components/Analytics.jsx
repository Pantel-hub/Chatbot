// src/components/Analytics.jsx
import React, {
	useEffect,
	useMemo,
	useRef,
	useState,
	useCallback,
} from "react";

import { useTranslation } from "react-i18next";
import {
	ChatBubbleOvalLeftEllipsisIcon,
	ChartBarIcon,
	ShieldCheckIcon,
	UserGroupIcon,
	ArrowTrendingUpIcon,
	ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { API_ENDPOINTS } from "../config/api";

const StatCard = ({
	title,
	value,
	trend,
	icon: Icon,
	color = "#2563eb",
	loading = false,
}) => (
	<div className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
		<div>
			<div className="text-xs sm:text-sm text-slate-500">{title}</div>
			<div className="mt-1 text-2xl sm:text-3xl font-semibold text-slate-900">
				{loading ? (
					<div className="h-7 sm:h-8 w-24 animate-pulse rounded bg-slate-200" />
				) : (
					value
				)}
			</div>
			{trend && !loading && (
				<div className="mt-2 inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-emerald-600">
					<ArrowTrendingUpIcon className="h-4 w-4" />
					<span>{trend}</span>
				</div>
			)}
			{loading && (
				<div className="mt-3 h-3 sm:h-4 w-36 animate-pulse rounded bg-slate-200" />
			)}
		</div>
		<div
			className="ml-3 sm:ml-4 grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-slate-50"
			style={{ color }}
		>
			<Icon className="h-5 w-5 sm:h-6 sm:w-6" />
		</div>
	</div>
);

export default function Analytics({
	endpoint = API_ENDPOINTS.analytics,
	headers = {},
	refreshMs = 60000,
	autoRefreshDefault = true,
	activeChatbotId = null,
}) {
	const { t } = useTranslation();
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [lastUpdated, setLastUpdated] = useState(null);
	const [autoRefresh, setAutoRefresh] = useState(autoRefreshDefault);
	const abortRef = useRef(null);

	const fetchData = useCallback(async () => {
		setError("");
		setLoading(true);
		try {
			abortRef.current?.abort?.(); //ακυρώνει προηγόυμενα fetch αν τρέχουν ακόμη
			const ctrl = new AbortController(); //νέος abort controller
			abortRef.current = ctrl;
			const res = await fetch(endpoint, {
				method: "GET",
				headers,
				signal: ctrl.signal, //συνδεει fetch με abort controller
				credentials: "include",
				cache: "no-store", // φέρνει πάντα φρέσκα data όχι cache
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const json = await res.json();
			setData(json);
			console.log("✅ Data set for bot:", activeChatbotId, json);
			setLastUpdated(new Date());
		} catch (e) {
			if (e.name !== "AbortError") setError(e.message || "Network error");
		} finally {
			setLoading(false);
		}
	}, [endpoint, activeChatbotId]); // dependencies

	// όταν αλλάζει το activechatbotid ή το endpoint καλείται η fetchData
	useEffect(() => {
		if (activeChatbotId) {
			console.log(
				"%c[Analytics.jsx] 📊 activeChatbotId changed",
				"color:blue; font-weight:bold;"
			);
			console.log("Fetching analytics for chatbot ID:", activeChatbotId);
			console.log("Endpoint used:", endpoint);

			setData(null);
			setLastUpdated(null);
			setLoading(true);
			fetchData();
		}
		return () => abortRef.current?.abort?.();
	}, [endpoint, activeChatbotId]);

	// αν δεν είναι autorefresh σταματα αλλιως δημιουργει interval
	useEffect(() => {
		if (!autoRefresh) return;
		const id = setInterval(fetchData, refreshMs);
		return () => clearInterval(id);
	}, [autoRefresh, refreshMs, endpoint, activeChatbotId]); // ✅

	// SSE connection for real-time updates
	//useEffect(() => {
	//  if (!autoRefresh) return; // Μόνο αν είναι enabled το auto-refresh

	//  const eventSource = new EventSource(
	//  `${endpoint.replace('/company', '/subscribe')}`,
	//  { withCredentials: true }
	//);

	//  eventSource.addEventListener('connected', () => {
	//    console.log('📡 SSE connected');
	//});

	//eventSource.addEventListener('stats_updated', () => {
	//console.log('🔄 Stats updated, fetching new data...');
	//fetchData(); // Instant refresh όταν αλλάζουν τα stats
	//});

	//eventSource.addEventListener('ping', () => {
	// Keep-alive ping, δεν κάνουμε τίποτα
	//}//);

	//eventSource.onerror = (error) => {
	//  console.error('SSE error:', error);
	//  eventSource.close();
	//};

	//return () => {
	//  eventSource.close();
	//};
	//}, [autoRefresh, endpoint]);

	const { todayStats, totalStats } = useMemo(() => {
		const today = data?.today || {};
		const totals = data?.totals || {};

		const formatSeconds = (seconds) =>
			typeof seconds === "number" && seconds > 0
				? `${seconds.toFixed(2)}s`
				: "—";

		const formatRating = (rating, count) => {
			if (typeof rating === "number" && rating > 0) {
				const countText = count > 0 ? ` (${count})` : "";
				return `${rating.toFixed(2)}${countText}`;
			}
			return "—";
		};

		const formatValue = (value) =>
			value !== null && value !== undefined ? value : "—";

		const formatDateTime = (isoString) =>
			isoString ? new Date(isoString).toLocaleString() : "—";

		return {
			todayStats: {
				messages: {
					title: t("analytics.messagesTitle"),
					value: formatValue(today.messages),
					icon: ChatBubbleOvalLeftEllipsisIcon,
					color: "#2563eb",
				},
				userMessages: {
					title: t("analytics.userMessagesTitle"),
					value: formatValue(today.user_messages),
					icon: UserGroupIcon,
					color: "#0ea5e9",
				},
				assistantMessages: {
					title: t("analytics.assistantMessagesTitle"),
					value: formatValue(today.assistant_messages),
					icon: ChatBubbleOvalLeftEllipsisIcon,
					color: "#22c55e",
				},
				sessions: {
					title: t("analytics.sessionsTodayTitle"),
					value: formatValue(today.sessions),
					icon: UserGroupIcon,
					color: "#6366f1",
				},
				avgResponse: {
					title: t("analytics.avgResponseTimeToday"),
					value: formatSeconds(today.avg_response_time_seconds),
					icon: ChartBarIcon,
					color: "#16a34a",
				},
				satisfaction: {
					title: t("analytics.satisfactionToday"),
					value: formatRating(today.avg_rating, today.ratings_count),
					icon: ShieldCheckIcon,
					color: "#d97706",
				},
				activeSessions: {
					title: t("analytics.activeSessionsNow"),
					value: formatValue(today.active_sessions),
					icon: ArrowTrendingUpIcon,
					color: "#f43f5e",
				},
				lastMessageAt: {
					title: t("analytics.lastMessageAt"),
					value: formatDateTime(today.last_message_at),
					icon: ArrowTrendingUpIcon,
					color: "#64748b",
				},
			},
			totalStats: {
				messages: {
					title: t("analytics.totalMessages"),
					value: formatValue(totals.messages),
					icon: ChatBubbleOvalLeftEllipsisIcon,
					color: "#2563eb",
				},
				userMessages: {
					title: t("analytics.totalUserMessages"),
					value: formatValue(totals.user_messages),
					icon: UserGroupIcon,
					color: "#0ea5e9",
				},
				assistantMessages: {
					title: t("analytics.totalAssistantMessages"),
					value: formatValue(totals.assistant_messages),
					icon: ChatBubbleOvalLeftEllipsisIcon,
					color: "#22c55e",
				},
				sessions: {
					title: t("analytics.totalSessions"),
					value: formatValue(totals.sessions),
					icon: UserGroupIcon,
					color: "#6366f1",
				},
				avgResponse: {
					title: t("analytics.avgResponseTimeOverall"),
					value: formatSeconds(totals.avg_response_time_seconds),
					icon: ChartBarIcon,
					color: "#16a34a",
				},
				satisfaction: {
					title: t("analytics.avgSatisfactionOverall"),
					value: formatRating(
						totals.avg_rating,
						totals.ratings_count
					),
					icon: ShieldCheckIcon,
					color: "#d97706",
				},
			},
		};
	}, [data, t]);

	return (
		<div
			key={activeChatbotId}
			className="rounded-2xl border border-slate-200 bg-white shadow-sm"
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 p-4 md:p-6">
				<h2 className="text-xl md:text-2xl font-semibold text-slate-900">
					{t("analytics.title")}
				</h2>
				<div className="flex flex-wrap items-center gap-2 sm:gap-3">
					{lastUpdated && (
						<span className="text-xs text-slate-500">
							{t("analytics.lastUpdated", {
								time: lastUpdated.toLocaleTimeString(),
							})}
						</span>
					)}
					<label className="flex cursor-pointer select-none items-center gap-2 text-xs sm:text-sm text-slate-700">
						<input
							type="checkbox"
							className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
							checked={autoRefresh}
							onChange={(e) => setAutoRefresh(e.target.checked)}
						/>
						{t("analytics.autoRefresh")}
					</label>
					<button
						type="button"
						onClick={fetchData}
						className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"
						disabled={loading}
					>
						<ArrowPathIcon
							className={`h-4 w-4 ${
								loading ? "animate-spin" : ""
							}`}
						/>
						{t("analytics.refresh")}
					</button>
				</div>
			</div>

			<div className="max-h-[70vh] md:max-h-[72vh] overflow-y-auto p-4 md:p-6">
				{error && (
					<div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
						{t("analytics.error", { error })}
					</div>
				)}

				<div className="mb-2 text-xs sm:text-sm font-semibold text-slate-500">
					Σήμερα
				</div>
				<div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
					<StatCard
						{...todayStats.messages}
						loading={loading && !data}
					/>
					<StatCard
						{...todayStats.userMessages}
						loading={loading && !data}
					/>
					<StatCard
						{...todayStats.assistantMessages}
						loading={loading && !data}
					/>
					<StatCard
						{...todayStats.sessions}
						loading={loading && !data}
					/>
					<StatCard
						{...todayStats.avgResponse}
						loading={loading && !data}
					/>
					<StatCard
						{...todayStats.satisfaction}
						loading={loading && !data}
					/>
					<StatCard
						{...todayStats.activeSessions}
						loading={loading && !data}
					/>
					<StatCard
						{...todayStats.lastMessageAt}
						loading={loading && !data}
					/>
				</div>

				<div className="my-6 h-px bg-slate-200" />

				<div className="mb-2 text-xs sm:text-sm font-semibold text-slate-500">
					Σύνολα
				</div>
				<div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
					<StatCard
						{...totalStats.messages}
						loading={loading && !data}
					/>
					<StatCard
						{...totalStats.userMessages}
						loading={loading && !data}
					/>
					<StatCard
						{...totalStats.assistantMessages}
						loading={loading && !data}
					/>
					<StatCard
						{...totalStats.sessions}
						loading={loading && !data}
					/>
					<StatCard
						{...totalStats.avgResponse}
						loading={loading && !data}
					/>
					<StatCard
						{...totalStats.satisfaction}
						loading={loading && !data}
					/>
				</div>

				<div className="h-2" />
			</div>
		</div>
	);
}
