import { useState, useRef } from "react";
import {
  GripVertical,
  Trash2,
  X,
  RotateCcw,
  Clipboard,
  Check,
  Terminal,
} from "lucide-react";

// =====================================================
// STATUS PARSING
// =====================================================
// Handles both long-form `git status` output:
//   modified:   path/to/file.js
//   new file:   path/to/file.js
//   deleted:    path/to/file.js
//   renamed:    old/path.js -> new/path.js
// and short-form `git status --short` / `-s` output:
//   M  path/to/file.js
//    M path/to/file.js
//   A  path/to/file.js
//   ?? path/to/file.js
//   D  path/to/file.js
//   R  old/path.js -> new/path.js

const STATUS_META = {
  modified: { label: "modified", color: "#E8B339" },
  added: { label: "new", color: "#4ADE80" },
  deleted: { label: "deleted", color: "#F87171" },
  renamed: { label: "renamed", color: "#60A5FA" },
  untracked: { label: "untracked", color: "#4ADE80" },
};

function resolveArrowPath(raw) {
  // "old/path.js -> new/path.js" → "new/path.js"
  const parts = raw.split("->").map((p) => p.trim());
  return parts[parts.length - 1];
}

function parseGitStatus(input) {
  const lines = input.split("\n");
  const found = [];

  const longForm = /^\s*(modified|new file|deleted|renamed|copied):\s+(.+)$/;
  const shortForm = /^([ MADRC?]{2})\s+(.+)$/;

  for (const line of lines) {
    const longMatch = line.match(longForm);
    if (longMatch) {
      const [, kind, rawPath] = longMatch;
      const path = resolveArrowPath(rawPath.trim());
      const status =
        kind === "new file"
          ? "added"
          : kind === "deleted"
          ? "deleted"
          : kind === "renamed" || kind === "copied"
          ? "renamed"
          : "modified";
      found.push({ path, status });
      continue;
    }

    const shortMatch = line.match(shortForm);
    if (shortMatch) {
      const [, code, rawPath] = shortMatch;
      const path = resolveArrowPath(rawPath.trim());
      // Skip obvious false positives (blank codes, header-ish lines)
      if (!path || path.includes(" up to date") || path.includes("branch")) {
        continue;
      }
      const status = code.includes("?")
        ? "untracked"
        : code.includes("A")
        ? "added"
        : code.includes("D")
        ? "deleted"
        : code.includes("R")
        ? "renamed"
        : "modified";
      found.push({ path, status });
    }
  }

  // De-duplicate by path, keeping first occurrence
  const seen = new Set();
  const unique = [];
  for (const f of found) {
    if (!seen.has(f.path)) {
      seen.add(f.path);
      unique.push(f);
    }
  }
  return unique;
}

