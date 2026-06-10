import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());

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
        return res.status(500).send('Ghostscript compression failed.');
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
  const pythonPath = path.join(__dirname, '../venv/bin/python3');
  const scriptPath = path.join(__dirname, 'anyToHEIC.py');

  execFile(
    pythonPath,
    [scriptPath, inputPath, outputPath],
    (error, stdout, stderr) => {
      if (error) {
        console.error('Conversion error:', stderr);
        return res.status(500).send('HEIC conversion failed.');
      }

      res.download(outputPath, 'converted.heic', () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    }
  );
});

app.listen(3001, () => {
  console.log('Backend running on http://localhost:3001');
});
