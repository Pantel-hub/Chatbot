// leadForm.js - Popup Modal Lead Form

function createLeadForm(fields, reason, companyName, primaryColor) {
    // Clean primary color (remove #)
    const cleanColor = primaryColor ? primaryColor.replace('#', '') : '4f46e5';
    
    // Remove existing modal if any
    const existingModal = document.querySelector('#lead-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'lead-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeLeadModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Στοιχεία Επικοινωνίας</h3>
                    <button class="modal-close" onclick="closeLeadModal()">×</button>
                </div>
                <div class="modal-body">
                    <p>Παρακαλώ συμπληρώστε τα παρακάτω στοιχεία για να επικοινωνήσουμε μαζί σας.</p>
                    <form id="lead-form" onsubmit="submitLeadModal(event)">
                        ${createFormFields(fields)}
                        <div class="modal-buttons">
                            <button type="submit" class="btn-submit">Αποστολή</button>
                            <button type="button" class="btn-cancel" onclick="closeLeadModal()">Ακύρωση</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Add modal styles
    addModalStyles(cleanColor);
    
    // Add to document
    document.body.appendChild(modal);
    
    // Focus first input
    setTimeout(() => {
        const firstInput = modal.querySelector('input, textarea');
        if (firstInput) firstInput.focus();
    }, 100);

    // Add confirmation message to chat
    addChatMessage(companyName, 'Παρακαλώ συμπληρώστε τη φόρμα επικοινωνίας που εμφανίστηκε.');
    
    return null; // No element to add to chat
}

function createFormFields(fields) {
    let fieldsHTML = '';
    
    fields.forEach(field => {
        const label = getFieldLabel(field);
        const type = getFieldType(field);
        
        if (type === 'textarea') {
            fieldsHTML += `
                <div class="form-field">
                    <label>${label}:</label>
                    <textarea name="${field}" placeholder="Γράψτε το ${label.toLowerCase()} σας..." required></textarea>
                </div>
            `;
        } else {
            fieldsHTML += `
                <div class="form-field">
                    <label>${label}:</label>
                    <input type="${type}" name="${field}" placeholder="Εισάγετε το ${label.toLowerCase()} σας..." required />
                </div>
            `;
        }
    });
    
    return fieldsHTML;
}

function getFieldLabel(fieldName) {
    const labels = {
        'name': 'Όνομα',
        'email': 'Email',
        'phone': 'Τηλέφωνο',
        'company': 'Εταιρεία',
        'message': 'Μήνυμα'
    };
    return labels[fieldName] || fieldName;
}

function getFieldType(fieldName) {
    const types = {
        'email': 'email',
        'phone': 'tel',
        'message': 'textarea'
    };
    return types[fieldName] || 'text';
}

function submitLeadModal(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('.btn-submit');
    const formData = new FormData(form);
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Αποστολή...';
    
    // Get form data
    const leadData = {};
    for (let [key, value] of formData.entries()) {
        leadData[key] = value.trim();
    }
    
    // Basic validation
    for (let [key, value] of Object.entries(leadData)) {
        if (!value) {
            alert(`Το πεδίο "${getFieldLabel(key)}" είναι υποχρεωτικό.`);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Αποστολή';
            return;
        }
    }
    
    // Email validation if exists
    if (leadData.email && !isValidEmail(leadData.email)) {
        alert('Παρακαλώ εισάγετε έγκυρη διεύθυνση email.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Αποστολή';
        return;
    }
    
    // Submit data
    submitLeadData(leadData)
        .then(() => {
            closeLeadModal();
            showSuccessMessage();
        })
        .catch((error) => {
            console.error('Lead submission error:', error);
            alert('Υπήρξε σφάλμα κατά την αποστολή. Παρακαλώ δοκιμάστε ξανά.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Αποστολή';
        });
}

function closeLeadModal() {
    const modal = document.querySelector('#lead-modal');
    if (modal) {
        modal.remove();
    }
}

function showSuccessMessage() {
    // Add success message to chat
    const companyName = document.querySelector('[id*="chat-messages-"]').id.split('-')[2];
    addChatMessage(companyName, 'Ευχαριστούμε! Τα στοιχεία σας στάλθηκαν με επιτυχία. Θα επικοινωνήσουμε μαζί σας σύντομα.');
}

function addChatMessage(companyName, message) {
    const messagesContainer = document.querySelector(`[id*="chat-messages-"]`);
    if (!messagesContainer) return;
    
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message-wrapper-${companyName} bot-wrapper-${companyName}`;
    messageWrapper.innerHTML = `
        <div class="bot-message-${companyName}" style="margin-left: 0;">${message}</div>
    `;
    messagesContainer.appendChild(messageWrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function submitLeadData(leadData) {
    // Get API details from current widget
    const currentScript = document.currentScript || 
        Array.from(document.getElementsByTagName('script')).find(s => 
            s.src && s.src.includes('widget.js')
        );
    
    let apiBase = 'http://127.0.0.1:8000';
    let apiKey = '';
    
    if (currentScript && currentScript.src) {
        const url = new URL(currentScript.src);
        apiBase = url.origin;
        const params = new URLSearchParams(url.search);
        apiKey = params.get('key');
    }
    
    const response = await fetch(`${apiBase}/api/public/submit-lead?api_key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            leadData: leadData,
            timestamp: new Date().toISOString()
        })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function addModalStyles(primaryColor) {
    if (document.querySelector('#lead-modal-styles')) return;
    
    const styles = `
        #lead-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            font-family: system-ui, -apple-system, sans-serif;
        }
        
        .modal-overlay {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 350px;
            height: 500px;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 12px;
            z-index: 1002;
   }

        .modal-content {
            background: white;
            border-radius: 12px;
            width: 100%;
            height: 100%;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            position: relative;
            display: flex;
            flex-direction: column;
        }
        
        .modal-header {
            padding: 20px 20px 0;
            border-bottom: 1px solid #e5e7eb;
            margin-bottom: 0;
            position: relative;
        }
        
        .modal-header h3 {
            margin: 0 0 15px 0;
            color: #${primaryColor};
            font-size: 20px;
            font-weight: 600;
        }
        
        .modal-close {
            position: absolute;
            top: 15px;
            right: 15px;
            background: none;
            border: none;
            font-size: 24px;
            color: #6b7280;
            cursor: pointer;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s;
        }
        
        .modal-close:hover {
            background: #f3f4f6;
        }
        
        .modal-body {
            padding: 20px;
        }
        
        .modal-body p {
            margin: 0 0 20px 0;
            color: #6b7280;
            line-height: 1.5;
        }
        
        .form-field {
            margin-bottom: 16px;
        }
        
        .form-field label {
            display: block;
            margin-bottom: 6px;
            color: #374151;
            font-size: 14px;
            font-weight: 500;
        }
        
        .form-field input,
        .form-field textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            background: white;
            box-sizing: border-box;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        
        .form-field textarea {
            min-height: 80px;
            resize: vertical;
            font-family: inherit;
        }
        
        .form-field input:focus,
        .form-field textarea:focus {
            outline: none;
            border-color: #${primaryColor};
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        
        .modal-buttons {
            display: flex;
            gap: 12px;
            margin-top: 24px;
        }
        
        .btn-submit {
            flex: 1;
            background: #${primaryColor};
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        
        .btn-submit:hover:not(:disabled) {
            opacity: 0.9;
        }
        
        .btn-submit:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .btn-cancel {
            background: #f8fafc;
            color: #64748b;
            border: 1px solid #d1d5db;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .btn-cancel:hover {
            background: #f1f5f9;
        }
        
        @media (max-width: 480px) {
            .modal-overlay {
                padding: 10px;
            }
            
            .modal-content {
                max-height: 95vh;
            }
            
            .modal-buttons {
                flex-direction: column;
            }
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.id = 'lead-modal-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

// Make functions globally accessible
window.createLeadForm = createLeadForm;
window.submitLeadModal = submitLeadModal;
window.closeLeadModal = closeLeadModal;