const fs = require('fs');
const path = require('path');

const indexHtml = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexHtml, 'utf-8');

// 1. Add standard calculator tab
const tabAnchor = `<button class="calc-tab active" data-calc="investment">Bunga Majemuk</button>`;
if (!html.includes('data-calc="standard"')) {
  html = html.replace(tabAnchor, `<button class="calc-tab" data-calc="standard">Kalkulator Biasa</button>\n          ` + tabAnchor);
}

// 2. Add standard calculator UI
const uiAnchor = `<div id="calc-loan" class="calc-content" style="display: none;">`;
const stdCalcHtml = `
        <div id="calc-standard" class="calc-content" style="display: none;">
          <div class="std-calc-wrapper" style="max-width:300px; margin: 0 auto; background: var(--bg-card); border:1px solid var(--border-color); border-radius: var(--radius); padding:20px;">
             <input type="text" id="std-calc-display" disabled value="0" style="width:100%; height:50px; font-size:24px; text-align:right; margin-bottom:12px; background:var(--bg-secondary); border:1px solid var(--border-light); color:var(--text-primary); padding:10px;">
             <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px;">
                <button class="btn btn-ghost" onclick="app.stdCalc('clear')">C</button>
                <button class="btn btn-ghost" onclick="app.stdCalc('/')">÷</button>
                <button class="btn btn-ghost" onclick="app.stdCalc('*')">×</button>
                <button class="btn btn-ghost" onclick="app.stdCalc('back')">⌫</button>
                
                <button class="btn btn-secondary" onclick="app.stdCalc('7')">7</button>
                <button class="btn btn-secondary" onclick="app.stdCalc('8')">8</button>
                <button class="btn btn-secondary" onclick="app.stdCalc('9')">9</button>
                <button class="btn btn-ghost" onclick="app.stdCalc('-')">-</button>
                
                <button class="btn btn-secondary" onclick="app.stdCalc('4')">4</button>
                <button class="btn btn-secondary" onclick="app.stdCalc('5')">5</button>
                <button class="btn btn-secondary" onclick="app.stdCalc('6')">6</button>
                <button class="btn btn-ghost" onclick="app.stdCalc('+')">+</button>
                
                <button class="btn btn-secondary" onclick="app.stdCalc('1')">1</button>
                <button class="btn btn-secondary" onclick="app.stdCalc('2')">2</button>
                <button class="btn btn-secondary" onclick="app.stdCalc('3')">3</button>
                <button class="btn btn-gold" style="grid-row: span 2; height:100%;" onclick="app.stdCalc('=')">=</button>
                
                <button class="btn btn-secondary" style="grid-column: span 2;" onclick="app.stdCalc('0')">0</button>
                <button class="btn btn-secondary" onclick="app.stdCalc('.')">.</button>
             </div>
          </div>
        </div>
`;
if (!html.includes('id="calc-standard"')) {
  html = html.replace(uiAnchor, stdCalcHtml + '\n        ' + uiAnchor);
}

fs.writeFileSync(indexHtml, html);
console.log('Standard calc HTML added');

const appJs = path.join(__dirname, 'app.js');
let js = fs.readFileSync(appJs, 'utf-8');

if (!js.includes('App.prototype.stdCalc')) {
  const stdCalcJs = `
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
`;
  fs.appendFileSync(appJs, '\n' + stdCalcJs);
  console.log('Standard calc JS added');
}
