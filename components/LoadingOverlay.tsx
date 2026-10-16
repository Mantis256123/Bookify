const LoadingOverlay = () => {
  return (
    <div className="loading-wrapper" role="status" aria-live="polite">
      <div className="loading-shadow-wrapper bg-white">
        <div className="loading-shadow">
          <div className="loading-animation h-10 w-10 rounded-full border-4 border-[#f3e4c7] border-t-[#663820]" />
          <p className="loading-title">Preparing your book...</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
