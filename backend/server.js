import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import shell from 'shelljs'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());

// Helper to find binaries in common locations
const findBinary = (binName, macPath) => {
  // 1. Check if it's in the system PATH
  const systemPath = shell.which(binName);
  if (systemPath && systemPath.code === 0) {
    return systemPath.toString();
  }

  // 2. Check common macOS Application path
  if (process.platform === 'darwin' && macPath && fs.existsSync(macPath)) {
    return macPath;
  }

  return null;
};

app.post('/compress-pdf', upload.single('file'), (req, res) => {
  const inputPath = req.file.path;
  const outputPath = path.join('uploads', `${req.file.filename}_compressed.pdf`);

  const ratio = Number(req.body.ratio);

  let pdfSetting = '/ebook';

  if (ratio >= 80) {
    pdfSetting = '/screen';
  } else if (ratio >= 50) {
    pdfSetting = '/ebook';
  } else {
    pdfSetting = '/printer';
  }

  execFile(
    'gs',
    [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=${pdfSetting}`,
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ],
    (error) => {
      if (error) {
        console.error(error);
        return res.status(500).send('Ghostscript compression failed. Ensure Ghostscript is installed on the server.');
      }

      res.download(outputPath, 'compressed.pdf', () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    }
  );
});

app.post('/convert-to-heic', upload.single('file'), (req, res) => {
  const inputPath = req.file.path;
  const outputPath = path.join('uploads', `${req.file.filename}.heic`);
  const scriptPath = path.join(__dirname, 'anyToHEIC.py');

  // Prefer venv python if present, otherwise fall back to system python3 / python
  const venvPython = path.join(__dirname, '../venv/bin/python3');
  let pythonPath = venvPython;
  if (!fs.existsSync(pythonPath)) {
    const found = findBinary('python3') || findBinary('python');
    pythonPath = found || 'python3';
  }

  execFile(
    pythonPath,
    [scriptPath, inputPath, outputPath],
    (error, stdout, stderr) => {
      if (error) {
        console.error('Conversion error:', error, stderr);
        // Return stderr to client for debugging (trim to reasonable length)
        const msg = (stderr && stderr.toString()) || (error && error.message) || 'HEIC conversion failed.';
        const safeMsg = msg.length > 1000 ? msg.slice(0, 1000) + '... (truncated)' : msg;
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        return res.status(500).send(`HEIC conversion failed: ${safeMsg}`);
      }

      res.download(outputPath, 'converted.heic', () => {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      });
    }
  );
});

app.post('/convert-to-pdf', upload.single('file'), (req, res) => {
  const inputPath = req.file.path;
  const originalName = req.file.originalname;
  const ext = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, ext);
  const outputDir = 'uploads';

  const LIBREOFFICE_FORMATS = ['.docx', '.xlsx', '.pptx', '.rtf', '.odt', '.html', '.txt'];
  const EPUB_FORMATS = ['.epub'];

  if (LIBREOFFICE_FORMATS.includes(ext)) {
    const loBinary = findBinary('libreoffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice') || findBinary('soffice', '');
    
    if (!loBinary) {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      return res.status(500).send('LibreOffice not found on server. Please install it to enable Office/HTML conversion.');
    }

    execFile(
      loBinary,
      ['--headless', '--convert-to', 'pdf', inputPath, '--outdir', outputDir],
      (error, stdout, stderr) => {
        if (error) {
          console.error('LibreOffice error:', stderr || error.message);
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          return res.status(500).send('LibreOffice conversion failed.');
        }

        const libreofficeOutputFile = path.join(outputDir, `${req.file.filename}.pdf`);

        if (fs.existsSync(libreofficeOutputFile)) {
          res.download(libreofficeOutputFile, `${baseName}.pdf`, () => {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(libreofficeOutputFile)) fs.unlinkSync(libreofficeOutputFile);
          });
        } else {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          res.status(500).send('Conversion produced no output.');
        }
      }
    );
  } else if (EPUB_FORMATS.includes(ext)) {
    const calibreBinary = findBinary('ebook-convert', '/Applications/calibre.app/Contents/MacOS/ebook-convert');

    if (!calibreBinary) {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      return res.status(500).send('Calibre (ebook-convert) not found on server. Please install it to enable EPUB conversion.');
    }

    const epubOutputPath = path.join(outputDir, `${req.file.filename}.pdf`);
    execFile(
      calibreBinary,
      [inputPath, epubOutputPath],
      (error) => {
        if (error) {
          console.error('Calibre error:', error);
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          return res.status(500).send('EPUB conversion failed.');
        }

        res.download(epubOutputPath, `${baseName}.pdf`, () => {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(epubOutputPath)) fs.unlinkSync(epubOutputPath);
        });
      }
    );
  } else {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    res.status(400).send(`Unsupported format: ${ext}`);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
