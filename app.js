/* ============================================================
   DompetKu — Premium Personal Finance Application
   Complete Application Logic (Pure Client-Side)
   ============================================================ */

'use strict';

/* ─── Constants ─── */
const CATEGORIES = {
  income: ['Gaji', 'Freelance', 'Investasi', 'Bonus', 'Hadiah', 'Penjualan', 'Lainnya'],
  expense: ['Makanan', 'Transport', 'Belanja', 'Tagihan', 'Kesehatan', 'Pendidikan', 'Hiburan', 'Rumah Tangga', 'Pakaian', 'Donasi', 'Tabungan', 'Lainnya']
};

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const CHART_CATEGORY_COLORS = [
  '#FFC000', '#FF5252', '#00E676', '#29ABE2',
  '#FF9800', '#E040FB', '#00BCD4', '#8BC34A',
  '#FF5722', '#607D8B', '#795548', '#9C27B0'
];

const ITEMS_PER_PAGE = 10;

const STORAGE_KEYS = {
  data: 'dompetku_data',
  settings: 'dompetku_settings',
  encrypted: 'dompetku_encrypted',
  theme: 'dompetku_theme',
  lastMonth: 'dompetku_last_month'
};


/* ============================================================
   1. CryptoManager — AES-GCM Encryption via Web Crypto API
   ============================================================ */
class CryptoManager {
  constructor() {
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
  }

  async deriveKey(password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      this.encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(data, password) {
    const salt = this.generateSalt();
    const iv = this.generateIV();
    const key = await this.deriveKey(password, salt);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      this.encoder.encode(data)
    );
    const combined = new Uint8Array(salt.byteLength + iv.byteLength + encrypted.byteLength);
    combined.set(new Uint8Array(salt), 0);
    combined.set(new Uint8Array(iv), salt.byteLength);
    combined.set(new Uint8Array(encrypted), salt.byteLength + iv.byteLength);
    return this.arrayBufferToBase64(combined.buffer);
  }

  async decrypt(encryptedData, password) {
    const data = this.base64ToArrayBuffer(encryptedData);
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const encrypted = data.slice(28);
    const key = await this.deriveKey(password, new Uint8Array(salt));
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      encrypted
    );
    return this.decoder.decode(decrypted);
  }

  generateSalt() {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  generateIV() {
    return crypto.getRandomValues(new Uint8Array(12));
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}


/* ============================================================
   2. StorageManager — localStorage with optional encryption
   ============================================================ */
class StorageManager {
  constructor(cryptoManager) {
    this.crypto = cryptoManager;
    this.encryptionEnabled = false;
    this.password = null;
  }

  setEncryption(enabled, password) {
    this.encryptionEnabled = enabled;
    this.password = password;
    localStorage.setItem(STORAGE_KEYS.encrypted, JSON.stringify(enabled));
  }

  async save(key, data) {
    const json = JSON.stringify(data);
    if (this.encryptionEnabled && this.password) {
      const encrypted = await this.crypto.encrypt(json, this.password);
      localStorage.setItem(key, encrypted);
    } else {
      localStorage.setItem(key, json);
    }
  }

  async load(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    if (this.encryptionEnabled && this.password) {
      try {
        const decrypted = await this.crypto.decrypt(raw, this.password);
        return JSON.parse(decrypted);
      } catch (e) {
        throw new Error('Gagal mendekripsi data. Password salah?');
      }
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  async saveAll(appData) {
    await this.save(STORAGE_KEYS.data, appData);
  }

  async loadAll() {
    return await this.load(STORAGE_KEYS.data);
  }

  clear() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }

  isEncrypted() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.encrypted)) === true;
    } catch {
      return false;
    }
  }
}


/* ============================================================
   3. TransactionManager — CRUD for transactions
   ============================================================ */
class TransactionManager {
  constructor() {
    this.transactions = [];
  }

  add(transaction) {
    const entry = {
      id: transaction.id || this._generateId(),
      type: transaction.type,
      amount: parseFloat(transaction.amount),
      category: transaction.category,
      description: transaction.description || '',
      date: transaction.date,
      createdAt: transaction.createdAt || new Date().toISOString()
    };
    this.transactions.push(entry);
    return entry;
  }

  update(id, data) {
    const idx = this.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;
    if (data.amount !== undefined) data.amount = parseFloat(data.amount);
    this.transactions[idx] = { ...this.transactions[idx], ...data };
    return this.transactions[idx];
  }

  delete(id) {
    const idx = this.transactions.findIndex(t => t.id === id);
    if (idx === -1) return false;
    this.transactions.splice(idx, 1);
    return true;
  }

  getById(id) {
    return this.transactions.find(t => t.id === id) || null;
  }

  getByMonth(year, month) {
    return this.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }

