import { useEffect, useRef, useState } from "react";
import { drawStadium } from "./stadium-background.js";

const MESSAGES = [
  "Warming up the pitch",
  "Gathering the squad",
  "Checking the standings",
  "Setting the formation",
  "Almost kickoff",
];

export function LeagueLoadingScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [dots, setDots] = useState("...");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return drawStadium(canvas);
  }, []);

  useEffect(() => {
    const startedAt = performance.now();
    const totalDuration = 3000;
    const progressTimer = window.setInterval(() => {
      setProgress(Math.min(100, ((performance.now() - startedAt) / totalDuration) * 100));
    }, 100);
    const messageTimer = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % MESSAGES.length);
    }, 1500);
    const dotsTimer = window.setInterval(() => {
      setDots((current) => `${current}.`.replace(/\.{4,}/, "."));
    }, 450);

    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(messageTimer);
      window.clearInterval(dotsTimer);
    };
  }, []);

  return (
    <main className="league-loading" aria-label="Loading E Football Friends League">
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden="true" />
      <div className="league-loading__beams" aria-hidden="true" />
      <div className="league-loading__pitch" aria-hidden="true" />
      <div className="league-loading__pitch-lines" aria-hidden="true" />
      <div className="league-loading__stage">
        <div className="league-loading__pitchbox" aria-hidden="true">
          <div className="league-loading__shadow" />
          <div className="league-loading__ball">
            <svg className="league-loading__ball-art" viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <radialGradient id="football-surface" cx="31%" cy="23%" r="78%">
                  <stop offset="0" stopColor="#fff" />
                  <stop offset="0.48" stopColor="#f1f1ec" />
                  <stop offset="0.82" stopColor="#d2d4d3" />
                  <stop offset="1" stopColor="#8b9297" />
                </radialGradient>
                <radialGradient id="football-gloss" cx="28%" cy="20%" r="70%">
                  <stop offset="0" stopColor="#fff" stopOpacity="0.72" />
                  <stop offset="0.42" stopColor="#fff" stopOpacity="0.12" />
                  <stop offset="1" stopColor="#17202a" stopOpacity="0.2" />
                </radialGradient>
                <clipPath id="football-clip">
                  <circle cx="50" cy="50" r="48" />
                </clipPath>
              </defs>
              <circle cx="50" cy="50" r="48" fill="url(#football-surface)" />
              <g
                clipPath="url(#football-clip)"
                fill="#171b20"
                stroke="#4d5358"
                strokeLinejoin="round"
                strokeWidth="1.5"
              >
                <path d="m50 35 13 9-5 16H42l-5-16 13-9Z" />
                <path d="m50 3 12 8-3 14-9 6-9-6-3-14 12-8Z" />
                <path d="m10 23 14-2 10 9-2 13-13 5-10-9 1-16Z" />
                <path d="m76 30 10-9 14 2 1 16-10 9-13-5-2-13Z" />
                <path d="m9 67 9-12 13 3 5 14-8 12-14-2-5-15Z" />
                <path d="m69 58 13-3 9 12-5 15-14 2-8-12 5-14Z" />
                <path d="m40 78 10-8 10 8 1 13-11 8-11-8 1-13Z" />
              </g>
              <circle cx="50" cy="50" r="48" fill="url(#football-gloss)" />
              <circle cx="50" cy="50" r="47.5" fill="none" stroke="#fff" strokeOpacity="0.7" />
            </svg>
          </div>
        </div>
        <h1 className="league-loading__title">
          E Football
          <span>Friends League</span>
        </h1>
        <div className="league-loading__chips" aria-label="Friends, Football, Competition">
          <span>Friends</span>
          <span>Football</span>
          <span className="league-loading__chip--gold">Competition</span>
        </div>
        <div className="league-loading__scoreboard">
          <div className="league-loading__score-row">
            <span>Kickoff status</span>
            <strong>{Math.round(progress)}%</strong>
          </div>
          <div
            className="league-loading__track"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="league-loading__fill" style={{ width: `${progress}%` }} />
            <div className="league-loading__ticks" aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
          </div>
          <p className="league-loading__status" role="status" aria-live="polite">
            <b>{MESSAGES[messageIndex]}</b>
            {dots}
          </p>
        </div>
      </div>
    </main>
  );
}
