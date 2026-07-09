const fs = require('fs');
const path = require('path');

const indexHtml = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexHtml, 'utf-8');

// 1. PWA Manifest
if (!html.includes('manifest.json')) {
  html = html.replace('<link rel="stylesheet"', '<link rel="manifest" href="manifest.json">\n  <link rel="stylesheet"');
}

// 2. Branding
html = html.replace('<span class="brand-text">DOMPETKU</span>', '<span class="brand-text">DOMPETKU <span style="font-size:10px; opacity:0.7">by Nexyuspay</span></span>');
html = html.replace('<small>DompetKu v1.0</small>', '<small>DompetKu v1.0 by Nexyuspay</small>');

// 3. Firebase Script
if (!html.includes('firebase-manager.js')) {
  html = html.replace('<script src="app.js"></script>', '<script type="module" src="firebase-manager.js"></script>\n  <script src="app.js"></script>');
}

// 4. Receipt Upload Input in Modal
const txDateGroup = `<div class="form-group">
            <label class="form-label">Tanggal</label>
            <input type="date" id="transaction-date" class="form-control" required>
          </div>`;
const receiptInput = `
          <div class="form-group">
            <label class="form-label">Lampiran Struk (Opsional)</label>
            <input type="file" id="transaction-receipt" class="form-control" accept="image/*">
            <small style="color:var(--text-muted);font-size:11px;">Foto otomatis diperkecil agar tidak memenuhi kuota.</small>
          </div>`;
if (!html.includes('transaction-receipt')) {
  html = html.replace(txDateGroup, txDateGroup + '\n' + receiptInput);
}

// 5. Financial Insights on Dashboard
const insightsWidget = `
      <!-- Financial Insights -->
      <div class="report-section" id="financial-insights" style="margin-top:24px; display:none;">
        <h3 class="report-title">💡 WAWASAN FINANSIAL</h3>
        <div class="budget-card" style="background: rgba(255, 192, 0, 0.1); border-color: var(--accent-gold);">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            <div style="font-size:24px;">🤖</div>
            <div id="insights-text" style="font-size:14px; line-height:1.5;">Memuat wawasan...</div>
          </div>
        </div>
      </div>
`;
const summaryCardsEnd = `      </div> <!-- End of summary cards -->`;
if (!html.includes('id="financial-insights"')) {
  // Find the end of summary cards. We'll just insert before the Transaction List in dashboard
  const txListHeader = `<div class="section-header" style="margin-top: 32px;">`;
  html = html.replace(txListHeader, insightsWidget + '\n      ' + txListHeader);
}

// 6. Register Service Worker at the bottom of the body
const swScript = `
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW reg failed', err));
      });
    }
  </script>
</body>`;
if (!html.includes('serviceWorker.register')) {
  html = html.replace('</body>', swScript);
}

fs.writeFileSync(indexHtml, html);
console.log('index.html patched part 2');
