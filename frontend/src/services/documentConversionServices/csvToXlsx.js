import * as XLSX from 'xlsx';

export const csvToXlsx = async (file) => {
  const text = await file.text();
  const workbook = XLSX.read(text, { type: 'string' });
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
