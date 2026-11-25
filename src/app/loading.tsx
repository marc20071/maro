
export default function Loading() {
  return (
    <div className="maro-loading">
      <div className="maro-loading-content">
        <div className="maro-logo-container">
          <div className="maro-glow" />

          <img
            src="/icons/maro.svg"
            alt="Maro"
            className="maro-loading-logo"
          />
        </div>

        <h2>MARO AI</h2>

        <p>Your AI companion is getting ready...</p>

        <div className="maro-loading-line">
          <div className="maro-loading-progress" />
        </div>
      </div>

      <style jsx>{`
        .maro-loading {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0b0e13;
          color: #f4f4f5;
          font-family: system-ui, sans-serif;
          padding: 24px;
        }

        .maro-loading-content {
          width: 100%;
          max-width: 360px;
          text-align: center;
          animation: appear 0.6s ease-out;
        }

        .maro-logo-container {
          width: 90px;
          height: 90px;
          position: relative;
          display: grid;
          place-items: center;
          margin: 0 auto 24px;
        }

        .maro-glow {
          position: absolute;
          inset: -15px;
          border-radius: 35px;
          background: rgba(245, 165, 36, 0.12);
          filter: blur(24px);
          animation: glow 2s infinite alternate;
        }

        .maro-loading-logo {
          width: 78px;
          height: 78px;
          object-fit: contain;
          position: relative;
          animation: float 2.5s ease-in-out infinite;
        }

        h2 {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 5px;
          color: #f5a524;
          margin: 0 0 14px;
        }

        p {
          font-size: 14px;
          color: #8c93a3;
          margin: 0;
        }

        .maro-loading-line {
          height: 3px;
          width: 100%;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 100px;
          overflow: hidden;
          margin-top: 30px;
        }

        .maro-loading-progress {
          height: 100%;
          width: 35%;
          border-radius: 100px;
          background: linear-gradient(
            90deg,
            transparent,
            #f5a524,
            #ffd27a
          );
          animation: loading 1.5s ease-in-out infinite;
        }

        @keyframes loading {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(350%);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        @keyframes glow {
          from {
            opacity: 0.5;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes appear {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
