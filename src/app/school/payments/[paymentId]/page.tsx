import PaymentDetailPage from '@/app/accountant/payments/[paymentId]/page';

export default function SchoolPaymentDetailPage() {
  return <PaymentDetailPage readOnly basePath="/school" />;
}