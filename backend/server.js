import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { execFile, spawn } from 'child_process'; 
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import shell from 'shelljs'; 
import AdmZip from 'adm-zip';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));


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

// DOCX, PPTX, XLSX, ODT, ODP, ODS, EPUB
const compressPackagedDocument = async ({
  inputPath,
  outputPath,
  ratio = 70,
  ext,
}) => {
  const zip = new AdmZip(inputPath);
  const entries = zip.getEntries();

  const isImageFile = (entryName) => {
    const lower = entryName.toLowerCase();

    return (
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.webp')
    );
  };

  const isCompressibleMediaPath = (entryName) => {
    const lower = entryName.toLowerCase();

    // EPUB files can place images in many different folders,
    // so for EPUB, just compress image files anywhere inside the package.
    if (ext === '.epub') {
      return isImageFile(lower);
    }

    return (
      lower.startsWith('word/media/') ||
      lower.startsWith('ppt/media/') ||
      lower.startsWith('xl/media/') ||
      lower.startsWith('pictures/') ||
      lower.includes('/media/') ||
      lower.includes('/pictures/')
    );
  };

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryName = entry.entryName;

    if (!isCompressibleMediaPath(entryName)) continue;
    if (!isImageFile(entryName)) continue;

    const inputBuffer = entry.getData();
    const lower = entryName.toLowerCase();

    let outputBuffer = null;

    try {
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
        outputBuffer = await sharp(inputBuffer)
          .jpeg({ quality: Number(ratio) })
          .toBuffer();
      } else if (lower.endsWith('.png')) {
        outputBuffer = await sharp(inputBuffer)
          .png({ compressionLevel: 9, palette: true })
          .toBuffer();
      } else if (lower.endsWith('.webp')) {
        outputBuffer = await sharp(inputBuffer)
          .webp({ quality: Number(ratio) })
          .toBuffer();
      }

      if (outputBuffer && outputBuffer.length < inputBuffer.length) {
        zip.updateFile(entry.entryName, outputBuffer);
      }
    } catch (err) {
      console.warn(`Skipped ${entryName}:`, err.message);
    }
  }

  zip.writeZip(outputPath);
};

