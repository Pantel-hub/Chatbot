// Load marked.js library για markdown support
(function() {
    if (!window.marked) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js';
        script.onload = function() {
            // Configure marked options όταν φορτώσει
            marked.setOptions({
                breaks: true,        // Line breaks γίνονται <br>
                gfm: true,          // GitHub Flavored Markdown
                sanitize: false,    // Θα κάνουμε manual sanitization
                pedantic: false     // Πιο relaxed parsing
            });
            console.log('Marked.js loaded successfully');
        };
        script.onerror = function() {
            console.error('Failed to load marked.js');
        };
        document.head.appendChild(script);
    }
})();

// Load DOMPurify για ασφαλές HTML sanitization
(function() {
    if (!window.DOMPurify) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/2.4.7/purify.min.js';
        script.onload = function() {
            console.log('DOMPurify loaded successfully');
        };
        script.onerror = function() {
            console.error('Failed to load DOMPurify');
        };
        document.head.appendChild(script);
    }
})();





(function() {
    // Δημιουργία chat widget container
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'chatbot-widget-{{ api_key }}';
    widgetContainer.innerHTML = `
        <!-- Chat Button -->
        <div id="chat-button-{{ api_key }}" class="chat-button-{{ api_key }}">
            💬
        </div>
        
        <!-- Chat Popup -->
        <div id="chat-popup-{{ api_key }}" class="chat-popup-{{ api_key }}" style="display: none;">
            <div class="chat-header-{{ api_key }}">
                <div class="header-info-{{ api_key }}">
                    <div class="bot-avatar-header-{{ api_key }}">
                        <svg class="chip-icon-{{ api_key }}" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                    </div>
                    <span class="bot-name-{{ api_key }}">{{ company_display_name }}</span>
                </div>
                <div class="status-info-{{ api_key }}">
                    <div class="status-dot-{{ api_key }}"></div>
                    <span class="status-text-{{ api_key }}">Συνδεδεμένος</span>
                </div>
                <button id="close-chat-{{ api_key }}" class="close-btn-{{ api_key }}">×</button>
            </div>
            <div id="chat-messages-{{ api_key }}" class="chat-messages-{{ api_key }}">
                <div class="message-wrapper-{{ api_key }} bot-wrapper-{{ api_key }}">
                    <div class="bot-avatar-{{ api_key }}">
                        <svg class="chip-icon-{{ api_key }}" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                    </div>
                    <div class="bot-message-{{ api_key }}">{{ greeting }}</div>
                </div>
            </div>
            <div class="chat-input-container-{{ api_key }}">
                <input type="text" id="chat-input-{{ api_key }}" placeholder="Γράψτε το μήνυμά σας..." />
                <button id="send-btn-{{ api_key }}" class="send-btn-{{ api_key }}">
                    <svg class="send-icon-{{ api_key }}" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    // Προσθήκη στο DOM
    document.body.appendChild(widgetContainer);
    
    // CSS Styles που ταιριάζουν με το screenshot
    const styles = `
        /* Chat Button */
        .chat-button-{{ api_key }} {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            background: {{ primary_color }};
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 24px;
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
            z-index: 1000;
            transition: all 0.3s ease;
            border: none;
        }

        .chat-button-{{ api_key }}:hover {
            transform: scale(1.1);
            box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
        }

        /* Chat Popup */
        .chat-popup-{{ api_key }} {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 350px;
            height: 500px;
            background: #fafafa;
            border-radius: 12px;
            border: 1px solid rgba(139, 92, 246, 0.2);
            box-shadow: 0 8px 30px rgba(0,0,0,0.3);
            z-index: 1001;
            display: flex;
            flex-direction: column;
            font-family: system-ui, -apple-system, sans-serif;
            overflow: hidden;
        }

        /* Header */
        .chat-header-{{ api_key }} {
            background: {{ primary_color }};
            padding: 16px;
            border-bottom: 1px solid rgba(139, 92, 246, 0.2);
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .header-info-{{ api_key }} {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .bot-avatar-header-{{ api_key }} {
            width: 32px;
            height: 32px;
            background: {{ primary_color }};
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .chip-icon-{{ api_key }} {
            width: 20px;
            height: 20px;
            color: white;
        }

        .bot-name-{{ api_key }} {
            color: #a78bfa;
            font-size: 18px;
            font-weight: bold;
        }

        .status-info-{{ api_key }} {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .status-dot-{{ api_key }} {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
        }

        .status-text-{{ api_key }} {
            color: #10b981;
            font-size: 12px;
        }

        .close-btn-{{ api_key }} {
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            color: #94a3b8;
            font-size: 20px;
            cursor: pointer;
            padding: 4px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            transition: all 0.2s ease;
        }

        .close-btn-{{ api_key }}:hover {
            background: rgba(139, 92, 246, 0.2);
            color: white;
        }

        /* Messages */
        .chat-messages-{{ api_key }} {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .message-wrapper-{{ api_key }} {
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }

        .user-wrapper-{{ api_key }} {
            flex-direction: row-reverse;
        }

        .bot-avatar-{{ api_key }}, .user-avatar-{{ api_key }} {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .bot-avatar-{{ api_key }} {
            background: {{ primary_color }};
        }

        .user-avatar-{{ api_key }} {
            background: #475569;
        }

        .bot-message-{{ api_key }}, .user-message-{{ api_key }} {
            padding: 12px 16px;
            border-radius: 12px;
            max-width: 240px;
            word-wrap: break-word;
            line-height: 1.4;
        }

        .bot-message-{{ api_key }} {
            background: #f1f5f9; 
            color: #1e293b;
            border-radius: 12px 12px 12px 4px;
        }

        .user-message-{{ api_key }} {
            background: {{ primary_color }};
            color: white;
            border-radius: 12px 12px 4px 12px;
        }

        /* Typing Indicator */
        .typing-indicator-{{ api_key }} {
            display: none;
            padding: 12px 16px;
            background: #374151;
            color: #9ca3af;
            border-radius: 12px 12px 12px 4px;
            max-width: 240px;
            font-style: italic;
        }

        /* Input Area */
        .chat-input-container-{{ api_key }} {
            padding: 16px;
            border-top: 1px solid #e5e7eb;
            background: #ffffff;
            display: flex;
            gap: 12px;
            align-items: center;
        }

        #chat-input-{{ api_key }} {
            flex: 1;
            background: #ffffff;
            color: #111111;
            border: 1px solid #e5e7eb;
            border-radius: 20px;
            padding: 12px 16px;
            outline: none;
            transition: all 0.2s ease;
            font-family: inherit;
        }

        #chat-input-{{ api_key }}:focus {
            background: #ffffff;
            box-shadow: 0 0 0 2px rgba(59,130,246,0.25);
        }

        #chat-input-{{ api_key }}::placeholder {
            color: #9ca3af;
        }

        .send-btn-{{ api_key }} {
            width: 44px;
            height: 44px;
            background: {{ primary_color }};
            border: none;
            border-radius: 50%;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            flex-shrink: 0;
        }

        .send-btn-{{ api_key }}:hover:not(:disabled) {
            opacity: 0.9;
            transform: scale(1.05);
        }

        .send-btn-{{ api_key }}:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .send-icon-{{ api_key }} {
            width: 20px;
            height: 20px;
        }

        /* Scrollbar */
        .chat-messages-{{ api_key }}::-webkit-scrollbar {
            width: 6px;
        }

        .chat-messages-{{ api_key }}::-webkit-scrollbar-track {
            background: transparent;
        }

        .chat-messages-{{ api_key }}::-webkit-scrollbar-thumb {
            background: rgba(139, 92, 246, 0.3);
            border-radius: 3px;
        }

        .chat-messages-{{ api_key }}::-webkit-scrollbar-thumb:hover {
            background: rgba(139, 92, 246, 0.5);
        }

        /* Mobile Responsive */
        @media (max-width: 480px) {
            .chat-popup-{{ api_key }} {
                width: 90%;
                height: 70%;
                right: 5%;
                bottom: 90px;
                }
                  }
        
        /* Markdown styling για bot messages */
        .bot-message-{{ api_key }} h1,
        .bot-message-{{ api_key }} h2,
        .bot-message-{{ api_key }} h3 {
            margin: 0.5em 0 0.3em 0;
            font-weight: bold;
            line-height: 1.2;
        }

        .bot-message-{{ api_key }} h1 { font-size: 1.2em; }
        .bot-message-{{ api_key }} h2 { font-size: 1.1em; }
        .bot-message-{{ api_key }} h3 { font-size: 1em; }

        .bot-message-{{ api_key }} p {
            margin: 0.3em 0;
        }

        .bot-message-{{ api_key }} code {
            background: #e2e8f0;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }

        .bot-message-{{ api_key }} pre {
            background: #e2e8f0;
            padding: 8px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 0.5em 0;
        }

        .bot-message-{{ api_key }} ul,
        .bot-message-{{ api_key }} ol {
            margin: 0.3em 0;
            padding-left: 1.2em;
        }

        .bot-message-{{ api_key }} li {
            margin: 0.2em 0;
        }

        .bot-message-{{ api_key }} strong {
            font-weight: bold;
        }

        .bot-message-{{ api_key }} em {
            font-style: italic;
        }

        .bot-message-{{ api_key }} blockquote {
            border-left: 3px solid {{ primary_color }};
            padding-left: 8px;
            margin: 0.5em 0;
            font-style: italic;
            opacity: 0.8;
        
            
        }
    `;
    
    // Προσθήκη CSS στο DOM
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
    
    // JavaScript Functionality
    const apiKey = '{{ api_key }}';
    const chatButton = document.getElementById('chat-button-{{ api_key }}');
    const chatPopup = document.getElementById('chat-popup-{{ api_key }}');
    const closeChat = document.getElementById('close-chat-{{ api_key }}');
    const chatInput = document.getElementById('chat-input-{{ api_key }}');
    const sendBtn = document.getElementById('send-btn-{{ api_key }}');
    const messagesContainer = document.getElementById('chat-messages-{{ api_key }}');

    let sessionId = localStorage.getItem('chatbot_session_' + apiKey) || null;
    let isOpen = false;
    let messageHistory = [];
    let isLoading = false;
    
    // Δημιουργία typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message-wrapper-{{ api_key }} bot-wrapper-{{ api_key }}';
    typingIndicator.style.display = 'none';
    typingIndicator.innerHTML = `
        <div class="bot-avatar-{{ api_key }}">
            <svg class="chip-icon-{{ api_key }}" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
        </div>
        <div class="typing-indicator-{{ api_key }}" style="display: block;">Γράφει...</div>
    `;
    
    // Toggle chat popup
    chatButton.addEventListener('click', function() {
        isOpen = !isOpen;
        chatPopup.style.display = isOpen ? 'flex' : 'none';
        if (isOpen) chatInput.focus();
    });
    
    // Close chat
    closeChat.addEventListener('click', function() {
        isOpen = false;
        chatPopup.style.display = 'none';
    });
    
    // Send message on Enter key
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !isLoading) {
            sendMessage();
        }
    });
    
    // Send message on button click
    sendBtn.addEventListener('click', function() {
        if (!isLoading) {
            sendMessage();
        }
    });
    
    function getRecentHistory() {
        if (messageHistory.length === 0) {
            return [];
        }
        return messageHistory.slice(-6).map(msg => {
            return { role: msg.role, content: msg.content };
        });
    }
    
    function addMessage(content, isUser = false) {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `message-wrapper-{{ api_key }} ${isUser ? 'user-wrapper-{{ api_key }}' : 'bot-wrapper-{{ api_key }}'}`;

        if (isUser) {
        // user avatar (trusted static SVG)
            const avatar = document.createElement('div');
            avatar.className = 'user-avatar-{{ api_key }}';
            avatar.innerHTML = `
                <svg class="chip-icon-{{ api_key }}" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd"/>
                </svg>
        `   ;

            const bubble = document.createElement('div');
            bubble.className = 'user-message-{{ api_key }}';
            bubble.textContent = content;  

            messageWrapper.appendChild(avatar);
            messageWrapper.appendChild(bubble);
        
        } else {
        // bot avatar (trusted SVG)
            const avatar = document.createElement('div');
            avatar.className = 'bot-avatar-{{ api_key }}';
            avatar.innerHTML = `
              <svg class="chip-icon-{{ api_key }}" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
        `    ;

        // bot bubble (secure)
            const bubble = document.createElement('div');
                bubble.className = 'bot-message-{{ api_key }}';
                if (window.marked && window.DOMPurify) {
                    const markedHtml = marked.parse(content);
                    const cleanHtml = DOMPurify.sanitize(markedHtml);
                    bubble.innerHTML = cleanHtml;
                } else {
                    bubble.textContent = content;
     }

            messageWrapper.appendChild(avatar);
            messageWrapper.appendChild(bubble);
    }

        messagesContainer.appendChild(messageWrapper);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        messageHistory.push({ role: isUser ? 'user' : 'assistant', content });
    }


    
    
    function showTypingIndicator() {
        messagesContainer.appendChild(typingIndicator);
        typingIndicator.style.display = 'flex';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function hideTypingIndicator() {
        if (typingIndicator.parentNode) {
            typingIndicator.parentNode.removeChild(typingIndicator);
        }
        typingIndicator.style.display = 'none';
    }

    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message || isLoading) return;
        
        addMessage(message, true);
        chatInput.value = '';
        
        isLoading = true;
        chatInput.disabled = true;
        sendBtn.disabled = true;
        
        showTypingIndicator();

        try {
        
            const apiBase = '{{ api_base }}';
            
            const response = await fetch(`${apiBase}/widget-chat?api_key={{ api_key }}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    history: getRecentHistory(),
                    session_id: sessionId
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            hideTypingIndicator();
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let botResponse = '';
            
            const botMessageWrapper = document.createElement('div');
            botMessageWrapper.className = 'message-wrapper-{{ api_key }} bot-wrapper-{{ api_key }}';
            botMessageWrapper.innerHTML = `
                <div class="bot-avatar-{{ api_key }}">
                    <svg class="chip-icon-{{ api_key }}" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                </div>
                <div class="bot-message-{{ api_key }}"></div>
            `;
            messagesContainer.appendChild(botMessageWrapper);
            const botMessageDiv = botMessageWrapper.querySelector('.bot-message-{{ api_key }}');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            break;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.response) {
                                botResponse += parsed.response;
    
    
                                const streamingSanitized = botResponse.replace(/<ACTION>[\s\S]*?<\/ACTION>/gi, '').trim();
                                    if (window.marked && window.DOMPurify) {
                                        const markedHtml = marked.parse(streamingSanitized);
                                        const cleanHtml = DOMPurify.sanitize(markedHtml);
                                        botMessageDiv.innerHTML = cleanHtml;
                                    } else {
                                        botMessageDiv.textContent = streamingSanitized;
                                 }
                                
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
   }
                            if (parsed.session_id) {
                                sessionId = parsed.session_id;
                                localStorage.setItem('chatbot_session_' + apiKey, sessionId);
                                console.log('Session ID received and stored:', sessionId);
                            }
                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                        } catch (e) {
                            console.warn('Failed to parse chunk:', data);
                        }
                    }
                }
            }
            
            if (botResponse) {
    // Clean up the displayed message after streaming completes  
                const finalCleanedResponse = parseActionBlocks(botResponse);
                    if (window.marked && window.DOMPurify && finalCleanedResponse) {
                        const markedHtml = marked.parse(finalCleanedResponse);
                        const cleanHtml = DOMPurify.sanitize(markedHtml);
                         botMessageDiv.innerHTML = cleanHtml;
                    } else if (finalCleanedResponse) {
                        botMessageDiv.textContent = finalCleanedResponse;
     }
            
    
    // push στο history το καθαρό κείμενο
                if (finalCleanedResponse) {
                    messageHistory.push({ role: 'assistant', content: finalCleanedResponse });
                }
            }
      } catch (error) {
          console.error('Chat error:', error);
          hideTypingIndicator();
          addMessage('Συγγνώμη, προέκυψε ένα σφάλμα. Παρακαλώ δοκιμάστε ξανά.', false);
        } finally {
            isLoading = false;
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    }
    
    // Parse ACTION blocks από bot response
    // Parse ACTION blocks από bot response
    function parseActionBlocks(botResponse) {
        const actionMatch = botResponse.match(/<ACTION>(.*?)<\/ACTION>/s);
        if (actionMatch) {
            try {
                console.log("🔍 Raw ACTION content:", actionMatch[1]);
                const actionData = JSON.parse(actionMatch[1]);
            
                if (actionData.type === 'lead_capture') {
                    showLeadForm(actionData.fields, actionData.reason);
                } else if (actionData.type === 'appointment') {
                // Νέα προσθήκη για appointments
                    createAppointmentForm(
                        actionData.fields || [
                            { label: "Όνομα", name: "name", type: "text", required: true },
                            { label: "Email", name: "email", type: "email", required: true },
                            { label: "Τηλέφωνο", name: "phone", type: "tel", required: true }
                       ],
                        actionData.reason || "appointment",
                        "{{ api_key }}",
                        "{{ primary_color }}",
                        "{{ api_key }}"
                   );
                }
            } catch (e) {
                console.warn('Failed to parse ACTION block:', e);
           }
            return botResponse.replace(/<ACTION>.*?<\/ACTION>/s, '').trim();
      }
        return botResponse;
  }

    function showLeadForm(fields, reason) {
        createLeadForm(fields, reason, '{{ api_key }}', '{{ primary_color }}');
    // Το modal προστίθεται αυτόματα στο document.body, όχι στο chat
    }

    console.log('Chat widget loaded for {{ company_name }}');
    console.log('Widget is connected to API endpoint: /widget-chat?api_key={{ api_key }}');
    {% include 'rating_popup.js' %}
    // Στην αρχή ή στο τέλος του αρχείου:
    {{ lead_form_js|safe }}
    {{ appointment_form_js|safe }}

})();