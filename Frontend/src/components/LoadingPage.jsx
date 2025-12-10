import { CpuChipIcon } from '@heroicons/react/24/solid'

export default function LoadingPage({
  title = 'Δημιουργούμε το chatbot σας',
  subtitle = 'Στήνουμε το μοντέλο, εκπαιδεύουμε intents και φέρνουμε assets',
  progress = null,
  tips = ['Μην κλείσεις αυτή τη σελίδα', 'Μπορεί να διαρκέσει μερικά δευτερόλεπτα'],
  onCancel = null,
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 bg-gray-50 text-gray-800">
      <div className="relative">
        <div className="absolute -inset-8 rounded-full blur-2xl bg-gradient-to-tr from-fuchsia-500/10 via-pink-500/5 to-indigo-500/10 animate-pulse" />
        <div className="relative w-24 h-24 rounded-full bg-white/60 border border-fuchsia-500/30 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-fuchsia-500/70 animate-spin" />
          <div className="absolute inset-3 rounded-full border border-fuchsia-400/30 animate-[spin_3s_linear_infinite_reverse]" />
          <CpuChipIcon className="w-10 h-10 text-fuchsia-500/90" />
        </div>
      </div>

      <div className="text-center">
        <p className="text-lg font-medium tracking-wide text-gray-700">
          {title}
          <span className="inline-flex w-10 overflow-hidden align-bottom">
            <span className="animate-[blink_1.4s_ease-in-out_infinite]">.</span>
            <span className="animate-[blink_1.4s_ease-in-out_infinite_0.2s]">.</span>
            <span className="animate-[blink_1.4s_ease-in-out_infinite_0.4s]">.</span>
          </span>
        </p>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>

      <div className="w-full max-w-sm">
        {progress === null ? (
          <>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-indigo-500 animate-[indeterminate_1.6s_ease-in-out_infinite]" />
            </div>
          </>
        ) : (
          <>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-indigo-500 transition-[width] duration-500"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
            <div className="mt-2 text-right text-xs text-gray-500">{Math.round(progress)}%</div>
          </>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="h-4 rounded bg-gray-200/80 animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="h-4 rounded bg-gray-200/80 animate-pulse" style={{ animationDelay: '120ms' }} />
          <div className="h-4 rounded bg-gray-200/80 animate-pulse" style={{ animationDelay: '240ms' }} />
        </div>

        {tips?.length > 0 && (
          <ul className="mt-4 space-y-1">
            {tips.map((tip, i) => (
              <li key={i} className="text-xs text-gray-500">• {tip}</li>
            ))}
          </ul>
        )}

        {onCancel && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
            >
              Ακύρωση
            </button>
          </div>
        )}
      </div>

      {/* keyframes */}
      <style>{`
        @keyframes blink { 0%, 20% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(50%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}