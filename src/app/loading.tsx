
export default function Loading() {
  return (
    <main className="maro-loading">
      <div className="maro-loading-content">
        <div className="maro-logo-container">
          <div className="maro-glow" />

          <img
            src="/icons/maro.svg"
            alt="Maro AI"
            className="maro-loading-logo"
          />
        </div>

        <h2>MARO AI</h2>

        <p>maro ai</p>

        <div
          className="maro-loading-line"
          role="progressbar"
          aria-label="Loading"
        >
          <div className="maro-loading-progress" />
        </div>
      </div>
    </main>
  );
}
