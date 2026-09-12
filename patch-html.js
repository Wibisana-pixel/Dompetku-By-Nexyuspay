const fs = require('fs');
const path = require('path');

const indexHtml = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexHtml, 'utf-8');

// Add onsubmit="event.preventDefault();" to all forms
html = html.replace(/<form\b([^>]*)>/g, (match, p1) => {
  if (!p1.includes('onsubmit')) {
    return `<form${p1} onsubmit="event.preventDefault();">`;
  }
  return match;
});

// Add Sidebar Menus
const navAnchor = `      <a href="#" data-section="reports" aria-label="Laporan">`;
const newNavs = `
      <a href="#" data-section="budgets" aria-label="Anggaran">
        <span class="nav-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
          </svg>
        </span>
        Anggaran
      </a>
      <a href="#" data-section="debts" aria-label="Hutang Piutang">
        <span class="nav-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 10h-4v4h4v-4z"></path>
            <path d="M12 2v20"></path>
            <path d="M5 10h4v4H5v-4z"></path>
          </svg>
        </span>
        Hutang/Piutang
      </a>
      <a href="#" data-section="calculator" aria-label="Kalkulator">
        <span class="nav-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
            <line x1="8" y1="6" x2="16" y2="6"></line>
            <line x1="16" y1="10" x2="16" y2="10.01"></line>
            <line x1="12" y1="10" x2="12" y2="10.01"></line>
            <line x1="8" y1="10" x2="8" y2="10.01"></line>
            <line x1="8" y1="14" x2="8" y2="14.01"></line>
            <line x1="12" y1="14" x2="12" y2="14.01"></line>
            <line x1="16" y1="14" x2="16" y2="14.01"></line>
            <line x1="8" y1="18" x2="8" y2="18.01"></line>
            <line x1="12" y1="18" x2="12" y2="18.01"></line>
            <line x1="16" y1="18" x2="16" y2="18.01"></line>
          </svg>
        </span>
        Kalkulator
      </a>
`;
if (!html.includes('data-section="budgets"')) {
  html = html.replace(navAnchor, newNavs + navAnchor);
}

// Add Sections
const sectionAnchor = `    <!-- ─────────────────────────────────────── -->\n    <!-- SECTION: Reports`;
const newSections = `
    <!-- ─────────────────────────────────────── -->
    <!-- SECTION: Budgets                        -->
    <!-- ─────────────────────────────────────── -->
    <section id="section-budgets" class="section">
      <div class="section-header">
        <h1>BATAS ANGGARAN</h1>
        <div class="header-actions">
          <button class="btn btn-gold" id="btn-add-budget">+ Set Anggaran</button>
        </div>
      </div>
      <div id="budget-list" class="budget-grid">
        <!-- Filled by JS -->
      </div>
    </section>

    <!-- ─────────────────────────────────────── -->
    <!-- SECTION: Debts                          -->
    <!-- ─────────────────────────────────────── -->
    <section id="section-debts" class="section">
      <div class="section-header">
        <h1>HUTANG & PIUTANG</h1>
        <div class="header-actions">
          <button class="btn btn-gold" id="btn-add-debt">+ Tambah Catatan</button>
        </div>
      </div>
      <div id="debt-summary" class="debt-summary">
        <!-- Summary JS -->
      </div>
      <div id="debt-list" class="debt-grid">
        <!-- Filled by JS -->
      </div>
    </section>

    <!-- ─────────────────────────────────────── -->
    <!-- SECTION: Calculator                     -->
    <!-- ─────────────────────────────────────── -->
    <section id="section-calculator" class="section">
      <div class="section-header">
        <h1>KALKULATOR FINANSIAL</h1>
      </div>
      <div class="calculator-container">
        <div class="calc-tabs">
          <button class="calc-tab active" data-calc="investment">Bunga Majemuk</button>
          <button class="calc-tab" data-calc="loan">Cicilan Pinjaman</button>
        </div>
        
        <div id="calc-investment" class="calc-content active">
          <div class="calc-grid">
            <div class="calc-form">
              <div class="form-group">
                <label class="form-label">Modal Awal (Rp)</label>
                <input type="number" id="calc-inv-principal" class="form-control" value="0">
              </div>
              <div class="form-group">
                <label class="form-label">Setoran Bulanan (Rp)</label>
                <input type="number" id="calc-inv-monthly" class="form-control" value="1000000">
              </div>
              <div class="form-group">
                <label class="form-label">Bunga Tahunan (%)</label>
                <input type="number" id="calc-inv-rate" class="form-control" value="6">
              </div>
              <div class="form-group">
                <label class="form-label">Lama Waktu (Tahun)</label>
                <input type="number" id="calc-inv-years" class="form-control" value="5">
              </div>
              <button class="btn btn-gold btn-block" onclick="app.calcInvestment()">Hitung</button>
            </div>
            <div class="calc-result" id="calc-inv-result">
              <!-- Result -->
            </div>
          </div>
        </div>

        <div id="calc-loan" class="calc-content" style="display: none;">
          <div class="calc-grid">
            <div class="calc-form">
              <div class="form-group">
                <label class="form-label">Total Pinjaman (Rp)</label>
                <input type="number" id="calc-loan-principal" class="form-control" value="100000000">
              </div>
              <div class="form-group">
                <label class="form-label">Suku Bunga Tahunan (%)</label>
                <input type="number" id="calc-loan-rate" class="form-control" value="10">
              </div>
              <div class="form-group">
                <label class="form-label">Tenor (Bulan)</label>
                <input type="number" id="calc-loan-months" class="form-control" value="60">
              </div>
              <button class="btn btn-gold btn-block" onclick="app.calcLoan()">Hitung</button>
            </div>
            <div class="calc-result" id="calc-loan-result">
              <!-- Result -->
            </div>
          </div>
        </div>
      </div>
    </section>

`;
if (!html.includes('id="section-budgets"')) {
  html = html.replace(sectionAnchor, newSections + sectionAnchor);
}

