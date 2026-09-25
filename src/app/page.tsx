'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2, ArrowRight, Wallet, ShieldCheck, History,
  BarChart3, Users, Smartphone, Building2, Menu, X,
  ChevronRight, ChevronDown, FileText, Bell, Receipt, Mail, Send, Phone
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Tiny hook: true once element enters viewport
───────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* Reveal wrapper */
function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Typewriter Effect
───────────────────────────────────────────── */
function useTypewriter(text: string, speed = 40, delay = 0, start = true) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!start) return;
    let i = 0;
    const t = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplayed(text.slice(0, i + 1));
        i++;
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(t);
  }, [text, speed, delay, start]);
  return displayed;
}

function HeroTypewriter() {
  const { ref, visible } = useInView(0.1);
  const full = "La gestion\nfinancière scolaire,\nsimplement.";
  const typed = useTypewriter(full, 45, 600, visible);
  const lines = typed.split('\n');
  return (
    <h1 ref={ref} className="font-extrabold leading-[1.04] tracking-tight text-white mb-6 min-h-[3.12em]" style={{ fontSize: 'clamp(2.8rem, 6vw, 5rem)' }}>
      {lines.map((line, idx) => (
        <span key={idx}>
          {idx === 2 ? <span className="grad-text">{line}</span> : line}
          {idx < lines.length - 1 && <br />}
        </span>
      ))}
      <span
        className="inline-block w-[5px] h-[0.75em] bg-green-400 ml-2 rounded-sm"
        style={{ animation: 'opacityPulse 1s step-end infinite', verticalAlign: 'baseline', transform: 'translateY(8%)' }}
      />
    </h1>
  );
}

/* ─────────────────────────────────────────────
   Contact Section
───────────────────────────────────────────── */
const CONTACT_SUBJECTS = [
  'Demande de démonstration',
  "Demande d'assistance",
  'Informations sur Paylix',
  'Problème de connexion',
  'Question concernant mon établissement',
  'Autre sujet',
] as const;

type FormState = 'idle' | 'sending' | 'success' | 'error';

