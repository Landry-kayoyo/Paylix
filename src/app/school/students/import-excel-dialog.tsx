"use client";

import { useState, useRef } from "react";
import {
  Upload, Download, CheckCircle2, AlertTriangle, Loader2,
  AlertCircle, X, Info, FileSpreadsheet, Sparkles, ChevronRight
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClassSimple, SchoolYearSimple } from "./actions";

interface ImportExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeYear: SchoolYearSimple | null;
  classes: ClassSimple[];
  onImportComplete: () => void;
}

type ImportMode = "choose" | "direct" | "template";
type ImportStep = "choose" | "select_class" | "upload" | "detecting" | "preview" | "importing";
type PreviewFilter = "new" | "unchanged";

interface PreviewData {
  new_students: any[];
  unchanged_existing: any[];
  changed_existing: any[];
  ambiguous: any[];
  class_conflicts: any[];
  errors: any[];
}

interface DetectionResult {
  detected: boolean;
  class_id?: string;
  school_year_id?: string;
  class_name?: string;
  year_name?: string;
  year_status?: string;
  reason?: string;
}

export function ImportExcelDialog({
  open,
  onOpenChange,
  activeYear,
  classes,
  onImportComplete,
}: ImportExcelDialogProps) {
  const [step, setStep] = useState<ImportStep>("choose");
  const [mode, setMode] = useState<ImportMode>("choose");

  // For template mode (manual class selection)
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "");

  // For direct import — set after detection
  const [detectedClassId, setDetectedClassId] = useState<string>("");
  const [detectedYearId, setDetectedYearId] = useState<string>("");
  const [detectedClassName, setDetectedClassName] = useState<string>("");
  const [detectedYearName, setDetectedYearName] = useState<string>("");
  const [detectionWarning, setDetectionWarning] = useState<string | null>(null);
  // Fallback: user picks class manually even in direct mode
  const [fallbackClassId, setFallbackClassId] = useState<string>(classes[0]?.id || "");
  const [fallbackYearId, setFallbackYearId] = useState<string>(activeYear?.id || "");

  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>("new");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ successCount: number; errorCount: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directFileInputRef = useRef<HTMLInputElement>(null);

  const effectiveClassId = mode === "direct"
    ? (detectedClassId || fallbackClassId)
    : selectedClassId;
  const effectiveYearId = mode === "direct"
    ? (detectedYearId || fallbackYearId)
    : (activeYear?.id || "");

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const reset = () => {
    setStep("choose");
    setMode("choose");
    setFileBase64(null);
    setFileName("");
    setPreview(null);
    setPreviewFilter("new");
    setError(null);
    setImportResult(null);
    setLoading(false);
    setDetectedClassId("");
    setDetectedYearId("");
    setDetectedClassName("");
    setDetectedYearName("");
    setDetectionWarning(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  // ── Helper: read file into base64 ─────────────────────────────────────────
  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        reject(new Error("Le fichier doit être un fichier Excel (.xlsx ou .xls)."));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error("Le fichier ne doit pas dépasser 5 Mo."));
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => resolve((ev.target?.result as string).split(",")[1]);
      reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
      reader.readAsDataURL(file);
    });

  // ── Template mode: download template ──────────────────────────────────────
  const handleDownloadTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/excel/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: selectedClassId,
          class_name: selectedClass?.name || "",
          school_year_name: activeYear?.name || "",
        }),
      });
      if (!res.ok) throw new Error("Impossible de générer le modèle.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Modele_Import_${selectedClass?.name?.replace(/\s+/g, "_") || "Eleves"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setStep("upload");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Direct mode: file selected → auto-detect ──────────────────────────────
  const handleDirectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setDetectionWarning(null);
    setStep("detecting");
    setLoading(true);

    try {
      const base64 = await readFile(file);
      setFileBase64(base64);
      setFileName(file.name);

      const res = await fetch("/api/excel/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_base64: base64 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de détection.");

      if (data.detected) {
        setDetectedClassId(data.class_id);
        setDetectedYearId(data.school_year_id);
        setDetectedClassName(data.class_name);
        setDetectedYearName(data.year_name);
        setStep("upload");
      } else {
        // Could not auto-detect — show warning and let user pick manually
        setDetectionWarning(data.reason || "Impossible de détecter automatiquement la classe.");
        setDetectedClassId("");
        setDetectedYearId("");
        setStep("upload");
      }
    } catch (err: any) {
      setError(err.message);
      setStep("choose");
    } finally {
      setLoading(false);
    }
  };

  // ── Template mode: file selected ──────────────────────────────────────────
  const handleTemplateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    readFile(file)
      .then(base64 => { setFileBase64(base64); setFileName(file.name); })
      .catch(err => setError(err.message));
  };

  // ── Preview ───────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!fileBase64) return;
    const classId = effectiveClassId;
    const yearId = effectiveYearId;

    if (!classId || !yearId) {
      setError("Veuillez sélectionner une classe et une année scolaire.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/excel/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: classId,
          school_year_id: yearId,
          file_base64: fileBase64,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Erreur de prévisualisation.");
      setPreview(data.preview);
        setPreview(data.preview);
        setPreviewFilter(data.preview.new_students.length > 0 ? "new" : "unchanged");
      setStep("preview");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Execute import ─────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!preview) return;
    setStep("importing");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/excel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: effectiveClassId,
          school_year_id: effectiveYearId,
          new_students: preview.new_students,
          changed_existing: preview.changed_existing,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Erreur lors de l'import.");
      setImportResult({ successCount: data.successCount, errorCount: data.errorCount });
      onImportComplete();
    } catch (err: any) {
      setError(err.message);
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const hasBlockers = preview && (preview.errors.length > 0 || preview.ambiguous.length > 0);

  const stepTitle: Record<ImportStep, string> = {
    choose: "Importer des élèves",
    select_class: "Sélectionner la classe",
    upload: mode === "direct" ? "Fichier chargé — vérification" : "Importer le fichier complété",
    detecting: "Analyse du fichier…",
    preview: "Aperçu avant import",
    importing: "Import en cours…",
  };

  const stepDesc: Record<ImportStep, string> = {
    choose: "Choisissez comment importer vos élèves.",
    select_class: "Sélectionnez la classe cible pour le modèle.",
    upload: mode === "direct"
      ? "Vérifiez les informations détectées, puis lancez l'analyse."
      : "Glissez-déposez ou cliquez pour sélectionner le fichier rempli.",
    detecting: "Lecture des métadonnées du fichier…",
    preview: "Vérifiez les données avant de confirmer l'import.",
    importing: "Import en cours, veuillez patienter.",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            {stepTitle[step]}
          </DialogTitle>
          <DialogDescription>{stepDesc[step]}</DialogDescription>
        </DialogHeader>

        {/* ── Error banner ──────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        {/* ── Success ───────────────────────────────────────────────────────── */}
        {importResult && (
          <div className="text-center py-8 space-y-3">
            <div className="h-16 w-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="font-semibold text-slate-800 text-lg">Import terminé !</p>
            <p className="text-sm text-slate-600">
              <strong>{importResult.successCount}</strong> élève{importResult.successCount > 1 ? "s" : ""} importé{importResult.successCount > 1 ? "s" : ""} avec succès.
            </p>
            {importResult.errorCount > 0 && (
              <p className="text-xs text-rose-600">{importResult.errorCount} erreur{importResult.errorCount > 1 ? "s" : ""} rencontrée{importResult.errorCount > 1 ? "s" : ""}.</p>
            )}
            <Button onClick={() => handleClose(false)}>Fermer</Button>
          </div>
        )}

        {/* ── Step: Choose mode ─────────────────────────────────────────────── */}
        {!importResult && step === "choose" && (
          <div className="space-y-3 py-2">
            {/* Option 1 — Direct import (smart) */}
            <button
              className="w-full text-left rounded-xl border-2 border-emerald-200 bg-emerald-50/40 hover:border-emerald-400 hover:bg-emerald-50 p-4 transition-all group"
              onClick={() => {
                setMode("direct");
                directFileInputRef.current?.click();
              }}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 text-sm">Import intelligent</p>
                    <Badge className="bg-emerald-600 text-white border-0 text-xs">Recommandé</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Importez un fichier Excel déjà rempli (export Paylix ou modèle). La classe et l'année sont détectées automatiquement.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 shrink-0 mt-1 transition-colors" />
              </div>
            </button>
            <input
              ref={directFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleDirectFileChange}
            />

            {/* Option 2 — Template mode */}
            <button
              className="w-full text-left rounded-xl border-2 border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-50 p-4 transition-all group"
              onClick={() => {
                setMode("template");
                setStep("select_class");
              }}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
                  <Download className="h-5 w-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">Utiliser un nouveau modèle</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Téléchargez un modèle Excel vierge pré-configuré pour une classe, remplissez-le, puis importez.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 shrink-0 mt-1 transition-colors" />
              </div>
            </button>
          </div>
        )}

        {/* ── Step: Detecting ───────────────────────────────────────────────── */}
        {!importResult && step === "detecting" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
            <p className="text-sm font-medium text-slate-700">Analyse du fichier…</p>
            <p className="text-xs text-muted-foreground">Détection de la classe et de l'année scolaire.</p>
          </div>
        )}

        {/* ── Step: Select class (template mode) ───────────────────────────── */}
        {!importResult && step === "select_class" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>L'année scolaire utilisée est automatiquement <strong>{activeYear?.name}</strong> (année active).</span>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Classe cible *</label>
              {classes.length === 0 ? (
                <p className="text-xs text-amber-600">Aucune classe disponible pour cette année.</p>
              ) : (
                <select
                  className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 py-1 shadow-xs"
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Après avoir sélectionné la classe, téléchargez le modèle Excel, remplissez-le, puis importez-le.
            </p>
          </div>
        )}

        {/* ── Step: Upload ─────────────────────────────────────────────────── */}
        {!importResult && step === "upload" && (
          <div className="space-y-4 py-2">
            {/* Direct mode: show detection result */}
            {mode === "direct" && (
              <>
                {detectedClassId ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                      <Sparkles className="h-4 w-4" />
                      Informations détectées automatiquement
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-slate-500 font-medium">Année scolaire</p>
                        <p className="font-semibold text-slate-900 mt-0.5">{detectedYearName}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Classe</p>
                        <p className="font-semibold text-slate-900 mt-0.5">{detectedClassName}</p>
                      </div>
                    </div>
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Fichier : <span className="font-medium">{fileName}</span>
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <div className="flex items-start gap-2 text-amber-700">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold">Détection partielle</p>
                        <p className="text-xs mt-0.5">{detectionWarning}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">Sélectionnez manuellement :</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">Classe *</label>
                        <select
                          className="w-full h-9 text-xs rounded-md border border-input bg-background px-3 py-1"
                          value={fallbackClassId}
                          onChange={e => setFallbackClassId(e.target.value)}
                        >
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">Année *</label>
                        <select
                          className="w-full h-9 text-xs rounded-md border border-input bg-background px-3 py-1"
                          value={fallbackYearId}
                          onChange={e => setFallbackYearId(e.target.value)}
                        >
                          {activeYear && (
                            <option value={activeYear.id}>{activeYear.name} ★</option>
                          )}
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Fichier chargé : <span className="font-medium">{fileName}</span>
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Template mode: show upload zone */}
            {mode === "template" && (
              <>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Modèle téléchargé pour <strong>{selectedClass?.name}</strong>. Remplissez-le puis importez ci-dessous.</span>
                </div>
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {fileName ? (
                    <>
                      <FileSpreadsheet className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-800">{fileName}</p>
                      <p className="text-xs text-slate-400 mt-1">Cliquez pour changer le fichier</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-700">Cliquez pour sélectionner le fichier</p>
                      <p className="text-xs text-slate-400 mt-1">Fichier Excel (.xlsx ou .xls) · max 5 Mo</p>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleTemplateFileChange} />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step: Preview ─────────────────────────────────────────────────── */}
        {!importResult && step === "preview" && preview && (
          <div className="space-y-4 py-2">
            {/* Context info */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 flex items-center gap-4">
              <div>
                <span className="text-slate-400">Classe :</span>{" "}
                <strong>{mode === "direct" ? (detectedClassName || classes.find(c => c.id === fallbackClassId)?.name) : selectedClass?.name}</strong>
              </div>
              <div>
                <span className="text-slate-400">Année :</span>{" "}
                <strong>{mode === "direct" ? (detectedYearName || activeYear?.name) : activeYear?.name}</strong>
              </div>
            </div>

            {/* Summary filters */}
            <div className="flex flex-wrap gap-2" aria-label="Filtrer l’aperçu">
              <button
                type="button"
                onClick={() => setPreviewFilter("new")}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${previewFilter === "new" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50"}`}
              >
                {preview.new_students.length} nouveau{preview.new_students.length > 1 ? "x" : ""}
              </button>
              {preview.unchanged_existing.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPreviewFilter("unchanged")}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${previewFilter === "unchanged" ? "border-slate-300 bg-slate-100 text-slate-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  {preview.unchanged_existing.length} inchangé{preview.unchanged_existing.length > 1 ? "s" : ""}
                </button>
              )}
              {preview.changed_existing.length > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {preview.changed_existing.length} modifi{preview.changed_existing.length > 1 ? "és" : "é"}
                </Badge>
              )}
              {preview.ambiguous.length > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  {preview.ambiguous.length} ambigu{preview.ambiguous.length > 1 ? "ës" : "ë"}
                </Badge>
              )}
              {preview.class_conflicts.length > 0 && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  {preview.class_conflicts.length} conflit{preview.class_conflicts.length > 1 ? "s" : ""} de classe
                </Badge>
              )}
              {preview.errors.length > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {preview.errors.length} erreur{preview.errors.length > 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {/* Errors */}
            {preview.errors.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> Erreurs à corriger</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {preview.errors.map((e, i) => (
                    <div key={i} className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                      Ligne {e.line} : {e.message}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Ambiguous */}
            {preview.ambiguous.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Correspondances ambiguës — vérification requise</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {preview.ambiguous.map((a, i) => (
                    <div key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      Ligne {a.line} — {a.nom} {a.prenom} : {a.message}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Class conflicts */}
            {preview.class_conflicts.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Conflits de classe</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {preview.class_conflicts.map((c, i) => (
                    <div key={i} className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2">
                      Ligne {c.line} — <strong>{c.nom} {c.prenom}</strong> ({c.matricule}) est déjà dans une autre classe. Validation explicite requise.
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* New students */}
            {previewFilter === "new" && preview.new_students.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-emerald-700 mb-2">Nouveaux élèves à créer ({preview.new_students.length})</h4>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                      <tr>
                        <th className="px-3 py-2 text-left">Nom</th>
                        <th className="px-3 py-2 text-left">Postnom</th>
                        <th className="px-3 py-2 text-left">Prénom</th>
                        <th className="px-3 py-2 text-left">Naissance</th>
                        <th className="px-3 py-2 text-left">Sexe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.new_students.map((s, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">{s.nom}</td>
                          <td className="px-3 py-2">{s.postnom || "—"}</td>
                          <td className="px-3 py-2">{s.prenom}</td>
                          <td className="px-3 py-2">{s.dob}</td>
                          <td className="px-3 py-2">{s.sexe}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Unchanged students */}
            {previewFilter === "unchanged" && preview.unchanged_existing.length > 0 && (
              <section>
                <h4 className="mb-2 text-xs font-semibold text-slate-700">Élèves inchangés ({preview.unchanged_existing.length})</h4>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="border-b bg-slate-50 font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Nom</th>
                        <th className="px-3 py-2 text-left">Postnom</th>
                        <th className="px-3 py-2 text-left">Prénom</th>
                        <th className="px-3 py-2 text-left">Matricule</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.unchanged_existing.map((s, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">{s.nom}</td>
                          <td className="px-3 py-2">{s.postnom || "—"}</td>
                          <td className="px-3 py-2">{s.prenom}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{s.matricule}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Modified students */}
            {preview.changed_existing.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-blue-700 mb-2">Élèves existants avec modifications ({preview.changed_existing.length})</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {preview.changed_existing.map((s, i) => (
                    <div key={i} className="text-xs bg-blue-50 border border-blue-200 rounded px-3 py-2 space-y-1">
                      <p className="font-semibold text-blue-800">{s.nom} {s.prenom} — <code>{s.matricule}</code></p>
                      {s.changes.map((ch: any, j: number) => (
                        <p key={j} className="text-blue-700">
                          {ch.field} : <span className="line-through text-slate-500">{ch.old}</span> → <span className="font-semibold">{ch.new}</span>
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Importing state ───────────────────────────────────────────────── */}
        {!importResult && step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
            <p className="text-sm font-medium text-slate-700">Import en cours…</p>
            <p className="text-xs text-muted-foreground">Veuillez patienter.</p>
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        {!importResult && (
          <DialogFooter className="pt-4 border-t gap-2">
            {/* Template: select_class → download template */}
            {step === "select_class" && (
              <Button
                onClick={handleDownloadTemplate}
                disabled={loading || !activeYear || classes.length === 0}
                className="gap-2"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Télécharger le modèle
              </Button>
            )}

            {/* Template: upload → analyze */}
            {step === "upload" && mode === "template" && (
              <>
                <Button variant="ghost" size="sm" className="text-xs mr-auto" onClick={() => setStep("select_class")}>← Retour</Button>
                <Button onClick={handlePreview} disabled={!fileBase64 || loading} className="gap-2">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Analyser le fichier
                </Button>
              </>
            )}

            {/* Direct: upload → analyze */}
            {step === "upload" && mode === "direct" && (
              <>
                <Button variant="ghost" size="sm" className="text-xs mr-auto" onClick={reset}>← Retour</Button>
                <Button onClick={handlePreview} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Analyser le fichier
                </Button>
              </>
            )}

            {/* Preview → import */}
            {step === "preview" && (
              <>
                <Button variant="ghost" size="sm" className="text-xs mr-auto" onClick={() => setStep("upload")}>← Retour</Button>
                <Button
                  onClick={handleImport}
                  disabled={!!hasBlockers || loading}
                  className="gap-2"
                >
                  {hasBlockers ? "Corrigez les erreurs d'abord" : "Valider l'import"}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
