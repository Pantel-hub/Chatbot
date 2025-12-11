// appointmentForm.js - Καθαρό Calendar System

function createAppointmentForm(
	fields,
	reason,
	companyName,
	primaryColor,
	apiKey
) {
	console.log("🗓️ Creating appointment form...", {
		fields,
		companyName,
		apiKey,
	});

	// Καθαρισμός υπάρχοντος modal
	const existingModal = document.querySelector("#appointment-modal");
	if (existingModal) {
		existingModal.remove();
	}

	// Δημιουργία modal structure
	const modal = document.createElement("div");
	modal.id = "appointment-modal";
	modal.innerHTML = createModalHTML(fields, companyName);

	// Προσθήκη styles
	addAppointmentStyles(primaryColor);

	// Προσθήκη στο DOM
	document.body.appendChild(modal);

	// Αρχικοποίηση event listeners
	initializeEventListeners(apiKey, companyName);

	// Focus στο πρώτο input
	setTimeout(() => {
		const firstInput = modal.querySelector(
			'input[type="text"], input[type="email"]'
		);
		if (firstInput) firstInput.focus();
	}, 100);

	return modal;
}

/**
 * Δημιουργεί το HTML του modal
 */
function createModalHTML(fields, companyName) {
	return `
        <div class="appointment-overlay" onclick="closeAppointmentModal()">
            <div class="appointment-content" onclick="event.stopPropagation()">
                <!-- Header -->
                <div class="appointment-header">
                    <h3>Κλείσιμο Ραντεβού</h3>
                    <button class="appointment-close" onclick="closeAppointmentModal()">&times;</button>
                </div>
                
                <!-- Body -->
                <div class="appointment-body">
                    <form id="appointment-form" onsubmit="handleAppointmentSubmit(event)">
                        ${createFieldsHTML(fields)}
                        
                        <!-- Date Picker -->
                        <div class="appointment-field">
                            <label>Επιλέξτε ημερομηνία:</label>
                            <input type="date" 
                                   id="appointment-date" 
                                   name="appointment_date" 
                                   required 
                                   min="${getTodayDate()}" 
                                   onchange="loadAvailableSlots()" />
                        </div>
                        
                        <!-- Time Slots -->
                        <div id="time-slots-container" style="display: none;">
                            <label>Διαθέσιμες ώρες:</label>
                            <div id="time-slots" class="time-slots-grid"></div>
                        </div>
                        
                        <!-- Submit Buttons -->
                        <div class="appointment-buttons">
                            <button type="submit" class="btn-appointment-submit" disabled>
                                Κλείσιμο Ραντεβού
                            </button>
                            <button type="button" class="btn-appointment-cancel" onclick="closeAppointmentModal()">
                                Ακύρωση
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}

/**
 * Δημιουργεί HTML για τα πεδία της φόρμας
 */
function createFieldsHTML(fields) {
	if (!Array.isArray(fields)) return "";

	return fields
		.map(
			(field) => `
        <div class="appointment-field">
            <label>${field.label}:</label>
            <input type="${field.type || "text"}" 
                   name="${field.name}" 
                   placeholder="Εισάγετε ${field.label.toLowerCase()}" 
                   ${field.required ? "required" : ""} />
        </div>
    `
		)
		.join("");
}

/**
 * Επιστρέφει το σημερινό date σε YYYY-MM-DD format
 */
function getTodayDate() {
	const today = new Date();
	return today.toISOString().split("T")[0];
}

/**
 * Αρχικοποιεί όλα τα event listeners
 */
function initializeEventListeners(apiKey, companyName) {
	// Global variables για το form
	window.currentApiKey = apiKey;
	window.currentCompanyName = companyName;
	window.selectedSlot = null;

	console.log(
		"📅 Event listeners initialized for",
		companyName,
		"with API key",
		apiKey
	);
}

/**
 * Κλείνει το appointment modal
 */
function closeAppointmentModal() {
	const modal = document.querySelector("#appointment-modal");
	if (modal) {
		modal.remove();
	}
	// Cleanup global variables
	window.currentApiKey = null;
	window.currentCompanyName = null;
	window.selectedSlot = null;
}

/**
 * Φορτώνει διαθέσιμες ώρες από το API
 */
async function loadAvailableSlots() {
	const dateInput = document.querySelector("#appointment-date");
	const slotsContainer = document.querySelector("#time-slots-container");
	const slotsGrid = document.querySelector("#time-slots");
	const submitBtn = document.querySelector(".btn-appointment-submit");

	if (!dateInput.value) return;

	console.log("🔍 Loading slots for date:", dateInput.value);

	// Show loading state
	slotsContainer.style.display = "block";
	slotsGrid.innerHTML =
		'<div class="loading-slots">Φόρτωση διαθέσιμων ωρών...</div>';
	submitBtn.disabled = true;
	window.selectedSlot = null;

	try {
		// Get API base URL
		const apiBase = getApiBaseUrl();
		const slotsUrl = `${apiBase}/api/public/available-slots/${
			window.currentApiKey
		}?date=${encodeURIComponent(dateInput.value)}`;
		const bookedUrl = `${apiBase}/api/public/booked-appointments/${
			window.currentApiKey
		}?date=${encodeURIComponent(dateInput.value)}`;

		// Fetch both available slots and booked appointments in parallel
		const [slotsResp, bookedResp] = await Promise.all([
			fetch(slotsUrl),
			fetch(bookedUrl),
		]);

		if (!slotsResp.ok) {
			throw new Error(
				`Slots HTTP ${slotsResp.status}: ${slotsResp.statusText}`
			);
		}
		if (!bookedResp.ok) {
			throw new Error(
				`Appointments HTTP ${bookedResp.status}: ${bookedResp.statusText}`
			);
		}

		const slotsData = await slotsResp.json();
		const bookedData = await bookedResp.json();

		console.log("📅 Received slots:", slotsData);
		console.log("📖 Booked appointments:", bookedData);

		displayBookedAppointments(bookedData.appointments || []);
		displayTimeSlots(slotsData.available_slots || []);
	} catch (error) {
		console.error("❌ Error loading slots or appointments:", error);
		slotsGrid.innerHTML = `
            <div class="error-message">
                Σφάλμα φόρτωσης ωρών: ${error.message}
                <br><small>Παρακαλώ δοκιμάστε ξανά</small>
            </div>
        `;
		displayBookedAppointments([]); // Clear booked appointments on error
	}
}

/**
 * Εμφανίζει τα ήδη κλεισμένα ραντεβού για την ημερομηνία
 */
function displayBookedAppointments(appointments) {
	let container = document.querySelector("#booked-appointments-container");
	if (!container) {
		// Insert above time-slots-container
		const slotsContainer = document.querySelector("#time-slots-container");
		container = document.createElement("div");
		container.id = "booked-appointments-container";
		slotsContainer.parentNode.insertBefore(container, slotsContainer);
	}
	if (!appointments || appointments.length === 0) {
		container.innerHTML =
			'<div class="no-slots">Δεν υπάρχουν κλεισμένα ραντεβού για αυτή την ημερομηνία</div>';
		return;
	}
	container.innerHTML = `
        <div class="booked-appointments-list">
            <div class="booked-title">Κλεισμένα ραντεβού:</div>
            ${appointments
				.map(
					(app) => `
                <div class="booked-appointment-item">
                    <span class="booked-time">${formatAppointmentTime(
						app.start,
						app.end
					)}</span>
                    <span class="booked-summary">${escapeHtml(
						app.summary || "Ραντεβού"
					)}</span>
                </div>
            `
				)
				.join("")}
        </div>
    `;
}

function formatAppointmentTime(startIso, endIso) {
	try {
		const start = new Date(startIso);
		const end = new Date(endIso);
		const pad = (n) => n.toString().padStart(2, "0");
		return `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(
			end.getHours()
		)}:${pad(end.getMinutes())}`;
	} catch {
		return "";
	}
}

function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Εμφανίζει τις διαθέσιμες ώρες
 */
function displayTimeSlots(slots) {
	const slotsGrid = document.querySelector("#time-slots");

	if (!slots || slots.length === 0) {
		slotsGrid.innerHTML =
			'<div class="no-slots">Δεν υπάρχουν διαθέσιμες ώρες για αυτή την ημερομηνία</div>';
		return;
	}

	slotsGrid.innerHTML = slots
		.map(
			(slot) => `
        <button type="button" 
                class="time-slot-btn" 
                data-datetime="${slot.datetime}"
                onclick="selectTimeSlot(this, '${slot.datetime}')">
            ${slot.start_time} - ${slot.end_time}
        </button>
    `
		)
		.join("");
}

/**
 * Επιλέγει ώρα ραντεβού
 */
function selectTimeSlot(button, datetime) {
	// Remove previous selection
	document.querySelectorAll(".time-slot-btn").forEach((btn) => {
		btn.classList.remove("selected");
	});

	// Add selection to clicked button
	button.classList.add("selected");
	window.selectedSlot = datetime;

	// Enable submit button
	const submitBtn = document.querySelector(".btn-appointment-submit");
	submitBtn.disabled = false;

	console.log("⏰ Selected slot:", datetime);
}

/**
 * Χειρίζεται το submit της φόρμας
 */
async function handleAppointmentSubmit(event) {
	event.preventDefault();

	if (!window.selectedSlot) {
		alert("Παρακαλώ επιλέξτε ώρα ραντεβού");
		return;
	}

	const form = event.target;
	const submitBtn = form.querySelector(".btn-appointment-submit");
	const originalText = submitBtn.textContent;

	// Disable form
	submitBtn.disabled = true;
	submitBtn.textContent = "Δημιουργία ραντεβού...";

	try {
		// Collect form data
		const formData = new FormData(form);
		const appointmentData = {};

		for (let [key, value] of formData.entries()) {
			appointmentData[key] = value.trim();
		}

		// Add selected slot
		appointmentData.start_datetime = window.selectedSlot;

		console.log("📝 Submitting appointment:", appointmentData);

		// Submit to API
		const result = await submitAppointment(appointmentData);

		// Success

		closeAppointmentModal();

		// Optional: Add success message to chat
		addAppointmentSuccessMessage();
	} catch (error) {
		// Re-enable form
		submitBtn.disabled = false;
		submitBtn.textContent = originalText;
	}
}

/**
 * Υποβάλλει το ραντεβού στο API
 */
async function submitAppointment(appointmentData) {
	const apiBase = getApiBaseUrl();
	const url = `${apiBase}/api/public/create-appointment/${window.currentApiKey}`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(appointmentData),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`HTTP ${response.status}: ${errorText}`);
	}

	return await response.json();
}

/**
 * Προσθέτει μήνυμα επιτυχίας στο chat
 */
function addAppointmentSuccessMessage() {
	try {
		const messagesContainer = document.querySelector(
			`[id*="chat-messages-"]`
		);
		if (!messagesContainer) return;

		const messageWrapper = document.createElement("div");
		messageWrapper.className = `message-wrapper-${window.currentCompanyName} bot-wrapper-${window.currentCompanyName}`;
		messageWrapper.innerHTML = `
            
            <div class="bot-message-${window.currentCompanyName}">
                ✅ Το ραντεβού σας δημιουργήθηκε επιτυχώς! Θα λάβετε email επιβεβαίωσης σύντομα.
            </div>
        `;
		messagesContainer.appendChild(messageWrapper);
		messagesContainer.scrollTop = messagesContainer.scrollHeight;
	} catch (error) {
		console.warn("Could not add success message to chat:", error);
	}
}

/**
 * Βρίσκει το API base URL
 */
function getApiBaseUrl() {
	const currentScript =
		document.currentScript ||
		Array.from(document.getElementsByTagName("script")).find(
			(s) => s.src && s.src.includes("widget.js")
		);

	if (currentScript && currentScript.src) {
		const url = new URL(currentScript.src);
		return url.origin;
	}

	return "http://127.0.0.1:8000"; // fallback για development
}

/**
 * Προσθέτει CSS styles για το appointment form
 */
function addAppointmentStyles(primaryColor = "#4f46e5") {
	const styleId = "appointment-form-styles";
	if (document.getElementById(styleId)) return;

	const style = document.createElement("style");
	style.id = styleId;
	style.textContent = `
        /* Appointment Modal */
        #appointment-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: system-ui, -apple-system, sans-serif;
        }
        
        .appointment-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6); /* ή ό,τι θες */
  backdrop-filter: blur(2px);
  z-index: 1002;
}


        .appointment-content {
  position: fixed;
  bottom: 90px;
  right: 20px;
  width: 350px;
  max-width: calc(100vw - 40px);
  height: 600px;
  max-height: calc(100vh - 120px);
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.3);
  animation: appointmentSlideIn 0.3s ease-out;

  display: flex;            /* σημαντικό */
  flex-direction: column;   /* σημαντικό */
  overflow: hidden;         /* κρατάει στρογγυλεμένες γωνίες */
}
 

        
        @keyframes appointmentSlideIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .appointment-header {
            background: ${primaryColor};
            color: white;
            padding: 20px 24px;
            position: relative;
        }
        
        .appointment-header h3 {
            margin: 0;
            font-size: 20px;
            font-weight: 600;
        }
        
        .appointment-close {
            position: absolute;
            top: 16px;
            right: 20px;
            background: none;
            border: none;
            color: white;
            font-size: 28px;
            cursor: pointer;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        
        .appointment-close:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        
        .appointment-body {
            padding: 24px;
            max-height: 1 1 auto;
            overflow-y: auto;
        }
        
        .appointment-field {
            margin-bottom: 20px;
        }
        
        .appointment-field label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #374151;
            font-size: 14px;
        }
        
        .appointment-field input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.2s, box-shadow 0.2s;
            box-sizing: border-box;
        }
        
        .appointment-field input:focus {
            outline: none;
            border-color: ${primaryColor};
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        
        #time-slots-container {
            margin-top: 16px;
        }
        
        .time-slots-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
            margin-top: 12px;
        }
        
        .time-slot-btn {
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            background: white;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
            color: #374151;
        }
        
        .time-slot-btn:hover {
            border-color: ${primaryColor};
            background: rgba(79, 70, 229, 0.05);
        }
        
        .time-slot-btn.selected {
            border-color: ${primaryColor};
            background: ${primaryColor};
            color: white;
        }
        
        .loading-slots, .no-slots, .error-message {
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-style: italic;
        }
        
        .error-message {
            color: #dc2626;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
        }
        
        .appointment-buttons {
            display: flex;
            gap: 12px;
            margin-top: 32px;
        }
        
        .btn-appointment-submit {
            flex: 1;
            background: ${primaryColor};
            color: white;
            border: none;
            padding: 16px 24px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s, transform 0.2s;
        }
        
        .btn-appointment-submit:hover:not(:disabled) {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        
        .btn-appointment-submit:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        
        .btn-appointment-cancel {
            background: #f8fafc;
            color: #64748b;
            border: 2px solid #e2e8f0;
            padding: 16px 24px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .btn-appointment-cancel:hover {
            background: #f1f5f9;
        }
        
        /* Mobile responsiveness */
        @media (max-width: 640px) {
            .appointment-content {
                width: 95%;
                margin: 10px;
            }
            
            .appointment-buttons {
                flex-direction: column;
            }
            
            .time-slots-grid {
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            }
        }
    `;

	document.head.appendChild(style);
}

// Make functions globally accessible
window.createAppointmentForm = createAppointmentForm;
window.closeAppointmentModal = closeAppointmentModal;
window.loadAvailableSlots = loadAvailableSlots;
window.selectTimeSlot = selectTimeSlot;
window.handleAppointmentSubmit = handleAppointmentSubmit;