  getByDateRange(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);
    return this.transactions.filter(t => {
      const d = new Date(t.date);
      return d >= s && d <= e;
    });
  }

  search(query) {
    const q = query.toLowerCase();
    return this.transactions.filter(t =>
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  }

  filter({ type, category, dateStart, dateEnd, search }) {
    let result = [...this.transactions];
    if (type && type !== 'all') {
      result = result.filter(t => t.type === type);
    }
    if (category && category !== 'all') {
      result = result.filter(t => t.category === category);
    }
    if (dateStart) {
      const s = new Date(dateStart);
      result = result.filter(t => new Date(t.date) >= s);
    }
    if (dateEnd) {
      const e = new Date(dateEnd);
      e.setHours(23, 59, 59, 999);
      result = result.filter(t => new Date(t.date) <= e);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => new Date(b.date) - new Date(a.date));
    return result;
  }

  getTotalIncome(year, month) {
    return this.getByMonth(year, month)
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getTotalExpense(year, month) {
    return this.getByMonth(year, month)
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  getBalance() {
    return this.transactions.reduce((bal, t) => {
      return t.type === 'income' ? bal + t.amount : bal - t.amount;
    }, 0);
  }

  getCategoryBreakdown(year, month, type) {
    const monthTx = this.getByMonth(year, month).filter(t => t.type === type);
    const map = {};
    monthTx.forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  getMonthlyTotals(year) {
    const result = [];
    for (let m = 0; m < 12; m++) {
      result.push({
        month: m,
        income: this.getTotalIncome(year, m),
        expense: this.getTotalExpense(year, m)
      });
    }
    return result;
  }

  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}


/* ============================================================
   4. BillManager — Recurring bill reminders
   ============================================================ */
class BillManager {
  constructor() {
    this.bills = [];
  }

  add(bill) {
    const entry = {
      id: bill.id || this._generateId(),
      name: bill.name,
      amount: parseFloat(bill.amount),
      dueDate: parseInt(bill.dueDate),
      category: bill.category || 'Tagihan',
      notes: bill.notes || '',
      paidThisMonth: bill.paidThisMonth || false,
      paidHistory: bill.paidHistory || [],
      createdAt: bill.createdAt || new Date().toISOString()
    };
    this.bills.push(entry);
    return entry;
  }

  update(id, data) {
    const idx = this.bills.findIndex(b => b.id === id);
    if (idx === -1) return null;
    if (data.amount !== undefined) data.amount = parseFloat(data.amount);
    if (data.dueDate !== undefined) data.dueDate = parseInt(data.dueDate);
    this.bills[idx] = { ...this.bills[idx], ...data };
    return this.bills[idx];
  }

  delete(id) {
    const idx = this.bills.findIndex(b => b.id === id);
    if (idx === -1) return false;
    this.bills.splice(idx, 1);
    return true;
  }

  getById(id) {
    return this.bills.find(b => b.id === id) || null;
  }

  markAsPaid(id) {
    const bill = this.getById(id);
    if (!bill) return false;
    bill.paidThisMonth = true;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!bill.paidHistory.includes(monthKey)) {
      bill.paidHistory.push(monthKey);
    }
    return true;
  }

  markAsUnpaid(id) {
    const bill = this.getById(id);
    if (!bill) return false;
    bill.paidThisMonth = false;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    bill.paidHistory = bill.paidHistory.filter(k => k !== monthKey);
    return true;
  }

  getUpcoming() {
    const today = new Date();
    const currentDay = today.getDate();
    return this.bills.filter(b => {
      if (b.paidThisMonth) return false;
      const diff = b.dueDate - currentDay;
      return diff >= 0 && diff <= 7;
    });
  }

  getOverdue() {
    const today = new Date();
    const currentDay = today.getDate();
    return this.bills.filter(b => !b.paidThisMonth && b.dueDate < currentDay);
  }

  resetMonthlyStatus() {
    this.bills.forEach(b => { b.paidThisMonth = false; });
  }

  checkDueDate() {
    const today = new Date().getDate();
    return this.bills.filter(b => b.dueDate === today && !b.paidThisMonth);
  }

  getTotalMonthlyBills() {
    return this.bills.reduce((sum, b) => sum + b.amount, 0);
  }

  getPaidCount() {
    return this.bills.filter(b => b.paidThisMonth).length;
  }

  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}


/* ============================================================
   5. SavingsManager — Savings goals
   ============================================================ */
class SavingsManager {
  constructor() {
    this.goals = [];
  }

  add(goal) {
    const entry = {
      id: goal.id || this._generateId(),
      name: goal.name,
      target: parseFloat(goal.target),
      current: parseFloat(goal.current || 0),
      icon: goal.icon || '🎯',
      deadline: goal.deadline || '',
      createdAt: goal.createdAt || new Date().toISOString()
    };
    this.goals.push(entry);
    return entry;
  }

  update(id, data) {
    const idx = this.goals.findIndex(g => g.id === id);
    if (idx === -1) return null;
    if (data.target !== undefined) data.target = parseFloat(data.target);
    if (data.current !== undefined) data.current = parseFloat(data.current);
    this.goals[idx] = { ...this.goals[idx], ...data };
    return this.goals[idx];
  }

  delete(id) {
    const idx = this.goals.findIndex(g => g.id === id);
    if (idx === -1) return false;
    this.goals.splice(idx, 1);
    return true;
  }

  getById(id) {
    return this.goals.find(g => g.id === id) || null;
  }

  addAmount(id, amount) {
    const goal = this.getById(id);
    if (!goal) return false;
    goal.current = Math.min(goal.current + parseFloat(amount), goal.target);
    return true;
  }

  withdrawAmount(id, amount) {
    const goal = this.getById(id);
    if (!goal) return false;
    goal.current = Math.max(goal.current - parseFloat(amount), 0);
    return true;
  }

  getProgress(id) {
    const goal = this.getById(id);
    if (!goal || goal.target === 0) return 0;
    return Math.min((goal.current / goal.target) * 100, 100);
  }

  getTotalSavings() {
    return this.goals.reduce((sum, g) => sum + g.current, 0);
  }

  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}


/* ============================================================
   6. ChartManager — Chart.js management
   ============================================================ */
class ChartManager {
  constructor() {
    this.charts = {};
  }

  _getThemeColors() {
    const isDark = !document.body.classList.contains('light-mode');
    return {
      text: isDark ? '#FFFFFF' : '#202020',
      grid: isDark ? 'rgba(255,192,0,0.1)' : 'rgba(0,0,0,0.08)',
      tooltipBg: isDark ? '#202020' : '#FFFFFF',
      tooltipText: isDark ? '#FFFFFF' : '#202020'
    };
  }

  _baseOptions() {
    const colors = this._getThemeColors();
    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: {
            color: colors.text,
            font: { family: 'Inter, system-ui, sans-serif', size: 12 },
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 10
          }
        },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipText,
          bodyColor: colors.tooltipText,
          borderColor: 'rgba(255,192,0,0.3)',
          borderWidth: 1,
          titleFont: { family: 'Inter, system-ui, sans-serif', weight: '600' },
          bodyFont: { family: 'Inter, system-ui, sans-serif' },
          padding: 12,
          cornerRadius: 0,
          displayColors: true,
          callbacks: {
            label: function (ctx) {
              const val = ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed;
              return ctx.dataset.label + ': Rp ' + Number(val).toLocaleString('id-ID');
            }
          }
        }
      }
    };
  }

  initIncomeExpenseChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (this.charts.incomeExpense) this.charts.incomeExpense.destroy();

    const colors = this._getThemeColors();
    const shortMonths = MONTH_NAMES.map(m => m.substring(0, 3));

    this.charts.incomeExpense = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: shortMonths,
        datasets: [
          {
            label: 'Pemasukan',
            data: new Array(12).fill(0),
            backgroundColor: '#00E676',
            borderWidth: 0,
            borderRadius: 0,
            barPercentage: 0.7,
            categoryPercentage: 0.6
          },
          {
            label: 'Pengeluaran',
            data: new Array(12).fill(0),
            backgroundColor: '#FF5252',
            borderWidth: 0,
            borderRadius: 0,
            barPercentage: 0.7,
            categoryPercentage: 0.6
          }
        ]
      },
      options: {
        ...this._baseOptions(),
        scales: {
          x: {
            ticks: { color: colors.text, font: { family: 'Inter, system-ui, sans-serif', size: 11 } },
            grid: { color: colors.grid, drawBorder: false }
          },
          y: {
            ticks: {
              color: colors.text,
              font: { family: 'Inter, system-ui, sans-serif', size: 11 },
              callback: function (value) {
                if (value >= 1000000) return 'Rp ' + (value / 1000000).toFixed(1) + 'jt';
                if (value >= 1000) return 'Rp ' + (value / 1000).toFixed(0) + 'rb';
                return 'Rp ' + value;
              }
            },
            grid: { color: colors.grid, drawBorder: false },
            beginAtZero: true
          }
        }
      }
    });
  }

  initCategoryChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (this.charts.category) this.charts.category.destroy();

    const colors = this._getThemeColors();

    this.charts.category = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: CHART_CATEGORY_COLORS,
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        ...this._baseOptions(),
        cutout: '65%',
        plugins: {
          ...this._baseOptions().plugins,
          tooltip: {
            ...this._baseOptions().plugins.tooltip,
            callbacks: {
              label: function (ctx) {
                const val = ctx.parsed;
                const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ctx.label + ': Rp ' + Number(val).toLocaleString('id-ID') + ' (' + pct + '%)';
              }
            }
          }
        }
      }
    });
  }

  initTrendChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (this.charts.trend) this.charts.trend.destroy();

    const colors = this._getThemeColors();
    const shortMonths = MONTH_NAMES.map(m => m.substring(0, 3));

    this.charts.trend = new Chart(canvas, {
      type: 'line',
      data: {
        labels: shortMonths,
        datasets: [
          {
            label: 'Saldo',
            data: new Array(12).fill(0),
            borderColor: '#FFC000',
            backgroundColor: 'rgba(255,192,0,0.1)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#FFC000',
            pointBorderColor: '#FFC000',
            pointRadius: 3,
            pointHoverRadius: 6,
            borderWidth: 2
          },
          {
            label: 'Tabungan',
            data: new Array(12).fill(0),
            borderColor: '#29ABE2',
            backgroundColor: 'rgba(41,171,226,0.1)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#29ABE2',
            pointBorderColor: '#29ABE2',
            pointRadius: 3,
            pointHoverRadius: 6,
            borderWidth: 2
          }
        ]
      },
      options: {
        ...this._baseOptions(),
        scales: {
          x: {
            ticks: { color: colors.text, font: { family: 'Inter, system-ui, sans-serif', size: 11 } },
            grid: { color: colors.grid, drawBorder: false }
          },
          y: {
            ticks: {
              color: colors.text,
              font: { family: 'Inter, system-ui, sans-serif', size: 11 },
              callback: function (value) {
                if (value >= 1000000) return 'Rp ' + (value / 1000000).toFixed(1) + 'jt';
                if (value >= 1000) return 'Rp ' + (value / 1000).toFixed(0) + 'rb';
                return 'Rp ' + value;
              }
            },
            grid: { color: colors.grid, drawBorder: false },
            beginAtZero: true
          }
        }
      }
    });
  }

  updateIncomeExpenseChart(monthlyData) {
    if (!this.charts.incomeExpense) return;
    const chart = this.charts.incomeExpense;
    chart.data.datasets[0].data = monthlyData.map(d => d.income);
    chart.data.datasets[1].data = monthlyData.map(d => d.expense);
    chart.update('none');
  }

  updateCategoryChart(categoryData) {
    if (!this.charts.category) return;
    const chart = this.charts.category;
    chart.data.labels = categoryData.map(d => d.category);
    chart.data.datasets[0].data = categoryData.map(d => d.amount);
    chart.update('none');
  }

  updateTrendChart(trendData) {
    if (!this.charts.trend) return;
    const chart = this.charts.trend;
    chart.data.datasets[0].data = trendData.balance;
    chart.data.datasets[1].data = trendData.savings;
    chart.update('none');
  }

  updateAll(transactionManager, savingsManager) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const monthlyData = transactionManager.getMonthlyTotals(year);
    this.updateIncomeExpenseChart(monthlyData);

    const categoryData = transactionManager.getCategoryBreakdown(year, month, 'expense');
    this.updateCategoryChart(categoryData);

    const balanceTrend = [];
    let runningBalance = 0;
    for (let m = 0; m < 12; m++) {
      const inc = transactionManager.getTotalIncome(year, m);
      const exp = transactionManager.getTotalExpense(year, m);
      runningBalance += inc - exp;
      balanceTrend.push(runningBalance);
    }

    const totalSavings = savingsManager.getTotalSavings();
    const savingsTrend = new Array(12).fill(totalSavings);

    this.updateTrendChart({ balance: balanceTrend, savings: savingsTrend });
  }

  refreshTheme() {
    const colors = this._getThemeColors();
    Object.values(this.charts).forEach(chart => {
      if (!chart) return;
      if (chart.options.plugins && chart.options.plugins.legend) {
        chart.options.plugins.legend.labels.color = colors.text;
      }
      if (chart.options.scales) {
        if (chart.options.scales.x) {
          chart.options.scales.x.ticks.color = colors.text;
          chart.options.scales.x.grid.color = colors.grid;
        }
        if (chart.options.scales.y) {
          chart.options.scales.y.ticks.color = colors.text;
          chart.options.scales.y.grid.color = colors.grid;
        }
      }
      chart.update('none');
    });
  }

  destroyAll() {
    Object.values(this.charts).forEach(chart => {
      if (chart) chart.destroy();
    });
    this.charts = {};
  }
}


/* ============================================================
   7. ExportManager — PDF & Excel export
   ============================================================ */
class ExportManager {
  constructor() {}

  async exportPDF(transactionManager, savingsManager, billManager) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let y = margin;
    const now = new Date();
    const monthYear = MONTH_NAMES[now.getMonth()] + ' ' + now.getFullYear();

    /* Header */
    doc.setFillColor(32, 32, 32);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setFillColor(255, 192, 0);
    doc.rect(0, 38, pageWidth, 2, 'F');

    doc.setTextColor(255, 192, 0);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('DOMPETKU', margin, 18);

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Laporan Keuangan — ' + monthYear, margin, 28);
    doc.text('Dicetak: ' + this._formatDateFull(now), margin, 34);

    y = 50;

