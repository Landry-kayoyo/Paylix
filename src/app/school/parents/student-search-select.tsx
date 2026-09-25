"use client";

import { useState, useEffect, useRef, useTransition, useId, type KeyboardEvent } from "react";
import { Search, X, Check, Loader2, User, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { searchAvailableStudents, type StudentSearchResult } from "./actions";

const RELATIONSHIPS = ["Père", "Mère", "Tuteur", "Tutrice", "Autre"];

export interface SelectedChild {
  student: StudentSearchResult;
  relationship: string;
}

interface StudentSearchSelectProps {
  parentId?: string;
  selectedChildren: SelectedChild[];
  onSelectionChange: (children: SelectedChild[]) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
}

export function StudentSearchSelect({
  parentId,
  selectedChildren,
  onSelectionChange,
  disabled = false,
  id,
  placeholder = "Rechercher un élève (nom, prénom, matricule…)" ,
}: StudentSearchSelectProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [loading, startLoading] = useTransition();
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = id ?? `student-search-${generatedId}`;
  const listboxId = `${inputId}-listbox`;

  // Initial load + debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      startLoading(async () => {
        try {
          const data = await searchAvailableStudents(search, parentId ?? undefined, 20);
          setResults(data);
        } catch {
          setResults([]);
        }
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, parentId]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedIds = new Set(selectedChildren.map((c) => c.student.id));

  function toggleStudent(student: StudentSearchResult) {
    if (student.has_active_parent && !selectedIds.has(student.id)) return;

    if (selectedIds.has(student.id)) {
      onSelectionChange(selectedChildren.filter((c) => c.student.id !== student.id));
    } else {
      onSelectionChange([...selectedChildren, { student, relationship: "Père" }]);
    }
  }

  function updateRelationship(studentId: string, relationship: string) {
    onSelectionChange(
      selectedChildren.map((c) =>
        c.student.id === studentId ? { ...c, relationship } : c
      )
    );
  }

  function removeChild(studentId: string) {
    onSelectionChange(selectedChildren.filter((c) => c.student.id !== studentId));
  }

  const showDropdown = focused;
  const selectableResults = results.filter(
    (student) => !student.has_active_parent || selectedIds.has(student.id)
  );
  const activeStudent = activeIndex >= 0 ? selectableResults[activeIndex] : undefined;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setFocused(false);
      return;
    }

    if (!showDropdown || selectableResults.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) =>
        (current + direction + selectableResults.length) % selectableResults.length
      );
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      toggleStudent(selectableResults[activeIndex]);
    }
  }

  return (
    <div className="space-y-4">
      {/* Selected chips */}
      {selectedChildren.length > 0 && (
        <div className="space-y-2.5">
          {selectedChildren.map((child) => (
            <div
              key={child.student.id}
              className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 px-3 py-2.5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0">
                {child.student.last_name.charAt(0)}
                {child.student.first_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {child.student.last_name.toUpperCase()}{" "}
                  {child.student.post_name
                    ? child.student.post_name + " "
                    : ""}
                  {child.student.first_name}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  <code className="font-mono">{child.student.matricule}</code>
                  {child.student.current_class && (
                    <> · {child.student.current_class}</>
                  )}
                </p>
              </div>
              <Select
                value={child.relationship}
                onValueChange={(v) => updateRelationship(child.student.id, v as string)}
                disabled={disabled}
              >
                <SelectTrigger className="h-7 w-28 text-xs border-indigo-200 bg-white shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => removeChild(child.student.id)}
                disabled={disabled}
                className="ml-1 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                aria-label={`Retirer ${child.student.first_name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input + dropdown */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          {loading ? (
            <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            id={inputId}
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={() => setFocused((prev) => !prev)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeStudent ? `${listboxId}-option-${activeStudent.id}` : undefined
            }
            className="h-12 pl-9 rounded-2xl border border-emerald-300 bg-white text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-100"
            disabled={disabled}
            autoComplete="off"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {showDropdown && (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Élèves disponibles"
            className="absolute z-50 mt-2 w-full min-h-[9rem] max-h-[22rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <div className="max-h-[22rem] overflow-y-auto p-1.5 pr-2">
              {results.length === 0 && !loading ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
                  <User className="h-4 w-4" />
                  Aucun élève trouvé
                </div>
              ) : (
                results.map((student) => {
                  const isSelected = selectedIds.has(student.id);
                  const isBlocked =
                    student.has_active_parent && !isSelected;
                  const selectableIndex = selectableResults.indexOf(student);

                  return (
                    <button
                      key={student.id}
                      type="button"
                      id={`${listboxId}-option-${student.id}`}
                      role="option"
                      aria-selected={isSelected}
                      disabled={isBlocked || disabled}
                      onClick={() => toggleStudent(student)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        isBlocked
                          ? "cursor-not-allowed opacity-50"
                          : "hover:bg-slate-50 cursor-pointer",
                        isSelected && "bg-indigo-50",
                        selectableIndex === activeIndex && "bg-slate-100"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0",
                          isSelected
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {isSelected ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <>
                            {student.last_name.charAt(0)}
                            {student.first_name.charAt(0)}
                          </>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {student.last_name.toUpperCase()}{" "}
                          {student.post_name ? student.post_name + " " : ""}
                          {student.first_name}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                          <code className="font-mono text-slate-700">
                            {student.matricule}
                          </code>
                          {student.current_class && (
                            <>
                              <GraduationCap className="h-3 w-3" />
                              {student.current_class}
                            </>
                          )}
                        </p>
                      </div>
                      {isBlocked && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 shrink-0"
                        >
                          Déjà associé
                        </Badge>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
