import { useEffect, useRef } from "react";

const COLORS = [
  "#ffee00",
  "#ff003c",
  "#00f0ff",
  "#39ff14",
  "#ff00ea",
  "#ff7b00",
  "#00ff9d",
  "#ffffff",
];

class Rocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetY: number;
  color: string;

  constructor(x: number, targetY: number, height: number) {
    this.x = x;
    this.y = height + 10;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = -(8 + Math.random() * 3);
    this.targetY = targetY;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.1;

    if (this.vy >= -1.5 || this.y <= this.targetY) {
      return false;
    }

    return true;
  }

  draw(context: CanvasRenderingContext2D) {
    context.beginPath();
    context.arc(this.x, this.y, 3, 0, Math.PI * 2);
    context.fillStyle = this.color;
    context.shadowBlur = 25;
    context.shadowColor = this.color;
    context.fill();
    context.shadowBlur = 0;
  }
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life = 1;
  decay: number;
  color: string;
  size: number;

  constructor(x: number, y: number, angle: number, speed: number, color: string) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.decay = 0.012 + Math.random() * 0.018;
    this.color = color;
    this.size = 1.5 + Math.random() * 2.2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.985;
    this.vy *= 0.985;
    this.vy += 0.045;
    this.life -= this.decay;
    return this.life > 0;
  }

  draw(context: CanvasRenderingContext2D) {
    context.globalAlpha = Math.max(0, this.life);
    context.beginPath();
    context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    context.fillStyle = this.color;
    context.shadowBlur = 18;
    context.shadowColor = this.color;
    context.fill();
    context.globalAlpha = 1;
    context.shadowBlur = 0;
  }
}

export function FinalFireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    const rockets: Rocket[] = [];
    const particles: Particle[] = [];

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * scale));
      canvas.height = Math.max(1, Math.floor(height * scale));
      context.setTransform(scale, 0, 0, scale, 0, 0);
    };

    const explode = (x: number, y: number, color: string) => {
      const count = 90 + Math.floor(Math.random() * 50);
      for (let index = 0; index < count; index += 1) {
        particles.push(new Particle(x, y, Math.random() * Math.PI * 2, 1.5 + Math.random() * 5.5, color));
      }
    };

    const launch = (x = Math.random() * width, y = height * (0.18 + Math.random() * 0.42)) => {
      rockets.push(new Rocket(x, y, height));
    };

    const handleClick = (event: MouseEvent) => {
      const bounds = canvas.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        return;
      }

      launch(event.clientX - bounds.left, event.clientY - bounds.top);
    };

    const animate = () => {
      context.clearRect(0, 0, width, height);

      for (let index = rockets.length - 1; index >= 0; index -= 1) {
        const rocket = rockets[index];
        if (!rocket.update()) {
          explode(rocket.x, rocket.y, rocket.color);
          rockets.splice(index, 1);
        } else {
          rocket.draw(context);
        }
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        if (!particle.update()) {
          particles.splice(index, 1);
        } else {
          particle.draw(context);
        }
      }

      animationFrame = window.requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("click", handleClick);
    const launchTimer = window.setInterval(() => {
      if (rockets.length < 5) launch();
    }, 650);
    launch();
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearInterval(launchTimer);
      window.removeEventListener("resize", resize);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return <canvas ref={canvasRef} className="final-fireworks" aria-hidden="true" />;
}