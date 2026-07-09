const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'app.js');
let appJs = fs.readFileSync(appPath, 'utf8');

if (!appJs.includes('if (type === \\'budget\\') {\\n      modalId = \\'modal-budget\\';\\n      const catSelect')) {
  appJs = appJs.replace(
    "if (type === 'budget') modalId = 'modal-budget';",
    `if (type === 'budget') {
      modalId = 'modal-budget';
      const catSelect = document.getElementById('budget-category');
      if (catSelect) {
        catSelect.innerHTML = CATEGORIES.expense.map(c => '<option value="'+c+'">'+c+'</option>').join('');
      }
    }`
  );
  fs.writeFileSync(appPath, appJs);
}

console.log('App.js patched successfully for budget-category.');
