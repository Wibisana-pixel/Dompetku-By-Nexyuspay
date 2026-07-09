const fs = require('fs');
const path = require('path');

const indexHtml = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexHtml, 'utf-8');

// Fix Batal buttons to have btn-modal-cancel
html = html.replace(/<button class="btn btn-ghost" data-modal="([^"]+)">BATAL<\/button>/g, '<button type="button" class="btn btn-ghost btn-modal-cancel">BATAL</button>');

// Fix Simpan buttons to have type="submit"
html = html.replace(/<button class="btn btn-gold" id="btn-save-([^"]+)">SIMPAN<\/button>/g, '<button type="submit" class="btn btn-gold">SIMPAN</button>');
html = html.replace(/<button class="btn btn-gold" id="btn-confirm-([^"]+)">TAMBAH<\/button>/g, '<button type="submit" class="btn btn-gold">TAMBAH</button>');

// Move </form> to after <div class="modal-footer">...</div>
// We can find `</form>\n      </div>\n      <div class="modal-footer">` and replace it
html = html.replace(/<\/form>\s*<\/div>\s*<div class="modal-footer">\s*<button([^>]+)>BATAL<\/button>\s*<button([^>]+)>(SIMPAN|TAMBAH)<\/button>\s*<\/div>/g, 
  `</div>\n      <div class="modal-footer">\n        <button$1>BATAL</button>\n        <button$2>$3</button>\n      </div>\n        </form>`);

fs.writeFileSync(indexHtml, html);
console.log('index.html modals fixed');