// DOC, PPT, XLS, RTF
const resaveWithLibreOffice = async ({
  inputPath,
  outputDir,
  ext,
}) => {
  const loBinary =
    findBinary('libreoffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice') ||
    findBinary('soffice', '');

  if (!loBinary) {
    throw new Error('LibreOffice not found on server.');
  }

  const convertToMap = {
    '.doc': 'doc',
    '.ppt': 'ppt',
    '.xls': 'xls',
    '.rtf': 'rtf',
  };

  const convertTo = convertToMap[ext];

  if (!convertTo) {
    throw new Error(`${ext} cannot be re-saved with LibreOffice.`);
  }

  await new Promise((resolve, reject) => {
    execFile(
      loBinary,
      ['--headless', '--convert-to', convertTo, inputPath, '--outdir', outputDir],
      (error, stdout, stderr) => {
        if (error) {
          console.error('LibreOffice same-format error:', stderr || error.message);
          reject(new Error('LibreOffice same-format compression failed.'));
          return;
        }

        resolve();
      }
    );
  });
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

// for compression of microsoft / opendocs / libre 
app.post('/compress-office', upload.single('file'), async (req, res) => {
  let inputPath;
  let outputPath;

  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const ratio = Number(req.body.ratio) || 70;

    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const baseName = path.basename(originalName, ext);

    inputPath = req.file.path;
    outputPath = path.join('uploads', `${req.file.filename}_compressed${ext}`);

    const packagedExtensions = [
      '.docx',
      '.pptx',
      '.xlsx',
      '.odt',
      '.odp',
      '.ods',
      '.epub',
    ];

    const libreOfficeResaveExtensions = [
      '.doc',
      '.ppt',
      '.xls',
      '.rtf',
    ];

    const plainTextExtensions = [
      '.txt',
      '.csv',
      '.md',
    ];

    if (packagedExtensions.includes(ext)) {
      await compressPackagedDocument({
        inputPath,
        outputPath,
        ratio,
        ext,
      });
    } else if (libreOfficeResaveExtensions.includes(ext)) {
      const outputDir = 'uploads';

      await resaveWithLibreOffice({
        inputPath,
        outputDir,
        ext,
      });

      const libreOfficeOutputPath = path.join(
        outputDir,
        `${req.file.filename}${ext}`
      );

      if (!fs.existsSync(libreOfficeOutputPath)) {
        throw new Error('LibreOffice produced no output.');
      }

      fs.renameSync(libreOfficeOutputPath, outputPath);
    } else if (plainTextExtensions.includes(ext)) {
      // TXT/CSV/MD have no meaningful same-extension native compression.
      // Return the original file. Frontend may say "already highly compressed"
      // if output size is not smaller.
      fs.copyFileSync(inputPath, outputPath);
    } else {
      return res.status(400).send(`${ext} native compression is not supported yet.`);
    }

    res.download(outputPath, `${baseName}_compressed${ext}`, () => {
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });
  } catch (err) {
    console.error('Document native compression error:', err);

    if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    res.status(500).send(err.message || 'Native document compression failed.');
  }
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

app.post('/convert-to-avif', upload.single('file'), async (req, res) => {
  try {
    const inputPath = req.file.path;
    const outputPath = `${inputPath}.avif`;

    const ratio = Number(req.body.ratio || 75);

    // ratio high = more compression = lower quality
    const quality = Math.round(85 - ((ratio - 20) / (90 - 20)) * 55);
    const safeQuality = Math.max(30, Math.min(85, quality));

    const python = spawn('python3', [
      'anyToAVIF.py',
      inputPath,
      outputPath,
      String(safeQuality),
    ]);

    python.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).send('AVIF conversion failed');
      }

      res.sendFile(path.resolve(outputPath), () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('AVIF conversion failed');
  }
});

app.post('/convert-to-pdf', upload.single('file'), (req, res) => {
  const inputPath = req.file.path;
  const originalName = req.file.originalname;
  const ext = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, ext);
  const outputDir = 'uploads';

  const LIBREOFFICE_FORMATS = ['.docx', '.xlsx', '.pptx', '.rtf', '.odt', '.html', '.txt', '.csv'];
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

const OCR_PROXY_TIMEOUT_MS = 20 * 60 * 1000;

const sendOcrDocument = ({ fileBuffer, fileName, mimeType }) => new Promise((resolve, reject) => {
  const boundary = `----archeio-${Date.now().toString(16)}`;
  const safeFileName = path.basename(fileName).replace(/["\r\n]/g, '_');
  const preamble = Buffer.from(
    `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="file"; filename="${safeFileName}"\r\n`
      + `Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`,
    'utf8'
  );
  const closing = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([preamble, fileBuffer, closing]);

  const request = http.request({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/convert/image-to-docx',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
  }, (response) => {
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => resolve({
      status: response.statusCode || 500,
      body: Buffer.concat(chunks),
    }));
  });

  request.setTimeout(OCR_PROXY_TIMEOUT_MS, () => {
    request.destroy(new Error('OCR conversion timed out after 20 minutes.'));
  });
  request.on('error', reject);
  request.end(body);
});

// OCR Docx Conversion Proxy Route
app.post('/convert/image-to-docx', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    
    const response = await sendOcrDocument({
      fileBuffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    if (response.status < 200 || response.status >= 300) {
      const errText = response.body.toString('utf8');
      return res.status(response.status).send(errText || 'FastAPI image-to-docx conversion failed');
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${req.file.originalname.replace(/\.[^/.]+$/, '')}.docx"`);
    res.send(response.body);
  } catch (err) {
    console.error('OCR docx conversion proxy error:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).send(err.message || 'OCR document conversion failed.');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  
  // Resolve Python binary path
  const venvPython = path.join(__dirname, '../venv/bin/python3');
  let pythonPath = venvPython;
  if (!fs.existsSync(pythonPath)) {
    const found = findBinary('python3') || findBinary('python');
    pythonPath = found || 'python3';
  }
  
  console.log(`Starting FastAPI OCR server with ${pythonPath}...`);
  const fastapiProcess = spawn(pythonPath, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: __dirname,
    stdio: 'inherit',
  });

  fastapiProcess.on('error', (err) => {
    console.error('Failed to start FastAPI OCR server:', err);
  });

  // Ensure the child process is terminated when node exits
  const killFastApi = () => {
    try {
      fastapiProcess.kill();
    } catch (e) {}
  };
  process.on('exit', killFastApi);
  process.on('SIGINT', () => {
    killFastApi();
    process.exit();
  });
  process.on('SIGTERM', () => {
    killFastApi();
    process.exit();
  });
});
