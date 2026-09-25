import { describe, expect, it } from 'vitest'
import AdmZip from 'adm-zip'
import { buildImportTemplateWorkbook, writeImportTemplateWorkbook } from './template'

describe('buildImportTemplateWorkbook', () => {
  it('creates a workbook with the expected student import columns and metadata sheet', () => {
    const workbook = buildImportTemplateWorkbook({
      tenantName: 'Collège Saint-Exemple',
      className: '1ère A',
      schoolYearName: '2026 - 2027',
      generatedAt: '10 septembre 2026',
    })

    expect(workbook.SheetNames).toContain('Données')
    expect(workbook.SheetNames).not.toContain('Instructions')

    const dataSheet = workbook.Sheets['Données']
    expect(dataSheet['A1']?.v).toContain('PAYLIX')
    expect(dataSheet['A7']?.v).toBe('Nom')
    expect(dataSheet['B7']?.v).toBe('Postnom')
    expect(dataSheet['C7']?.v).toBe('Prénom')
    expect(dataSheet['D7']?.v).toBe('Sexe')
    expect(dataSheet['E7']?.v).toBe('Date de naissance')
    expect(dataSheet['!ref']).toBe('A1:E57')
  })

  it('applies a professional colorized header style to the data sheet', () => {
    const workbook = buildImportTemplateWorkbook({
      tenantName: 'Collège Saint-Exemple',
      className: '1ère A',
      schoolYearName: '2026 - 2027',
      generatedAt: '10 septembre 2026',
    })

    const dataSheet = workbook.Sheets['Données']
    expect(dataSheet['A7']?.s?.fill?.fgColor?.rgb).toBe('078A57')
    expect(dataSheet['A7']?.s?.font?.bold).toBe(true)
  })

  it('keeps sex and date validation metadata on the data sheet', () => {
    const workbook = buildImportTemplateWorkbook({
      tenantName: 'Collège Saint-Exemple',
      className: '1ère A',
      schoolYearName: '2026 - 2027',
      generatedAt: '10 septembre 2026',
    })

    const exported = writeImportTemplateWorkbook(workbook)
    const dataSheet = workbook.Sheets['Données']

    expect(exported).toBeInstanceOf(Buffer)
    expect(dataSheet['!dataValidation']).toEqual(expect.arrayContaining([
      expect.objectContaining({
      type: 'list',
      formulas: ['"M,F"'],
      }),
      expect.objectContaining({
      type: 'date',
      operator: 'between',
      formulas: ['DATE(1900,1,1)', 'DATE(2100,12,31)'],
      }),
    ]))
    expect(dataSheet['E8']?.s?.numFmt).toBe('dd/mm/yyyy')
  })

  it('writes the validations into the XLSX worksheet XML', () => {
    const workbook = buildImportTemplateWorkbook({
      tenantName: 'Collège Saint-Exemple',
      className: '1ère A',
      schoolYearName: '2026 - 2027',
      generatedAt: '10 septembre 2026',
    })

    const zip = new AdmZip(writeImportTemplateWorkbook(workbook))
    const sheetXml = zip.getEntry('xl/worksheets/sheet1.xml')?.getData().toString('utf8') || ''

    expect(sheetXml).toContain('sqref="D8:D57"')
    expect(sheetXml).toContain('&quot;M,F&quot;')
    expect(sheetXml).toContain('prompt="Saisissez la date au format JJ/MM/AAAA, par exemple 15/03/2014."')
    expect(sheetXml).not.toContain('showDropDown="1"')
    expect(sheetXml).toContain('prompt="Choisissez M ou F dans le menu déroulant."')
    expect(sheetXml).toContain('JJ/MM/AAAA')
    expect(sheetXml).toContain('sqref="E8:E57"')
    expect(sheetXml).toContain('DATE(1900,1,1)')
    expect(sheetXml).toContain('Classe :')
    expect(sheetXml).toContain('1ère A')
    expect(sheetXml).toContain('Année scolaire :')
    expect(sheetXml).toContain('2026 - 2027')
  })
})