function quoteForShell(path) {
  return /\s|["'()&|;<>]/.test(path) ? `'${path.replace(/'/g, `'\\''`)}'` : path;
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `file-${idCounter}-${Date.now()}`;
}

// =====================================================
// SORTABLE FILE ROW (native HTML5 drag and drop)
// =====================================================

function FileRow({ file, index, isDragging, onDelete, dragHandlers }) {
  const meta = STATUS_META[file.status] ?? STATUS_META.modified;

  return (
    <div
      draggable
      onDragStart={dragHandlers.onDragStart}
      onDragOver={dragHandlers.onDragOver}
      onDrop={dragHandlers.onDrop}
      onDragEnd={dragHandlers.onDragEnd}
      className="group flex items-center gap-3 border-b border-[#23262B] px-3 py-2.5 last:border-b-0 transition-colors"
      style={{
        backgroundColor: isDragging ? "#1B1E24" : "transparent",
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="shrink-0 cursor-grab p-1 text-[#565C66] transition-colors hover:text-[#C4C9D2] active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Index */}
      <span className="w-5 shrink-0 text-right font-mono text-xs text-[#565C66]">
        {index + 1}
      </span>

      {/* Status color dot only */}
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: meta.color }}
        title={meta.label}
      />

      {/* Path only */}
      <p
        className="min-w-0 flex-1 truncate font-mono text-sm text-[#D7DAE0]"
        title={file.path}
      >
        {file.path}
      </p>

      {/* Delete */}
      <button
        type="button"
        onClick={() => onDelete(file.id)}
        className="shrink-0 rounded-md p-1.5 text-[#565C66] opacity-0 transition-all hover:bg-[#2A1616] hover:text-[#F87171] group-hover:opacity-100"
        aria-label="Remove path"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
// =====================================================
// MAIN APP
// =====================================================

const PLACEHOLDER = `On branch main
Changes not staged for commit:

\tmodified:   api/routes/blogs/blog.controller.js
\tmodified:   frontend/react-web/components/BlogCard.js
\tdeleted:    frontend/react-web/components/OldWidget.js

Untracked files:
\tfrontend/react-web/components/NewBanner.js`;

export default function App() {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [copied, setCopied] = useState(false);

  const dragIndex = useRef(null);
  const [draggingId, setDraggingId] = useState(null);

  const extractFiles = () => {
    const parsed = parseGitStatus(input);
    setFiles(parsed.map((f) => ({ id: nextId(), ...f })));
    setCopied(false);
  };

  const deleteFile = (id) => {
    setFiles((current) => current.filter((f) => f.id !== id));
    setCopied(false);
  };

  const deleteAllFiles = () => {
    setFiles([]);
    setCopied(false);
  };

  const clearAll = () => {
    setInput("");
    setFiles([]);
    setCopied(false);
  };

  const handleDragStart = (index) => (e) => {
    dragIndex.current = index;
    setDraggingId(files[index]?.id ?? null);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (index) => (e) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;
    setFiles((current) => {
      const updated = [...current];
      const [moved] = updated.splice(dragIndex.current, 1);
      updated.splice(index, 0, moved);
      dragIndex.current = index;
      return updated;
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    setDraggingId(null);
    setCopied(false);
  };

  const copyFiles = async () => {
    if (!files.length) return;
    const text = files.map((f) => f.path).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("paths");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const copyGitAdd = async () => {
    if (!files.length) return;
    const command = `git add ${files.map((f) => quoteForShell(f.path)).join(" ")}`;
    try {
      await navigator.clipboard.writeText(command);
      setCopied("git");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#14161A] ring-1 ring-[#23262B]">
            <Terminal className="h-4 w-4 text-[#4ADE80]" />
          </div>
          <div>
            <h1 className="font-mono text-lg font-semibold text-[#E5E7EB]">
              git path extractor
            </h1>
            <p className="text-xs text-[#565C66]">
              Paste <code className="text-[#8B92A0]">git status</code> output, reorder, copy.
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="rounded-xl bg-[#101216] ring-1 ring-[#23262B]">
          <div className="flex items-center justify-between border-b border-[#23262B] px-4 py-2.5">
            <span className="font-mono text-xs text-[#8B92A0]">input</span>
            {input.trim() && (
              <span className="font-mono text-[11px] text-[#4ADE80]">ready</span>
            )}
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={10}
            className="w-full resize-none bg-transparent px-4 py-3 font-mono text-[13px] leading-6 text-[#D7DAE0] placeholder-[#3A3F47] focus:outline-none"
            spellCheck={false}
          />

          <div className="flex flex-wrap gap-2 border-t border-[#23262B] px-4 py-3">
            <button
              onClick={extractFiles}
              disabled={!input.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4ADE80] px-3.5 py-2 font-mono text-[13px] font-medium text-[#0A0B0D] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              extract paths
            </button>
            <button
              onClick={clearAll}
              disabled={!input && !files.length}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 font-mono text-[13px] text-[#8B92A0] ring-1 ring-[#23262B] transition-colors hover:text-[#D7DAE0] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <X className="h-3.5 w-3.5" />
              clear
            </button>
          </div>
        </div>

        {/* Output */}
        <div className="mt-6 rounded-xl bg-[#101216] ring-1 ring-[#23262B]">
          <div className="flex items-center justify-between border-b border-[#23262B] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[#8B92A0]">
                {files.length} {files.length === 1 ? "file" : "files"}
              </span>
            </div>
            {files.length > 0 && (
              <button
                onClick={deleteAllFiles}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#565C66] transition-colors hover:text-[#F87171]"
              >
                <Trash2 className="h-3 w-3" />
                clear all
              </button>
            )}
          </div>

          {files.length === 0 ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="font-mono text-sm text-[#565C66]">no paths yet</p>
              <p className="text-xs text-[#3A3F47]">
                paste git status above, then extract paths
              </p>
            </div>
          ) : (
            <div>
              {files.map((file, index) => (
                <FileRow
                  key={file.id}
                  file={file}
                  index={index}
                  isDragging={draggingId === file.id}
                  onDelete={deleteFile}
                  dragHandlers={{
                    onDragStart: handleDragStart(index),
                    onDragOver: handleDragOver(index),
                    onDrop: handleDrop,
                    onDragEnd: handleDragEnd,
                  }}
                />
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="grid gap-2 border-t border-[#23262B] p-3 sm:grid-cols-2">
              <button
                onClick={copyFiles}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#181B20] px-3.5 py-2 font-mono text-[13px] text-[#D7DAE0] ring-1 ring-[#23262B] transition-colors hover:bg-[#1E2127]"
              >
                {copied === "paths" ? (
                  <Check className="h-3.5 w-3.5 text-[#4ADE80]" />
                ) : (
                  <Clipboard className="h-3.5 w-3.5" />
                )}
                {copied === "paths" ? "copied" : "copy paths"}
              </button>
              <button
                onClick={copyGitAdd}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#181B20] px-3.5 py-2 font-mono text-[13px] text-[#D7DAE0] ring-1 ring-[#23262B] transition-colors hover:bg-[#1E2127]"
              >
                {copied === "git" ? (
                  <Check className="h-3.5 w-3.5 text-[#4ADE80]" />
                ) : (
                  <Clipboard className="h-3.5 w-3.5" />
                )}
                {copied === "git" ? "copied" : "copy git add"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
