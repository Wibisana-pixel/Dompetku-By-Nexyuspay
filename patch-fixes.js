const fs = require('fs');
const path = require('path');

/* -- 1. Fix CSS -- */
const cssPath = path.join(__dirname, 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');

if (!css.includes('max-width: 100vw;')) {
  css = css.replace('body {', 'body {\n  max-width: 100vw;\n  overflow-x: hidden;\n');
  css += `
.app-container {
  max-width: 100vw;
  overflow-x: hidden;
  box-sizing: border-box;
}
.table-wrapper {
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
* {
  box-sizing: border-box;
}
`;
  fs.writeFileSync(cssPath, css);
}

/* -- 2. Add File Input in HTML -- */
const htmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

if (!html.includes('tx-receipt')) {
  // Try to find the Date input in modal-transaction
  const searchStr = '<label class="form-label">Tanggal</label>';
  const index = html.indexOf(searchStr);
  
  if (index !== -1) {
    // Find the opening of the form-group for Date
    const fgIndex = html.lastIndexOf('<div class="form-group">', index);
    if (fgIndex !== -1) {
      const injection = `
              <div class="form-group">
                <label class="form-label">Upload Foto/Struk (Opsional)</label>
                <input type="file" id="tx-receipt" class="form-control" accept="image/*">
              </div>
      `;
      html = html.substring(0, fgIndex) + injection + html.substring(fgIndex);
      fs.writeFileSync(htmlPath, html);
    }
  }
}

/* -- 3. Fix deleteTransaction in app.js -- */
const appPath = path.join(__dirname, 'app.js');
let appJs = fs.readFileSync(appPath, 'utf8');

if (!appJs.includes('App.prototype.deleteTransaction = function(id) {')) {
  appJs += `
// Override deleteTransaction to be robust
App.prototype.deleteTransaction = function(id) {
  if (confirm('Yakin ingin menghapus transaksi ini?')) {
    const success = this.transactionManager.delete(id);
    if (!success) {
      this.notificationManager.show('Gagal menemukan data transaksi di memori', 'error');
      return;
    }
    
    // Save locally/cloud immediately, but don't block UI refresh
    this.saveData().catch(e => console.error(e));
    
    // Refresh UI
    this.updateDashboard();
    if (typeof this.updateCharts === 'function') this.updateCharts();
    this.renderTransactionList();
    this.renderRecentTransactions();
    this._populateMonthFilter();
    
    this.notificationManager.show('Transaksi berhasil dihapus', 'info');
  }
};
`;
  fs.writeFileSync(appPath, appJs);
}

console.log("Patched successfully");
