# 📝 AI Chat Notları & Kod Parçacıkları

Bu dosya, AI chat'ten kaydetmek istediğin yararlı bilgileri ve kod parçacıklarını içerir.

---

## 🔐 URL Gizleme Yöntemleri

### NodeBB'de Reverse Proxy ile Site Gömme
```javascript
// NodeBB Plugin - library.js
'use strict';

const fetch = require('node-fetch');
const TARGET_URL = 'https://hedef-site.com/sayfa';

const plugin = {};

plugin.init = async function (params) {
    const { router } = params;
    
    router.get('/embedded-content', async (req, res) => {
        try {
            const response = await fetch(TARGET_URL, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const html = await response.text();
            res.set('Content-Type', 'text/html');
            res.send(html);
        } catch (err) {
            res.status(500).send('Sayfa yüklenemedi');
        }
    });
};

module.exports = plugin;
```

### Cloudflare Workers ile Proxy
```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/gizli') {
      return fetch('https://hedef-site.com/sayfa');
    }
    return new Response('Not found', { status: 404 });
  }
}
```

---

## 💡 Kullanım
- Yeni bir snippet eklemek için: "Bunu kaydet" de, ben buraya eklerim
- Kategorilere göre düzenle (##, ### başlıkları)

---

*Son güncelleme: 2026-01-10*
