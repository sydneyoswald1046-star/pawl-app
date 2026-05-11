import * as Print from 'expo-print';
import * as MailComposer from 'expo-mail-composer';
import { Share } from 'react-native';
import type { Invoice } from '../data/invoices';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function buildInvoiceHtml(invoice: Invoice, fromName: string, options: { showPoweredBy?: boolean } = {}): string {
  const items =
    invoice.items && invoice.items.length > 0
      ? invoice.items
      : [{ id: 'single', description: invoice.service || '—', amount: invoice.amount }];

  const itemsRows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee;">${escapeHtml(it.description)}</td>
        <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;">${formatMoney(it.amount, invoice.currency)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.5px; }
  .muted { color: #666; font-size: 13px; }
  .number { font-family: monospace; font-size: 12px; color: #999; letter-spacing: 1px; }
  .billed { margin: 24px 0; padding: 16px; background: #f5f5f7; border-radius: 12px; }
  .label { font-size: 10px; font-weight: 700; letter-spacing: 0.8px; color: #666; text-transform: uppercase; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th { text-align: left; padding: 8px 0; border-bottom: 2px solid #111; font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase; }
  th.right { text-align: right; }
  .total-row { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; padding-top: 16px; border-top: 2px solid #111; font-size: 18px; font-weight: 700; }
  .meta { display: flex; gap: 24px; margin-top: 16px; font-size: 13px; }
  .meta-item .label { margin-bottom: 2px; }
  .notes { margin-top: 24px; padding: 16px; background: #fafafa; border-radius: 8px; font-size: 13px; line-height: 1.5; color: #444; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Invoice</h1>
      <div class="muted">${escapeHtml(fromName)}</div>
    </div>
    <div style="text-align:right;">
      <div class="number">${escapeHtml(invoice.number)}</div>
      <div class="muted" style="margin-top:6px;">${invoice.issuedDate ? `Issued ${formatDateLong(invoice.issuedDate)}` : ''}</div>
    </div>
  </div>

  <div class="billed">
    <div class="label">Billed to</div>
    <div style="font-size:16px;font-weight:600;">${escapeHtml(invoice.clientName)}</div>
    ${invoice.clientEmail ? `<div class="muted" style="margin-top:2px;">${escapeHtml(invoice.clientEmail)}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="total-row">
    <span>Total</span>
    <span>${formatMoney(invoice.amount, invoice.currency)}</span>
  </div>

  <div class="meta">
    <div class="meta-item">
      <div class="label">Due</div>
      <div>${formatDateLong(invoice.dueDate)}</div>
    </div>
    ${invoice.status === 'paid' && invoice.paidDate
      ? `<div class="meta-item"><div class="label">Paid</div><div>${formatDateLong(invoice.paidDate)}</div></div>`
      : ''}
  </div>

  ${invoice.paymentLinkUrl
    ? `<div style="margin-top:24px;padding:18px;background:#7c3aed;border-radius:12px;text-align:center;"><a href="${escapeHtml(invoice.paymentLinkUrl)}" style="color:#fff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:-0.2px;">Pay this invoice online →</a><div style="color:rgba(255,255,255,0.7);font-size:11px;margin-top:6px;">Secure checkout via Stripe</div></div>`
    : ''}

  ${invoice.notes ? `<div class="notes"><div class="label" style="margin-bottom:6px;">Notes</div>${escapeHtml(invoice.notes)}</div>` : ''}

  ${options.showPoweredBy
    ? `<div style="margin-top:40px;text-align:center;color:#999;font-size:11px;">Sent via Payly</div>`
    : ''}
</body>
</html>`;
}

export async function generateInvoicePdf(
  invoice: Invoice,
  fromName: string,
  options: { showPoweredBy?: boolean } = {},
): Promise<string> {
  const html = buildInvoiceHtml(invoice, fromName, options);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

export type EmailInvoiceResult =
  | { ok: true; status: MailComposer.MailComposerStatus }
  | { ok: false; reason: 'unavailable' | 'no-recipient' };

export type ShareInvoiceResult =
  | { ok: true; action: string | undefined }
  | { ok: false; reason: 'no-recipient' };

export type EmailMode = 'initial' | 'reminder';

function dueStatus(invoice: Invoice): string {
  const today = new Date();
  const due = new Date(invoice.dueDate);
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `due in ${days} days`;
}

function payLine(invoice: Invoice): string {
  return invoice.paymentLinkUrl ? `Pay online: ${invoice.paymentLinkUrl}\n` : '';
}

function buildEmailFields(
  invoice: Invoice,
  fromName: string,
  mode: EmailMode,
): { subject: string; body: string } {
  const total = formatMoney(invoice.amount, invoice.currency);
  if (mode === 'reminder') {
    return {
      subject: `Reminder: Invoice ${invoice.number} — ${total}`,
      body:
        `Hi ${invoice.clientName},\n\n` +
        `Just a friendly reminder that invoice ${invoice.number} for ${total} is ${dueStatus(invoice)}. ` +
        `A copy of the invoice is attached for your reference.\n\n` +
        `Total: ${total}\n` +
        `Due: ${formatDateLong(invoice.dueDate)}\n` +
        payLine(invoice) +
        `\nThanks,\n${fromName}\n`,
    };
  }
  return {
    subject: `Invoice ${invoice.number} — ${total}`,
    body:
      `Hi ${invoice.clientName},\n\n` +
      `Please find your invoice (${invoice.number}) attached.\n\n` +
      `Total: ${total}\n` +
      `Due: ${formatDateLong(invoice.dueDate)}\n` +
      payLine(invoice) +
      `\nThanks,\n${fromName}\n`,
  };
}

export async function emailInvoice(
  invoice: Invoice,
  fromName: string,
  mode: EmailMode = 'initial',
  options: { showPoweredBy?: boolean } = {},
): Promise<EmailInvoiceResult> {
  if (!invoice.clientEmail) return { ok: false, reason: 'no-recipient' };
  const available = await MailComposer.isAvailableAsync();
  if (!available) return { ok: false, reason: 'unavailable' };

  const pdfUri = await generateInvoicePdf(invoice, fromName, options);
  const { subject, body } = buildEmailFields(invoice, fromName, mode);

  const result = await MailComposer.composeAsync({
    recipients: [invoice.clientEmail],
    subject,
    body,
    attachments: [pdfUri],
  });
  return { ok: true, status: result.status };
}

export async function shareInvoicePdf(
  invoice: Invoice,
  fromName: string,
  mode: EmailMode = 'initial',
  options: { showPoweredBy?: boolean } = {},
): Promise<ShareInvoiceResult> {
  if (!invoice.clientEmail) return { ok: false, reason: 'no-recipient' };
  const pdfUri = await generateInvoicePdf(invoice, fromName, options);
  const { subject, body } = buildEmailFields(invoice, fromName, mode);
  // iOS: `url` attaches the file. `message` is included in apps that support it
  // (Mail uses it as body; many apps show the subject line). Apps that only
  // accept attachments will just receive the PDF.
  const result = await Share.share({
    url: pdfUri,
    message: `${subject}\n\n${body}`,
    title: subject,
  });
  return { ok: true, action: result.activityType ?? undefined };
}
