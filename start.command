#!/usr/bin/env bash
# macOS: double-click this file. Linux: run `bash start.command`.

set -u

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SETUP_ONLY=false
LOG_FILE="${TMPDIR:-/tmp}/archeio-setup.log"

if [[ "${1:-}" == "--setup-only" ]]; then
  SETUP_ONLY=true
fi

say() {
  printf '%s\n' "$1"
}

fail() {
  say "✖ $1"
  say "Details: $LOG_FILE"
  exit 1
}

quiet() {
  "$@" >>"$LOG_FILE" 2>&1
}

has_libreoffice() {
  command -v soffice >/dev/null 2>&1 || [[ -x /Applications/LibreOffice.app/Contents/MacOS/soffice ]]
}

has_calibre() {
  command -v ebook-convert >/dev/null 2>&1 || [[ -x /Applications/calibre.app/Contents/MacOS/ebook-convert ]]
}

has_ghostscript() {
  command -v gs >/dev/null 2>&1
}

install_system_tools() {
  local missing=()
  has_libreoffice || missing+=("LibreOffice")
  has_calibre || missing+=("Calibre")
  has_ghostscript || missing+=("Ghostscript")

  if [[ ${#missing[@]} -eq 0 ]]; then
    say "✓ Conversion tools found."
    return
  fi

  say "Missing conversion tools: ${missing[*]}."
  read -r -p "Install them now? [y/N] " answer
  if [[ ! "$answer" =~ ^[Yy]$ ]]; then
    show_manual_install_steps
    return
  fi

  case "$(uname -s)" in
    Darwin)
      if ! command -v brew >/dev/null 2>&1; then
        say "Homebrew is needed for automatic installation."
        show_manual_install_steps
        return
      fi
      say "Installing conversion tools..."
      quiet brew install --cask libreoffice calibre || fail "Could not install LibreOffice and Calibre."
      quiet brew install ghostscript || fail "Could not install Ghostscript."
      ;;
    Linux)
      say "Installing conversion tools..."
      if command -v apt-get >/dev/null 2>&1; then
        quiet sudo apt-get update -qq || fail "Could not update apt packages."
        quiet sudo apt-get install -y -qq libreoffice calibre ghostscript || fail "Could not install conversion tools."
      elif command -v dnf >/dev/null 2>&1; then
        quiet sudo dnf install -y libreoffice calibre ghostscript || fail "Could not install conversion tools."
      elif command -v pacman >/dev/null 2>&1; then
        quiet sudo pacman -S --needed --noconfirm libreoffice-fresh calibre ghostscript || fail "Could not install conversion tools."
      else
        say "Your Linux package manager is not supported for automatic installation."
        show_manual_install_steps
      fi
      ;;
    *)
      show_manual_install_steps
      ;;
  esac
}

show_manual_install_steps() {
  say "Optional manual step for Office, EPUB, and PDF conversions:"
  case "$(uname -s)" in
    Darwin)
      say "  brew install --cask libreoffice calibre"
      say "  brew install ghostscript"
      ;;
    Linux)
      say "  Install LibreOffice, Calibre, and Ghostscript with your package manager."
      ;;
    *)
      say "  Install LibreOffice, Calibre, and Ghostscript, then add them to PATH."
      ;;
  esac
  say "Continuing without those optional conversion features."
}

find_python() {
  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 \
      && "$candidate" -c 'import sys; raise SystemExit(sys.version_info < (3, 10))' >/dev/null 2>&1; then
      command -v "$candidate"
      return
    fi
  done
  return 1
}

setup_application() {
  : >"$LOG_FILE"
  cd "$ROOT_DIR" || fail "Could not open the Archeio folder."

  say "Archeio setup"
  install_system_tools

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    fail "Node.js 20.19+ or 22.12+ is required. Install it, then run this launcher again."
  fi
  if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit((major === 20 && minor >= 19) || (major >= 22 && !(major === 22 && minor < 12)) ? 0 : 1)' >>"$LOG_FILE" 2>&1; then
    fail "Node.js 20.19+ or 22.12+ is required. Install it, then run this launcher again."
  fi

  local python
  python="$(find_python)" || fail "Python 3.10+ is required. Install it, then run this launcher again."
  local venv_python="$ROOT_DIR/venv/bin/python3"
  if [[ ! -x "$venv_python" ]]; then
    say "Creating Python environment..."
    quiet "$python" -m venv "$ROOT_DIR/venv" || fail "Could not create the Python environment."
  fi

  say "Installing Python packages..."
  quiet "$venv_python" -m pip install --upgrade pip setuptools wheel || fail "Could not prepare Python package tools."
  quiet "$venv_python" -m pip install -r "$ROOT_DIR/backend/requirements.txt" || fail "Could not install Python packages."

  say "Downloading OCR models..."
  (
    cd "$ROOT_DIR/backend" || exit 1
    "$venv_python" -m ocr_pipeline.bootstrap --download-models >>"$LOG_FILE" 2>&1
  ) || fail "Could not download or verify OCR models."

  say "Installing Node packages..."
  quiet npm --prefix "$ROOT_DIR/frontend" ci --silent --no-audit --no-fund || fail "Could not install frontend packages."
  quiet npm --prefix "$ROOT_DIR/backend" ci --silent --no-audit --no-fund || fail "Could not install backend packages."

  if [[ ! -f "$ROOT_DIR/frontend/.env" ]]; then
    printf 'VITE_API_URL=http://localhost:3001\n' >"$ROOT_DIR/frontend/.env"
  fi
  say "✓ Setup complete."
}

release_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    say "Stopping existing service on port $port..."
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

open_browser() {
  local url="http://localhost:5173"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    open "$url" >/dev/null 2>&1 || true
  else
    xdg-open "$url" >/dev/null 2>&1 || true
  fi
}

start_application() {
  release_port 3001
  release_port 5173

  say "Starting Archeio..."
  (
    cd "$ROOT_DIR/backend" || exit 1
    npm run dev
  ) &
  local backend_pid=$!
  (
    cd "$ROOT_DIR/frontend" || exit 1
    npm run dev
  ) &
  local frontend_pid=$!

  trap 'kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; exit 0' INT TERM EXIT

  local attempt
  local frontend_ready=false
  for attempt in {1..30}; do
    if curl -fsS http://127.0.0.1:5173 >/dev/null 2>&1; then
      open_browser
      say "✓ Archeio is ready at http://localhost:5173"
      frontend_ready=true
      break
    fi
    sleep 1
  done

  if [[ "$frontend_ready" == false ]]; then
    fail "The frontend did not become ready. Check the server output above."
  fi

  while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do
    sleep 1
  done
  fail "A server stopped unexpectedly."
}

setup_application
if [[ "$SETUP_ONLY" == false ]]; then
  start_application
fi
