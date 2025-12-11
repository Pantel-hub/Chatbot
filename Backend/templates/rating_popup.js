// Rating Popup Functionality
(function () {
	// Rating state variables
	let inactivityTimer = null;

	function getCurrentSessionId() {
		return localStorage.getItem(`chatbot_session_${apiKey}`) || null;
	}

	let ratingShown =
		localStorage.getItem(
			`rating_shown_${apiKey}_${getCurrentSessionId()}`
		) === "true";

	// Υπολογισμός API Base (server origin)
	let apiBase = "http://127.0.0.1:8000"; // default local

	const currentScript =
		document.currentScript ||
		Array.from(document.getElementsByTagName("script")).find(
			(s) => s.src && s.src.includes("widget.js")
		);

	if (currentScript && currentScript.src) {
		const url = new URL(currentScript.src);
		apiBase = url.origin;
	}

	// Create rating popup HTML
	const ratingPopupHTML = `
        <div id="rating-overlay-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}" class="rating-overlay-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}" style="display: none;">
            <div class="rating-popup-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}">
                <div class="rating-header-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}">
                    <h3 class="rating-title-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}">Πώς σας φάνηκε η εμπειρία με τον AI Assistant;</h3>
                    <button id="rating-close-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}" class="rating-close-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}">×</button>
                </div>
                <div class="rating-body-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}">
                    <p class="rating-description-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}">Βαθμολογήστε την εξυπηρέτησή μας</p>
                    <div class="rating-stars-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}">
                        <span class="star-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}" data-rating="1">⭐</span>
                        <span class="star-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}" data-rating="2">⭐</span>
                        <span class="star-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}" data-rating="3">⭐</span>
                        <span class="star-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}" data-rating="4">⭐</span>
                        <span class="star-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}" data-rating="5">⭐</span>
                    </div>
                </div>
            </div>
        </div>
    `;

	// Add rating popup to widget container
	widgetContainer.insertAdjacentHTML("beforeend", ratingPopupHTML);

	// Rating popup CSS
	const ratingStyles = `
        /* Rating Overlay */
        .rating-overlay-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }} {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 350px;
            height: 500px;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.3);
            z-index: 1001;
            display: none;
            overflow: hidden;
        }
        
        /* Rating Popup */
        .rating-popup-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }} {
            background: #ffffff;
            border-radius: 16px;
            padding: 0;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 90%;
            animation: ratingSlideIn 0.3s ease-out;
            overflow: hidden;
        }
        
        @keyframes ratingSlideIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        
        /* Rating Header */
        .rating-header-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }} {
            background: {{ primary_color }};
            color: white;
            padding: 20px;
            position: relative;
            text-align: center;
        }
        
        .rating-title-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }} {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            font-family: system-ui, -apple-system, sans-serif;
        }
        
        .rating-close-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }} {
            position: absolute;
            top: 15px;
            right: 15px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            font-size: 20px;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s ease;
        }
        
        .rating-close-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        /* Rating Body */
        .rating-body-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }} {
            padding: 30px 20px;
            text-align: center;
        }
        
        .rating-description-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }} {
            margin: 0 0 20px 0;
            color: #64748b;
            font-size: 14px;
            font-family: system-ui, -apple-system, sans-serif;
        }
        
        /* Rating Stars */
        .rating-stars-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }} {
            display: flex;
            justify-content: center;
            gap: 8px;
        }
        
        .star-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }} {
            font-size: 32px;
            cursor: pointer;
            transition: transform 0.2s ease, filter 0.2s ease;
            user-select: none;
            opacity: 0.3;
        }
        
        .star-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}:hover {
            transform: scale(1.1);
            opacity: 1;
        }
        
        .star-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}.hovered {
            opacity: 1;
        }
        
        .star-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}.selected {
            opacity: 1;
            transform: scale(1.1);
        }
    `;

	// Add rating styles to existing stylesheet
	const existingStyle = document.head.querySelector("style");
	if (existingStyle) {
		existingStyle.textContent += "\n" + ratingStyles;
	}

	// Get rating elements
	const ratingOverlay = document.getElementById(
		'rating-overlay-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}'
	);
	const ratingClose = document.getElementById(
		'rating-close-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}'
	);
	const stars = document.querySelectorAll(
		'.star-{{ company_name|replace(" ", "_")|replace("-", "_")|replace(".", "_") }}'
	);

	// Rating functions
	async function showRatingPopup() {
		const currentSessionId = getCurrentSessionId();

		ratingShown =
			localStorage.getItem(
				`rating_shown_${apiKey}_${currentSessionId}`
			) === "true";

		if (ratingShown) return;

		try {
			const response = await fetch(
				`${apiBase}/api/public/has_rated?api_key=${apiKey}&session_id=${currentSessionId}`
			);
			const data = await response.json();

			if (data.hasRated) {
				console.log(
					"Το session έχει ήδη δώσει rating, δεν θα εμφανιστεί popup."
				);
				return;
			}

			console.log("Showing rating popup");
			ratingOverlay.style.display = "flex";
		} catch (error) {
			console.error("Σφάλμα κατά τον έλεγχο has_rated:", error);
			// fallback: εμφάνισε το popup αν δεν δουλέψει το API
			ratingOverlay.style.display = "flex";
		}
	}

	function hideRatingPopup(rating = null) {
		const currentSessionId = getCurrentSessionId();
		ratingOverlay.style.display = "none";
		ratingShown = true;
		localStorage.setItem(
			`rating_shown_${apiKey}_${currentSessionId}`,
			"true"
		);

		// Submit rating to backend
		submitRating(rating);
	}

	function startInactivityTimer() {
		if (ratingShown) return;

		clearTimeout(inactivityTimer);
		console.log("⏱️ Timer ξεκίνησε για 3 λεπτά");

		inactivityTimer = setTimeout(() => {
			console.log("🚨 3 λεπτά πέρασαν, καλώ showRatingPopup()");
			showRatingPopup();
		}, 180000); // 3 λεπτά (για δοκιμή μπορείς να βάλεις 10000)
	}

	function resetInactivityTimer() {
		clearTimeout(inactivityTimer);
		if (!ratingShown) {
			console.log("🔄 Timer έγινε reset");
			startInactivityTimer();
		}
	}

	async function submitRating(rating) {
		const currentSessionId = getCurrentSessionId();
		try {
			console.log("Submitting rating:", rating);

			const response = await fetch(
				`${apiBase}/api/public/rating?api_key={{ api_key }}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						rating: rating,
						session_id: currentSessionId,
					}),
				}
			);

			const data = await response.json();
			if (data.status === "ok") {
				console.log("Rating stored:", rating);
				localStorage.setItem(
					"rating_shown_" + apiKey + "_" + currentSessionId,
					"true"
				);
				ratingOverlay.style.display = "none";
			} else {
				console.error("Rating error:", data.message);
			}
		} catch (error) {
			console.error("Rating submission error:", error);
		}
	}

	// Star hover effects
	stars.forEach((star, index) => {
		star.addEventListener("mouseenter", () => {
			stars.forEach((s, i) => {
				if (i <= index) {
					s.classList.add("hovered");
				} else {
					s.classList.remove("hovered");
				}
			});
		});

		star.addEventListener("mouseleave", () => {
			stars.forEach((s) => s.classList.remove("hovered"));
		});

		star.addEventListener("click", () => {
			const rating = parseInt(star.dataset.rating);
			console.log("Star clicked, rating:", rating);

			// Visual feedback
			stars.forEach((s, i) => {
				if (i < rating) {
					s.classList.add("selected");
				} else {
					s.classList.remove("selected");
				}
			});

			// Submit rating after a short delay for visual feedback
			setTimeout(() => {
				hideRatingPopup(rating);
			}, 300);
		});
	});

	// Close button event
	ratingClose.addEventListener("click", () => {
		console.log("Rating popup closed without rating");
		hideRatingPopup(null);
	});

	// Override original close chat behavior
	const originalCloseHandler = closeChat.onclick;
	closeChat.onclick = function (e) {
		if (!ratingShown) {
			e.preventDefault();
			showRatingPopup();
			return false;
		}
		// If rating was shown, proceed with normal close
		if (originalCloseHandler) {
			originalCloseHandler.call(this, e);
		} else {
			isOpen = false;
			chatPopup.style.display = "none";
		}
	};

	// Start inactivity timer after first bot response
	const originalAddMessage = addMessage;
	addMessage = function (content, isUser = false) {
		const result = originalAddMessage.apply(this, arguments);
		// Ξεκίνα το countdown μόνο μετά από bot message
		if (!isUser) {
			resetInactivityTimer();
		}
		return result;
	};

	// Stop-only όταν στέλνει ο χρήστης: ακύρωση του pending popup
	const originalSendMessage = sendMessage;
	sendMessage = function (...args) {
		resetInactivityTimer(); // μηδενίζει και ξαναρχίζει το countdown
		return originalSendMessage.apply(this, args);
	};
})();
