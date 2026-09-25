import QRCode from 'qrcode';

/**
 * Génère une Data URL (PNG) à partir d'un texte ou d'une URL.
 */
export async function generateQRCodeDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 250,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch (err) {
    console.error('Erreur lors de la génération du QR Code:', err);
    return '';
  }
}
