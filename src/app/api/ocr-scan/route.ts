import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, err, getSystemContext } from '@/lib/api'
export async function GET() { const ctx = await getSystemContext(); const scans = await db.ocrScan.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: 'desc' }, select: { id: true, fileName: true, status: true, extractedData: true, entityType: true, entityId: true, createdAt: true } }); return ok({ ocrScans: scans }) }
export async function POST(req: NextRequest) { try { const ctx = await getSystemContext(); const b = await req.json(); if (!b.fileName||!b.fileData) return err('fileName, fileData (base64) required', 422); const scan = await db.ocrScan.create({ data: { organizationId: ctx.organizationId, fileName: b.fileName, mimeType: b.mimeType||'image/png', fileData: b.fileData, status: 'Pending' } }); 
// Try to extract data using Z.AI vision API
try {
  const ZAI = (await import('z-ai-web-dev-sdk')).default;
  const zai = await ZAI.create();
  const imageData = b.fileData.startsWith('data:') ? b.fileData : `data:${b.mimeType||'image/png'};base64,${b.fileData}`;
  const response = await zai.chat.completions.createVision({ messages: [{ role: 'user', content: [{ type: 'text', text: 'Extract invoice data from this image. Return JSON with: vendor, amount, date, invoiceNumber, lineItems (array of {description, quantity, unitPrice}). If not an invoice, return {"error":"not an invoice"}.' }, { type: 'image_url', image_url: { url: imageData } }] }] });
  const extracted = response.choices?.[0]?.message?.content || '';
  await db.ocrScan.update({ where: { id: scan.id }, data: { extractedData: extracted, status: 'Processed' } });
  return ok({ ocrScan: { id: scan.id, fileName: b.fileName, status: 'Processed', extractedData: extracted } }, 201);
} catch (aiError) {
  await db.ocrScan.update({ where: { id: scan.id }, data: { status: 'Failed' } });
  return ok({ ocrScan: { id: scan.id, fileName: b.fileName, status: 'Failed', error: 'OCR extraction failed — saved for manual review' } }, 201);
}
} catch (e) { return err(e instanceof Error?e.message:'Failed', 500) } }
