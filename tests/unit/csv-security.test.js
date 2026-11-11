import { describe, it, expect } from 'vitest';
import { formatCsvCell } from '../../src/utils/index.js';

describe('Phase 1: Critical CSV and Spreadsheet Security Audit', () => {
  describe('Malicious Formula Injection Attacks', () => {
    it('should neutralize formula execution starting with =', () => {
      const output = formatCsvCell('=CMD|"/C calc"!A0');
      expect(output).toBe('"\'=CMD|""/C calc""!A0"');
      expect(output.startsWith('="')).toBe(false);
      expect(output.startsWith('\'=')).toBe(false); // wrapped in quotes with internal '
    });

    it('should neutralize formula execution starting with +', () => {
      const output = formatCsvCell('+SUM(A1:A100)');
      expect(output).toBe('"\' +SUM(A1:A100)"'.replace(/ /g, ''));
      expect(output.startsWith('="')).toBe(false);
    });

    it('should neutralize formula execution starting with - followed by commands or expressions', () => {
      const output1 = formatCsvCell('-calc');
      expect(output1).toBe('"\' -calc"'.replace(/ /g, ''));

      const output2 = formatCsvCell('-2+5*cmd');
      expect(output2).toBe('"\' -2+5*cmd"'.replace(/ /g, ''));
    });

    it('should neutralize formula execution starting with @', () => {
      const output = formatCsvCell('@SUM(B1:B10)');
      expect(output).toBe('"\'@SUM(B1:B10)"');
      expect(output.startsWith('="')).toBe(false);
    });

    it('should neutralize formula execution starting with tab, carriage return, or line feed', () => {
      const tabOutput = formatCsvCell('\t=cmd');
      expect(tabOutput).toBe('"\'\t=cmd"');

      const crOutput = formatCsvCell('\r=cmd');
      expect(crOutput).toBe('"\'\r=cmd"');

      const lfOutput = formatCsvCell('\n=1+1');
      expect(lfOutput).toBe('"\'\n=1+1"');
    });

    it('should neutralize formula triggers preceded by leading whitespace', () => {
      const spaceEq = formatCsvCell('   =1+1');
      expect(spaceEq).toBe('"\'   =1+1"');

      const spaceAt = formatCsvCell(' \t@SUM(A1)');
      expect(spaceAt).toBe('"\' \t@SUM(A1)"');

      const spaceMinus = formatCsvCell('  -cmd');
      expect(spaceMinus).toBe('"\'  -cmd"');
    });

    it('guarantees that no output ever begins with executable formula prefix ="', () => {
      const dangerousInputs = [
        '=1+1',
        '+1+1',
        '-cmd',
        '@calc',
        '0550112233',
        '0012345678',
        '123456789012345',
        '="malicious"',
        '\t=SUM(A1)'
      ];

      for (const input of dangerousInputs) {
        const result = formatCsvCell(input);
        expect(result.startsWith('="')).toBe(false);
      }
    });
  });

  describe('Legitimate Data Preservation and Escaping', () => {
    it('should safely preserve Algerian telephone numbers without leading zero truncation', () => {
      const phone = '0550112233';
      const output = formatCsvCell(phone);
      expect(output).toBe('"\'0550112233"');
      // Contains the single quote text escape to preserve leading 0 in Excel/LibreOffice
      expect(output).toContain('0550112233');
    });

    it('should safely preserve multiple leading zeros in identifiers', () => {
      const multiZero = '0012345678';
      const output = formatCsvCell(multiZero);
      expect(output).toBe('"\'0012345678"');
    });

    it('should safely preserve 15-digit national tax identifiers (NIF/NIS/R.C.)', () => {
      const nif = '000216001234567';
      const output = formatCsvCell(nif);
      expect(output).toBe('"\'000216001234567"');

      const longId = '123456789012345';
      const outputLong = formatCsvCell(longId);
      expect(outputLong).toBe('"\'123456789012345"');
    });

    it('should correctly format Arabic business names and text', () => {
      const arabicName = 'مؤسسة بروجيليك الجزائر للبرمجيات';
      const output = formatCsvCell(arabicName);
      expect(output).toBe('"مؤسسة بروجيليك الجزائر للبرمجيات"');
    });

    it('should correctly format French corporate names with accents', () => {
      const frenchName = 'SARL PROGILIC ÉQUIPEMENT & FRÈRES';
      const output = formatCsvCell(frenchName);
      expect(output).toBe('"SARL PROGILIC ÉQUIPEMENT & FRÈRES"');
    });

    it('should escape internal double-quotes according to RFC 4180', () => {
      const quoted = 'Client "Alpha" Premium';
      const output = formatCsvCell(quoted);
      expect(output).toBe('"Client ""Alpha"" Premium"');
    });

    it('should correctly preserve commas and semicolons inside quotes', () => {
      const address = 'Rue Didouche Mourad, Alger Centre; BP 16000';
      const output = formatCsvCell(address);
      expect(output).toBe('"Rue Didouche Mourad, Alger Centre; BP 16000"');
    });

    it('should correctly preserve embedded line breaks inside RFC 4180 quoted string', () => {
      const multiLine = 'Ligne 1\nLigne 2\r\nLigne 3';
      const output = formatCsvCell(multiLine);
      expect(output).toContain('Ligne 1\nLigne 2\r\nLigne 3');
      expect(output.startsWith('"')).toBe(true);
      expect(output.endsWith('"')).toBe(true);
    });

    it('should allow legitimate clean negative and positive numbers as numbers', () => {
      expect(formatCsvCell('-15')).toBe('"-15"');
      expect(formatCsvCell('+42.50')).toBe('"+42.50"');
      expect(formatCsvCell('0')).toBe('"0"');
      expect(formatCsvCell(100)).toBe('"100"');
    });

    it('should handle null, undefined, and empty string gracefully', () => {
      expect(formatCsvCell(null)).toBe('""');
      expect(formatCsvCell(undefined)).toBe('""');
      expect(formatCsvCell('')).toBe('""');
    });
  });
});