function ContactSection() {
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [fields, setFields] = useState({
    name: '',
    email: '',
    subject: '',
    customSubject: '',
    message: '',
    website: '', // honeypot
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isOtherSubject = fields.subject === 'Autre sujet';

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const val = e.target.value;
      setFields(prev => ({
        ...prev,
        [key]: val,
        // Clear customSubject when switching away from "Autre sujet"
        ...(key === 'subject' && val !== 'Autre sujet' ? { customSubject: '' } : {}),
      }));
      setFieldErrors(prev => ({ ...prev, [key]: '' }));
    };
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!fields.name.trim() || fields.name.length < 2) errs.name = 'Veuillez entrer votre nom complet.';
    if (!fields.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) errs.email = 'Adresse e-mail invalide.';
    if (!fields.subject) errs.subject = 'Veuillez sélectionner un sujet.';
    if (fields.subject === 'Autre sujet' && (!fields.customSubject.trim() || fields.customSubject.length < 3)) errs.customSubject = 'Veuillez préciser votre sujet.';
    if (!fields.message.trim() || fields.message.length < 10) errs.message = 'Message trop court (min. 10 caractères).';
    if (fields.message.length > 4000) errs.message = 'Message trop long (max. 4000 caractères).';
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }

    setFormState('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error ?? 'Impossible d\'envoyer votre message pour le moment.');
        setFormState('error');
      } else {
        setFormState('success');
        setFields({ name: '', email: '', subject: '', customSubject: '', message: '', website: '' });
        setFieldErrors({});
      }
    } catch {
      setErrorMsg('Vérifiez votre connexion et réessayez.');
      setFormState('error');
    }
  }

  const inputCls = (field: string) =>
    `w-full px-4 py-3 rounded-xl border text-sm transition-all duration-200 outline-none bg-white focus:ring-2 focus:ring-green-500/30 ${fieldErrors[field]
      ? 'border-red-400 focus:border-red-400'
      : 'border-[oklch(0.9_0.01_160)] focus:border-green-400'
    }`;

  return (
    <section id="contact" className="py-20 px-4 sm:px-8 lg:px-16 bg-white">
      <div className="max-w-[1360px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">

          {/* Left — Info */}
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-widest text-green-600 mb-4">Nous contacter</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              Une question ?<br />Parlons-en.
            </h2>
            <p className="text-lg text-[oklch(0.55_0.02_160)] leading-relaxed mb-10 max-w-md">
              Notre équipe est disponible pour répondre à toutes vos questions sur Paylix et vous accompagner dans votre démarche.
            </p>
            <div className="space-y-5">
              {[
                { icon: Mail, label: 'Email', value: 'contact@paylix.app' },
                { icon: Phone, label: 'Disponibilité', value: 'Lun – Ven, 8h – 18h' },
                { icon: CheckCircle2, label: 'Réponse', value: 'Sous 24 heures ouvrables' },
              ].map(({ icon: Icon, label, value }, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[oklch(0.55_0.02_160)]">{label}</p>
                    <p className="font-semibold text-sm mt-0.5">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Right — Form */}
          <Reveal delay={150}>
            <div className="rounded-3xl border border-[oklch(0.93_0.01_160)] bg-[oklch(0.985_0.005_160)] p-8 md:p-10 shadow-xl shadow-green-900/5">
              {formState === 'success' ? (
                <div className="text-center py-8">
                  <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-extrabold mb-3">Message envoyé avec succès.</h3>
                  <p className="text-[oklch(0.55_0.02_160)] leading-relaxed">
                    Merci pour votre message. Nous reviendrons vers vous prochainement.
                  </p>
                  <button
                    onClick={() => setFormState('idle')}
                    className="mt-8 px-6 py-2.5 rounded-xl border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-50 transition-colors"
                  >
                    Envoyer un autre message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  <h3 className="text-xl font-extrabold mb-1">Envoyer un message</h3>
                  <p className="text-sm text-[oklch(0.55_0.02_160)] mb-6">Tous les champs marqués <span className="text-red-500">*</span> sont obligatoires.</p>

                  {/* Error banner */}
                  {formState === 'error' && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                      <p className="font-bold text-sm text-red-700 mb-1">Impossible d&apos;envoyer votre message.</p>
                      <p className="text-sm text-red-600">{errorMsg || 'Vérifiez votre connexion et réessayez.'}</p>
                    </div>
                  )}

                  {/* Honeypot — hidden */}
                  <input
                    type="text"
                    name="website"
                    value={fields.website}
                    onChange={set('website')}
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{ display: 'none' }}
                    autoComplete="off"
                  />

                  {/* Name */}
                  <div>
                    <label htmlFor="contact-name" className="block text-sm font-semibold mb-2">
                      Nom complet <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      autoComplete="name"
                      value={fields.name}
                      onChange={set('name')}
                      placeholder="Jean Kabongo"
                      className={inputCls('name')}
                      disabled={formState === 'sending'}
                      aria-describedby={fieldErrors.name ? 'error-name' : undefined}
                      aria-invalid={!!fieldErrors.name}
                    />
                    {fieldErrors.name && <p id="error-name" className="mt-1.5 text-xs text-red-500">{fieldErrors.name}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="contact-email" className="block text-sm font-semibold mb-2">
                      Adresse e-mail <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      autoComplete="email"
                      value={fields.email}
                      onChange={set('email')}
                      placeholder="jean@exemple.com"
                      className={inputCls('email')}
                      disabled={formState === 'sending'}
                      aria-describedby={fieldErrors.email ? 'error-email' : undefined}
                      aria-invalid={!!fieldErrors.email}
                    />
                    {fieldErrors.email && <p id="error-email" className="mt-1.5 text-xs text-red-500">{fieldErrors.email}</p>}
                  </div>

                  {/* Subject */}
                  <div>
                    <label htmlFor="contact-subject" className="block text-sm font-semibold mb-2">
                      Sujet <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="contact-subject"
                        value={fields.subject}
                        onChange={set('subject')}
                        className={`${inputCls('subject')} cursor-pointer appearance-none pr-10 h-[46px] leading-normal`}
                        disabled={formState === 'sending'}
                        aria-describedby={fieldErrors.subject ? 'error-subject' : undefined}
                        aria-invalid={!!fieldErrors.subject}
                      >
                        <option value="">Sélectionnez un sujet...</option>
                        {CONTACT_SUBJECTS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[oklch(0.55_0.02_160)] pointer-events-none" />
                    </div>
                    {fieldErrors.subject && <p id="error-subject" className="mt-1.5 text-xs text-red-500">{fieldErrors.subject}</p>}
                  </div>

                  {/* Custom subject — shown only for "Autre sujet" */}
                  {isOtherSubject && (
                    <div>
                      <label htmlFor="contact-custom-subject" className="block text-sm font-semibold mb-2">
                        Sujet personnalisé <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="contact-custom-subject"
                        type="text"
                        value={fields.customSubject}
                        onChange={set('customSubject')}
                        placeholder="Écrivez votre sujet..."
                        className={inputCls('customSubject')}
                        disabled={formState === 'sending'}
                        maxLength={120}
                        aria-describedby={fieldErrors.customSubject ? 'error-custom-subject' : undefined}
                        aria-invalid={!!fieldErrors.customSubject}
                      />
                      {fieldErrors.customSubject && <p id="error-custom-subject" className="mt-1.5 text-xs text-red-500">{fieldErrors.customSubject}</p>}
                    </div>
                  )}

                  {/* Message */}
                  <div>
                    <label htmlFor="contact-message" className="block text-sm font-semibold mb-2">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="contact-message"
                      value={fields.message}
                      onChange={set('message')}
                      placeholder="Décrivez votre demande..."
                      rows={5}
                      maxLength={4000}
                      className={`${inputCls('message')} resize-y min-h-[120px]`}
                      disabled={formState === 'sending'}
                      aria-describedby={fieldErrors.message ? 'error-message' : undefined}
                      aria-invalid={!!fieldErrors.message}
                    />
                    <div className="flex justify-between mt-1">
                      {fieldErrors.message
                        ? <p id="error-message" className="text-xs text-red-500">{fieldErrors.message}</p>
                        : <span />}
                      <p className="text-xs text-[oklch(0.65_0.01_160)]">{fields.message.length}/4000</p>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={formState === 'sending'}
                    className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-green-600 text-white font-bold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-green-700 active:scale-[0.99]"
                    style={{ boxShadow: formState === 'sending' ? 'none' : '0 4px 14px rgba(22,163,74,0.35)' }}
                  >
                    {formState === 'sending' ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Envoyer le message
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { href: '#solution', label: 'Produit' },
    { href: '#comment-ca-marche', label: 'Comment ça marche' },
    { href: '#espaces', label: 'Espaces' },
    { href: '#avantages', label: 'Avantages' },
    { href: '#contact', label: 'Contact' },
  ];

  return (
    <>
      <style>{`
        @keyframes floatY {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-12px); }
        }
        @keyframes blobPulse {
          0%, 100% { transform: scale(1) rotate(0deg); }
          33%       { transform: scale(1.08) rotate(5deg); }
          66%       { transform: scale(0.94) rotate(-5deg); }
        }
        @keyframes shimmer {
          from { background-position: -200% 0; }
          to   { background-position:  200% 0; }
        }
        @keyframes heroTextIn {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroBadgeIn {
          from { opacity: 0; transform: scale(0.85) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes gradLine {
          0%   { background-position: 0%   50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0%   50%; }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulseRing {
          0%   { transform: scale(0.85); opacity: 0.6; }
          100% { transform: scale(1.6);  opacity: 0; }
        }
        @keyframes scrollBar {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(200%); }
        }
        @keyframes opacityPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .hero-text-1 { animation: heroTextIn 0.8s cubic-bezier(.22,.68,0,1.2) 0.2s both; }
        .hero-text-2 { animation: heroTextIn 0.8s cubic-bezier(.22,.68,0,1.2) 0.45s both; }
        .hero-text-3 { animation: heroTextIn 0.8s cubic-bezier(.22,.68,0,1.2) 0.65s both; }
        .hero-cta    { animation: heroTextIn 0.8s cubic-bezier(.22,.68,0,1.2) 0.85s both; }
        .hero-badge  { animation: heroBadgeIn 0.6s cubic-bezier(.22,.68,0,1.2) 0.1s both; }
        .card-float-1 { animation: cardIn 0.7s ease 1.1s both; }
        .card-float-1-float { animation: floatY 5s ease-in-out infinite; }
        .card-float-2 { animation: cardIn 0.7s ease 1.35s both; }
        .card-float-2-float { animation: floatY 6s 0.8s ease-in-out infinite; }
        .grad-text {
          background: linear-gradient(135deg, #16a34a 0%, #4ade80 45%, #16a34a 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradLine 4s linear infinite;
        }
        .shimmer-layer {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 2.5s infinite;
        }
        .hover-lift {
          transition: transform 0.28s cubic-bezier(.22,.68,0,1.2), box-shadow 0.28s ease;
        }
        .hover-lift:hover {
          transform: translateY(-6px);
          box-shadow: 0 24px 48px -12px rgba(22,163,74,0.18);
        }
        .pulse-dot {
          animation: pulseRing 1.5s cubic-bezier(0,0,0.2,1) infinite;
        }
        .scroll-indicator {
          animation: scrollBar 1.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-text-1, .hero-text-2, .hero-text-3, .hero-cta, .hero-badge,
          .card-float-1, .card-float-1-float, .card-float-2, .card-float-2-float,
          .grad-text, .shimmer-layer, .hover-lift, .pulse-dot, .scroll-indicator {
            animation: none !important;
            transition: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      <div className="flex min-h-screen flex-col bg-[oklch(0.985_0.005_160)] text-[oklch(0.2_0.02_160)] font-sans">

        {/* ══════ HEADER ══════ */}
        <header
          className="fixed top-0 left-0 right-0 z-50"
          style={{
            background: scrolled ? 'rgba(255,255,255,0.9)' : 'transparent',
            backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
            borderBottom: scrolled ? '1px solid rgba(22,163,74,0.12)' : '1px solid transparent',
            boxShadow: scrolled ? '0 4px 24px -4px rgba(0,0,0,0.07)' : 'none',
            transition: 'background 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease',
          }}
        >
          <div className="max-w-7xl mx-auto px-6 md:px-10 h-20 flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative h-10 w-10" style={{ transition: 'transform 0.3s ease' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                <Image src="/landing/logo.png" alt="Paylix" fill sizes="40px" className="object-contain" />
              </div>
              <span className="text-xl font-extrabold tracking-tight"
                style={{ color: scrolled ? 'oklch(0.2 0.02 160)' : 'white', textShadow: scrolled ? 'none' : '0 2px 10px rgba(0,0,0,0.4)', transition: 'color 0.4s ease' }}>
                Paylix
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
              {navLinks.map(link => (
                <Link key={link.href} href={link.href}
                  className="transition-colors duration-200 hover:text-green-600 relative group"
                  style={{ color: scrolled ? 'oklch(0.45 0.02 160)' : 'rgba(255,255,255,0.85)' }}>
                  {link.label}
                  <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-green-500 rounded-full transition-all duration-300 group-hover:w-full" />
                </Link>
              ))}
            </nav>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-3">
              <Link href="/login">
                <div className="relative overflow-hidden px-6 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white transition-all duration-200 inline-block"
                  style={{ boxShadow: '0 4px 14px rgba(22,163,74,0.4)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(22,163,74,0.5)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 14px rgba(22,163,74,0.4)'; }}>
                  <span className="relative z-10">Connexion</span>
                  <div className="shimmer-layer absolute inset-0" />
                </div>
              </Link>
            </div>

            {/* Hamburger */}
            <button className="md:hidden p-2 rounded-xl" aria-label="Menu"
              style={{ color: scrolled ? 'oklch(0.2 0.02 160)' : 'white' }}
              onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile drawer */}
          <div className="md:hidden overflow-hidden"
            style={{ maxHeight: mobileOpen ? '420px' : '0px', transition: 'max-height 0.35s cubic-bezier(.22,.68,0,1.2)', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)' }}>
            <div className="px-6 py-4 space-y-1 border-t border-green-100">
              {navLinks.map(link => (
                <Link key={link.href} href={link.href}
                  className="flex items-center justify-between py-4 text-base font-semibold text-[oklch(0.3_0.05_160)] hover:text-green-600 border-b border-green-50 transition-colors"
                  onClick={() => setMobileOpen(false)}>
                  {link.label}
                  <ChevronRight className="h-4 w-4 opacity-40" />
                </Link>
              ))}
              <div className="flex flex-col gap-3 pt-5 pb-2">
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <div className="w-full py-3.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors shadow-lg text-center cursor-pointer">Connexion</div>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* ══════ HERO — Full Background ══════ */}
        <section className="relative flex items-center overflow-hidden" style={{ minHeight: '100dvh' }}>
          {/* BG video */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover object-center"
              poster="/landing/hero-bg.jpg"
            >
              <source src="/landing/VideoHero.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(110deg, rgba(5,16,10,0.86) 0%, rgba(8,32,16,0.70) 48%, rgba(5,16,10,0.38) 100%)' }} />
            <div className="absolute bottom-0 left-0 right-0 h-48" style={{ background: 'linear-gradient(to top, rgba(5,16,10,0.5), transparent)' }} />
          </div>

          {/* Green blob decoration */}
          <div className="absolute top-24 right-24 w-64 h-64 rounded-full opacity-8 z-0 blur-3xl"
            style={{ background: 'radial-gradient(circle, #4ade80, #16a34a)', animation: 'blobPulse 10s ease-in-out infinite' }} />

          {/* Content */}
          <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 w-full pt-24 pb-16 md:pt-32">
            <div className="max-w-2xl xl:max-w-3xl">
              {/* Live badge */}
              <div className="hero-badge inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 mb-8 text-sm font-semibold text-green-300"
                style={{ background: 'rgba(22,163,74,0.18)', border: '1px solid rgba(74,222,128,0.35)', backdropFilter: 'blur(8px)' }}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
                </span>
                Gestion financière scolaire nouvelle génération
              </div>

              {/* Headline Typing Effect */}
              <HeroTypewriter />

              {/* Sub */}
              <p className="hero-text-2 text-lg sm:text-xl text-white/75 leading-relaxed mb-10 max-w-xl">
                Paylix aide les établissements à gérer, suivre et sécuriser leurs opérations financières tout en offrant aux parents une visibilité claire sur la situation de leurs enfants.
              </p>

              {/* CTAs */}
              <div className="hero-cta flex flex-wrap gap-4">
                <Link href="#contact">
                  <div className="group relative overflow-hidden flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-green-600 text-white font-bold text-base transition-all duration-300 cursor-pointer"
                    style={{ boxShadow: '0 8px 32px rgba(22,163,74,0.45)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 16px 48px rgba(22,163,74,0.55)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(22,163,74,0.45)'; }}>
                    <span className="relative z-10">Commencer avec Paylix</span>
                    <ArrowRight className="relative z-10 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5" />
                    <div className="shimmer-layer absolute inset-0" />
                  </div>
                </Link>
                <Link href="#comment-ca-marche">
                  <div className="flex items-center gap-2.5 px-8 py-4 rounded-2xl font-bold text-base text-white hover:text-green-300 transition-colors duration-200 cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)' }}>
                    Voir comment ça fonctionne
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Floating UI cards */}
          <div className="absolute bottom-20 right-8 lg:right-16 hidden lg:flex flex-col gap-4 z-20">
            <div className="card-float-1">
              <div className="card-float-1-float flex items-center gap-3.5 rounded-2xl px-5 py-4 shadow-2xl"
                style={{ background: 'rgba(255,255,255,0.11)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(18px)' }}>
                <div className="h-11 w-11 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Paiement enregistré</p>
                  <p className="text-xs text-white/55">Reçu #2034 · Landry Kayoyo</p>
                </div>
              </div>
            </div>
            <div className="card-float-2">
              <div className="card-float-2-float flex items-center gap-3.5 rounded-2xl px-5 py-4 shadow-2xl"
                style={{ background: 'rgba(255,255,255,0.11)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(18px)' }}>
                <div className="h-11 w-11 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Bell className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Parent informé</p>
                  <p className="text-xs text-white/55">Situation mise à jour</p>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
            <span className="text-xs text-white/45 font-semibold tracking-widest uppercase">Défiler</span>
            <div className="w-5 h-8 rounded-full flex items-start justify-center pt-1.5"
              style={{ border: '1.5px solid rgba(255,255,255,0.3)' }}>
              <div className="w-1 h-2 rounded-full bg-white/70 scroll-indicator" />
            </div>
          </div>
        </section>

        {/* ══════ PROBLEM ══════ */}
        <section className="py-20 px-4 sm:px-8 lg:px-16" style={{ background: 'oklch(0.975 0.006 160)' }}>
          <div className="max-w-[1360px] mx-auto">
            <Reveal className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest text-green-600 mb-4">Le problème</p>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-5">
                Les paiements scolaires ne devraient<br className="hidden md:block" /> pas être difficiles à suivre.
              </h2>
              <p className="text-lg text-[oklch(0.55_0.02_160)] max-w-2xl mx-auto">
                Les méthodes traditionnelles manquent de transparence et créent de la confusion pour tout le monde.
              </p>
            </Reveal>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { title: 'Informations dispersées', desc: "Entre carnets, reçus papier et fichiers Excel, l'information est rarement centralisée.", icon: Wallet, col: '#ef4444' },
                { title: 'Historique introuvable', desc: "Retrouver un paiement d'il y a plusieurs mois relève souvent du parcours du combattant.", icon: History, col: '#f97316' },
                { title: 'Parents dans le flou', desc: "Les familles découvrent souvent les soldes restants aux périodes d'examens.", icon: Smartphone, col: '#eab308' },
              ].map((item, i) => (
                <Reveal key={i} delay={i * 120}>
                  <div className="hover-lift group p-8 rounded-3xl bg-white border border-[oklch(0.93_0.01_160)] h-full">
                    <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-6" style={{ background: `${item.col}14` }}>
                      <item.icon className="h-7 w-7" style={{ color: item.col }} />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                    <p className="text-[oklch(0.55_0.02_160)] leading-relaxed">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ SOLUTION ══════ */}
        <section id="solution" className="py-20 px-4 sm:px-8 lg:px-16 bg-white">
          <div className="max-w-[1360px] mx-auto">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <Reveal>
                <p className="text-sm font-bold uppercase tracking-widest text-green-600 mb-4">La solution</p>
                <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-10">
                  Une seule plateforme<br />pour une vision claire.
                </h2>
                <div className="space-y-4">
                  {[
                    { title: 'Paiements suivis', desc: 'Chaque paiement enregistré reste traçable et retrouvable en quelques secondes.', icon: Receipt },
                    { title: 'Situation financière claire', desc: 'Montants dus, payés et restants consultables d\'un seul coup d\'œil.', icon: BarChart3 },
                    { title: 'Portail parent', desc: 'Les parents consultent la situation de leurs enfants depuis leur téléphone.', icon: Smartphone },
                    { title: 'Historique & Reçus', desc: 'Toutes les opérations et reçus restent accessibles à tout moment.', icon: FileText },
                  ].map((item, i) => (
                    <div key={i} className="group flex gap-5 p-4 rounded-2xl cursor-default transition-colors duration-200 hover:bg-green-50">
                      <div className="h-11 w-11 shrink-0 rounded-xl bg-green-100 flex items-center justify-center transition-colors duration-200 group-hover:bg-green-600">
                        <item.icon className="h-5 w-5 text-green-600 transition-colors duration-200 group-hover:text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-1">{item.title}</h3>
                        <p className="text-[oklch(0.55_0.02_160)] leading-relaxed text-sm">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
              <Reveal delay={180}>
                <div className="relative">
                  <div className="absolute -inset-4 rounded-3xl opacity-20" style={{ background: 'radial-gradient(circle at 60% 40%, #4ade80, transparent 70%)' }} />
                  <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-green-900/15 border border-green-100">
                    <Image src="/landing/parent.jpg" alt="Parent consultant Paylix" width={700} height={600} className="object-cover w-full" />
                  </div>
                  <div className="absolute -bottom-5 -left-5 flex items-center gap-3 bg-white rounded-2xl p-4 shadow-xl border border-green-100">
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Landry Kayoyo</p>
                      <p className="text-xs text-[oklch(0.55_0.02_160)]">Situation à jour · Reçu disponible</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══════ HOW IT WORKS ══════ */}
        <section id="comment-ca-marche" className="py-20 px-4 sm:px-8 lg:px-16" style={{ background: 'oklch(0.975 0.006 160)' }}>
          <div className="max-w-[1360px] mx-auto">
            <Reveal className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest text-green-600 mb-4">Le processus</p>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Comment ça fonctionne ?</h2>
              <p className="text-lg text-[oklch(0.55_0.02_160)] mt-5 max-w-xl mx-auto">Un flux fluide de l'établissement jusqu'au parent, sans friction.</p>
            </Reveal>

            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Video Showcase */}
              <Reveal delay={100}>
                <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl shadow-green-900/15 border border-green-100 bg-black/5">
                  <video
                    autoPlay loop muted playsInline
                    className="w-full h-auto object-cover rounded-[2.5rem]"
                  >
                    <source src="/landing/Comment ca marche.mp4" type="video/mp4" />
                  </video>
                  {/* Subtle inner shadow for depth */}
                  <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-[2.5rem] pointer-events-none" />
                </div>
              </Reveal>

              {/* Steps Vertical List */}
              <div className="flex flex-col gap-5">
                {[
                  { step: '01', title: 'Le paiement est effectué', desc: 'Le parent ou l\'élève règle les frais à l\'établissement de manière classique.', icon: Wallet },
                  { step: '02', title: 'Le comptable l\'enregistre', desc: 'Il retrouve l\'élève dans Paylix et saisit le paiement avec précision.', icon: Users },
                  { step: '03', title: 'La situation se met à jour', desc: 'Paylix actualise automatiquement la situation financière globale.', icon: CheckCircle2 },
                  { step: '04', title: 'Le parent peut suivre', desc: 'Il consulte la situation, l\'historique et les reçus depuis son espace.', icon: Smartphone },
                ].map((item, i, arr) => (
                  <Reveal key={i} delay={i * 120} className="relative">
                    <div className="group relative z-10 flex gap-5 md:gap-6 p-6 rounded-3xl bg-white border border-[oklch(0.93_0.01_160)] hover:border-green-400 transition-all duration-300 hover-lift hover:shadow-xl hover:shadow-green-900/5">
                      <div className="h-14 w-14 shrink-0 rounded-2xl bg-green-50 flex items-center justify-center transition-all duration-300 group-hover:bg-green-600 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-green-600/30">
                        <item.icon className="h-7 w-7 text-green-600 transition-colors duration-300 group-hover:text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg md:text-xl font-bold mb-2 flex items-center gap-3">
                          <span className="text-green-600/40 text-sm font-extrabold group-hover:text-green-600 transition-colors duration-300">{item.step}</span>
                          {item.title}
                        </h3>
                        <p className="text-[oklch(0.55_0.02_160)] text-sm md:text-base leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                    {/* Timeline connector */}
                    {i !== arr.length - 1 && (
                      <div className="absolute left-[3.25rem] md:left-[3.5rem] top-full h-5 w-[2px] bg-green-200/60 -mt-[1px] z-0" />
                    )}
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════ ACCOUNTANT ══════ */}
        <section className="py-20 px-4 sm:px-8 lg:px-16 bg-white">
          <div className="max-w-[1360px] mx-auto grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            <Reveal>
              <div className="relative">
                <div className="absolute -inset-4 rounded-3xl opacity-15" style={{ background: 'radial-gradient(circle at 40% 60%, #16a34a, transparent 70%)' }} />
                <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-green-900/10 border border-green-100">
                  <Image src="/landing/accountant.jpg" alt="Comptable Paylix" width={700} height={550} className="object-cover w-full" />
                </div>
              </div>
            </Reveal>
            <Reveal delay={180}>
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-6 text-sm font-bold text-green-700 bg-green-50 border border-green-100">
                <Users className="h-4 w-4" />
                Espace Comptable
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
                Enregistrer un paiement devrait être simple.
              </h2>
              <p className="text-lg text-[oklch(0.55_0.02_160)] leading-relaxed mb-8">
                L'interface Paylix permet une recherche d'élève rapide, un enregistrement précis et une validation sécurisée. Chaque opération laisse une trace vérifiable.
              </p>
              <ul className="space-y-4">
                {['Recherche rapide par classe ou par nom', 'Génération automatique des reçus', 'Suivi journalier des encaissements', 'Historique complet par élève'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 font-medium">
                    <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ══════ SPACES ══════ */}
        <section id="espaces" className="py-20 px-4 sm:px-8 lg:px-16" style={{ background: 'oklch(0.975 0.006 160)' }}>
          <div className="max-w-[1360px] mx-auto">
            <Reveal className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest text-green-600 mb-4">Espaces dédiés</p>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                Une plateforme pensée<br className="hidden md:block" /> pour chaque acteur.
              </h2>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { icon: Building2, title: 'Directeur', desc: 'Supervisez votre établissement avec une vision claire de vos activités, revenus et créances via des rapports détaillés.', color: '#0ea5e9', bg: '#0ea5e910' },
                { icon: Users, title: 'Comptable', desc: 'Enregistrez les paiements rapidement, gardez un historique précis et sécurisé, et générez les reçus automatiquement.', color: '#16a34a', bg: '#16a34a10' },
                { icon: Smartphone, title: 'Parent', desc: 'Consultez simplement la situation financière de vos enfants, téléchargez les reçus et évitez les mauvaises surprises.', color: '#8b5cf6', bg: '#8b5cf610' },
                { icon: ShieldCheck, title: 'Administrateur', desc: "Supervisez l'écosystème Paylix à l'échelle de la plateforme en garantissant sécurité et intégrité des données.", color: '#f59e0b', bg: '#f59e0b10' },
              ].map((item, i) => (
                <Reveal key={i} delay={i * 100}>
                  <div className="hover-lift group p-8 rounded-3xl bg-white border border-[oklch(0.93_0.01_160)] h-full flex gap-6">
                    <div className="h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center" style={{ background: item.bg }}>
                      <item.icon className="h-7 w-7" style={{ color: item.color }} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                      <p className="text-[oklch(0.55_0.02_160)] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ WHY PAYLIX ══════ */}
        <section id="avantages" className="py-20 px-4 sm:px-8 lg:px-16 bg-white">
          <div className="max-w-[1360px] mx-auto">
            <Reveal className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest text-green-600 mb-4">Pourquoi Paylix</p>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Ce qui rend Paylix différent.</h2>
            </Reveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { title: 'Simple', desc: 'Une interface épurée qui ne nécessite pas de formation longue.', icon: '✦' },
                { title: 'Traçable', desc: 'Chaque opération laisse une trace claire et retrouvable.', icon: '◎' },
                { title: 'Accessible', desc: 'Depuis n\'importe quel appareil connecté, à tout moment.', icon: '⬡' },
                { title: 'Multi-établissements', desc: 'Gérez plusieurs écoles depuis une seule plateforme.', icon: '⬢' },
                { title: 'Pensé pour les écoles', desc: 'Conçu spécifiquement pour les réalités des établissements africains.', icon: '◈' },
                { title: 'Portail parents', desc: 'Les familles restent informées sans effort supplémentaire.', icon: '◉' },
              ].map((item, i) => (
                <Reveal key={i} delay={i * 80}>
                  <div className="hover-lift group p-7 rounded-3xl border border-[oklch(0.93_0.01_160)] bg-white h-full">
                    <div className="text-3xl text-green-400 mb-5 font-bold transition-colors duration-200 group-hover:text-green-600">{item.icon}</div>
                    <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                    <p className="text-[oklch(0.55_0.02_160)] leading-relaxed text-sm">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ TRACABILITY STRIP ══════ */}
        <section className="py-20 px-4 sm:px-8 lg:px-16" style={{ background: 'linear-gradient(135deg, oklch(0.32 0.10 160) 0%, oklch(0.22 0.07 160) 100%)' }}>
          <Reveal className="max-w-5xl mx-auto text-center">
            <ShieldCheck className="h-14 w-14 text-green-400 mx-auto mb-6" />
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Chaque opération laisse une trace.</h2>
            <p className="text-lg text-white/70 leading-relaxed max-w-2xl mx-auto mb-10">
              Transparence, traçabilité et historique pour toutes les parties — l'établissement, le comptable et les familles — selon les droits de chacun.
            </p>
            <div className="flex justify-center flex-wrap gap-8">
              {['Transparence', 'Traçabilité', 'Historique', 'Sécurité'].map((tag, i) => (
                <div key={i} className="flex items-center gap-2.5 text-white font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  {tag}
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ══════ FINAL CTA ══════ */}
        <section className="py-24 px-4 sm:px-8 lg:px-16 bg-white">
          <div className="max-w-[1360px] mx-auto">
            <Reveal>
              <div className="relative rounded-3xl overflow-hidden p-12 md:p-20 text-center"
                style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 55%, #166534 100%)' }}>
                <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-15"
                  style={{ background: 'radial-gradient(circle, #4ade80, transparent)', transform: 'translate(30%, -30%)', animation: 'blobPulse 8s ease-in-out infinite' }} />
                <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10"
                  style={{ background: 'radial-gradient(circle, #bbf7d0, transparent)', transform: 'translate(-30%, 30%)', animation: 'blobPulse 10s 2s ease-in-out infinite' }} />
                <div className="relative z-10">
                  <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
                    Prêt à simplifier la gestion<br className="hidden md:block" /> financière de votre établissement ?
                  </h2>
                  <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
                    Découvrez comment Paylix peut accompagner votre établissement vers plus de transparence.
                  </p>
                  <Link href="#contact">
                    <div className="group inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-white text-green-700 font-bold text-lg shadow-2xl shadow-green-900/30 transition-all duration-300 cursor-pointer"
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 32px 64px rgba(0,0,0,0.25)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 20px 40px rgba(0,0,0,0.18)'; }}>
                      Commencer avec Paylix
                      <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5" />
                    </div>
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══════ CONTACT ══════ */}
        <ContactSection />

        {/* ══════ FOOTER ══════ */}
        <footer className="border-t border-[oklch(0.93_0.01_160)] bg-[oklch(0.975_0.006_160)] pt-16 pb-8 px-4 sm:px-8 lg:px-16">
          <div className="max-w-[1360px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-3 mb-4 group">
                <div className="relative h-9 w-9">
                  <Image src="/landing/logo.png" alt="Paylix" fill sizes="36px" className="object-contain" />
                </div>
                <span className="text-lg font-extrabold">Paylix</span>
              </Link>
              <p className="text-sm text-[oklch(0.55_0.02_160)] leading-relaxed pr-4">
                Plateforme professionnelle de gestion financière scolaire.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-5 text-xs uppercase tracking-widest text-[oklch(0.4_0.02_160)]">Produit</h4>
              <ul className="space-y-3 text-sm text-[oklch(0.55_0.02_160)]">
                <li><Link href="#solution" className="hover:text-green-600 transition-colors">Fonctionnalités</Link></li>
                <li><Link href="#espaces" className="hover:text-green-600 transition-colors">Pour les établissements</Link></li>
                <li><Link href="#espaces" className="hover:text-green-600 transition-colors">Portail parents</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-5 text-xs uppercase tracking-widest text-[oklch(0.4_0.02_160)]">Sécurité</h4>
              <ul className="space-y-3 text-sm text-[oklch(0.55_0.02_160)]">
                <li><span className="hover:text-green-600 transition-colors cursor-pointer">Traçabilité</span></li>
                <li><span className="hover:text-green-600 transition-colors cursor-pointer">Protection des données</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-5 text-xs uppercase tracking-widest text-[oklch(0.4_0.02_160)]">Contact</h4>
              <ul className="space-y-3 text-sm text-[oklch(0.55_0.02_160)]">
                <li><a href="#contact" className="hover:text-green-600 transition-colors">Nous contacter</a></li>
                <li><a href="#contact" className="hover:text-green-600 transition-colors">Demande de démo</a></li>
              </ul>
            </div>
          </div>
          <div className="max-w-[1360px] mx-auto pt-8 border-t border-[oklch(0.93_0.01_160)] flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[oklch(0.55_0.02_160)]">
            <p>© {new Date().getFullYear()} Paylix. Tous droits réservés.</p>
            <div className="flex gap-6">
              <span className="hover:text-[oklch(0.3_0.05_160)] cursor-pointer transition-colors">Conditions d&apos;utilisation</span>
              <span className="hover:text-[oklch(0.3_0.05_160)] cursor-pointer transition-colors">Politique de confidentialité</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
