declare module "opentype.js" {
  namespace opentype {
    class Path {
      commands: any[];
      moveTo(x: number, y: number): void;
      lineTo(x: number, y: number): void;
      closePath(): void;
      toSVG(decimalPlaces?: number): string;
    }

    class Glyph {
      name: string;
      unicode: number | undefined;
      advanceWidth: number;
      path: Path;
      constructor(options: {
        name: string;
        unicode?: number;
        advanceWidth: number;
        path: Path;
      });
    }

    class Font {
      names: any;
      unitsPerEm: number;
      ascender: number;
      descender: number;
      glyphs: { length: number; get(index: number): Glyph };
      substitution: {
        add(feature: string, rule: any): void;
      };
      charToGlyphIndex(codepoint: string | number): number;
      toArrayBuffer(): ArrayBuffer;
      download(fileName?: string): void;

      constructor(options: {
        familyName: string;
        styleName: string;
        unitsPerEm: number;
        ascender: number;
        descender: number;
        glyphs: Glyph[];
      });
    }

    function parse(buffer: ArrayBuffer): Font;
    function load(url: string, callback: (err: any, font: Font) => void): void;
  }

  export default opentype;
}

declare module "wawoff2" {
  const wawoff2: {
    compress(input: Buffer | Uint8Array): Promise<Buffer>;
    decompress(input: Buffer | Uint8Array): Promise<Buffer>;
  };
  export default wawoff2;
}
