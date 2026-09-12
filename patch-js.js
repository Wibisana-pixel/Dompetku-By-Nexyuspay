const fs = require('fs');
const path = require('path');

const appJs = path.join(__dirname, 'app.js');
let js = fs.readFileSync(appJs, 'utf-8');

if (js.includes('class BudgetManager')) {
  console.log('Already patched');
  process.exit(0);
}

const newJs = `
/* ============================================================
   11. BudgetManager — Monthly Budget Limits
   ============================================================ */
class BudgetManager {
  constructor() {
    this.budgets = [];
  }
  setBudget(category, limit) {
    const idx = this.budgets.findIndex(b => b.category === category);
    if (idx !== -1) {
      this.budgets[idx].limit = parseFloat(limit);
    } else {
      this.budgets.push({ category, limit: parseFloat(limit) });
    }
  }
  deleteBudget(category) {
    this.budgets = this.budgets.filter(b => b.category !== category);
  }
}

/* ============================================================
   12. DebtManager — Debts & Receivables
   ============================================================ */
class DebtManager {
  constructor() {
    this.debts = [];
  }
  add(debt) {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      type: debt.type, // 'payable' or 'receivable'
      person: debt.person,
      amount: parseFloat(debt.amount),
      dueDate: debt.dueDate || '',
      isPaid: false,
      createdAt: new Date().toISOString()
    };
    this.debts.push(entry);
    return entry;
  }
  delete(id) {
    this.debts = this.debts.filter(d => d.id !== id);
  }
  markAsPaid(id) {
    const debt = this.debts.find(d => d.id === id);
    if (debt) debt.isPaid = true;
  }
}

/* ============================================================
   13. Monkey-Patch App Class
   ============================================================ */
const originalInit = App.prototype.init;
App.prototype.init = async function() {
  this.budgetManager = new BudgetManager();
  this.debtManager = new DebtManager();
  
  // Safe crypto check
  if (!window.crypto || !window.crypto.subtle) {
    console.warn("Web Crypto API not available. Disabling encryption feature.");
    this.storageManager.encryptionEnabled = false;
    this.storageManager.password = null;
    const isEncrypted = this.storageManager.isEncrypted();
    if (isEncrypted) {
      this.notificationManager.show('Keamanan browser tidak mendukung dekripsi di koneksi HTTP ini.', 'error');
    }
    await this.loadData();
    this._finishInit();
    return;
  }
  
  await originalInit.call(this);
};

const originalLoadData = App.prototype.loadData;
App.prototype.loadData = async function() {
  try {
    await originalLoadData.call(this);
    const data = await this.storageManager.loadAll();
    if (data) {
      this.budgetManager.budgets = data.budgets || [];
      this.debtManager.debts = data.debts || [];
    }
  } catch (err) {
    console.error("Load error:", err);
    throw err;
  }
};

const originalSaveData = App.prototype.saveData;
App.prototype.saveData = async function() {
  const appData = {
    transactions: this.transactionManager.transactions,
    bills: this.billManager.bills,
    savings: this.savingsManager.goals,
    budgets: this.budgetManager.budgets,
    debts: this.debtManager.debts,
    lastSaved: new Date().toISOString()
  };
  try {
    await this.storageManager.saveAll(appData);
  } catch (err) {
    this.notificationManager.show('Gagal menyimpan data: ' + err.message, 'error');
  }
};

const originalSetupEventListeners = App.prototype.setupEventListeners;
App.prototype.setupEventListeners = function() {
  originalSetupEventListeners.call(this);
  
  // Budget
  const btnAddBudget = document.getElementById('btn-add-budget');
  if (btnAddBudget) btnAddBudget.addEventListener('click', () => this.openModal('budget'));
  
  const formBudget = document.getElementById('form-budget');
  if (formBudget) {
    formBudget.addEventListener('submit', (e) => {
      e.preventDefault();
      const cat = document.getElementById('budget-category').value;
      const limit = document.getElementById('budget-limit').value;
      this.budgetManager.setBudget(cat, limit);
      this.notificationManager.show('Anggaran berhasil diset!', 'success');
      this.closeModal('modal-budget');
      this.saveData();
      this.renderBudgetList();
    });
  }

  // Debt
  const btnAddDebt = document.getElementById('btn-add-debt');
  if (btnAddDebt) btnAddDebt.addEventListener('click', () => this.openModal('debt'));
  
  const formDebt = document.getElementById('form-debt');
  if (formDebt) {
    formDebt.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = document.getElementById('debt-type').value;
      const person = document.getElementById('debt-person').value;
      const amount = document.getElementById('debt-amount').value;
      const dueDate = document.getElementById('debt-due').value;
      this.debtManager.add({ type, person, amount, dueDate });
      this.notificationManager.show('Catatan berhasil ditambahkan!', 'success');
      this.closeModal('modal-debt');
      this.saveData();
      this.renderDebtList();
    });
  }

  // Calculator Tabs
  document.querySelectorAll('.calc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.calc-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.calc-content').forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      document.getElementById('calc-' + tab.getAttribute('data-calc')).style.display = 'block';
    });
  });
};

const originalNavigateTo = App.prototype.navigateTo;
App.prototype.navigateTo = function(sectionName) {
  originalNavigateTo.call(this, sectionName);
  if (sectionName === 'budgets') this.renderBudgetList();
  if (sectionName === 'debts') this.renderDebtList();
};

const originalOpenModal = App.prototype.openModal;
App.prototype.openModal = function(type, editId = null) {
  let modalId;
  if (type === 'budget') modalId = 'modal-budget';
  else if (type === 'debt') modalId = 'modal-debt';
  else return originalOpenModal.call(this, type, editId);
  
  const form = document.getElementById('form-' + type);
  if (form) form.reset();
  const overlay = document.getElementById(modalId);
  if (overlay) overlay.classList.add('active');
};

const originalCloseModal = App.prototype.closeModal;
App.prototype.closeModal = function(modalId) {
  originalCloseModal.call(this, modalId);
  const overlay = document.getElementById(modalId);
  if (overlay) overlay.classList.remove('active');
};

App.prototype.renderBudgetList = function() {
  const container = document.getElementById('budget-list');
  if (!container) return;
  
  if (this.budgetManager.budgets.length === 0) {
    container.innerHTML = '<div class="empty-state"><p class="empty-text">Belum ada anggaran yang diatur.</p></div>';
    return;
  }
  
  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  const expenses = this.transactionManager.getCategoryBreakdown(year, month, 'expense');
  
  container.innerHTML = this.budgetManager.budgets.map(b => {
    const expenseData = expenses.find(e => e.category === b.category);
    const current = expenseData ? expenseData.amount : 0;
    const progress = Math.min((current / b.limit) * 100, 100);
    let barClass = 'safe';
    if (progress >= 100) barClass = 'danger';
    else if (progress >= 80) barClass = 'warning';
    
    return \`
      <div class="budget-card">
        <div class="budget-header">
          <div class="budget-category-title">\${b.category}</div>
          <div class="budget-actions">
            <button class="btn-icon" onclick="app.deleteBudget('\${b.category}')" title="Hapus">🗑️</button>
          </div>
        </div>
        <div class="budget-amounts">
          <span>Terpakai: \${this.formatCurrency(current)}</span>
          <span>Batas: \${this.formatCurrency(b.limit)}</span>
        </div>
        <div class="budget-progress-bar">
          <div class="budget-progress-fill \${barClass}" style="width: \${progress}%"></div>
        </div>
        <div class="budget-amounts" style="justify-content: flex-end; font-weight: bold; color: var(--text-primary);">
          \${progress.toFixed(1)}%
        </div>
      </div>
    \`;
  }).join('');
};

App.prototype.deleteBudget = function(cat) {
  this.showConfirm('Hapus Anggaran', 'Yakin hapus anggaran kategori ini?', () => {
    this.budgetManager.deleteBudget(cat);
    this.saveData();
    this.renderBudgetList();
    this.notificationManager.show('Anggaran dihapus', 'success');
  });
};

App.prototype.renderDebtList = function() {
  const container = document.getElementById('debt-list');
  const summary = document.getElementById('debt-summary');
  if (!container || !summary) return;
  
  let totPayable = 0;
  let totReceivable = 0;
  
  this.debtManager.debts.filter(d => !d.isPaid).forEach(d => {
    if (d.type === 'payable') totPayable += d.amount;
    else totReceivable += d.amount;
  });
  
  summary.innerHTML = \`
    <div class="debt-summary-card payable">
      <div style="font-size:12px;color:var(--text-secondary)">Total Harus Dibayar (Hutang)</div>
      <div style="font-size:24px;font-weight:900;color:var(--expense-color);margin-top:8px;">\${this.formatCurrency(totPayable)}</div>
    </div>
    <div class="debt-summary-card receivable">
      <div style="font-size:12px;color:var(--text-secondary)">Total Akan Diterima (Piutang)</div>
      <div style="font-size:24px;font-weight:900;color:var(--income-color);margin-top:8px;">\${this.formatCurrency(totReceivable)}</div>
    </div>
  \`;
  
  const pending = this.debtManager.debts.filter(d => !d.isPaid);
  if (pending.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><p class="empty-text">Tidak ada catatan hutang/piutang aktif.</p></div>';
    return;
  }
  
  container.innerHTML = pending.map(d => {
    const isPay = d.type === 'payable';
    return \`
      <div class="debt-card \${d.type}">
        <div class="debt-header">
          <div class="debt-person">\${d.person}</div>
          <div class="debt-type-badge \${d.type}">\${isPay ? 'HUTANG' : 'PIUTANG'}</div>
        </div>
        <div class="debt-amount">\${this.formatCurrency(d.amount)}</div>
        \${d.dueDate ? \`<div style="font-size:12px;color:var(--text-secondary);">Jatuh Tempo: \${this.formatDate(d.dueDate)}</div>\` : ''}
        <div class="debt-footer">
          <button class="btn-ghost btn-sm" onclick="app.payDebt('\${d.id}')">✓ Tandai Lunas</button>
          <button class="btn-icon" onclick="app.deleteDebt('\${d.id}')" title="Hapus">🗑️</button>
        </div>
      </div>
    \`;
  }).join('');
};

App.prototype.deleteDebt = function(id) {
  this.showConfirm('Hapus', 'Yakin ingin menghapus catatan ini?', () => {
    this.debtManager.delete(id);
    this.saveData();
    this.renderDebtList();
    this.notificationManager.show('Catatan dihapus', 'success');
  });
};

App.prototype.payDebt = function(id) {
  this.showConfirm('Tandai Lunas', 'Tandai catatan ini sebagai sudah lunas?', () => {
    this.debtManager.markAsPaid(id);
    this.saveData();
    this.renderDebtList();
    this.notificationManager.show('Berhasil ditandai lunas', 'success');
  });
};

App.prototype.calcInvestment = function() {
  const p = parseFloat(document.getElementById('calc-inv-principal').value);
  const m = parseFloat(document.getElementById('calc-inv-monthly').value);
  const r = parseFloat(document.getElementById('calc-inv-rate').value) / 100 / 12;
  const t = parseFloat(document.getElementById('calc-inv-years').value) * 12;
  
  if (isNaN(p) || isNaN(m) || isNaN(r) || isNaN(t)) return;
  
  let fv = p * Math.pow(1 + r, t);
  if (r > 0) {
    fv += m * ( (Math.pow(1 + r, t) - 1) / r );
  } else {
    fv += m * t;
  }
  
  document.getElementById('calc-inv-result').innerHTML = \`
    <div class="calc-result-title">Estimasi Nilai Masa Depan</div>
    <div class="calc-result-value">\${this.formatCurrency(fv)}</div>
    <div class="calc-result-detail">
      Total Setoran Pokok: \${this.formatCurrency(p + (m * t))}<br>
      Estimasi Bunga: \${this.formatCurrency(fv - (p + (m * t)))}
    </div>
  \`;
};

App.prototype.calcLoan = function() {
  const p = parseFloat(document.getElementById('calc-loan-principal').value);
  const r = parseFloat(document.getElementById('calc-loan-rate').value) / 100 / 12;
  const n = parseFloat(document.getElementById('calc-loan-months').value);
  
  if (isNaN(p) || isNaN(r) || isNaN(n) || n === 0) return;
  
  let pmt = p;
  if (r > 0) {
    pmt = p * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  } else {
    pmt = p / n;
  }
  
  const totalPay = pmt * n;
  
  document.getElementById('calc-loan-result').innerHTML = \`
    <div class="calc-result-title">Estimasi Cicilan Bulanan</div>
    <div class="calc-result-value">\${this.formatCurrency(pmt)}</div>
    <div class="calc-result-detail">
      Total Pembayaran (Pokok + Bunga): \${this.formatCurrency(totalPay)}<br>
      Total Bunga: \${this.formatCurrency(totalPay - p)}
    </div>
  \`;
};
`;

fs.appendFileSync(appJs, '\n' + newJs);
console.log('app.js patched');