    /* Summary Section */
    doc.setTextColor(255, 192, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RINGKASAN', margin, y);
    y += 2;
    doc.setDrawColor(255, 192, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 40, y);
    y += 8;

    const income = transactionManager.getTotalIncome(now.getFullYear(), now.getMonth());
    const expense = transactionManager.getTotalExpense(now.getFullYear(), now.getMonth());
    const balance = transactionManager.getBalance();
    const savings = savingsManager.getTotalSavings();

    const summaryItems = [
      { label: 'Total Pemasukan', value: this._fmtCurrency(income), color: [0, 230, 118] },
      { label: 'Total Pengeluaran', value: this._fmtCurrency(expense), color: [255, 82, 82] },
      { label: 'Saldo', value: this._fmtCurrency(balance), color: [255, 192, 0] },
      { label: 'Total Tabungan', value: this._fmtCurrency(savings), color: [41, 171, 226] }
    ];

    const boxW = (contentWidth - 9) / 4;
    summaryItems.forEach((item, i) => {
      const bx = margin + i * (boxW + 3);
      doc.setFillColor(40, 40, 40);
      doc.rect(bx, y, boxW, 22, 'F');
      doc.setTextColor(180, 180, 180);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(item.label, bx + 4, y + 8);
      doc.setTextColor(item.color[0], item.color[1], item.color[2]);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(item.value, bx + 4, y + 17);
    });
    y += 32;

    /* Transactions Table */
    const txs = transactionManager.getByMonth(now.getFullYear(), now.getMonth())
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    doc.setTextColor(255, 192, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TRANSAKSI BULAN INI', margin, y);
    y += 2;
    doc.line(margin, y, margin + 60, y);
    y += 8;

    if (txs.length === 0) {
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Belum ada transaksi bulan ini.', margin, y);
      y += 10;
    } else {
      /* Table header */
      const cols = [
        { label: 'Tanggal', w: 28 },
        { label: 'Kategori', w: 30 },
        { label: 'Keterangan', w: 55 },
        { label: 'Tipe', w: 22 },
        { label: 'Jumlah', w: 38 }
      ];
      const rowH = 7;

      doc.setFillColor(50, 50, 50);
      doc.rect(margin, y, contentWidth, rowH, 'F');
      doc.setTextColor(255, 192, 0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      let cx = margin + 2;
      cols.forEach(col => {
        doc.text(col.label, cx, y + 5);
        cx += col.w;
      });
      y += rowH;

      txs.forEach((tx, idx) => {
        if (y > 270) {
          doc.addPage();
          y = margin;
        }
        if (idx % 2 === 0) {
          doc.setFillColor(35, 35, 35);
          doc.rect(margin, y, contentWidth, rowH, 'F');
        }
        doc.setTextColor(220, 220, 220);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        cx = margin + 2;
        const dateStr = this._formatDateShort(new Date(tx.date));
        doc.text(dateStr, cx, y + 5); cx += cols[0].w;
        doc.text(tx.category, cx, y + 5); cx += cols[1].w;
        const desc = tx.description.length > 30 ? tx.description.substring(0, 27) + '...' : tx.description;
        doc.text(desc || '-', cx, y + 5); cx += cols[2].w;
        doc.setTextColor(tx.type === 'income' ? 0 : 255, tx.type === 'income' ? 230 : 82, tx.type === 'income' ? 118 : 82);
        doc.text(tx.type === 'income' ? 'Masuk' : 'Keluar', cx, y + 5); cx += cols[3].w;
        doc.text(this._fmtCurrency(tx.amount), cx, y + 5);
        y += rowH;
      });
      y += 5;
    }

    /* Bills Section */
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setTextColor(255, 192, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('STATUS TAGIHAN', margin, y);
    y += 2;
    doc.line(margin, y, margin + 50, y);
    y += 8;

    if (billManager.bills.length === 0) {
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Belum ada tagihan.', margin, y);
      y += 10;
    } else {
      billManager.bills.forEach(bill => {
        if (y > 270) { doc.addPage(); y = margin; }
        doc.setFillColor(40, 40, 40);
        doc.rect(margin, y, contentWidth, 10, 'F');
        doc.setTextColor(220, 220, 220);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(bill.name, margin + 3, y + 7);
        doc.text(this._fmtCurrency(bill.amount), margin + 90, y + 7);
        doc.text('Jatuh tempo: ' + bill.dueDate, margin + 130, y + 7);
        doc.setTextColor(bill.paidThisMonth ? 0 : 255, bill.paidThisMonth ? 230 : 82, bill.paidThisMonth ? 118 : 82);
        doc.setFont('helvetica', 'bold');
        doc.text(bill.paidThisMonth ? 'LUNAS' : 'BELUM', margin + contentWidth - 20, y + 7);
        y += 12;
      });
      y += 5;
    }

    /* Savings Section */
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setTextColor(255, 192, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TARGET TABUNGAN', margin, y);
    y += 2;
    doc.line(margin, y, margin + 55, y);
    y += 8;

    if (savingsManager.goals.length === 0) {
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Belum ada target tabungan.', margin, y);
      y += 10;
    } else {
      savingsManager.goals.forEach(goal => {
        if (y > 270) { doc.addPage(); y = margin; }
        const progress = goal.target > 0 ? ((goal.current / goal.target) * 100).toFixed(1) : 0;
        doc.setFillColor(40, 40, 40);
        doc.rect(margin, y, contentWidth, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(goal.icon + ' ' + goal.name, margin + 3, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 180, 180);
        doc.text(this._fmtCurrency(goal.current) + ' / ' + this._fmtCurrency(goal.target) + '  (' + progress + '%)', margin + 3, y + 12);
        /* progress bar */
        const barX = margin + 120;
        const barW = contentWidth - 123;
        doc.setFillColor(60, 60, 60);
        doc.rect(barX, y + 5, barW, 4, 'F');
        doc.setFillColor(255, 192, 0);
        doc.rect(barX, y + 5, barW * (progress / 100), 4, 'F');
        y += 17;
      });
    }

    /* Footer */
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.text('DompetKu — Halaman ' + p + ' dari ' + totalPages, margin, doc.internal.pageSize.getHeight() - 8);
    }

    doc.save('DompetKu_Laporan_' + monthYear.replace(' ', '_') + '.pdf');
  }

  exportExcel(transactionManager) {
    const wb = XLSX.utils.book_new();
    const now = new Date();

    /* Sheet 1: Transaksi */
    const txHeaders = ['No', 'Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Jumlah (Rp)'];
    const sorted = [...transactionManager.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    const txData = sorted.map((tx, i) => [
      i + 1,
      this._formatDateShort(new Date(tx.date)),
      tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      tx.category,
      tx.description || '-',
      tx.amount
    ]);
    const ws1Data = [txHeaders, ...txData];
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    ws1['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 30 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Transaksi');

    /* Sheet 2: Ringkasan Bulanan */
    const summaryHeaders = ['Bulan', 'Pemasukan (Rp)', 'Pengeluaran (Rp)', 'Selisih (Rp)'];
    const year = now.getFullYear();
    const monthlyTotals = transactionManager.getMonthlyTotals(year);
    const summaryData = monthlyTotals.map(m => [
      MONTH_NAMES[m.month] + ' ' + year,
      m.income,
      m.expense,
      m.income - m.expense
    ]);
    const ws2Data = [summaryHeaders, ...summaryData];
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    ws2['!cols'] = [
      { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Ringkasan Bulanan');

    const monthYear = MONTH_NAMES[now.getMonth()] + '_' + year;
    XLSX.writeFile(wb, 'DompetKu_Data_' + monthYear + '.xlsx');
  }

  _fmtCurrency(n) {
    return 'Rp ' + Number(n).toLocaleString('id-ID');
  }

  _formatDateShort(d) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return dd + '/' + mm + '/' + yyyy;
  }

  _formatDateFull(d) {
    return d.getDate() + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
  }
}


/* ============================================================
   8. NotificationManager — Toast notifications
   ============================================================ */
class NotificationManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = containerId || 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  show(message, type = 'info', duration = 4000) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const titles = { success: 'Berhasil', error: 'Gagal', warning: 'Peringatan', info: 'Informasi' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <div class="toast-content">
        <div class="toast-title">${titles[type] || 'Informasi'}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this._removeToast(toast));

    this.container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    if (duration > 0) {
      setTimeout(() => this._removeToast(toast), duration);
    }

    return toast;
  }

  showBillReminder(bill) {
    const message = `Tagihan "${bill.name}" sebesar Rp ${Number(bill.amount).toLocaleString('id-ID')} jatuh tempo tanggal ${bill.dueDate}!`;
    this.show(message, 'warning', 6000);
  }

  checkBillReminders(billManager) {
    const due = billManager.checkDueDate();
    due.forEach(bill => this.showBillReminder(bill));

    const overdue = billManager.getOverdue();
    overdue.forEach(bill => {
      const msg = `Tagihan "${bill.name}" sebesar Rp ${Number(bill.amount).toLocaleString('id-ID')} sudah melewati jatuh tempo!`;
      this.show(msg, 'error', 8000);
    });
  }

  _removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 400);
  }
}


/* ============================================================
   9. ThemeManager — Dark/Light mode toggle
   ============================================================ */
class ThemeManager {
  constructor() {
    this.isDark = true;
  }

  toggle() {
    this.isDark = !this.isDark;
    this._apply();
    this.save();
    return this.isDark;
  }

  set(isDark) {
    this.isDark = isDark;
    this._apply();
    this.save();
  }

  load() {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    if (stored !== null) {
      this.isDark = stored === 'dark';
    }
    this._apply();
  }

  save() {
    localStorage.setItem(STORAGE_KEYS.theme, this.isDark ? 'dark' : 'light');
  }

  _apply() {
    if (this.isDark) {
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
    }
    /* Update toggle button icon if present */
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
      btn.innerHTML = this.isDark ? '<span>☀️</span>' : '<span>🌙</span>';
      btn.setAttribute('title', this.isDark ? 'Mode Terang' : 'Mode Gelap');
    }
  }
}


/* ============================================================
   10. App — Main Application Controller
   ============================================================ */
class App {
  constructor() {
    this.cryptoManager = new CryptoManager();
    this.storageManager = new StorageManager(this.cryptoManager);
    this.transactionManager = new TransactionManager();
    this.billManager = new BillManager();
    this.savingsManager = new SavingsManager();
    this.chartManager = new ChartManager();
    this.exportManager = new ExportManager();
    this.notificationManager = new NotificationManager('toast-container');
    this.themeManager = new ThemeManager();

    this.currentSection = 'dashboard';
    this.transactionPage = 1;
    this.editingTransactionId = null;
    this.editingBillId = null;
    this.editingSavingsId = null;
    this.addToSavingsId = null;
    this.dashboardYear = new Date().getFullYear();
    this.dashboardMonth = new Date().getMonth();
  }

  async init() {
    /* 1. Load theme */
    this.themeManager.load();

    /* 2. Check encryption */
    const isEncrypted = this.storageManager.isEncrypted();

    if (isEncrypted) {
      /* 3. Show unlock modal */
      this._showUnlockModal();
    } else {
      /* 4. Load data directly */
      await this.loadData();
      this._finishInit();
    }
  }

