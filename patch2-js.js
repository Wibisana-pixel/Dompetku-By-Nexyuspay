const fs = require('fs');
const path = require('path');

const appJs = path.join(__dirname, 'app.js');
let js = fs.readFileSync(appJs, 'utf-8');

if (js.includes('compressImage')) {
  console.log('Already patched');
  process.exit(0);
}

const newJs = `
/* ============================================================
   14. Insights & Firebase Patch
   ============================================================ */
App.prototype.compressImage = function(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

// Override saveData to use Firebase if available
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
    if (window.FirebaseManager) {
      await window.FirebaseManager.saveData(appData);
    } else {
      await this.storageManager.saveAll(appData);
    }
  } catch (err) {
    this.notificationManager.show('Gagal menyimpan data: ' + err.message, 'error');
  }
};

// Override loadData to use Firebase if available
const prevLoadData = App.prototype.loadData;
App.prototype.loadData = async function() {
  try {
    let data = null;
    if (window.FirebaseManager) {
      data = await window.FirebaseManager.loadData();
    }
    // Fallback to local storage if firebase returns null or errors
    if (!data) {
      data = await this.storageManager.loadAll();
    }
    
    if (data) {
      this.transactionManager.transactions = data.transactions || [];
      this.billManager.bills = data.bills || [];
      this.savingsManager.goals = data.savings || [];
      this.budgetManager.budgets = data.budgets || [];
      this.debtManager.debts = data.debts || [];
    }
  } catch (err) {
    console.error("Load error:", err);
  }
};

// Override saveTransaction to handle receipt upload
App.prototype.saveTransaction = async function() {
  const type = document.getElementById('transaction-type')?.value;
  const category = document.getElementById('transaction-category')?.value;
  const amount = document.getElementById('transaction-amount')?.value;
  const description = document.getElementById('transaction-description')?.value || '';
  const date = document.getElementById('transaction-date')?.value;
  const receiptInput = document.getElementById('transaction-receipt');

  if (!type || !category || !amount || !date) {
    this.notificationManager.show('Semua kolom wajib diisi!', 'error');
    return;
  }

  let receiptUrl = null;
  if (receiptInput && receiptInput.files && receiptInput.files[0]) {
    try {
      this.notificationManager.show('Mengompresi dan mengunggah struk...', 'info', 0);
      const file = receiptInput.files[0];
      const base64 = await this.compressImage(file);
      const filename = Date.now() + '_' + file.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      receiptUrl = await window.FirebaseManager.uploadImage(base64, filename);
      document.querySelector('.toast.toast-info .toast-close')?.click();
    } catch (e) {
      document.querySelector('.toast.toast-info .toast-close')?.click();
      this.notificationManager.show('Gagal mengunggah struk', 'error');
      return;
    }
  }

  const editId = document.getElementById('transaction-id')?.value;
  
  if (editId) {
    const tx = this.transactionManager.transactions.find(t => t.id === editId);
    if (tx) {
      tx.type = type;
      tx.category = category;
      tx.amount = parseFloat(amount);
      tx.description = description;
      tx.date = date;
      if (receiptUrl) tx.receiptUrl = receiptUrl;
      this.notificationManager.show('Transaksi berhasil diubah!', 'success');
    }
  } else {
    const newTx = { type, category, amount: parseFloat(amount), description, date };
    if (receiptUrl) newTx.receiptUrl = receiptUrl;
    this.transactionManager.add(newTx);
    this.notificationManager.show('Transaksi berhasil ditambahkan!', 'success');
  }

  this.closeModal('modal-transaction');
  this.saveData();
  this.updateDashboard();
  this.updateCharts();
  this.renderTransactionList();
  this._populateMonthFilter();
  
  if (receiptInput) receiptInput.value = '';
};

// Override renderTransactionList to show receipt link
const prevRenderTransactionList = App.prototype.renderTransactionList;
App.prototype.renderTransactionList = function() {
  prevRenderTransactionList.call(this);
  // Add receipt icons manually via DOM manipulation since the HTML string is already inserted
  const list = document.getElementById('transaction-list');
  if (!list) return;
  
  const txs = Array.from(list.children);
  const dataTxs = this.transactionManager.transactions.sort((a,b) => new Date(b.date) - new Date(a.date));
  
  // This is a naive injection, finding the description element
  txs.forEach(el => {
    const editBtn = el.querySelector('.btn-edit');
    if (!editBtn) return;
    // Extract ID from onclick="app.editTransaction('ID')"
    const match = editBtn.getAttribute('onclick').match(/'([^']+)'/);
    if (match) {
      const id = match[1];
      const tx = dataTxs.find(t => t.id === id);
      if (tx && tx.receiptUrl) {
        const infoDiv = el.querySelector('.list-item-info');
        if (infoDiv) {
          const badge = document.createElement('a');
          badge.href = tx.receiptUrl;
          badge.target = "_blank";
          badge.innerHTML = " 📎 Struk";
          badge.style.fontSize = "10px";
          badge.style.color = "var(--accent-cyan)";
          badge.style.textDecoration = "none";
          badge.style.marginLeft = "8px";
          infoDiv.appendChild(badge);
        }
      }
    }
  });
};

// Generate Insights on Dashboard Update
const prevUpdateDashboard = App.prototype.updateDashboard;
App.prototype.updateDashboard = function() {
  prevUpdateDashboard.call(this);
  this.generateInsights();
};

App.prototype.generateInsights = function() {
  const container = document.getElementById('financial-insights');
  const textEl = document.getElementById('insights-text');
  if (!container || !textEl) return;
  
  const now = new Date();
  const past7Days = new Date();
  past7Days.setDate(now.getDate() - 7);
  
  const recentTxs = this.transactionManager.transactions.filter(t => {
    const d = new Date(t.date);
    return t.type === 'expense' && d >= past7Days && d <= now;
  });
  
  let total7Days = 0;
  recentTxs.forEach(t => total7Days += t.amount);
  
  let insightText = "";
  
  if (total7Days > 0) {
    insightText = \`Dalam 7 hari terakhir, Anda telah menghabiskan <strong>\${this.formatCurrency(total7Days)}</strong>. \`;
    
    // Check against budget
    if (this.budgetManager && this.budgetManager.budgets.length > 0) {
      let overBudget = [];
      const currentMonthExpenses = this.transactionManager.getCategoryBreakdown(now.getFullYear(), now.getMonth(), 'expense');
      
      this.budgetManager.budgets.forEach(b => {
        const spent = currentMonthExpenses.find(e => e.category === b.category)?.amount || 0;
        if (spent > b.limit) overBudget.push(b.category);
        else if (spent > b.limit * 0.8) overBudget.push(b.category + " (kritis)");
      });
      
      if (overBudget.length > 0) {
        insightText += \`<br><span style="color:var(--expense-color)">Perhatian: Kategori <strong>\${overBudget.join(', ')}</strong> sudah melebihi batas atau mendekati limit! Rem pengeluaran Anda.</span>\`;
      } else {
        insightText += "Pengeluaran per kategori bulan ini masih aman terkendali. Lanjutkan kebiasaan baik ini!";
      }
    } else {
      insightText += "Set sebuah Anggaran bulanan agar saya bisa memberi saran yang lebih tajam!";
    }
    
    container.style.display = 'block';
    textEl.innerHTML = insightText;
  } else {
    container.style.display = 'none';
  }
};
`;

fs.appendFileSync(appJs, '\n' + newJs);
console.log('app.js patched part 2');
