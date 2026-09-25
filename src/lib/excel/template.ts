import * as xlsx from 'xlsx-js-style'
import AdmZip from 'adm-zip'

export interface BuildImportTemplateOptions {
  tenantName: string
  className: string
  schoolYearName: string
  generatedAt: string
}

const COLORS = {
  emerald: '078A57',
  emeraldDark: '075E45',
  emeraldSoft: 'EAF7F1',
  emeraldPale: 'F6FBF8',
  line: 'D6E9E1',
  text: '15352B',
  muted: '55766A',
  amber: 'FFF7E6',
  amberLine: 'F2D08A',
  white: 'FFFFFF',
}

const thinBorder = {
  top: { style: 'thin', color: { rgb: COLORS.line } },
  bottom: { style: 'thin', color: { rgb: COLORS.line } },
  left: { style: 'thin', color: { rgb: COLORS.line } },
  right: { style: 'thin', color: { rgb: COLORS.line } },
}

function styleRange(
  sheet: xlsx.WorkSheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
  style: Record<string, unknown>
) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      const cell = sheet[xlsx.utils.encode_cell({ r: row, c: col })]
      if (cell) cell.s = style
    }
  }
}

function applyInstructionSheetStyles(sheet: xlsx.WorkSheet) {
  const titleStyle = {
    fill: { fgColor: { rgb: COLORS.emeraldDark } },
    font: { name: 'Aptos Display', sz: 20, bold: true, color: { rgb: COLORS.white } },
    alignment: { horizontal: 'left', vertical: 'center' },
  }
  const subtitleStyle = {
    fill: { fgColor: { rgb: COLORS.emeraldDark } },
    font: { name: 'Aptos', sz: 10, color: { rgb: 'DDF4E9' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  }
  const sectionStyle = {
    fill: { fgColor: { rgb: COLORS.emeraldSoft } },
    font: { name: 'Aptos', sz: 11, bold: true, color: { rgb: COLORS.emeraldDark } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder,
  }
  const labelStyle = {
    fill: { fgColor: { rgb: COLORS.emeraldPale } },
    font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: COLORS.text } },
    alignment: { vertical: 'center' },
    border: thinBorder,
  }
  const valueStyle = {
    fill: { fgColor: { rgb: COLORS.white } },
    font: { name: 'Aptos', sz: 10, color: { rgb: COLORS.text } },
    alignment: { vertical: 'center' },
    border: thinBorder,
  }
  const bodyStyle = {
    fill: { fgColor: { rgb: COLORS.white } },
    font: { name: 'Aptos', sz: 10, color: { rgb: COLORS.muted } },
    alignment: { vertical: 'center', wrapText: true },
  }
  const warningStyle = {
    fill: { fgColor: { rgb: COLORS.amber } },
    font: { name: 'Aptos', sz: 10, color: { rgb: '76551C' } },
    alignment: { vertical: 'center', wrapText: true },
    border: { top: { style: 'thin', color: { rgb: COLORS.amberLine } }, bottom: { style: 'thin', color: { rgb: COLORS.amberLine } } },
  }

  styleRange(sheet, 0, 0, 0, 1, titleStyle)
  styleRange(sheet, 1, 1, 0, 1, subtitleStyle)
  styleRange(sheet, 3, 3, 0, 1, sectionStyle)
  styleRange(sheet, 4, 7, 0, 0, labelStyle)
  styleRange(sheet, 4, 7, 1, 1, valueStyle)
  styleRange(sheet, 9, 9, 0, 1, sectionStyle)
  styleRange(sheet, 10, 14, 0, 1, bodyStyle)
  styleRange(sheet, 16, 16, 0, 1, warningStyle)
  styleRange(sheet, 18, 18, 0, 1, sectionStyle)
  styleRange(sheet, 19, 19, 0, 4, labelStyle)
  styleRange(sheet, 20, 20, 0, 4, bodyStyle)

  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 1 } },
    { s: { r: 16, c: 0 }, e: { r: 16, c: 1 } },
    { s: { r: 18, c: 0 }, e: { r: 18, c: 4 } },
  ]
  sheet['!rows'] = [
    { hpt: 32 }, { hpt: 20 }, { hpt: 8 }, { hpt: 22 },
    { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 },
    { hpt: 8 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 },
    { hpt: 22 }, { hpt: 22 }, { hpt: 8 }, { hpt: 8 },
    { hpt: 34 }, { hpt: 8 }, { hpt: 22 }, { hpt: 24 }, { hpt: 32 },
  ]
  sheet['!cols'] = [{ wch: 58 }, { wch: 45 }, { wch: 18 }, { wch: 18 }, { wch: 22 }]
  sheet['!freeze'] = { xSplit: 0, ySplit: 3, topLeftCell: 'A4', state: 'frozen' }
}

