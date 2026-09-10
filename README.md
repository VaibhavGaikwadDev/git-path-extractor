# Git Path Extractor

A simple tool to extract file paths from `git status` output, reorder them, and copy them (or generate a `git add` command).

**Live Demo:** [(https://git-path-extractor.vaibhav8145.workers.dev/)]

---
<img width="1038" height="831" alt="image" src="https://github.com/user-attachments/assets/a071a902-e0a8-4faf-97e7-fe7238d36477" />

## Features

- Paste full `git status` or `git status -s` output
- Supports:
  - modified
  - new file / added
  - deleted
  - renamed
  - untracked
- Drag & drop to reorder paths
- Copy just the paths
- Copy ready-to-use `git add ...` command (with proper quoting)
- Clean dark terminal-style UI

---

## How to Use

1. Run `git status` in your terminal
2. Copy the output
3. Paste it into the input box
4. Click **extract paths**
5. Drag to reorder if needed
6. Click **copy paths** or **copy git add**

---

## Local Development

```bash
# Clone the repo
git clone <your-repo-url>
cd git-path-extractor

# Install dependencies
npm install

# Start development server
npm run dev
