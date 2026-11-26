export const themeDefaultTokens = Object.freeze({
  colors: Object.freeze({
    primary: '#d93645',
    secondary: '#fff1f2',
    accent: '#d93645',
    background: '#f7f9f8',
    surface: '#ffffff',
    text: '#17241f',
    textMuted: '#74817b',
    border: '#e8edea',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
  }),
  typography: Object.freeze({
    headingFont: 'Inter',
    bodyFont: 'Inter',
    headingWeight: 700,
    bodyWeight: 400,
    baseSize: '14px',
    headingScale: 1.25,
  }),
  layout: Object.freeze({
    public: Object.freeze({
      header: 'modern',
      hero: 'split',
      footer: 'multi-column',
    }),
    dashboard: Object.freeze({
      sidebar: 'left',
      sidebarStyle: 'expanded',
      header: 'topbar',
      contentWidth: 'fluid',
    }),
  }),
});