function applyDataSheetStyles(sheet: xlsx.WorkSheet, headerCount: number, headerRow: number, lastRow: number) {
  const headerStyle = {
    fill: { fgColor: { rgb: COLORS.emerald } },
    font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: COLORS.white } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder,
  }
  const bodyStyle = {
    fill: { fgColor: { rgb: COLORS.white } },
    font: { name: 'Aptos', sz: 10, color: { rgb: COLORS.text } },
    alignment: { vertical: 'center' },
    border: thinBorder,
  }
  const dateStyle = { ...bodyStyle, numFmt: 'dd/mm/yyyy' }

  styleRange(sheet, headerRow, headerRow, 0, headerCount - 1, headerStyle)
  styleRange(sheet, headerRow + 1, lastRow, 0, headerCount - 1, bodyStyle)
  styleRange(sheet, headerRow + 1, lastRow, 4, 4, dateStyle)
  sheet['!rows'] = [
    { hpt: 30 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 22 }, { hpt: 8 }, { hpt: 30 },
    ...Array.from({ length: lastRow - headerRow }, () => ({ hpt: 22 })),
  ]
  sheet['!cols'] = [
    { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 22 },
    { wch: 3, hidden: true }, { wch: 22, hidden: true }, { wch: 32, hidden: true },
  ]
  sheet['!autofilter'] = { ref: `A${headerRow + 1}:E${lastRow + 1}` }
  sheet['!freeze'] = { xSplit: 0, ySplit: headerRow + 1, topLeftCell: `A${headerRow + 2}`, state: 'frozen' }
  sheet['!dataValidation'] = [
    { sqref: `D${headerRow + 2}:D${lastRow + 1}`, type: 'list', formulas: ['"M,F"'], showErrorMessage: true, errorTitle: 'Valeur invalide', error: 'Choisissez M ou F.' },
    { sqref: `E${headerRow + 2}:E${lastRow + 1}`, type: 'date', operator: 'between', formulas: ['DATE(1900,1,1)', 'DATE(2100,12,31)'], showErrorMessage: true, errorTitle: 'Date invalide', error: 'Saisissez une date au format JJ/MM/AAAA ou utilisez le calendrier.' },
  ]
}

export function buildImportTemplateWorkbook({
  tenantName,
  className,
  schoolYearName,
  generatedAt,
}: BuildImportTemplateOptions): xlsx.WorkBook {
  const workbook = xlsx.utils.book_new()
  // Keep these labels exact: the import parser uses them as the file contract.
  const headers = ['Nom', 'Postnom', 'Prénom', 'Sexe', 'Date de naissance']
  const blankRows = Array.from({ length: 50 }, () => ['', '', '', '', ''])

  const dataSheet = xlsx.utils.aoa_to_sheet([
    ['PAYLIX — IMPORTATION DES ÉLÈVES', '', '', '', ''],
    ['Établissement :', tenantName || 'Établissement', '', '', ''],
    ['Classe :', className || 'Classe cible', '', '', ''],
    ['Année scolaire :', schoolYearName || 'Année scolaire', '', '', ''],
    ['Généré le :', generatedAt || new Date().toLocaleDateString('fr-FR'), '', '', ''],
    ['', '', '', '', ''],
    headers,
    ...blankRows,
  ])
  applyDataSheetStyles(dataSheet, headers.length, 6, 56)
  dataSheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 1 }, e: { r: 1, c: 4 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 4 } },
    { s: { r: 4, c: 1 }, e: { r: 4, c: 4 } },
  ]
  styleRange(dataSheet, 0, 0, 0, 4, {
    fill: { fgColor: { rgb: COLORS.emeraldDark } },
    font: { name: 'Aptos', sz: 12, bold: true, color: { rgb: COLORS.white } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  })
  styleRange(dataSheet, 1, 4, 0, 0, {
    fill: { fgColor: { rgb: COLORS.emeraldSoft } },
    font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: COLORS.emeraldDark } },
    border: thinBorder,
  })
  styleRange(dataSheet, 1, 4, 1, 4, {
    fill: { fgColor: { rgb: COLORS.white } },
    font: { name: 'Aptos', sz: 10, color: { rgb: COLORS.text } },
    border: thinBorder,
  })
  dataSheet['!ref'] = 'A1:E57'

  xlsx.utils.book_append_sheet(workbook, dataSheet, 'Données')
  return workbook
}

export function writeImportTemplateWorkbook(workbook: xlsx.WorkBook): Buffer {
  const zip = new AdmZip(xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
  const dataSheetPath = 'xl/worksheets/sheet1.xml'
  const dataSheetEntry = zip.getEntry(dataSheetPath)

  if (!dataSheetEntry) {
    throw new Error('La feuille Données est introuvable dans le classeur exporté.')
  }

  const dataSheetXml = dataSheetEntry.getData().toString('utf8')
  const validations = [
    '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" promptTitle="Sexe" prompt="Choisissez M ou F dans le menu déroulant." errorTitle="Valeur invalide" error="Choisissez uniquement M ou F." sqref="D8:D57"><formula1>&quot;M,F&quot;</formula1></dataValidation>',
    '<dataValidation type="date" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1" promptTitle="Date de naissance" prompt="Saisissez la date au format JJ/MM/AAAA, par exemple 15/03/2014." errorTitle="Date invalide" error="Saisissez une date valide au format JJ/MM/AAAA." sqref="E8:E57"><formula1>DATE(1900,1,1)</formula1><formula2>DATE(2100,12,31)</formula2></dataValidation>',
  ].join('')
  const validationXml = `<dataValidations count="2">${validations}</dataValidations>`
  const validationInsertionPoint = dataSheetXml.includes('<ignoredErrors')
    ? '<ignoredErrors'
    : '</worksheet>'
  const updatedXml = dataSheetXml.replace(
    validationInsertionPoint,
    validationInsertionPoint === '</worksheet>' ? `${validationXml}</worksheet>` : `${validationXml}${validationInsertionPoint}`
  )

  zip.updateFile(dataSheetPath, Buffer.from(updatedXml, 'utf8'))
  return zip.toBuffer()
}
