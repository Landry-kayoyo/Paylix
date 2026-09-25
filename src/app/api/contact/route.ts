import { NextResponse } from "next/server";
import { z } from "zod";

/* HTML escape */
function esc(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/\n/g,"<br>");
}

/* Email HTML */
function buildHtml(name: string, email: string, subject: string, message: string) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f4f7f4;font-family:Inter,system-ui,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e0ede4"><tr><td style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px 40px"><p style="margin:0;font-size:22px;font-weight:800;color:#fff">Nouvelle demande Paylix</p><p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">Via le formulaire de la landing page</p></td></tr><tr><td style="padding:36px 40px"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-bottom:20px;border-bottom:1px solid #e0ede4"><p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#16a34a">Nom complet</p><p style="margin:0;font-size:16px;font-weight:600;color:#1a2e1e">${esc(name)}</p></td></tr><tr><td style="padding:20px 0;border-bottom:1px solid #e0ede4"><p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#16a34a">Adresse e-mail</p><p style="margin:0;font-size:16px;color:#1a2e1e"><a href="mailto:${esc(email)}" style="color:#16a34a;text-decoration:none">${esc(email)}</a></p></td></tr><tr><td style="padding:20px 0;border-bottom:1px solid #e0ede4"><p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#16a34a">Sujet</p><p style="margin:0;font-size:16px;font-weight:600;color:#1a2e1e">${esc(subject)}</p></td></tr><tr><td style="padding:20px 0"><p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#16a34a">Message</p><div style="background:#f4f7f4;border-radius:10px;padding:20px;font-size:15px;line-height:1.7;color:#2d4a33">${esc(message)}</div></td></tr></table></td></tr><tr><td style="padding:20px 40px 32px;border-top:1px solid #e0ede4"><p style="margin:0;font-size:12px;color:#6b7a6e;text-align:center">Message envoye depuis le site <strong>Paylix</strong>.</p></td></tr></table></td></tr></table></body></html>`;
}

function buildText(name: string, email: string, subject: string, message: string) {
  return `Nouvelle demande Paylix\n\nNom: ${name}\nEmail: ${email}\nSujet: ${subject}\n\nMessage:\n${message}\n\n---\nEnvoye depuis le site Paylix.`;
}

/* Rate limiting */
const ipRateMap = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateMap.get(ip);
  if (!entry || now > entry.resetAt) { ipRateMap.set(ip, { count: 1, resetAt: now + 600000 }); return false; }
  if (entry.count >= 3) return true;
  entry.count++;
  return false;
}

/* Zod schema */
const SUBJECTS = [
  "Demande de demonstration",
  "Demande d assistance",
  "Informations sur Paylix",
  "Probleme de connexion",
  "Acces a mon espace",
  "Question concernant mon etablissement",
  "Partenariat",
  "Autre sujet",
] as const;

const ContactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(254),
  subject: z.string().min(1).max(100),
  customSubject: z.string().max(120).optional(),
  message: z.string().min(10).max(4000),
  website: z.string().max(0).optional(),
}).superRefine((data, ctx) => {
  if (data.subject === "Autre sujet") {
    if (!data.customSubject || data.customSubject.trim().length < 3) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Veuillez preciser votre sujet", path: ["customSubject"] });
    }
  }
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (isRateLimited(ip)) return NextResponse.json({ error: "Trop de demandes. Veuillez patienter quelques minutes." }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Corps invalide." }, { status: 400 }); }

  const result = ContactSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: "Donnees invalides.", details: result.error.flatten().fieldErrors }, { status: 422 });

  const { name, email, subject, customSubject, message, website } = result.data;
  if (website) return NextResponse.json({ success: true }); // honeypot

  const finalSubject = subject === "Autre sujet" ? (customSubject ?? "Autre sujet") : subject;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT ?? "465");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;
  const contactEmail = process.env.CONTACT_EMAIL;

  if (!smtpHost || !smtpUser || !smtpPass || !contactEmail) {
    console.error("[contact] SMTP env vars manquants");
    return NextResponse.json({ error: "Configuration serveur incomplete. Reessayez plus tard." }, { status: 503 });
  }

  try {
    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: true, auth: { user: smtpUser, pass: smtpPass } });
    await transporter.sendMail({
      from: `"Paylix Contact" <${smtpUser}>`,
      to: contactEmail,
      replyTo: `"${name}" <${email}>`,
      subject: `[Paylix] ${finalSubject} - ${name}`,
      text: buildText(name, email, finalSubject, message),
      html: buildHtml(name, email, finalSubject, message),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[contact] SMTP error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Impossible d envoyer votre message. Veuillez reessayer." }, { status: 500 });
  }
}
