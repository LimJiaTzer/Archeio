import subprocess
import os
import shutil

LIBREOFFICE_FORMATS = {'.docx', '.xlsx', '.pptx', '.rtf', '.odt', '.html', '.txt', '.csv'}
EPUB_FORMATS = {'.epub'}

def convert_to_pdf(input_path: str, output_dir: str):
    ext = os.path.splitext(input_path)[1].lower()
    
    if ext in LIBREOFFICE_FORMATS:
        return _convert_with_libreoffice(input_path, output_dir)
    elif ext in EPUB_FORMATS:
        return _convert_with_calibre(input_path, output_dir)
    else:
        raise ValueError(f"Unsupported format: {ext}")

def _convert_with_libreoffice(input_path: str, output_dir: str):
    try:
        # On macOS, LibreOffice is often here: /Applications/LibreOffice.app/Contents/MacOS/soffice
        # We try 'libreoffice' first, then 'soffice'
        cmd = 'libreoffice'
        if not shutil.which(cmd):
            cmd = 'soffice'
            if not shutil.which(cmd):
                # Check standard macOS location as last resort
                macos_path = "/Applications/LibreOffice.app/Contents/MacOS/soffice"
                if os.path.exists(macos_path):
                    cmd = macos_path
                else:
                    raise FileNotFoundError("LibreOffice/soffice not found in PATH or Applications.")

        subprocess.run(
            [cmd, '--headless', '--convert-to', 'pdf',
             input_path, '--outdir', output_dir],
            check=True, timeout=60,
            capture_output=True, text=True
        )
        
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        pdf_path = os.path.join(output_dir, base_name + '.pdf')
        return pdf_path
    except subprocess.CalledProcessError as e:
        print(f"LibreOffice Error: {e.stderr}")
        raise e

def _convert_with_calibre(input_path: str, output_dir: str):
    try:
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        output_path = os.path.join(output_dir, base_name + '.pdf')
        
        cmd = 'ebook-convert'
        if not shutil.which(cmd):
            macos_path = "/Applications/calibre.app/Contents/MacOS/ebook-convert"
            if os.path.exists(macos_path):
                cmd = macos_path
            else:
                raise FileNotFoundError("ebook-convert not found in PATH or Applications.")

        subprocess.run(
            [cmd, input_path, output_path],
            check=True, timeout=120,
            capture_output=True, text=True
        )
        return output_path
    except subprocess.CalledProcessError as e:
        print(f"Calibre Error: {e.stderr}")
        raise e
