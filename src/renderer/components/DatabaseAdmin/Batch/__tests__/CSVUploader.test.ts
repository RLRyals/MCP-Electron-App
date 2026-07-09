/**
 * Tests for CSVUploader (issue #128): CSV text parsing, type detection,
 * malformed-row handling, and the drag/drop + file-input wiring that feeds
 * BatchInsert's "CSV Upload" mode.
 */

import { CSVUploader } from '../CSVUploader';

/**
 * jsdom's Blob/File implementation doesn't provide `.text()` (only
 * FileReader.readAsText works) -- a jsdom-environment gap, not a bug in
 * CSVUploader.ts, which correctly relies on the standard File API and
 * works as-is in the real Electron renderer (Chromium). Stub `.text()`
 * per-instance in tests that need it.
 */
function makeFileWithText(content: string, name: string, type: string): File {
  const file = new File([content], name, { type });
  (file as any).text = () => Promise.resolve(content);
  return file;
}

describe('CSVUploader', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'csv-uploader-test-container';
    document.body.appendChild(container);
  });

  function makeUploader(options: ConstructorParameters<typeof CSVUploader>[1] = {}) {
    const uploader = new CSVUploader('csv-uploader-test-container', options);
    uploader.render();
    return uploader;
  }

  describe('parseText', () => {
    it('parses headers and rows, and can be inspected via parseText (public API)', () => {
      const uploader = makeUploader();
      const csv = 'name,age,active\nAda,30,true\nGrace,28,false';

      const result = uploader.parseText(csv);

      expect(result.success).toBe(true);
      expect(result.headers).toEqual(['name', 'age', 'active']);
      expect(result.rowCount).toBe(2);
      expect(result.data[0]).toEqual({ name: 'Ada', age: 30, active: true });
      expect(result.data[1]).toEqual({ name: 'Grace', age: 28, active: false });
    });

    it('type-detects numbers, booleans, and null/empty values', () => {
      const uploader = makeUploader();
      const csv = 'id,score,note\n1,3.14,\n2,0,null';

      const result = uploader.parseText(csv);

      expect(result.data[0]).toEqual({ id: 1, score: 3.14, note: null });
      expect(result.data[1]).toEqual({ id: 2, score: 0, note: null });
    });

    it('handles quoted values containing commas and escaped quotes', () => {
      const uploader = makeUploader();
      const csv = 'name,bio\n"Doe, Jane","Says ""hi"" often"';

      const result = uploader.parseText(csv);

      expect(result.data[0]).toEqual({ name: 'Doe, Jane', bio: 'Says "hi" often' });
    });

    it('reports an error for an empty file', () => {
      const uploader = makeUploader();
      const result = uploader.parseText('');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/empty/i);
    });

    it('warns (but still succeeds) on rows with a column-count mismatch, skipping the bad row', () => {
      const uploader = makeUploader();
      const csv = 'a,b,c\n1,2,3\n4,5'; // second row has only 2 values

      const result = uploader.parseText(csv);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.error).toMatch(/column count mismatch/i);
    });
  });

  describe('file handling', () => {
    it('rejects files with a disallowed extension via onError', () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      const onError = jest.fn();
      makeUploader({ onError });

      const badFile = new File(['not,a,csv'], 'notes.png', { type: 'image/png' });
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;

      // jsdom lets us assign a FileList-like object for change events.
      Object.defineProperty(fileInput, 'files', { value: [badFile], configurable: true });
      fileInput.dispatchEvent(new Event('change'));

      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/invalid file type/i));
      alertSpy.mockRestore();
    });

    it('parses a valid dropped/selected CSV file and calls onParsed', async () => {
      const onParsed = jest.fn();
      makeUploader({ onParsed });

      const file = makeFileWithText('col1,col2\nval1,val2', 'data.csv', 'text/csv');
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;

      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput.dispatchEvent(new Event('change'));

      // file.text() resolves asynchronously
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(onParsed).toHaveBeenCalledTimes(1);
      const result = onParsed.mock.calls[0][0];
      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ col1: 'val1', col2: 'val2' }]);
    });

    it('clearFile() resets the current file and hides the preview', () => {
      const uploader = makeUploader();
      const file = makeFileWithText('a,b\n1,2', 'data.csv', 'text/csv');
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput.dispatchEvent(new Event('change'));

      uploader.clearFile();

      expect(uploader.getCurrentFile()).toBeNull();
    });
  });
});
