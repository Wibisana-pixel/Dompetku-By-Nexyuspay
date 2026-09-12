const fs = require('fs');
const path = require('path');

const appJs = path.join(__dirname, 'app.js');
let js = fs.readFileSync(appJs, 'utf-8');

const regexTransactionList = /container\.innerHTML = paged\.map\(tx => \`\s*<div class="transaction-item"[\s\S]*?<\/div>\s*<\/div>\s*`\)\.join\(''\);/g;
const replacementTransactionList = `container.innerHTML = paged.map(tx => {
        let receiptHtml = '';
        if (tx.receiptUrl) {
          receiptHtml = \` <a href="\${tx.receiptUrl}" target="_blank" style="font-size:10px; color:var(--accent-cyan); text-decoration:none; margin-left:8px;">📎 Struk</a>\`;
        }
        return \`
        <tr class="transaction-item" data-id="\${tx.id}">
          <td>\${this.formatDate(tx.date)}</td>
          <td>\${tx.description || tx.category}\${receiptHtml}</td>
          <td><span class="transaction-category-badge \${tx.type}">\${tx.category}</span></td>
          <td style="text-transform:capitalize; color:\${tx.type === 'income' ? 'var(--income-color)' : 'var(--expense-color)'}">\${tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</td>
          <td class="transaction-amount \${tx.type}">\${tx.type === 'income' ? '+' : '-'} \${this.formatCurrency(tx.amount)}</td>
          <td>
            <div class="transaction-actions" style="display:flex; gap:8px;">
              <button class="btn-icon btn-edit" onclick="app.editTransaction('\${tx.id}')" title="Edit">✏️</button>
              <button class="btn-icon btn-delete" onclick="app.deleteTransaction('\${tx.id}')" title="Hapus">🗑️</button>
            </div>
          </td>
        </tr>
      \`}).join('');`;

js = js.replace(regexTransactionList, replacementTransactionList);

const regexRecentList = /container\.innerHTML = recent\.map\(tx => \`\s*<div class="transaction-item"[\s\S]*?<\/div>\s*<\/div>\s*`\)\.join\(''\);/g;
const replacementRecentList = `container.innerHTML = recent.map(tx => \`
        <tr class="transaction-item" data-id="\${tx.id}">
          <td>\${this.formatDate(tx.date)}</td>
          <td>\${tx.description || tx.category}</td>
          <td><span class="transaction-category-badge \${tx.type}">\${tx.category}</span></td>
          <td class="transaction-amount \${tx.type}">\${tx.type === 'income' ? '+' : '-'} \${this.formatCurrency(tx.amount)}</td>
        </tr>
      \`).join('');`;

js = js.replace(regexRecentList, replacementRecentList);

fs.writeFileSync(appJs, js);
console.log("Fixed tables in app.js");
