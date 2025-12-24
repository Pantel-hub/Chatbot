import "./i18n"; // <- ΠΡΩΤΟ, ώστε να στηθεί το context
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./App.css";

const container = document.getElementById("app");
if (!container) throw new Error("Το στοιχείο #app δεν βρέθηκε");

createRoot(container).render(
	<React.StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</React.StrictMode>
);
