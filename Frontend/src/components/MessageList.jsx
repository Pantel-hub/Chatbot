// src/components/MessageList.jsx
import React from "react";
import { UserIcon, CpuChipIcon } from "@heroicons/react/24/solid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

function Message({ text, sender }) {
  const isUser = sender === "user";

 const userBubble =
  "ml-auto bg-indigo-500 text-white rounded-lg rounded-br-none";
  const botBubble =
  "mr-auto bg-gray-200 text-gray-800 rounded-lg rounded-bl-none";
  return (
    <div
      className={`flex items-start my-3 gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-slate-600" : "bg-fuchsia-600"
        }`}
      >
        {isUser ? (
          <UserIcon className="w-5 h-5" />
        ) : (
          <CpuChipIcon className="w-5 h-5" />
        )}
      </div>

      <div className={`p-3 max-w-md shadow-md ${isUser ? userBubble : botBubble}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            a: ({ node, ...props }) => (
              <a
                {...props}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline"
              />
            ),
            ul: (props) => <ul {...props} className="list-disc pl-5 space-y-1" />,
            ol: (props) => <ol {...props} className="list-decimal pl-5 space-y-1" />,
            li: (props) => <li {...props} className="leading-relaxed" />,
            p:  (props) => <p  {...props} className="leading-relaxed" />,
            strong: (props) => <strong {...props} className="font-semibold" />,
            code: ({ inline, ...props }) =>
              inline ? (
                <code {...props} className="px-1 py-0.5 rounded bg-black/30" />
              ) : (
                <code
                  {...props}
                  className="block w-full overflow-auto p-3 rounded bg-black/30"
                />
              ),
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start my-3 gap-3">

      <div className="p-3 bg-slate-700 rounded-lg flex items-center space-x-1.5">
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
      </div>
    </div>
  );
}

export default function MessageList({ messages, isTyping, messagesEndRef }) {
  return (
    <>
      <style>{`
        .only-message-scroll::-webkit-scrollbar { width: 8px; }
        .only-message-scroll::-webkit-scrollbar-track { background: #b8c8e1ff; }
        .only-message-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 6px; }
        .only-message-scroll::-webkit-scrollbar-thumb:hover { background: #b8c8e1ff; }
        .only-message-scroll { scrollbar-width: thin; scrollbar-color: #b8c8e1ff; #b8c8e1ff; }
      `}</style>

      <div className="h-full pr-2 overflow-y-auto only-message-scroll">
        {messages.map((msg) => (
          <Message key={msg.id} text={msg.text} sender={msg.sender} />
        ))}


        <div ref={messagesEndRef} />
      </div>
    </>
  );
}