  _showUnlockModal() {
    const overlay = document.getElementById('modal-unlock');
    if (overlay) {
      overlay.classList.add('active');
      const form = document.getElementById('form-unlock');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const pwInput = document.getElementById('unlock-password');
          const pw = pwInput ? pwInput.value : '';
          if (!pw) {
            this.notificationManager.show('Masukkan password!', 'error');
            return;
          }
          this.storageManager.setEncryption(true, pw);
          try {
            await this.loadData();
            overlay.classList.remove('active');
            this._finishInit();
            this.notificationManager.show('Data berhasil didekripsi!', 'success');
          } catch (err) {
            this.notificationManager.show('Password salah! Coba lagi.', 'error');
            this.storageManager.password = null;
          }
        };
      }
    } else {
      /* Fallback: no unlock modal in DOM, try loading without encryption */
      this.storageManager.setEncryption(false, null);
      this.loadData().then(() => this._finishInit());
    }
  }

  _finishInit() {
    /* 5. Initialize UI */
    this._initUI();

    /* 6. Initialize charts */
    this.chartManager.initIncomeExpenseChart('chart-income-expense');
    this.chartManager.initCategoryChart('chart-category');
    this.chartManager.initTrendChart('chart-trend');

    /* 7. Check month change and bill reminders */
    this._checkMonthChange();
    setTimeout(() => {
      this.notificationManager.checkBillReminders(this.billManager);
    }, 1500);

    /* 8. Set up event listeners */
    this.setupEventListeners();

    /* 9. Update dashboard */
    this.updateDashboard();
    this.updateCharts();
    this.renderTransactionList();
    this.renderBillList();
    this.renderSavingsList();
    this.renderReportSummary();

    /* Populate dashboard month filter */
    this._populateMonthFilter();
  }

  _initUI() {
    this.navigateTo('dashboard');
    this._updateCategoryOptions('expense');
  }

  _checkMonthChange() {
    const now = new Date();
    const currentMonthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const lastMonth = localStorage.getItem(STORAGE_KEYS.lastMonth);
    if (lastMonth && lastMonth !== currentMonthKey) {
      this.billManager.resetMonthlyStatus();
      this.saveData();
    }
    localStorage.setItem(STORAGE_KEYS.lastMonth, currentMonthKey);
  }

  /* ─── Event Listeners ─── */
  setupEventListeners() {
    /* Sidebar navigation */
    document.querySelectorAll('.sidebar-nav a[data-section]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.getAttribute('data-section');
        this.navigateTo(section);
        /* Close sidebar on mobile */
        if (window.innerWidth < 1024) {
          document.body.classList.remove('sidebar-open');
        }
      });
    });

    /* Theme toggle */
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        this.themeManager.toggle();
        this.chartManager.refreshTheme();
      });
    }

    /* Sidebar toggle */
    const sidebarBtn = document.getElementById('btn-sidebar-toggle');
    if (sidebarBtn) {
      sidebarBtn.addEventListener('click', () => {
        document.body.classList.toggle('sidebar-open');
      });
    }

    /* ─── Transaction ─── */
    const addTxBtn = document.getElementById('btn-add-transaction');
    if (addTxBtn) {
      addTxBtn.addEventListener('click', () => this.openModal('transaction'));
    }

    const txForm = document.getElementById('form-transaction');
    if (txForm) {
      txForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveTransaction();
      });
    }

    /* Transaction type → category mapping */
    const txType = document.getElementById('transaction-type');
    if (txType) {
      txType.addEventListener('change', () => {
        this._updateCategoryOptions(txType.value);
      });
    }

    /* Filter inputs */
    const filterSearch = document.getElementById('filter-search');
    if (filterSearch) {
      filterSearch.addEventListener('input', () => {
        this.transactionPage = 1;
        this.renderTransactionList();
      });
    }

    const filterType = document.getElementById('filter-type');
    if (filterType) {
      filterType.addEventListener('change', () => {
        this.transactionPage = 1;
        this.renderTransactionList();
      });
    }

    const filterCategory = document.getElementById('filter-category');
    if (filterCategory) {
      filterCategory.addEventListener('change', () => {
        this.transactionPage = 1;
        this.renderTransactionList();
      });
    }

    const filterDateStart = document.getElementById('filter-date-start');
    if (filterDateStart) {
      filterDateStart.addEventListener('change', () => {
        this.transactionPage = 1;
        this.renderTransactionList();
      });
    }

    const filterDateEnd = document.getElementById('filter-date-end');
    if (filterDateEnd) {
      filterDateEnd.addEventListener('change', () => {
        this.transactionPage = 1;
        this.renderTransactionList();
      });
    }

    /* ─── Bills ─── */
    const addBillBtn = document.getElementById('btn-add-bill');
    if (addBillBtn) {
      addBillBtn.addEventListener('click', () => this.openModal('bill'));
    }

    const billForm = document.getElementById('form-bill');
    if (billForm) {
      billForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveBill();
      });
    }

    /* ─── Savings ─── */
    const addSavingsBtn = document.getElementById('btn-add-savings');
    if (addSavingsBtn) {
      addSavingsBtn.addEventListener('click', () => this.openModal('savings'));
    }

    const savingsForm = document.getElementById('form-savings');
    if (savingsForm) {
      savingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSavingsGoal();
      });
    }

    /* Add to savings amount form */
    const addSavingsAmtForm = document.getElementById('form-add-savings-amount');
    if (addSavingsAmtForm) {
      addSavingsAmtForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.confirmAddToSavings();
      });
    }

    /* ─── Export ─── */
    const pdfBtn = document.getElementById('btn-export-pdf');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', async () => {
        try {
          await this.exportManager.exportPDF(this.transactionManager, this.savingsManager, this.billManager);
          this.notificationManager.show('Laporan PDF berhasil diunduh!', 'success');
        } catch (err) {
          this.notificationManager.show('Gagal mengekspor PDF: ' + err.message, 'error');
        }
      });
    }

    const excelBtn = document.getElementById('btn-export-excel');
    if (excelBtn) {
      excelBtn.addEventListener('click', () => {
        try {
          this.exportManager.exportExcel(this.transactionManager);
          this.notificationManager.show('File Excel berhasil diunduh!', 'success');
        } catch (err) {
          this.notificationManager.show('Gagal mengekspor Excel: ' + err.message, 'error');
        }
      });
    }

    /* ─── Settings ─── */
    const encryptionToggle = document.getElementById('encryption-toggle');
    if (encryptionToggle) {
      encryptionToggle.addEventListener('change', async () => {
        if (encryptionToggle.checked) {
          await this.enableEncryption();
        } else {
          await this.disableEncryption();
        }
      });
    }
    /* Set initial state */
    if (encryptionToggle) {
      encryptionToggle.checked = this.storageManager.isEncrypted();
    }

    const changePwBtn = document.getElementById('btn-change-password');
    if (changePwBtn) {
      changePwBtn.addEventListener('click', () => this.changePassword());
    }

    const resetDataBtn = document.getElementById('btn-reset-data');
    if (resetDataBtn) {
      resetDataBtn.addEventListener('click', () => this.resetAllData());
    }

    const exportBackupBtn = document.getElementById('btn-export-backup');
    if (exportBackupBtn) {
      exportBackupBtn.addEventListener('click', () => this.exportBackup());
    }

    const importBackupBtn = document.getElementById('btn-import-backup');
    if (importBackupBtn) {
      importBackupBtn.addEventListener('click', () => {
        const fileInput = document.getElementById('import-backup-file');
        if (fileInput) fileInput.click();
      });
    }

    const importFileInput = document.getElementById('import-backup-file');
    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => this.importBackup(e));
    }

    /* ─── Modal close ─── */
    document.querySelectorAll('.modal-overlay .modal-close, .modal-overlay .btn-modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        const overlay = btn.closest('.modal-overlay');
        if (overlay) this.closeModal(overlay.id);
      });
    });

    /* Overlay click to close */
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal(overlay.id);
      });
    });

    /* Dashboard month filter */
    const monthFilter = document.getElementById('dashboard-month-filter');
    if (monthFilter) {
      monthFilter.addEventListener('change', () => {
        const val = monthFilter.value;
        if (val) {
          const [y, m] = val.split('-').map(Number);
          this.dashboardYear = y;
          this.dashboardMonth = m;
          this.updateDashboard();
          this.updateCharts();
        }
      });
    }

    /* Dashboard add transaction shortcut */
    const dashAddBtn = document.getElementById('btn-dash-add-transaction');
    if (dashAddBtn) {
      dashAddBtn.addEventListener('click', () => this.openModal('transaction'));
    }
  }

  /* ─── Navigation ─── */
  navigateTo(sectionName) {
    this.currentSection = sectionName;

    /* Hide all sections */
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    /* Show target */
    const target = document.getElementById('section-' + sectionName);
    if (target) target.classList.add('active');

    /* Update sidebar active */
    document.querySelectorAll('.sidebar-nav a[data-section]').forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-section') === sectionName);
    });

    /* Refresh section data */
    if (sectionName === 'dashboard') {
      this.updateDashboard();
      this.updateCharts();
    } else if (sectionName === 'transactions') {
      this.renderTransactionList();
    } else if (sectionName === 'bills') {
      this.renderBillList();
    } else if (sectionName === 'savings') {
      this.renderSavingsList();
    } else if (sectionName === 'reports') {
      this.renderReportSummary();
    }
  }

  /* ─── Modal Operations ─── */
  openModal(type, editId = null) {
    let modalId;

    if (type === 'transaction') {
      modalId = 'modal-transaction';
      this.editingTransactionId = editId;
      const form = document.getElementById('form-transaction');
      if (form) form.reset();

      const title = document.querySelector('#modal-transaction .modal-title');
      if (title) title.textContent = editId ? 'Edit Transaksi' : 'Tambah Transaksi';

      if (editId) {
        const tx = this.transactionManager.getById(editId);
        if (tx) {
          const typeEl = document.getElementById('transaction-type');
          if (typeEl) { typeEl.value = tx.type; this._updateCategoryOptions(tx.type); }
          const catEl = document.getElementById('transaction-category');
          if (catEl) catEl.value = tx.category;
          const amtEl = document.getElementById('transaction-amount');
          if (amtEl) amtEl.value = tx.amount;
          const descEl = document.getElementById('transaction-description');
          if (descEl) descEl.value = tx.description;
          const dateEl = document.getElementById('transaction-date');
          if (dateEl) dateEl.value = tx.date;
        }
      } else {
        /* Default date to today */
        const dateEl = document.getElementById('transaction-date');
        if (dateEl) dateEl.value = this._todayString();
        const typeEl = document.getElementById('transaction-type');
        if (typeEl) this._updateCategoryOptions(typeEl.value);
      }
    } else if (type === 'budget') {
      modalId = 'modal-budget';
      const catSelect = document.getElementById('budget-category');
      if (catSelect) {
        catSelect.innerHTML = CATEGORIES.expense.map(c => `<option value="${c}">${c}</option>`).join('');
      }
    } else if (type === 'bill') {
      modalId = 'modal-bill';
      this.editingBillId = editId;
      const form = document.getElementById('form-bill');
      if (form) form.reset();

      const title = document.querySelector('#modal-bill .modal-title');
      if (title) title.textContent = editId ? 'Edit Tagihan' : 'Tambah Tagihan';

      if (editId) {
        const bill = this.billManager.getById(editId);
        if (bill) {
          const nameEl = document.getElementById('bill-name');
          if (nameEl) nameEl.value = bill.name;
          const amtEl = document.getElementById('bill-amount');
          if (amtEl) amtEl.value = bill.amount;
          const dueEl = document.getElementById('bill-due-date');
          if (dueEl) dueEl.value = bill.dueDate;
          const catEl = document.getElementById('bill-category');
          if (catEl) catEl.value = bill.category;
          const notesEl = document.getElementById('bill-notes');
          if (notesEl) notesEl.value = bill.notes;
        }
      }
    } else if (type === 'savings') {
      modalId = 'modal-savings';
      this.editingSavingsId = editId;
      const form = document.getElementById('form-savings');
      if (form) form.reset();

      const title = document.querySelector('#modal-savings .modal-title');
      if (title) title.textContent = editId ? 'Edit Target Tabungan' : 'Tambah Target Tabungan';

      if (editId) {
        const goal = this.savingsManager.getById(editId);
        if (goal) {
          const nameEl = document.getElementById('savings-name');
          if (nameEl) nameEl.value = goal.name;
          const targetEl = document.getElementById('savings-target');
          if (targetEl) targetEl.value = goal.target;
          const currentEl = document.getElementById('savings-current');
          if (currentEl) currentEl.value = goal.current;
          const iconEl = document.getElementById('savings-icon');
          if (iconEl) iconEl.value = goal.icon;
          const deadlineEl = document.getElementById('savings-deadline');
          if (deadlineEl) deadlineEl.value = goal.deadline;
        }
      }
    } else if (type === 'add-savings-amount') {
      modalId = 'modal-add-savings-amount';
      const form = document.getElementById('form-add-savings-amount');
      if (form) form.reset();
    } else if (type === 'confirm') {
      modalId = 'modal-confirm';
    }

    const overlay = document.getElementById(modalId);
    if (overlay) overlay.classList.add('active');
  }

  closeModal(modalId) {
    const overlay = document.getElementById(modalId);
    if (overlay) overlay.classList.remove('active');
    if (modalId === 'modal-transaction') this.editingTransactionId = null;
    if (modalId === 'modal-bill') this.editingBillId = null;
    if (modalId === 'modal-savings') this.editingSavingsId = null;
    if (modalId === 'modal-add-savings-amount') this.addToSavingsId = null;
  }

  /* ─── Transaction Operations ─── */
  saveTransaction() {
    const type = document.getElementById('transaction-type')?.value;
    const category = document.getElementById('transaction-category')?.value;
    const amount = document.getElementById('transaction-amount')?.value;
    const description = document.getElementById('transaction-description')?.value || '';
    const date = document.getElementById('transaction-date')?.value;

    /* Validation */
    if (!type || !category || !amount || !date) {
      this.notificationManager.show('Semua kolom wajib diisi!', 'error');
      return;
    }
    if (parseFloat(amount) <= 0) {
      this.notificationManager.show('Jumlah harus lebih dari 0!', 'error');
      return;
    }

    if (this.editingTransactionId) {
      this.transactionManager.update(this.editingTransactionId, { type, category, amount, description, date });
      this.notificationManager.show('Transaksi berhasil diperbarui!', 'success');
    } else {
      this.transactionManager.add({ type, category, amount, description, date });
      this.notificationManager.show('Transaksi berhasil ditambahkan!', 'success');
    }

    this.closeModal('modal-transaction');
    this.saveData();
    this.updateDashboard();
    this.updateCharts();
    this.renderTransactionList();
    this.renderReportSummary();
    this._populateMonthFilter();
  }

  deleteTransaction(id) {
    this.showConfirm('Hapus Transaksi', 'Apakah Anda yakin ingin menghapus transaksi ini?', () => {
      this.transactionManager.delete(id);
      this.notificationManager.show('Transaksi berhasil dihapus!', 'success');
      this.saveData();
      this.updateDashboard();
      this.updateCharts();
      this.renderTransactionList();
      this.renderReportSummary();
    });
  }

  editTransaction(id) {
    this.openModal('transaction', id);
  }

  renderTransactionList() {
    const container = document.getElementById('transaction-list');
    if (!container) return;

    const filters = {
      type: document.getElementById('filter-type')?.value || 'all',
      category: document.getElementById('filter-category')?.value || 'all',
      dateStart: document.getElementById('filter-date-start')?.value || '',
      dateEnd: document.getElementById('filter-date-end')?.value || '',
      search: document.getElementById('filter-search')?.value || ''
    };

    const filtered = this.transactionManager.filter(filters);
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    if (this.transactionPage > totalPages) this.transactionPage = totalPages;
    const startIdx = (this.transactionPage - 1) * ITEMS_PER_PAGE;
    const paged = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    if (paged.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p class="empty-text">Belum ada transaksi</p>
          <p class="empty-subtext">Mulai tambahkan transaksi pertama Anda</p>
        </div>
      `;
    } else {
      container.innerHTML = paged.map(tx => {
        let receiptHtml = '';
        if (tx.receiptUrl) {
          receiptHtml = ` <a href="${tx.receiptUrl}" target="_blank" style="font-size:10px; color:var(--accent-cyan); text-decoration:none; margin-left:8px;">📎 Struk</a>`;
        }
        return `
        <tr class="tx-row" data-id="${tx.id}">
          <td>${this.formatDate(tx.date)}</td>
          <td>${tx.description || tx.category}${receiptHtml}</td>
          <td><span class="transaction-category-badge ${tx.type}">${tx.category}</span></td>
          <td style="text-transform:capitalize; color:${tx.type === 'income' ? 'var(--income-color)' : 'var(--expense-color)'}">${tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</td>
          <td class="transaction-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'} ${this.formatCurrency(tx.amount)}</td>
          <td>
            <div class="transaction-actions" style="display:flex; gap:8px;">
              <button class="btn-icon btn-edit" onclick="app.editTransaction('${tx.id}')" title="Edit">✏️</button>
              <button class="btn-icon btn-delete" onclick="app.deleteTransaction('${tx.id}')" title="Hapus">🗑️</button>
            </div>
          </td>
        </tr>
      `}).join('');
    }

    /* Transaction count */
    const countEl = document.getElementById('transaction-count');
    if (countEl) countEl.textContent = `${filtered.length} transaksi`;

    /* Pagination */
    this._renderPagination(totalPages);
  }

  _renderPagination(totalPages) {
    const container = document.getElementById('transaction-pagination');
    if (!container) return;

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button class="btn-page ${this.transactionPage === 1 ? 'disabled' : ''}" onclick="app.goToPage(${this.transactionPage - 1})" ${this.transactionPage === 1 ? 'disabled' : ''}>‹</button>`;
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7) {
        if (p === 1 || p === totalPages || (p >= this.transactionPage - 1 && p <= this.transactionPage + 1)) {
          html += `<button class="btn-page ${p === this.transactionPage ? 'active' : ''}" onclick="app.goToPage(${p})">${p}</button>`;
        } else if (p === this.transactionPage - 2 || p === this.transactionPage + 2) {
          html += `<span class="page-ellipsis">…</span>`;
        }
      } else {
        html += `<button class="btn-page ${p === this.transactionPage ? 'active' : ''}" onclick="app.goToPage(${p})">${p}</button>`;
      }
    }
    html += `<button class="btn-page ${this.transactionPage === totalPages ? 'disabled' : ''}" onclick="app.goToPage(${this.transactionPage + 1})" ${this.transactionPage === totalPages ? 'disabled' : ''}>›</button>`;

    container.innerHTML = html;
  }

  goToPage(page) {
    if (page < 1) return;
    this.transactionPage = page;
    this.renderTransactionList();
  }

  renderRecentTransactions() {
    const container = document.getElementById('recent-transactions');
    if (!container) return;

    const recent = [...this.transactionManager.transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    if (recent.length === 0) {
      container.innerHTML = `
        <div class="empty-state small">
          <p class="empty-text">Belum ada transaksi</p>
        </div>
      `;
      return;
    }

    container.innerHTML = recent.map(tx => `
      <tr class="tx-row" data-id="${tx.id}">
        <td>${this.formatDate(tx.date)}</td>
        <td>${tx.description || tx.category}</td>
        <td><span class="transaction-category-badge ${tx.type}">${tx.category}</span></td>
        <td class="transaction-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'} ${this.formatCurrency(tx.amount)}</td>
      </tr>
    `).join('');
  }

  /* ─── Bill Operations ─── */
  saveBill() {
    const name = document.getElementById('bill-name')?.value;
    const amount = document.getElementById('bill-amount')?.value;
    const dueDate = document.getElementById('bill-due-date')?.value;
    const category = document.getElementById('bill-category')?.value || 'Tagihan';
    const notes = document.getElementById('bill-notes')?.value || '';

    if (!name || !amount || !dueDate) {
      this.notificationManager.show('Nama, jumlah, dan tanggal jatuh tempo wajib diisi!', 'error');
      return;
    }
    if (parseFloat(amount) <= 0) {
      this.notificationManager.show('Jumlah harus lebih dari 0!', 'error');
      return;
    }
    const dd = parseInt(dueDate);
    if (dd < 1 || dd > 31) {
      this.notificationManager.show('Tanggal jatuh tempo harus antara 1-31!', 'error');
      return;
    }

    if (this.editingBillId) {
      this.billManager.update(this.editingBillId, { name, amount, dueDate: dd, category, notes });
      this.notificationManager.show('Tagihan berhasil diperbarui!', 'success');
    } else {
      this.billManager.add({ name, amount, dueDate: dd, category, notes });
      this.notificationManager.show('Tagihan berhasil ditambahkan!', 'success');
    }

    this.closeModal('modal-bill');
    this.saveData();
    this.renderBillList();
    this.updateDashboard();
  }

  deleteBill(id) {
    this.showConfirm('Hapus Tagihan', 'Apakah Anda yakin ingin menghapus tagihan ini?', () => {
      this.billManager.delete(id);
      this.notificationManager.show('Tagihan berhasil dihapus!', 'success');
      this.saveData();
      this.renderBillList();
      this.updateDashboard();
    });
  }

  editBill(id) {
    this.openModal('bill', id);
  }

  toggleBillPaid(id) {
    const bill = this.billManager.getById(id);
    if (!bill) return;
    if (bill.paidThisMonth) {
      this.billManager.markAsUnpaid(id);
      this.notificationManager.show(`Tagihan "${bill.name}" ditandai belum lunas.`, 'info');
    } else {
      this.billManager.markAsPaid(id);
      this.notificationManager.show(`Tagihan "${bill.name}" ditandai lunas!`, 'success');
    }
    this.saveData();
    this.renderBillList();
    this.updateDashboard();
  }

  renderBillList() {
    const container = document.getElementById('bill-list');
    if (!container) return;

    if (this.billManager.bills.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🧾</div>
          <p class="empty-text">Belum ada tagihan</p>
          <p class="empty-subtext">Tambahkan tagihan rutin Anda</p>
        </div>
      `;
      return;
    }

    const filterStart = document.getElementById('filter-date-start-bills')?.value || '';
    const filterEnd = document.getElementById('filter-date-end-bills')?.value || '';

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const filteredBills = this.billManager.bills.filter(bill => {
      if (!filterStart && !filterEnd) return true;
      
      const billDate = new Date(currentYear, currentMonth, bill.dueDate);
      billDate.setHours(0,0,0,0);

      if (filterStart) {
        const sDate = new Date(filterStart);
        sDate.setHours(0,0,0,0);
        if (billDate < sDate) return false;
      }
      if (filterEnd) {
        const eDate = new Date(filterEnd);
        eDate.setHours(0,0,0,0);
        if (billDate > eDate) return false;
      }
      return true;
    });

    if (filteredBills.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p class="empty-text">Tidak ada tagihan yang sesuai dengan filter.</p>
        </div>
      `;
      return;
    }

    const sorted = [...filteredBills].sort((a, b) => a.dueDate - b.dueDate);
    const today = now.getDate();

    container.innerHTML = sorted.map(bill => {
      const isOverdue = !bill.paidThisMonth && bill.dueDate < today;
      const isDueSoon = !bill.paidThisMonth && bill.dueDate >= today && bill.dueDate - today <= 3;
      let statusClass = '';
      let statusText = '';
      if (bill.paidThisMonth) {
        statusClass = 'paid';
        statusText = 'LUNAS';
      } else if (isOverdue) {
        statusClass = 'overdue';
        statusText = 'TERLAMBAT';
      } else if (isDueSoon) {
        statusClass = 'due-soon';
        statusText = 'SEGERA';
      } else {
        statusClass = 'pending';
        statusText = 'MENUNGGU';
      }

      return `
        <div class="bill-card ${statusClass}">
          <div class="bill-header">
            <div class="bill-info">
              <h4 class="bill-name">${bill.name}</h4>
              <span class="bill-category">${bill.category}</span>
            </div>
            <div class="bill-status ${statusClass}">${statusText}</div>
          </div>
          <div class="bill-body">
            <div class="bill-amount">${this.formatCurrency(bill.amount)}</div>
            <div class="bill-due">Jatuh tempo: Tanggal ${bill.dueDate}</div>
            ${bill.notes ? `<div class="bill-notes">${bill.notes}</div>` : ''}
          </div>
          <div class="bill-footer">
            <button class="btn-ghost btn-sm" onclick="app.toggleBillPaid('${bill.id}')">
              ${bill.paidThisMonth ? '↩ Belum Lunas' : '✓ Tandai Lunas'}
            </button>
            <div class="bill-actions">
              <button class="btn-icon" onclick="app.editBill('${bill.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="app.deleteBill('${bill.id}')" title="Hapus">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ─── Savings Operations ─── */
  saveSavingsGoal() {
    const name = document.getElementById('savings-name')?.value;
    const target = document.getElementById('savings-target')?.value;
    const current = document.getElementById('savings-current')?.value || '0';
    const icon = document.getElementById('savings-icon')?.value || '🎯';
    const deadline = document.getElementById('savings-deadline')?.value || '';

    if (!name || !target) {
      this.notificationManager.show('Nama dan target wajib diisi!', 'error');
      return;
    }
    if (parseFloat(target) <= 0) {
      this.notificationManager.show('Target harus lebih dari 0!', 'error');
      return;
    }

    if (this.editingSavingsId) {
      this.savingsManager.update(this.editingSavingsId, { name, target, current, icon, deadline });
      this.notificationManager.show('Target tabungan berhasil diperbarui!', 'success');
    } else {
      this.savingsManager.add({ name, target, current, icon, deadline });
      this.notificationManager.show('Target tabungan berhasil ditambahkan!', 'success');
    }

    this.closeModal('modal-savings');
    this.saveData();
    this.renderSavingsList();
    this.updateDashboard();
    this.updateCharts();
  }

  deleteSavingsGoal(id) {
    this.showConfirm('Hapus Target', 'Apakah Anda yakin ingin menghapus target tabungan ini?', () => {
      this.savingsManager.delete(id);
      this.notificationManager.show('Target tabungan berhasil dihapus!', 'success');
      this.saveData();
      this.renderSavingsList();
      this.updateDashboard();
      this.updateCharts();
    });
  }

  editSavingsGoal(id) {
    this.openModal('savings', id);
  }

  addToSavings(id) {
    this.addToSavingsId = id;
    this.openModal('add-savings-amount');
    const goal = this.savingsManager.getById(id);
    const labelEl = document.getElementById('add-savings-label');
    if (labelEl && goal) {
      const remaining = goal.target - goal.current;
      labelEl.textContent = `${goal.icon} ${goal.name} — Sisa: ${this.formatCurrency(remaining)}`;
    }
  }

  withdrawFromSavings(id) {
    this.addToSavingsId = id;
    const goal = this.savingsManager.getById(id);
    if (!goal) return;

    this.openModal('add-savings-amount');
    const labelEl = document.getElementById('add-savings-label');
    if (labelEl) {
      labelEl.textContent = `Tarik dari: ${goal.icon} ${goal.name} — Saldo: ${this.formatCurrency(goal.current)}`;
    }
    /* Tag this as withdrawal */
    const modeInput = document.getElementById('add-savings-mode');
    if (modeInput) modeInput.value = 'withdraw';
  }

  confirmAddToSavings() {
    const amountEl = document.getElementById('add-savings-amount-input');
    const modeInput = document.getElementById('add-savings-mode');
    const amount = amountEl ? parseFloat(amountEl.value) : 0;
    const mode = modeInput ? modeInput.value : 'add';

    if (!amount || amount <= 0) {
      this.notificationManager.show('Masukkan jumlah yang valid!', 'error');
      return;
    }

    if (!this.addToSavingsId) return;

    if (mode === 'withdraw') {
      const goal = this.savingsManager.getById(this.addToSavingsId);
      if (goal && amount > goal.current) {
        this.notificationManager.show('Jumlah penarikan melebihi saldo tabungan!', 'error');
        return;
      }
      this.savingsManager.withdrawAmount(this.addToSavingsId, amount);
      this.notificationManager.show('Penarikan berhasil!', 'success');
    } else {
      this.savingsManager.addAmount(this.addToSavingsId, amount);
      this.notificationManager.show('Tabungan berhasil ditambahkan!', 'success');
    }

    /* Reset mode */
    if (modeInput) modeInput.value = 'add';

    this.closeModal('modal-add-savings-amount');
    this.saveData();
    this.renderSavingsList();
    this.updateDashboard();
    this.updateCharts();
  }

  renderSavingsList() {
    const container = document.getElementById('savings-list');
    if (!container) return;

    if (this.savingsManager.goals.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <p class="empty-text">Belum ada target tabungan</p>
          <p class="empty-subtext">Mulai tetapkan tujuan keuangan Anda</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.savingsManager.goals.map(goal => {
      const progress = this.savingsManager.getProgress(goal.id);
      const remaining = goal.target - goal.current;
      const isComplete = progress >= 100;
      let deadlineText = '';
      if (goal.deadline) {
        const dl = new Date(goal.deadline);
        const now = new Date();
        const daysLeft = Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
        deadlineText = daysLeft > 0
          ? `${daysLeft} hari tersisa`
          : daysLeft === 0 ? 'Hari ini!' : 'Sudah lewat!';
      }

      return `
        <div class="savings-card ${isComplete ? 'completed' : ''}">
          <div class="savings-header">
            <div class="savings-icon">${goal.icon}</div>
            <div class="savings-info">
              <h4 class="savings-name">${goal.name}</h4>
              ${deadlineText ? `<span class="savings-deadline">${deadlineText}</span>` : ''}
            </div>
            <div class="savings-progress-pct">${progress.toFixed(1)}%</div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
          </div>
          <div class="savings-amounts">
            <span class="savings-current">${this.formatCurrency(goal.current)}</span>
            <span class="savings-target">/ ${this.formatCurrency(goal.target)}</span>
          </div>
          ${!isComplete ? `<div class="savings-remaining">Kurang: ${this.formatCurrency(remaining)}</div>` : '<div class="savings-complete-badge">🎉 Tercapai!</div>'}
          <div class="savings-footer">
            <button class="btn-gold btn-sm" onclick="app.addToSavings('${goal.id}')">+ Tambah</button>
            <button class="btn-ghost btn-sm" onclick="app.withdrawFromSavings('${goal.id}')">- Tarik</button>
            <div class="savings-actions">
              <button class="btn-icon" onclick="app.editSavingsGoal('${goal.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="app.deleteSavingsGoal('${goal.id}')" title="Hapus">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ─── Dashboard ─── */
  updateDashboard() {
    const year = this.dashboardYear;
    const month = this.dashboardMonth;

    const income = this.transactionManager.getTotalIncome(year, month);
    const expense = this.transactionManager.getTotalExpense(year, month);
    const balance = this.transactionManager.getBalance();
    const savings = this.savingsManager.getTotalSavings();

    /* Update card values */
    this._setCardValue('card-income', income);
    this._setCardValue('card-expense', expense);
    this._setCardValue('card-balance', balance);
    this._setCardValue('card-savings', savings);

    /* Trends: compare with previous month */
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 0) { prevMonth = 11; prevYear--; }

    const prevIncome = this.transactionManager.getTotalIncome(prevYear, prevMonth);
    const prevExpense = this.transactionManager.getTotalExpense(prevYear, prevMonth);

    this._setCardTrend('card-income', income, prevIncome);
    this._setCardTrend('card-expense', expense, prevExpense);

    /* Render recent transactions */
    this.renderRecentTransactions();

    /* Bills summary on dashboard */
    this._updateDashboardBillsSummary();
  }

  _setCardValue(cardId, value) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const valEl = card.querySelector('.card-value');
    if (valEl) valEl.textContent = this.formatCurrency(value);
  }

  _setCardTrend(cardId, current, previous) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const trendEl = card.querySelector('.card-trend');
    if (!trendEl) return;

    if (previous === 0 && current === 0) {
      trendEl.textContent = '';
      trendEl.className = 'card-trend';
      return;
    }

    let pctChange;
    if (previous === 0) {
      pctChange = 100;
    } else {
      pctChange = ((current - previous) / previous) * 100;
    }

    const arrow = pctChange >= 0 ? '▲' : '▼';
    trendEl.textContent = `${arrow} ${Math.abs(pctChange).toFixed(1)}% dari bulan lalu`;
    trendEl.className = 'card-trend ' + (pctChange >= 0 ? 'trend-up' : 'trend-down');
  }

  _updateDashboardBillsSummary() {
    const el = document.getElementById('dashboard-bills-summary');
    if (!el) return;
    const total = this.billManager.bills.length;
    const paid = this.billManager.getPaidCount();
    const overdue = this.billManager.getOverdue().length;
    el.innerHTML = `
      <span>${paid}/${total} lunas</span>
      ${overdue > 0 ? `<span class="text-expense">${overdue} terlambat</span>` : ''}
    `;
  }

  updateCharts() {
    const year = this.dashboardYear;
    const month = this.dashboardMonth;

    const monthlyData = this.transactionManager.getMonthlyTotals(year);
    this.chartManager.updateIncomeExpenseChart(monthlyData);

    const categoryData = this.transactionManager.getCategoryBreakdown(year, month, 'expense');
    this.chartManager.updateCategoryChart(categoryData);

    /* Balance trend */
    const balanceTrend = [];
    let runningBalance = 0;
    for (let m = 0; m < 12; m++) {
      const inc = this.transactionManager.getTotalIncome(year, m);
      const exp = this.transactionManager.getTotalExpense(year, m);
      runningBalance += inc - exp;
      balanceTrend.push(runningBalance);
    }

    const totalSavings = this.savingsManager.getTotalSavings();
    const savingsTrend = new Array(12).fill(totalSavings);

    this.chartManager.updateTrendChart({ balance: balanceTrend, savings: savingsTrend });
  }

  /* ─── Reports ─── */
  renderReportSummary() {
    const container = document.getElementById('report-summary');
    if (!container) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const income = this.transactionManager.getTotalIncome(year, month);
    const expense = this.transactionManager.getTotalExpense(year, month);
    const balance = this.transactionManager.getBalance();
    const savings = this.savingsManager.getTotalSavings();
    const monthlyTotals = this.transactionManager.getMonthlyTotals(year);
    const txCount = this.transactionManager.getByMonth(year, month).length;

    /* Category breakdown */
    const expenseBreakdown = this.transactionManager.getCategoryBreakdown(year, month, 'expense');
    const incomeBreakdown = this.transactionManager.getCategoryBreakdown(year, month, 'income');

    /* Annual totals */
    const annualIncome = monthlyTotals.reduce((s, m) => s + m.income, 0);
    const annualExpense = monthlyTotals.reduce((s, m) => s + m.expense, 0);

    container.innerHTML = `
      <div class="report-section">
        <h3 class="report-title">RINGKASAN ${MONTH_NAMES[month].toUpperCase()} ${year}</h3>
        <div class="report-grid">
          <div class="report-stat">
            <div class="report-stat-label">Total Pemasukan</div>
            <div class="report-stat-value income">${this.formatCurrency(income)}</div>
          </div>
          <div class="report-stat">
            <div class="report-stat-label">Total Pengeluaran</div>
            <div class="report-stat-value expense">${this.formatCurrency(expense)}</div>
          </div>
          <div class="report-stat">
            <div class="report-stat-label">Saldo Keseluruhan</div>
            <div class="report-stat-value balance">${this.formatCurrency(balance)}</div>
          </div>
          <div class="report-stat">
            <div class="report-stat-label">Jumlah Transaksi</div>
            <div class="report-stat-value">${txCount}</div>
          </div>
        </div>
      </div>

      <div class="report-section">
        <h3 class="report-title">RINGKASAN TAHUNAN ${year}</h3>
        <div class="report-grid">
          <div class="report-stat">
            <div class="report-stat-label">Pemasukan Tahun Ini</div>
            <div class="report-stat-value income">${this.formatCurrency(annualIncome)}</div>
          </div>
          <div class="report-stat">
            <div class="report-stat-label">Pengeluaran Tahun Ini</div>
            <div class="report-stat-value expense">${this.formatCurrency(annualExpense)}</div>
          </div>
          <div class="report-stat">
            <div class="report-stat-label">Selisih Bersih</div>
            <div class="report-stat-value ${annualIncome - annualExpense >= 0 ? 'income' : 'expense'}">${this.formatCurrency(annualIncome - annualExpense)}</div>
          </div>
          <div class="report-stat">
            <div class="report-stat-label">Total Tabungan</div>
            <div class="report-stat-value savings">${this.formatCurrency(savings)}</div>
          </div>
        </div>
      </div>

      ${expenseBreakdown.length > 0 ? `
      <div class="report-section">
        <h3 class="report-title">PENGELUARAN PER KATEGORI</h3>
        <div class="report-categories">
          ${expenseBreakdown.map((cat, i) => {
            const pct = expense > 0 ? ((cat.amount / expense) * 100).toFixed(1) : 0;
            return `
              <div class="report-category-item">
                <div class="report-category-bar" style="width: ${pct}%; background: ${CHART_CATEGORY_COLORS[i % CHART_CATEGORY_COLORS.length]}"></div>
                <span class="report-category-name">${cat.category}</span>
                <span class="report-category-value">${this.formatCurrency(cat.amount)} (${pct}%)</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>` : ''}

      ${incomeBreakdown.length > 0 ? `
      <div class="report-section">
        <h3 class="report-title">PEMASUKAN PER KATEGORI</h3>
        <div class="report-categories">
          ${incomeBreakdown.map((cat, i) => {
            const pct = income > 0 ? ((cat.amount / income) * 100).toFixed(1) : 0;
            return `
              <div class="report-category-item">
                <div class="report-category-bar" style="width: ${pct}%; background: ${CHART_CATEGORY_COLORS[i % CHART_CATEGORY_COLORS.length]}"></div>
                <span class="report-category-name">${cat.category}</span>
                <span class="report-category-value">${this.formatCurrency(cat.amount)} (${pct}%)</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>` : ''}
    `;
  }

  /* ─── Data Persistence ─── */
  async saveData() {
    const appData = {
      transactions: this.transactionManager.transactions,
      bills: this.billManager.bills,
      savings: this.savingsManager.goals,
      lastSaved: new Date().toISOString()
    };
    try {
      await this.storageManager.saveAll(appData);
    } catch (err) {
      this.notificationManager.show('Gagal menyimpan data: ' + err.message, 'error');
    }
  }

  async loadData() {
    try {
      const data = await this.storageManager.loadAll();
      if (data) {
        this.transactionManager.transactions = data.transactions || [];
        this.billManager.bills = data.bills || [];
        this.savingsManager.goals = data.savings || [];
      }
    } catch (err) {
      throw err;
    }
  }

  /* ─── Utility Methods ─── */
  formatCurrency(amount) {
    const num = Number(amount);
    if (isNaN(num)) return 'Rp 0';
    const absFormatted = Math.abs(num).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (num < 0 ? '-Rp ' : 'Rp ') + absFormatted;
  }

  formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month.substring(0, 3)} ${year}`;
  }

  formatDateFull(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  _todayString() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  _updateCategoryOptions(type) {
    const catSelect = document.getElementById('transaction-category');
    if (!catSelect) return;
    const cats = CATEGORIES[type] || CATEGORIES.expense;
    catSelect.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  _populateMonthFilter() {
    const select = document.getElementById('dashboard-month-filter');
    if (!select) return;

    /* Collect all unique months from transactions */
    const monthSet = new Set();
    const now = new Date();
    /* Always include current month */
    monthSet.add(`${now.getFullYear()}-${now.getMonth()}`);

    this.transactionManager.transactions.forEach(tx => {
      const d = new Date(tx.date);
      monthSet.add(`${d.getFullYear()}-${d.getMonth()}`);
    });

    const months = [...monthSet].map(k => {
      const [y, m] = k.split('-').map(Number);
      return { year: y, month: m, key: k };
    }).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    const currentVal = `${this.dashboardYear}-${this.dashboardMonth}`;

    select.innerHTML = months.map(m =>
      `<option value="${m.year}-${m.month}" ${m.key === currentVal ? 'selected' : ''}>${MONTH_NAMES[m.month]} ${m.year}</option>`
    ).join('');
  }

  /* ─── Settings ─── */
  async enableEncryption() {
    const password = prompt('Masukkan password untuk mengenkripsi data:');
    if (!password) {
      const toggle = document.getElementById('encryption-toggle');
      if (toggle) toggle.checked = false;
      return;
    }
    const confirm = prompt('Konfirmasi password:');
    if (password !== confirm) {
      this.notificationManager.show('Password tidak cocok!', 'error');
      const toggle = document.getElementById('encryption-toggle');
      if (toggle) toggle.checked = false;
      return;
    }

    this.storageManager.setEncryption(true, password);
    await this.saveData();
    this.notificationManager.show('Enkripsi berhasil diaktifkan! Ingat password Anda.', 'success');
  }

  async disableEncryption() {
    this.showConfirm('Nonaktifkan Enkripsi', 'Data akan disimpan tanpa enkripsi. Lanjutkan?', async () => {
      this.storageManager.setEncryption(false, null);
      await this.saveData();
      this.notificationManager.show('Enkripsi dinonaktifkan.', 'info');
    });
    /* If user cancels, re-check the toggle */
  }

  async changePassword() {
    if (!this.storageManager.encryptionEnabled) {
      this.notificationManager.show('Enkripsi belum aktif!', 'warning');
      return;
    }
    const oldPw = prompt('Masukkan password lama:');
    if (!oldPw) return;
    if (oldPw !== this.storageManager.password) {
      this.notificationManager.show('Password lama salah!', 'error');
      return;
    }
    const newPw = prompt('Masukkan password baru:');
    if (!newPw) return;
    const confirmPw = prompt('Konfirmasi password baru:');
    if (newPw !== confirmPw) {
      this.notificationManager.show('Password baru tidak cocok!', 'error');
      return;
    }

    this.storageManager.setEncryption(true, newPw);
    await this.saveData();
    this.notificationManager.show('Password berhasil diubah!', 'success');
  }

  resetAllData() {
    this.showConfirm(
      'Reset Semua Data',
      'PERINGATAN: Semua data akan dihapus permanen dan tidak dapat dikembalikan. Apakah Anda yakin?',
      () => {
        this.storageManager.clear();
        this.transactionManager.transactions = [];
        this.billManager.bills = [];
        this.savingsManager.goals = [];
        this.updateDashboard();
        this.updateCharts();
        this.renderTransactionList();
        this.renderBillList();
        this.renderSavingsList();
        this.renderReportSummary();
        this._populateMonthFilter();
        this.notificationManager.show('Semua data telah direset!', 'info');
      }
    );
  }

  exportBackup() {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      transactions: this.transactionManager.transactions,
      bills: this.billManager.bills,
      savings: this.savingsManager.goals
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DompetKu_Backup_${this._todayString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.notificationManager.show('Backup berhasil diunduh!', 'success');
  }

  importBackup(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.transactions && !data.bills && !data.savings) {
          throw new Error('Format file tidak valid');
        }

        this.showConfirm(
          'Import Backup',
          'Data yang ada saat ini akan digantikan dengan data dari backup. Lanjutkan?',
          async () => {
            this.transactionManager.transactions = data.transactions || [];
            this.billManager.bills = data.bills || [];
            this.savingsManager.goals = data.savings || [];
            await this.saveData();
            this.updateDashboard();
            this.updateCharts();
            this.renderTransactionList();
            this.renderBillList();
            this.renderSavingsList();
            this.renderReportSummary();
            this._populateMonthFilter();
            this.notificationManager.show('Backup berhasil diimpor!', 'success');
          }
        );
      } catch (err) {
        this.notificationManager.show('Gagal mengimpor: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);

    /* Reset file input */
    event.target.value = '';
  }

  /* ─── Confirmation Dialog ─── */
  showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('modal-confirm');
    if (!modal) {
      /* Fallback to native confirm */
      if (confirm(message)) onConfirm();
      return;
    }

    const titleEl = modal.querySelector('.confirm-title');
    const msgEl = modal.querySelector('.confirm-message');
    const confirmBtn = modal.querySelector('.btn-confirm-yes');
    const cancelBtn = modal.querySelector('.btn-confirm-no');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    modal.classList.add('active');

    /* Clone buttons to remove old listeners */
    if (confirmBtn) {
      const newConfirm = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
      newConfirm.addEventListener('click', () => {
        modal.classList.remove('active');
        onConfirm();
      });
    }

    if (cancelBtn) {
      const newCancel = cancelBtn.cloneNode(true);
      cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
      newCancel.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }
  }
}


/* ============================================================
   Initialize Application
   ============================================================ */
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new App();
  app.init();
});


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

  // Bills Date Filters
  const filterDateStartBills = document.getElementById('filter-date-start-bills');
  const filterDateEndBills = document.getElementById('filter-date-end-bills');
  if (filterDateStartBills) filterDateStartBills.addEventListener('change', () => this.renderBillList());
  if (filterDateEndBills) filterDateEndBills.addEventListener('change', () => this.renderBillList());

  // Debts Date Filters
  const filterDateStartDebts = document.getElementById('filter-date-start-debts');
  const filterDateEndDebts = document.getElementById('filter-date-end-debts');
  if (filterDateStartDebts) filterDateStartDebts.addEventListener('change', () => this.renderDebtList());
  if (filterDateEndDebts) filterDateEndDebts.addEventListener('change', () => this.renderDebtList());
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
    
    return `
      <div class="budget-card">
        <div class="budget-header">
          <div class="budget-category-title">${b.category}</div>
          <div class="budget-actions">
            <button class="btn-icon" onclick="app.deleteBudget('${b.category}')" title="Hapus">🗑️</button>
          </div>
        </div>
        <div class="budget-amounts">
          <span>Terpakai: ${this.formatCurrency(current)}</span>
          <span>Batas: ${this.formatCurrency(b.limit)}</span>
        </div>
        <div class="budget-progress-bar">
          <div class="budget-progress-fill ${barClass}" style="width: ${progress}%"></div>
        </div>
        <div class="budget-amounts" style="justify-content: flex-end; font-weight: bold; color: var(--text-primary);">
          ${progress.toFixed(1)}%
        </div>
      </div>
    `;
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
  
  const filterStart = document.getElementById('filter-date-start-debts')?.value || '';
  const filterEnd = document.getElementById('filter-date-end-debts')?.value || '';
  
  let totPayable = 0;
  let totReceivable = 0;
  
  const filteredDebts = this.debtManager.debts.filter(d => !d.isPaid).filter(d => {
    if (!filterStart && !filterEnd) return true;
    if (!d.dueDate) return false; // If there is a date filter but no due date on debt, maybe hide it? Or show it? Let's hide if not matching.
    const dDate = new Date(d.dueDate);
    dDate.setHours(0,0,0,0);
    
    if (filterStart) {
      const sDate = new Date(filterStart);
      sDate.setHours(0,0,0,0);
      if (dDate < sDate) return false;
    }
    if (filterEnd) {
      const eDate = new Date(filterEnd);
      eDate.setHours(0,0,0,0);
      if (dDate > eDate) return false;
    }
    return true;
  });

  filteredDebts.forEach(d => {
    if (d.type === 'payable') totPayable += d.amount;
    else totReceivable += d.amount;
  });
  
  summary.innerHTML = `
    <div class="debt-summary-card payable">
      <div style="font-size:12px;color:var(--text-secondary)">Total Harus Dibayar (Hutang)</div>
      <div style="font-size:24px;font-weight:900;color:var(--expense-color);margin-top:8px;">${this.formatCurrency(totPayable)}</div>
    </div>
    <div class="debt-summary-card receivable">
      <div style="font-size:12px;color:var(--text-secondary)">Total Akan Diterima (Piutang)</div>
      <div style="font-size:24px;font-weight:900;color:var(--income-color);margin-top:8px;">${this.formatCurrency(totReceivable)}</div>
    </div>
  `;
  
  if (filteredDebts.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><p class="empty-text">Tidak ada catatan hutang/piutang yang sesuai.</p></div>';
    return;
  }
  
  container.innerHTML = filteredDebts.map(d => {
    const isPay = d.type === 'payable';
    return `
      <div class="debt-card ${d.type}">
        <div class="debt-header">
          <div class="debt-person">${d.person}</div>
          <div class="debt-type-badge ${d.type}">${isPay ? 'HUTANG' : 'PIUTANG'}</div>
        </div>
        <div class="debt-amount">${this.formatCurrency(d.amount)}</div>
        ${d.dueDate ? `<div style="font-size:12px;color:var(--text-secondary);">Jatuh Tempo: ${this.formatDate(d.dueDate)}</div>` : ''}
        <div class="debt-footer">
          <button class="btn-ghost btn-sm" onclick="app.payDebt('${d.id}')">✓ Tandai Lunas</button>
          <button class="btn-icon" onclick="app.deleteDebt('${d.id}')" title="Hapus">🗑️</button>
        </div>
      </div>
    `;
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
  
  document.getElementById('calc-inv-result').innerHTML = `
    <div class="calc-result-title">Estimasi Nilai Masa Depan</div>
    <div class="calc-result-value">${this.formatCurrency(fv)}</div>
    <div class="calc-result-detail">
      Total Setoran Pokok: ${this.formatCurrency(p + (m * t))}<br>
      Estimasi Bunga: ${this.formatCurrency(fv - (p + (m * t)))}
    </div>
  `;
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
  
  document.getElementById('calc-loan-result').innerHTML = `
    <div class="calc-result-title">Estimasi Cicilan Bulanan</div>
    <div class="calc-result-value">${this.formatCurrency(pmt)}</div>
    <div class="calc-result-detail">
      Total Pembayaran (Pokok + Bunga): ${this.formatCurrency(totalPay)}<br>
      Total Bunga: ${this.formatCurrency(totalPay - p)}
    </div>
  `;
};


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
  let savedToCloud = false;
  if (window.FirebaseManager) {
    try {
      await window.FirebaseManager.saveData(appData);
      savedToCloud = true;
    } catch (err) {
      this.notificationManager.show('Gagal ke Cloud (' + err.message + '). Menyimpan ke HP...', 'warning');
    }
  }
  if (!savedToCloud) {
    try {
      await this.storageManager.saveAll(appData);
    } catch (err) {
      this.notificationManager.show('Gagal menyimpan data: ' + err.message, 'error');
    }
  }
};

// Override loadData to use Firebase if available
const prevLoadData = App.prototype.loadData;
App.prototype.loadData = async function() {
  let data = null;
  if (window.FirebaseManager) {
    try {
      data = await window.FirebaseManager.loadData();
    } catch (err) {
      console.error("Firebase load error, falling back to local:", err);
    }
  }
  
  if (!data) {
    try {
      data = await this.storageManager.loadAll();
    } catch (err) {
      console.error("Local load error:", err);
    }
  }
  
  if (data) {
    this.transactionManager.transactions = data.transactions || [];
    this.billManager.bills = data.bills || [];
    this.savingsManager.goals = data.savings || [];
    this.budgetManager.budgets = data.budgets || [];
    this.debtManager.debts = data.debts || [];
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
    insightText = `Dalam 7 hari terakhir, Anda telah menghabiskan <strong>${this.formatCurrency(total7Days)}</strong>. `;
    
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
        insightText += `<br><span style="color:var(--expense-color)">Perhatian: Kategori <strong>${overBudget.join(', ')}</strong> sudah melebihi batas atau mendekati limit! Rem pengeluaran Anda.</span>`;
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


App.prototype.stdCalc = function(action) {
  const display = document.getElementById('std-calc-display');
  if (!display) return;
  
  if (this._calcValue === undefined) this._calcValue = "";
  
  if (action === 'clear') {
    this._calcValue = "";
  } else if (action === 'back') {
    if (this._calcValue === "Error") this._calcValue = "";
    else this._calcValue = this._calcValue.slice(0, -1);
  } else if (action === '=') {
    try {
      // Evaluate string safely via Function
      if (this._calcValue) {
        this._calcValue = String(new Function('return ' + this._calcValue)());
      }
    } catch(e) {
      this._calcValue = "Error";
    }
  } else {
    if (this._calcValue === "Error") this._calcValue = "";
    this._calcValue += action;
  }
  
  display.value = this._calcValue || "0";
};


// ─── AUTHENTICATION LOGIC ───
App.prototype.setupAuth = function() {
  const formAuth = document.getElementById('form-auth');
  const toggleMode = document.getElementById('auth-toggle-mode');
  const btnSubmit = document.getElementById('btn-auth-submit');
  const emailInput = document.getElementById('auth-email');
  const passInput = document.getElementById('auth-password');
  const btnLogout = document.getElementById('btn-logout');
  
  let isLoginMode = true;
  
  if (toggleMode) {
    toggleMode.addEventListener('click', (e) => {
      e.preventDefault();
      isLoginMode = !isLoginMode;
      btnSubmit.textContent = isLoginMode ? 'MASUK' : 'DAFTAR';
      toggleMode.innerHTML = isLoginMode ? 'Daftar di sini' : 'Masuk di sini';
      toggleMode.parentElement.innerHTML = isLoginMode 
        ? 'Belum punya akun? <a href="#" id="auth-toggle-mode" style="color:var(--accent-gold);">Daftar di sini</a>'
        : 'Sudah punya akun? <a href="#" id="auth-toggle-mode" style="color:var(--accent-gold);">Masuk di sini</a>';
      
      // re-attach listener because innerHTML wipes it
      document.getElementById('auth-toggle-mode').addEventListener('click', (ev) => {
        ev.preventDefault();
        toggleMode.click(); // recursive trigger trick won't work perfectly, let's just do it cleanly
      });
      this.setupAuth(); // re-init cleanly
    });
  }
  
  if (formAuth && !formAuth.dataset.bound) {
    formAuth.dataset.bound = "true";
    formAuth.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value;
      const pass = document.getElementById('auth-password').value;
      
      try {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'MEMPROSES...';
        
        if (isLoginMode) {
          await window.FirebaseManager.login(email, pass);
          this.notificationManager.show('Login berhasil!', 'success');
        } else {
          await window.FirebaseManager.register(email, pass);
          this.notificationManager.show('Pendaftaran berhasil!', 'success');
        }
      } catch (err) {
        this.notificationManager.show('Error: ' + err.message, 'error');
        btnSubmit.disabled = false;
        btnSubmit.textContent = isLoginMode ? 'MASUK' : 'DAFTAR';
      }
    });
  }
  
  if (btnLogout && !btnLogout.dataset.bound) {
    btnLogout.dataset.bound = "true";
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      if (confirm('Yakin ingin keluar?')) {
        await window.FirebaseManager.logout();
      }
    });
  }
};

// Hook into app initialization
const prevInitForAuth = App.prototype.init;
App.prototype.init = async function() {
  // Wait for firebase manager
  const checkInterval = setInterval(() => {
    if (window.FirebaseManager) {
      clearInterval(checkInterval);
      window.FirebaseManager.onAuthStateChanged(async (user) => {
        if (user) {
          document.getElementById('auth-screen').style.display = 'none';
          document.getElementById('app-container').style.display = 'flex';
          await this.loadData();
          this._finishInit();
          this.updateDashboard();
          this.updateCharts();
          this.renderTransactionList();
          this.notificationManager.show('Selamat datang kembali!', 'info');
        } else {
          document.getElementById('auth-screen').style.display = 'flex';
          document.getElementById('app-container').style.display = 'none';
          this.setupAuth();
        }
      });
    }
  }, 100);
  
  // We don't call prevInitForAuth because we completely override the startup flow
  this.budgetManager = new BudgetManager();
  this.debtManager = new DebtManager();
  this.themeManager.load();
};

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

// Override showConfirm to use native confirm robustly
App.prototype.showConfirm = function(title, message, onConfirm) {
  if (confirm(message)) {
    onConfirm();
  }
};
