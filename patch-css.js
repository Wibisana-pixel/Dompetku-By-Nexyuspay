const fs = require('fs');
const path = require('path');

const styleCss = path.join(__dirname, 'style.css');
let css = fs.readFileSync(styleCss, 'utf-8');

// Ensure --z-toast is in :root if missing
if (!css.includes('--z-toast:')) {
  css = css.replace(/--z-modal: 2000;/, '--z-modal: 2000;\n  --z-toast: 3000;');
}

const newStyles = `
/* ────────────────────────────────────────────────────────────
   20. BUDGET (ANGGARAN)
   ──────────────────────────────────────────────────────────── */
.budget-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
.budget-card {
  background: var(--bg-card);
  padding: 24px;
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
}
.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.budget-category-title {
  font-weight: 700;
  font-size: 16px;
}
.budget-actions {
  display: flex;
  gap: 8px;
}
.budget-progress-bar {
  height: 10px;
  background: var(--bg-secondary);
  margin: 12px 0;
  border-radius: 5px;
  overflow: hidden;
}
.budget-progress-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}
.budget-progress-fill.safe { background: var(--income-color); }
.budget-progress-fill.warning { background: var(--accent-gold); }
.budget-progress-fill.danger { background: var(--expense-color); }
.budget-amounts {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
}

/* ────────────────────────────────────────────────────────────
   21. DEBT (HUTANG/PIUTANG)
   ──────────────────────────────────────────────────────────── */
.debt-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}
.debt-summary-card {
  background: var(--bg-card);
  padding: 20px;
  border: 1px solid var(--border-color);
  text-align: center;
}
.debt-summary-card.receivable {
  border-bottom: 4px solid var(--income-color);
}
.debt-summary-card.payable {
  border-bottom: 4px solid var(--expense-color);
}
.debt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
.debt-card {
  background: var(--bg-card);
  padding: 24px;
  border: 1px solid var(--border-color);
  border-left: 4px solid;
}
.debt-card.payable { border-left-color: var(--expense-color); }
.debt-card.receivable { border-left-color: var(--income-color); }
.debt-header {
  display: flex;
  justify-content: space-between;
}
.debt-person {
  font-size: 16px;
  font-weight: 700;
}
.debt-type-badge {
  font-size: 10px;
  text-transform: uppercase;
  padding: 2px 6px;
  font-weight: 800;
}
.debt-type-badge.payable {
  background: rgba(255, 82, 82, 0.1);
  color: var(--expense-color);
}
.debt-type-badge.receivable {
  background: rgba(0, 230, 118, 0.1);
  color: var(--income-color);
}
.debt-amount {
  font-size: 24px;
  font-weight: 800;
  margin: 12px 0;
}
.debt-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

/* ────────────────────────────────────────────────────────────
   22. CALCULATOR
   ──────────────────────────────────────────────────────────── */
.calculator-container {
  max-width: 800px;
}
.calc-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}
.calc-tab {
  padding: 12px 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}
.calc-tab.active {
  background: var(--accent-gold);
  color: #000;
  border-color: var(--accent-gold);
}
.calc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
}
@media (max-width: 768px) {
  .calc-grid {
    grid-template-columns: 1fr;
  }
}
.calc-result {
  background: var(--bg-elevated);
  padding: 24px;
  border: 1px solid var(--border-color);
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.calc-result-title {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.calc-result-value {
  font-size: 32px;
  font-weight: 900;
  color: var(--accent-gold);
}
.calc-result-detail {
  margin-top: 16px;
  font-size: 14px;
  color: var(--text-primary);
}
`;

if (!css.includes('.budget-grid')) {
  css += '\n' + newStyles;
}

fs.writeFileSync(styleCss, css);
console.log('style.css patched');
