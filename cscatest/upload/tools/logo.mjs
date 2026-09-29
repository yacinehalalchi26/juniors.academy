// CSCA Test brand.
// The logo is the wordmark itself: "CSCA" bold + "Test" regular, set in Bricolage Grotesque.
// There is no pictorial mark. Where a square icon is unavoidable (favicon, phone home
// screens, email clients that block SVG), the name is stacked two-by-two on a purple tile.
export const GOLD = '#FFCB3E';
export const CORAL = '#FB836F';
export const MAGENTA = '#C1549C';
export const PURPLE = '#7E549F';
export const PURPLE_DEEP = '#6B4189';
export const INK = '#2A1F33';

/** The logo. Rendered as text so it stays crisp at any size and matches the page font. */
export const wordmark = () => '<span class="wordmark">CSCA<span> Test</span></span>';
export const brand = () => wordmark();

/** Square app icon / favicon: the name stacked, the way it reads on a seal. */
export function tile({ size = 48, bg = PURPLE_DEEP, fg = '#ffffff', className = '' } = {}) {
  return `<svg${className ? ` class="${className}"` : ''} width="${size}" height="${size}" viewBox="0 0 48 48" role="img" aria-label="CSCA Test" xmlns="http://www.w3.org/2000/svg">`
    + `<rect width="48" height="48" rx="10" fill="${bg}"/>`
    + `<g fill="${fg}" font-family="Bricolage Grotesque, Arial, sans-serif" font-weight="700" font-size="17" text-anchor="middle" letter-spacing="-0.5">`
    + `<text x="24" y="22">CS</text><text x="24" y="39">CA</text></g></svg>`;
}

export const favicon = () => tile({ size: 48 });
