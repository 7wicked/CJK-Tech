// CSV in and out. Small hand-rolled parser — handles quotes, commas inside
// quotes, and \r\n. Swap in Papa Parse if your exports get exotic.

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Column names people actually use in exported lists. */
const ALIASES = {
  name: ['name', 'full name', 'fullname', 'contact', 'contact name', 'first name'],
  email: ['email', 'email address', 'e-mail', 'work email'],
  phone: ['phone', 'phone number', 'mobile', 'whatsapp', 'contact number'],
  company: ['company', 'organisation', 'organization', 'account', 'company name'],
  title: ['title', 'job title', 'role', 'designation', 'position'],
  notes: ['notes', 'note', 'comment', 'comments'],
};

function mapHeader(header) {
  const clean = header.trim().toLowerCase();
  for (const [field, names] of Object.entries(ALIASES)) {
    if (names.includes(clean)) return field;
  }
  return null;
}

/** CSV text -> lead objects, with anything unrecognised kept in meta. */
export function csvToLeads(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { leads: [], headers: [], unmapped: [] };

  const headers = rows[0];
  const mapped = headers.map(mapHeader);
  const unmapped = headers.filter((h, i) => !mapped[i]);

  const leads = rows.slice(1).map((cells) => {
    const lead = { meta: {} };
    headers.forEach((header, i) => {
      const value = (cells[i] || '').trim();
      if (!value) return;
      const field = mapped[i];
      if (field) lead[field] = value;
      else lead.meta[header.trim().toLowerCase().replace(/\s+/g, '_')] = value;
    });
    lead.source = 'csv';
    return lead;
  });

  return { leads, headers, unmapped };
}

export function leadsToCsv(leads) {
  const cols = ['name', 'email', 'phone', 'company', 'title', 'status', 'source', 'score', 'created_at'];
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...leads.map((l) => cols.map((c) => escape(l[c])).join(','))].join('\n');
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Opens the file picker and resolves with the parsed result. */
export function pickCsvFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ filename: file.name, ...csvToLeads(String(reader.result)) });
      reader.readAsText(file);
    };
    input.click();
  });
}
