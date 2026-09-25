import * as XLSX from 'xlsx-js-style';

/**
 * Utilitaire d'exportation de données financières vers Excel
 * Version Premium Paylix
 */

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "10B981" } }, // Emerald 500
  alignment: { horizontal: "center", vertical: "center" }
};

const CELL_STYLE = {
  alignment: { horizontal: "left", vertical: "center" }
};

const MONEY_STYLE = {
  alignment: { horizontal: "right", vertical: "center" }
};

// Fonction utilitaire pour appliquer le style aux colonnes
const applyStylesToSheet = (worksheet: any, colWidths: number[]) => {
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  
  for (let C = range.s.c; C <= range.e.c; ++C) {
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cellAddress = { c: C, r: R };
      const cellRef = XLSX.utils.encode_cell(cellAddress);
      
      if (!worksheet[cellRef]) continue;
      
      if (R === 0) {
        // En-tête
        worksheet[cellRef].s = HEADER_STYLE;
      } else {
        // Détection si c'est un montant (souvent aligné à droite)
        const isMoney = String(worksheet[cellRef].v).includes('CDF') || String(worksheet[cellRef].v).includes('$') || typeof worksheet[cellRef].v === 'number';
        worksheet[cellRef].s = isMoney ? MONEY_STYLE : CELL_STYLE;
      }
    }
  }

  // Largeur des colonnes
  worksheet['!cols'] = colWidths.map(w => ({ wch: w }));
};

export function exportPaymentsToExcel(payments: any[]) {
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Paylix_Rapport_Comptable_${dateStr}.xlsx`;

  const data = payments.map((p) => ({
    'Date Paiement': new Date(p.payment_date).toLocaleDateString('fr-FR'),
    'N° Reçu': p.receipts?.[0]?.receipt_number || '-',
    'Élève': `${p.students?.first_name || ''} ${p.students?.last_name || ''}`.trim(),
    'Montant': p.amount,
    'Devise': p.currency,
    'Statut': p.status === 'confirmed' ? 'Validé' : 'Annulé',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  applyStylesToSheet(worksheet, [15, 20, 30, 15, 10, 15]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Opérations');
  XLSX.writeFile(workbook, fileName);
}

export function exportClassReportToExcel(reportData: any[]) {
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Paylix_Rapport_Financier_Classes_${dateStr}.xlsx`;

  const data = reportData.map((c) => ({
    'Classe': c.class_name,
    'Nombre Élèves': c.student_count,
    'Attendu (CDF)': c.cdf.expected,
    'Payé (CDF)': c.cdf.paid,
    'Restant (CDF)': c.cdf.remaining,
    'Attendu (USD)': c.usd.expected,
    'Payé (USD)': c.usd.paid,
    'Restant (USD)': c.usd.remaining,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  applyStylesToSheet(worksheet, [25, 15, 15, 15, 15, 15, 15, 15]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Synthèse par Classe');
  XLSX.writeFile(workbook, fileName);
}

export function exportUnpaidToExcel(unpaid: any[]) {
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Paylix_Rapport_Impayes_${dateStr}.xlsx`;

  const data = unpaid.map((u) => ({
    'Élève': u.student_name,
    'Matricule': u.matricule,
    'Classe': u.class_name,
    'Frais': u.fee_name,
    'Montant Initial': u.initial_amount,
    'Montant Payé': u.paid_amount,
    'Reste à Payer': u.remaining_amount,
    'Devise': u.currency,
    'Statut': u.status === 'overdue' ? 'En retard' : u.status === 'partial' ? 'Partiel' : 'À payer',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  applyStylesToSheet(worksheet, [30, 15, 25, 25, 15, 15, 15, 10, 15]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Impayés');
  XLSX.writeFile(workbook, fileName);
}

export function exportReceiptsToExcel(receipts: any[]) {
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Paylix_Recus_${dateStr}.xlsx`;

  const data = receipts.map((r) => ({
    'N° Reçu': r.receipt_number,
    'Date Émission': r.issued_at,
    'Élève': r.student_name,
    'Matricule': r.matricule,
    'Classe': r.class_name,
    'Montant': r.amount,
    'Devise': r.currency,
    'Enregistré Par': r.recorded_by,
    'Statut': r.status === 'confirmed' ? 'Valide' : 'Annulé',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  applyStylesToSheet(worksheet, [20, 20, 30, 15, 20, 15, 10, 20, 15]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Reçus');
  XLSX.writeFile(workbook, fileName);
}
