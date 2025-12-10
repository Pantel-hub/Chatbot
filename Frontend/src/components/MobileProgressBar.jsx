import React from 'react';

const MobileProgressBar = ({ steps, currentPage, maxVisitedPage, onGoToPage }) => {
  return (
    <div className="w-full px-4 sm:px-6 py-4 bg-white border-t border-gray-200">
      <div className="flex items-start">
        {steps.map((step, index) => {
          const isCompleted = index < currentPage;
          const isActive = index === currentPage;
          const isAccessible = index <= maxVisitedPage;

          // --- Classes for styling ---
          let circleClass = 'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 relative z-10';
          let lineClass = 'flex-1 h-0.5 transition-all duration-300';
          let textClass = 'text-xs mt-2 text-center transition-all duration-300 w-20';

          if (isActive) {
            circleClass += ' bg-green-500 text-white scale-110';
            textClass += ' text-green-600 font-bold';
          } else if (isCompleted) {
            circleClass += ' bg-green-500 text-white cursor-pointer hover:bg-green-600';
            textClass += ' text-gray-700';
          } else if (isAccessible) {
            circleClass += ' bg-gray-300 text-gray-600 cursor-pointer hover:bg-gray-400';
            textClass += ' text-gray-500';
          } else {
            circleClass += ' bg-gray-200 text-gray-400';
            textClass += ' text-gray-400';
          }

          if (index < currentPage) {
            lineClass += ' bg-green-500';
          } else {
            lineClass += ' bg-gray-300';
          }
          
          return (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center">
                <button
                  onClick={() => isAccessible && onGoToPage(index)}
                  disabled={!isAccessible}
                  className={circleClass}
                  aria-label={`Go to step ${index + 1}`}
                >
                    <span>{index + 1}</span>
                </button>
                <p className={textClass}>STEP {index + 1}</p>
              </div>

              {index < steps.length - 1 && (
                <div className={lineClass} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default MobileProgressBar;