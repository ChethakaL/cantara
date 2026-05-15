/**
 * Shared Cantara logo + wordmark for branded PDF/HTML cover pages.
 * Used by generate-report-html, teaser, CIM, and other standalone document generators.
 */

/** CSS for the logo + wordmark block (include inside document `<style>`). */
export const CANTARA_COVER_BRAND_CSS = `
  .cover-brand-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    width: 100%;
  }
  .cover img.cantara-logo {
    height: 32px;
    margin-bottom: 24px;
    filter: brightness(1.1);
  }
  .cover .cantara-brand-text {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 5px;
    color: #CAA15F;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .cover .cantara-brand-sub {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #64748b;
    font-weight: 600;
  }
`

/** HTML: logo image + "Cantara" + "Pet Business Advisors" */
export function buildCantaraCoverBrandHtml(): string {
  return `<div class="cover-brand-block">
    <img class="cantara-logo" src="/brand/logo-wordmark-dark.svg" alt="Cantara" onerror="this.style.display='none'" />
    <div class="cantara-brand-text">Cantara</div>
    <div class="cantara-brand-sub">Pet Business Advisors</div>
  </div>`
}
