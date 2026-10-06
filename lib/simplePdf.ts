// A tiny, dependency-free PDF writer for the server (the kick-off and results
// emails). It covers just what the board PDF needs: text in Helvetica / Helvetica
// Bold, font sizes, grey text and extra pages. Using this instead of jsPDF on the
// server means the emails can't break because of how a browser library loads there.

const HELVETICA: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667,
  556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556,
  556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722,
  500, 500, 500, 334, 260, 334, 584,
];
const HELVETICA_BOLD: number[] = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722,
  611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556,
  611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778,
  556, 556, 500, 389, 280, 389, 584,
];

// Characters outside plain ASCII that we use, mapped to their WinAnsi byte and width.
const EXTRA: Record<string, { code: number; width: number }> = {
  "£": { code: 163, width: 556 },
  "—": { code: 151, width: 1000 },
  "–": { code: 150, width: 556 },
  "·": { code: 183, width: 278 },
  "’": { code: 146, width: 222 },
  "‘": { code: 145, width: 222 },
  "é": { code: 233, width: 556 },
  "€": { code: 128, width: 556 },
};

type Font = "normal" | "bold";

export class SimplePdf {
  private pages: string[][] = [[]];
  private font: Font = "normal";
  private size = 12;
  private colour = "0 0 0";
  readonly width = 595.28; // A4 in points
  readonly height = 841.89;

  internal = {
    pageSize: {
      getWidth: () => this.width,
      getHeight: () => this.height,
    },
  };

  // Accepts the same options as jsPDF so the board builder can use either.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_options?: unknown) {}

  setFont(_family: string, style?: string) {
    this.font = style === "bold" ? "bold" : "normal";
    return this;
  }

  setFontSize(size: number) {
    this.size = size;
    return this;
  }

  setTextColor(r: number, g: number, b: number) {
    this.colour = [r, g, b].map((v) => (v / 255).toFixed(3)).join(" ");
    return this;
  }

  addPage() {
    this.pages.push([]);
    return this;
  }

  getTextWidth(text: string): number {
    const table = this.font === "bold" ? HELVETICA_BOLD : HELVETICA;
    let units = 0;
    for (const ch of text) {
      const c = ch.charCodeAt(0);
      if (c >= 32 && c <= 126) units += table[c - 32];
      else units += EXTRA[ch]?.width ?? 556;
    }
    return (units * this.size) / 1000;
  }

  // Coordinates are from the top-left, like jsPDF. Text longer than maxWidth is cut short.
  text(text: string, x: number, y: number, options?: { maxWidth?: number }) {
    let t = text;
    if (options?.maxWidth && this.getTextWidth(t) > options.maxWidth) {
      while (t.length > 1 && this.getTextWidth(t + "...") > options.maxWidth) t = t.slice(0, -1);
      t = t.trimEnd() + "...";
    }
    const fontRef = this.font === "bold" ? "/F2" : "/F1";
    const pdfY = (this.height - y).toFixed(2);
    this.pages[this.pages.length - 1].push(
      `BT ${fontRef} ${this.size} Tf ${this.colour} rg ${x.toFixed(2)} ${pdfY} Td (${encode(t)}) Tj ET`
    );
    return this;
  }

  // Returns the finished PDF file.
  output(_type: "arraybuffer" = "arraybuffer"): ArrayBuffer {
    const objects: string[] = [];
    const add = (body: string) => {
      objects.push(body);
      return objects.length; // object number
    };

    const catalog = add(""); // filled in below
    const pagesObj = add("");
    const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

    const pageRefs: number[] = [];
    for (const content of this.pages) {
      const stream = content.join("\n");
      const contentObj = add(`<< /Length ${latin1Length(stream)} >>\nstream\n${stream}\nendstream`);
      pageRefs.push(
        add(
          `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${this.width} ${this.height}] ` +
            `/Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contentObj} 0 R >>`
        )
      );
    }
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageRefs.map((p) => `${p} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(latin1Length(pdf));
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = latin1Length(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    // Each character in the string is one byte (WinAnsi), so copy them across directly.
    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
    return bytes.buffer;
  }
}

// Turns text into a PDF string: escapes brackets and backslashes, and converts the
// few special characters we use (£, —, ·) to their single-byte WinAnsi codes.
function encode(text: string): string {
  let out = "";
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    let byte: number;
    if (c >= 32 && c <= 126) byte = c;
    else if (EXTRA[ch]) byte = EXTRA[ch].code;
    else byte = 63; // "?"
    const s = String.fromCharCode(byte);
    out += s === "(" || s === ")" || s === "\\" ? `\\${s}` : s;
  }
  return out;
}

function latin1Length(s: string): number {
  return s.length; // every character is a single byte by the time it gets here
}
