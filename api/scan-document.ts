import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleAuth } from 'google-auth-library';

interface ScanRequest {
  file: string;
  mimeType: string;
}

interface ExtractedFields {
  container_no: string | null;
  size: string | null;
  shipping_line: string | null;
  agent_name: string | null;
  consignee: string | null;
  bl_no: string | null;
  vessel_voyage: string | null;
  eta: string | null;
  destination: string | null;
  detention_validity: string | null;
  release_date: string | null;
}

function extractDate(text: string): string | null {
  const datePatterns = [
    /(\d{4})[-/](\d{2})[-/](\d{2})/,
    /(\d{2})[-/](\d{2})[-/](\d{4})/,
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern === datePatterns[0]) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      } else if (pattern === datePatterns[1]) {
        const day = match[1].length === 1 ? `0${match[1]}` : match[1];
        const month = match[2].length === 1 ? `0${match[2]}` : match[2];
        return `${match[3]}-${month}-${day}`;
      } else {
        const months: Record<string, string> = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        };
        const month = months[match[2].toLowerCase().slice(0, 3)];
        const day = match[1].length === 1 ? `0${match[1]}` : match[1];
        return `${match[3]}-${month}-${day}`;
      }
    }
  }
  return null;
}

function extractFields(fullText: string): ExtractedFields {
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
  const textUpper = fullText.toUpperCase();

  const findValueAfter = (patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      for (let i = 0; i < lines.length; i++) {
        const lineUpper = lines[i].toUpperCase();
        const match = lineUpper.match(pattern);
        if (match) {
          const value = lineUpper.replace(pattern, '').replace(/^[:\s]+/, '').trim();
          if (value) return value;
          if (i + 1 < lines.length && lines[i + 1].length > 0 && lines[i + 1].length < 100) {
            return lines[i + 1].trim();
          }
        }
      }
    }
    return null;
  };

  // Container No
  const containerNo = findValueAfter([
    /CONTAINER\s*NO\.?\s*:?\s*/,
    /CONTAINER\s*NUMBER\s*:?\s*/,
  ]);

  // Size — look for patterns like HC40, 20GP, 40GP, 40HC, 20HC
  let size: string | null = null;
  const sizeMatch = fullText.match(/\b(20|40|45)\s*(GP|HC|DC|RF|OT|FR|TK|PW)\b/i);
  if (sizeMatch) {
    size = `${sizeMatch[1]}${sizeMatch[2].toUpperCase()}`;
  } else {
    const hcMatch = fullText.match(/\bHC\s*(20|40|45)\b/i) || fullText.match(/\b(20|40|45)\s*HC\b/i);
    if (hcMatch) size = `${hcMatch[1]}HC`;
  }
  if (!size) {
    size = findValueAfter([/SIZE\s*:?\s*/]);
  }

  // Shipping Line / Carrier
  const shippingLine = findValueAfter([
    /SHIPPING\s*LINE\s*:?\s*/,
    /CARRIER\s*:?\s*/,
  ]);

  // Agent / C&F Agent
  const agentName = findValueAfter([
    /C\s*&\s*F\s*AGENT\s*:?\s*/,
    /C\s*AND\s*F\s*AGENT\s*:?\s*/,
    /AGENT\s*:?\s*/,
  ]);

  // Consignee
  const consignee = findValueAfter([
    /CONSIGNEE\s*:?\s*/,
  ]);

  // B/L No
  const blNo = findValueAfter([
    /B\s*\/\s*L\s*NO\.?\s*:?\s*/,
    /BL\s*NO\.?\s*:?\s*/,
    /BILL\s*OF\s*LADING\s*NO\.?\s*:?\s*/,
  ]);

  // Vessel / Vessel/Voy
  const vesselVoyage = findValueAfter([
    /VESSEL\s*\/\s*VOY\.?\s*:?\s*/,
    /VESSEL\s*VOY\.?\s*:?\s*/,
    /VESSEL\s*:?\s*/,
  ]);

  // ETA — look for "ETA" followed by a date
  let eta: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const lineUpper = lines[i].toUpperCase();
    if (lineUpper.match(/ETA\s*:?\s*/)) {
      const afterEta = lineUpper.replace(/ETA\s*:?\s*/, '').trim();
      if (afterEta) {
        eta = extractDate(afterEta);
        if (eta) break;
      }
      if (i + 1 < lines.length) {
        eta = extractDate(lines[i + 1]);
        if (eta) break;
      }
    }
  }

  // Destination
  const destination = findValueAfter([
    /DESTINATION\s*:?\s*/,
    /PORT\s*OF\s*DISCHARGE\s*:?\s*/,
  ]);

  // Detention — look for "Detention" followed by a date
  let detentionValidity: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const lineUpper = lines[i].toUpperCase();
    if (lineUpper.match(/DETENTION\s*:?\s*/)) {
      const afterDet = lineUpper.replace(/DETENTION\s*:?\s*/, '').trim();
      if (afterDet) {
        detentionValidity = extractDate(afterDet);
        if (detentionValidity) break;
      }
      if (i + 1 < lines.length) {
        detentionValidity = extractDate(lines[i + 1]);
        if (detentionValidity) break;
      }
    }
  }

  // Release Date — "Date" at top of document (first 10 lines)
  let releaseDate: string | null = null;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const lineUpper = lines[i].toUpperCase();
    if (lineUpper.match(/^DATE\s*:?\s*/) || lineUpper.match(/\bDATE\s*:?\s/)) {
      const afterDate = lineUpper.replace(/.*DATE\s*:?\s*/, '').trim();
      if (afterDate) {
        releaseDate = extractDate(afterDate);
        if (releaseDate) break;
      }
      if (i + 1 < lines.length) {
        releaseDate = extractDate(lines[i + 1]);
        if (releaseDate) break;
      }
    }
  }

  return {
    container_no: containerNo,
    size,
    shipping_line: shippingLine,
    agent_name: agentName,
    consignee,
    bl_no: blNo,
    vessel_voyage: vesselVoyage,
    eta,
    destination,
    detention_validity: detentionValidity,
    release_date: releaseDate,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file, mimeType } = req.body as ScanRequest;

    if (!file || !mimeType) {
      return res.status(400).json({ error: 'Missing file or mimeType in request body' });
    }

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const processorId = process.env.GOOGLE_DOC_AI_PROCESSOR_ID;
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    if (!projectId || !processorId || !credentialsJson) {
      return res.status(500).json({ error: 'Google Document AI credentials not configured' });
    }

    const credentials = JSON.parse(credentialsJson);

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const endpoint = `https://documentai.googleapis.com/v1/projects/${projectId}/locations/eu/processors/${processorId}:process`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rawDocument: {
          content: file,
          mimeType: mimeType,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Document AI API error:', response.status, errorText);
      return res.status(502).json({ error: `Document AI request failed (${response.status})` });
    }

    const data = await response.json();

    // Extract text from the response
    let fullText = '';
    if (data.document?.text) {
      fullText = data.document.text;
    } else if (data.document?.pages) {
      for (const page of data.document.pages) {
        if (page?.lines) {
          for (const line of page.lines) {
            if (line?.layout?.textAnchor?.contentSegments) {
              for (const seg of line.layout.textAnchor.contentSegments) {
                fullText += seg.content || '';
              }
              fullText += '\n';
            }
          }
        }
      }
    }

    const extractedFields = extractFields(fullText);

    return res.status(200).json(extractedFields);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('Scan document error:', message);
    return res.status(500).json({ error: message });
  }
}
