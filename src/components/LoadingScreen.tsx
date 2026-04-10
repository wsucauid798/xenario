import { ArrowRight, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import reactLogo from '../assets/images/react.svg';
import tailwindLogo from '../assets/images/tailwindcss-mark.96ee6a5a.svg';
import threeLogo from '../assets/images/three-js.svg';
import typescriptLogo from '../assets/images/ts-logo-512.svg';

interface Props {
  ready: boolean;
  onBegin: () => void;
}

export function LoadingScreen({ ready, onBegin }: Props) {
  const [mounted, setMounted] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const techStack = [
    { label: 'TypeScript', logo: typescriptLogo, preserveColor: true },
    { label: 'React 19', logo: reactLogo },
    { label: 'Three.js', logo: threeLogo },
    { label: 'Tailwind v4', logo: tailwindLogo },
  ];

  // Stagger entrance animations
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Reveal the prompt once ready
  useEffect(() => {
    if (ready) {
      const t = setTimeout(() => setShowPrompt(true), 400);
      return () => clearTimeout(t);
    }
  }, [ready]);

  // Allow pressing Enter or Space to begin
  useEffect(() => {
    if (!showPrompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onBegin();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPrompt, onBegin]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-black px-6 py-8 text-stone-100 select-none sm:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="experience-screen-vignette absolute inset-0" />
        <div
          className={`experience-atmosphere-glow absolute left-[12%] top-[18%] h-[28rem] w-[28rem] rounded-full transition-all duration-[2200ms] ${
            mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
        />
        <div
          className={`experience-atmosphere-glow-cool absolute bottom-[10%] right-[8%] h-[24rem] w-[24rem] rounded-full transition-all delay-150 duration-[2600ms] ${
            mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
        />
        <div
          className={`experience-horizon-lines absolute inset-x-0 bottom-0 h-[38vh] transition-opacity duration-[2400ms] ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          className={`experience-particle-field absolute inset-0 transition-opacity duration-[2400ms] ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-between">
        <div
          className={`mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 py-12 text-center transition-all duration-[1800ms] ease-out ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          <div className="flex items-center gap-3 rounded-full border border-white/12 bg-white/4 px-4 py-2 text-[11px] tracking-[0.3em] text-stone-300 uppercase backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.8)]" />
            Cinematic Guided Walkthrough
          </div>

          <div className="flex flex-col gap-5">
            <h1 className="experience-display-title text-5xl leading-none text-stone-50 sm:text-7xl lg:text-[6.5rem]">
              7th Month Return
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-7 text-stone-300/88 sm:text-lg">
              A guided point-cloud passage through Dajing Village.
            </p>
            <p className="mx-auto max-w-xl text-sm leading-6 text-stone-400 sm:text-base">
              The tour carries you forward like a cutscene, but your hands still
              matter: look around with the mouse and drift within the walk using
              <span className="text-stone-200"> WASD </span>
              or
              <span className="text-stone-200"> arrow keys</span>.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            {showPrompt ? (
              <button
                type="button"
                onClick={onBegin}
                className="group relative overflow-hidden rounded-full border border-stone-200/18 bg-stone-50/[0.05] px-7 py-3.5 text-left backdrop-blur-sm transition-all duration-500 hover:border-amber-200/45 hover:bg-stone-50/[0.09]"
              >
                <span className="experience-button-sheen absolute inset-y-0 left-0 w-24 -translate-x-28 bg-gradient-to-r from-transparent via-white/18 to-transparent transition-transform duration-700 group-hover:translate-x-[17rem]" />
                <span className="experience-button-glow absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="relative flex items-center gap-3 text-sm tracking-[0.24em] text-stone-100 uppercase">
                  Begin the walk
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-500 group-hover:translate-x-1"
                  />
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-[11px] tracking-[0.24em] text-stone-300 uppercase backdrop-blur-sm">
                <Loader2 size={14} className="animate-spin text-amber-200" />
                Loading the first scene
              </div>
            )}

            <p className="text-[11px] tracking-[0.22em] text-stone-500 uppercase">
              Enter / Space start · P pause · +/- speed
            </p>
          </div>
        </div>

        <div
          className={`absolute inset-x-0 bottom-24 transition-all delay-200 duration-[1600ms] ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-4 px-6">
            {techStack.map((tech) => (
              <div key={tech.label} className="flex items-center gap-2">
                <img
                  src={tech.logo}
                  alt=""
                  className={`experience-tech-logo h-5 w-5 shrink-0 object-contain ${
                    tech.preserveColor ? 'experience-tech-logo--native' : ''
                  }`}
                />
                <span className="text-[10px] tracking-[0.18em] text-stone-300 uppercase">
                  {tech.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <footer
          className={`pb-3 text-center transition-all delay-300 duration-[1800ms] ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <p className="text-sm text-stone-400">
            Developed by{' '}
            <a
              href="https://williamsawyerr.net"
              target="_blank"
              rel="noreferrer"
              className="experience-footer-link text-stone-200 transition-colors duration-300 hover:text-amber-100"
            >
              William Sawyerr
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
