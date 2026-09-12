const fs = require('fs');
const path = require('path');

/* 1. Fix index.html */
const htmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Fix Savings Input
if (html.includes('id="add-savings-amount"')) {
  html = html.replace('id="add-savings-amount"', 'id="add-savings-amount-input"');
}
if (!html.includes('id="add-savings-mode"')) {
  html = html.replace('<input type="hidden" id="add-savings-goal-id">', '<input type="hidden" id="add-savings-goal-id">\n          <input type="hidden" id="add-savings-mode" value="add">');
}

// Add Missing Modals
const modalDebtStr = `
  <!-- MODAL: Debt -->
  <div class="modal-overlay" id="modal-debt" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">TAMBAH CATATAN</h2>
        <button class="btn-icon modal-close" data-modal="modal-debt">✕</button>
      </div>
      <div class="modal-body">
        <form id="form-debt" onsubmit="event.preventDefault();">
          <input type="hidden" id="debt-id">
          <div class="form-group">
            <label class="form-label" for="debt-type">Tipe</label>
            <select class="form-control" id="debt-type" required>
              <option value="debt">Hutang (Saya Berhutang)</option>
              <option value="receivable">Piutang (Orang Berhutang)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="debt-person">Nama Pihak/Orang</label>
            <input type="text" class="form-control" id="debt-person" placeholder="Nama pihak terkait..." required>
          </div>
          <div class="form-group">
            <label class="form-label" for="debt-amount">Jumlah (Rp)</label>
            <input type="number" class="form-control" id="debt-amount" min="0" placeholder="0" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="debt-due-date">Tanggal Jatuh Tempo (Opsional)</label>
            <input type="date" class="form-control" id="debt-due-date">
          </div>
          <div class="form-group">
            <label class="form-label" for="debt-notes">Catatan Tambahan</label>
            <input type="text" class="form-control" id="debt-notes" placeholder="Catatan singkat...">
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost btn-modal-cancel">BATAL</button>
        <button type="submit" form="form-debt" class="btn btn-gold">SIMPAN</button>
      </div>
    </div>
  </div>
`;

const modalBudgetStr = `
  <!-- MODAL: Budget -->
  <div class="modal-overlay" id="modal-budget" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">TAMBAH ANGGARAN</h2>
        <button class="btn-icon modal-close" data-modal="modal-budget">✕</button>
      </div>
      <div class="modal-body">
        <form id="form-budget" onsubmit="event.preventDefault();">
          <div class="form-group">
            <label class="form-label" for="budget-category">Kategori Pengeluaran</label>
            <select class="form-control" id="budget-category" required>
              <!-- Diisi oleh JS -->
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="budget-amount">Batas Maksimal (Rp)</label>
            <input type="number" class="form-control" id="budget-amount" min="0" placeholder="0" required>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost btn-modal-cancel">BATAL</button>
        <button type="submit" form="form-budget" class="btn btn-gold">SIMPAN</button>
      </div>
    </div>
  </div>
`;

if (!html.includes('id="modal-debt"')) {
  // Insert before the last modal (modal-confirm)
  const insertIndex = html.indexOf('<div class="modal-overlay" id="modal-confirm"');
  if (insertIndex !== -1) {
    html = html.substring(0, insertIndex) + modalDebtStr + modalBudgetStr + html.substring(insertIndex);
  }
}

fs.writeFileSync(htmlPath, html);

/* 2. Fix app.js */
const appPath = path.join(__dirname, 'app.js');
let appJs = fs.readFileSync(appPath, 'utf8');

// Override showConfirm globally to use native confirm to bypass modal issues
if (!appJs.includes('App.prototype.showConfirm = function')) {
  appJs += `
// Override showConfirm to use native confirm robustly
App.prototype.showConfirm = function(title, message, onConfirm) {
  if (confirm(message)) {
    onConfirm();
  }
};
`;
  fs.writeFileSync(appPath, appJs);
}

console.log('Final patches applied successfully.');
