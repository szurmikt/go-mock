import { markdownLiteToHtml } from './markdown-lite';

describe('markdownLiteToHtml', () => {
  it('wraps a plain line in a paragraph', () => {
    expect(markdownLiteToHtml('Hello there')).toBe('<p style="margin: 0 0 8px">Hello there</p>');
  });

  it('converts bold and italic markers', () => {
    expect(markdownLiteToHtml('**bold** and *italic*')).toBe(
      '<p style="margin: 0 0 8px"><strong style="font-weight: 800; color: var(--ink)">bold</strong> and <em>italic</em></p>',
    );
  });

  it('groups consecutive bullet lines into one list', () => {
    const html = markdownLiteToHtml('- one\n- two\n- three');
    expect(html).toBe(
      '<ul style="margin: 4px 0 8px; padding-left: 20px">' +
        '<li style="margin-bottom: 4px">one</li>' +
        '<li style="margin-bottom: 4px">two</li>' +
        '<li style="margin-bottom: 4px">three</li>' +
        '</ul>',
    );
  });

  it('mixes paragraphs and bullet lists in order', () => {
    const html = markdownLiteToHtml('Intro line\n- one\n- two\nOutro line');
    expect(html).toBe(
      '<p style="margin: 0 0 8px">Intro line</p>' +
        '<ul style="margin: 4px 0 8px; padding-left: 20px">' +
        '<li style="margin-bottom: 4px">one</li>' +
        '<li style="margin-bottom: 4px">two</li>' +
        '</ul>' +
        '<p style="margin: 0 0 8px">Outro line</p>',
    );
  });

  it('escapes HTML special characters before applying markup', () => {
    expect(markdownLiteToHtml('5 < 10 & **bold**')).toBe(
      '<p style="margin: 0 0 8px">5 &lt; 10 &amp; <strong style="font-weight: 800; color: var(--ink)">bold</strong></p>',
    );
  });

  it('ignores blank lines between blocks', () => {
    const html = markdownLiteToHtml('- one\n\n- two');
    expect(html).toBe(
      '<ul style="margin: 4px 0 8px; padding-left: 20px"><li style="margin-bottom: 4px">one</li></ul>' +
        '<ul style="margin: 4px 0 8px; padding-left: 20px"><li style="margin-bottom: 4px">two</li></ul>',
    );
  });

  it('returns an empty string for empty input', () => {
    expect(markdownLiteToHtml('')).toBe('');
  });
});
