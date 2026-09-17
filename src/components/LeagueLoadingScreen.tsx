import { useEffect, useState } from "react";

const MESSAGES = [
  "Warming up the pitch",
  "Gathering the squad",
  "Checking the standings",
  "Setting the formation",
  "Almost kickoff",
];

export function LeagueLoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [dots, setDots] = useState("...");

  useEffect(() => {
    const progressTimer = window.setInterval(() => {
      setProgress((current) => {
        const next = current + Math.random() * 9 + 3;
        if (next >= 100) {
          setMessageIndex((index) => (index + 1) % MESSAGES.length);
          return 0;
        }
        return next;
      });
    }, 480);
    const dotsTimer = window.setInterval(() => {
      setDots((current) => `${current}.`.replace(/\.{4,}/, "."));
    }, 450);

    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(dotsTimer);
    };
  }, []);

  return (
    <main className="league-loading" aria-label="Loading E Football Friends League">
      <div className="league-loading__beams" aria-hidden="true" />
      <div className="league-loading__pitch" aria-hidden="true" />
      <div className="league-loading__pitch-lines" aria-hidden="true" />
      <div className="league-loading__stage">
        <div className="league-loading__pitchbox" aria-hidden="true">
          <div className="league-loading__shadow" />
          <div className="league-loading__ball">
            <span className="league-loading__ball-patch league-loading__ball-patch--one" />
            <span className="league-loading__ball-patch league-loading__ball-patch--two" />
            <span className="league-loading__ball-patch league-loading__ball-patch--three" />
            <span className="league-loading__ball-patch league-loading__ball-patch--four" />
            <span className="league-loading__ball-patch league-loading__ball-patch--five" />
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
          <p className="league-loading__status">
            <b>{MESSAGES[messageIndex]}</b>
            {dots}
          </p>
        </div>
      </div>
    </main>
  );
}
