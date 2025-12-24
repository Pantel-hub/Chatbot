// PageTransition.jsx
import React from "react";

export default function PageTransition({ children }) {
	return (
		<div className="page-transition fadeIn">
			{children}
		</div>
	);
}
