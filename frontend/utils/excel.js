function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeSheetName(name, index) {
  const fallback = `Sheet${index + 1}`;
  const raw = String(name || fallback)
    .replace(/[\\/*?:[\]]/g, ' ')
    .trim();
  return raw.slice(0, 31) || fallback;
}

function detectCellType(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return 'Number';
  if (typeof value === 'boolean') return 'String';
  return 'String';
}

function cellValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  return String(value);
}

function buildSheetXml(sheet, index) {
  const name = sanitizeSheetName(sheet?.name, index);
  const columns = Array.isArray(sheet?.columns) ? sheet.columns : [];
  const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];

  const headerXml = `
    <Row ss:StyleID="header">
      ${columns.map((column) => `<Cell><Data ss:Type="String">${escapeXml(column)}</Data></Cell>`).join('')}
    </Row>
  `;

  const rowsXml = rows.map((row) => {
    const cells = columns.map((_, colIndex) => {
      const raw = Array.isArray(row) ? row[colIndex] : '';
      const type = detectCellType(raw);
      const value = cellValue(raw);
      return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
    });
    return `<Row>${cells.join('')}</Row>`;
  }).join('');

  return `
    <Worksheet ss:Name="${escapeXml(name)}">
      <Table>
        ${headerXml}
        ${rowsXml}
      </Table>
    </Worksheet>
  `;
}

function buildWorkbookXml(sheets) {
  const worksheets = sheets.map((sheet, index) => buildSheetXml(sheet, index)).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Bottom"/>
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
    <Style ss:ID="header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#DCE6F2" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  ${worksheets}
</Workbook>`;
}

function downloadBlob(content, fileName) {
  const blob = new Blob([`\uFEFF${content}`], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadExcelWorkbook(sheets, fileName = 'export.xls') {
  if (!Array.isArray(sheets) || sheets.length === 0) return;
  const workbookXml = buildWorkbookXml(sheets);
  downloadBlob(workbookXml, fileName);
}

export { downloadExcelWorkbook };
