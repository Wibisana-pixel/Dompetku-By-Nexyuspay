const fs = require('fs');
const path = require('path');

/* -------------------------------------------------------------------------- */
/* 1. UPDATE FIREBASE-MANAGER.JS                                              */
/* -------------------------------------------------------------------------- */
const fbManagerPath = path.join(__dirname, 'firebase-manager.js');
let fbJs = fs.readFileSync(fbManagerPath, 'utf-8');

if (!fbJs.includes('firebase-auth.js')) {
  fbJs = `import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";\n` + fbJs;
  fbJs = fbJs.replace('const storage = getStorage(app);', 'const storage = getStorage(app);\nconst auth = getAuth(app);');
  
  // Inject auth methods
  const authMethods = `
  static onAuthStateChanged(callback) {
    onAuthStateChanged(auth, callback);
  }
  static async login(email, password) {
    return await signInWithEmailAndPassword(auth, email, password);
  }
  static async register(email, password) {
    return await createUserWithEmailAndPassword(auth, email, password);
  }
  static async logout() {
    return await signOut(auth);
  }
`;
  fbJs = fbJs.replace('window.FirebaseManager = class FirebaseManager {', 'window.FirebaseManager = class FirebaseManager {' + authMethods);
  
  // Replace doc paths
  fbJs = fbJs.replace(/const docRef = doc\(db, "users", "my-personal-data"\);/g, `
      if (!auth.currentUser) throw new Error("Sesi telah habis, silakan login ulang");
      const docRef = doc(db, "users", auth.currentUser.uid);
  `);
  
  // Storage paths
  fbJs = fbJs.replace(/const storageRef = ref\(storage, 'receipts\/' \+ filename\);/g, `
      if (!auth.currentUser) throw new Error("Sesi telah habis");
      const storageRef = ref(storage, 'receipts/' + auth.currentUser.uid + '/' + filename);
  `);
  
  fs.writeFileSync(fbManagerPath, fbJs);
  console.log('firebase-manager.js patched');
}

/* -------------------------------------------------------------------------- */
/* 2. UPDATE INDEX.HTML                                                       */
/* -------------------------------------------------------------------------- */
const indexHtmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf-8');

if (!html.includes('auth-screen')) {
  // Wrap app in app-container
  html = html.replace('<body>', '<body>\n  <div id="auth-screen" class="auth-screen">\n    <div class="auth-box">\n      <h1 class="brand-text" style="text-align:center; margin-bottom: 24px;">DOMPETKU <br><span style="font-size:12px; opacity:0.7">by Nexyuspay</span></h1>\n      <form id="form-auth" onsubmit="event.preventDefault();">\n        <div class="form-group">\n          <label class="form-label">Email</label>\n          <input type="email" id="auth-email" class="form-control" required>\n        </div>\n        <div class="form-group">\n          <label class="form-label">Password</label>\n          <input type="password" id="auth-password" class="form-control" required>\n        </div>\n        <button type="submit" class="btn btn-gold btn-block" id="btn-auth-submit">MASUK</button>\n        <p style="text-align:center; margin-top:16px; font-size:12px; color:var(--text-muted);">Belum punya akun? <a href="#" id="auth-toggle-mode" style="color:var(--accent-gold);">Daftar di sini</a></p>\n      </form>\n    </div>\n  </div>\n  <div id="app-container" style="display:none;">');
  
  html = html.replace('<script type="module" src="firebase-manager.js"></script>', '  </div>\n<script type="module" src="firebase-manager.js"></script>');
  
  // Add Logout button to sidebar
  const logoutBtnHtml = `
      <div class="sidebar-menu" style="margin-top:auto; padding-top:20px;">
        <a href="#" class="menu-item" id="btn-logout" style="color: var(--expense-color);">
          <span class="menu-icon">🚪</span>
          <span>Keluar (Logout)</span>
        </a>
      </div>
  `;
  html = html.replace('</nav>\n    <div class="sidebar-footer">', logoutBtnHtml + '</nav>\n    <div class="sidebar-footer">');
  
  fs.writeFileSync(indexHtmlPath, html);
  console.log('index.html patched');
}

/* -------------------------------------------------------------------------- */
/* 3. UPDATE APP.JS                                                           */
/* -------------------------------------------------------------------------- */
const appJsPath = path.join(__dirname, 'app.js');
let js = fs.readFileSync(appJsPath, 'utf-8');

if (!js.includes('App.prototype.setupAuth')) {
  const authJs = `
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
`;
  fs.appendFileSync(appJsPath, '\n' + authJs);
  console.log('app.js patched for auth');
}

/* -------------------------------------------------------------------------- */
/* 4. UPDATE STYLE.CSS                                                        */
/* -------------------------------------------------------------------------- */
const cssPath = path.join(__dirname, 'style.css');
let css = fs.readFileSync(cssPath, 'utf-8');

if (!css.includes('.auth-screen')) {
  css += `
/* Auth Screen */
.auth-screen {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: var(--bg-main);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.auth-box {
  background: var(--bg-card);
  padding: 40px;
  border-radius: var(--radius);
  border: 1px solid var(--border-color);
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}
`;
  fs.writeFileSync(cssPath, css);
  console.log('style.css patched for auth');
}