// Add modals for Budget and Debt
const modalsAnchor = `  <!-- ═══════════════════════════════════════════ -->\n  <!-- MODALS                                      -->`;
const newModals = `
  <!-- Modal: Budget -->
  <div class="modal-overlay" id="modal-budget">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">Atur Anggaran</h2>
        <button class="btn-icon modal-close">&times;</button>
      </div>
      <form id="form-budget" onsubmit="event.preventDefault();">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <select id="budget-category" class="form-control" required>
              <option value="Makanan">Makanan</option>
              <option value="Transport">Transport</option>
              <option value="Belanja">Belanja</option>
              <option value="Tagihan">Tagihan</option>
              <option value="Hiburan">Hiburan</option>
              <option value="Rumah Tangga">Rumah Tangga</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Batas Anggaran Bulanan (Rp)</label>
            <input type="number" id="budget-limit" class="form-control" required min="1">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost btn-modal-cancel">Batal</button>
          <button type="submit" class="btn btn-gold">Simpan</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal: Debt -->
  <div class="modal-overlay" id="modal-debt">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">Tambah Catatan</h2>
        <button class="btn-icon modal-close">&times;</button>
      </div>
      <form id="form-debt" onsubmit="event.preventDefault();">
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tipe</label>
              <select id="debt-type" class="form-control">
                <option value="payable">Saya Berhutang (Hutang)</option>
                <option value="receivable">Orang Berhutang (Piutang)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Nama Orang</label>
              <input type="text" id="debt-person" class="form-control" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Jumlah (Rp)</label>
            <input type="number" id="debt-amount" class="form-control" required min="1">
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal Jatuh Tempo (Opsional)</label>
            <input type="date" id="debt-due" class="form-control">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost btn-modal-cancel">Batal</button>
          <button type="submit" class="btn btn-gold">Simpan</button>
        </div>
      </form>
    </div>
  </div>
`;
if (!html.includes('id="modal-budget"')) {
  html = html.replace(modalsAnchor, modalsAnchor + '\n' + newModals);
}

fs.writeFileSync(indexHtml, html);
console.log('index.html patched');
