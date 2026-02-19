# LearnCraft AI - Akıllı Çalışma ve Öğrenme Platformu 🚀

LearnCraft AI, öğrencilerin ve profesyonellerin verimli bir şekilde çalışmasını sağlayan, yapay zeka destekli, çok kullanıcılı ve etkileşimli bir çalışma ortamıdır. Modern web teknolojileri ve Google Gemini AI entegrasyonu ile güçlendirilmiş bu platform, odalar (rooms) mantığıyla çalışarak kullanıcıların birlikte veya bireysel olarak ders çalışmalarına olanak tanır.

## 🌟 Temel Özellikler

Proje, `DESIGN_SPEC.md` dosyasında belirtilen kapsamlı özellik setine sahiptir:

### 🏠 Oda ve Çalışma Yönetimi
*   **Sanal Çalışma Odaları:** Kullanıcılar kendi odalarını oluşturabilir veya mevcut odalara katılabilir.
*   **Rol Yönetimi:** Oda sahibi ve üyeler arasında yetkilendirme sistemi.
*   **Gerçek Zamanlı Etkileşim:** Socket.io ile anlık veri senkronizasyonu.

### 🧠 Yapay Zeka Destekli Araçlar (Gemini AI)
*   **Deep Dive (AI Sohbet):** Konu bazlı, derinlemesine öğrenme sağlayan AI asistanı.
*   **Akıllı Quiz:** Zorluk seviyesini kullanıcının başarısına göre ayarlayan (adaptif) quizler. Yanlış cevaplarda AI detaylı açıklama yapar.
*   **Flashcards (Bilgi Kartları):** SM-2 algoritması ile aralıklı tekrar sistemi ve AI destekli görsel üretimi.
*   **Mind Map (Zihin Haritası):** Karmaşık konuları bölümlere ayıran ve görselleştiren haritalar (Mermaid.js).

### 🛠️ Diğer Verimlilik Araçları
*   **Sprint (Pomodoro):** Senkronize çalışabilen, grup odaklı zamanlayıcı.
*   **Notes:** Oda içi paylaşımlı not alma aracı.
*   **Materyal Yönetimi:** PDF ve Ses (Whisper entegrasyonu) desteği ile ders materyalleri üzerinden çalışma.

## 💻 Teknoloji Yığını (Tech Stack)

### Frontend (Web)
*   **React 19 & TypeScript:** Güçlü ve tip güvenli UI geliştirme.
*   **Vite:** Hızlı geliştirme sunucusu ve build aracı.
*   **Zustand:** Hafif ve performanslı durum yönetimi (state management).
*   **Framer Motion:** Akıcı animasyonlar ve geçişler.
*   **Mermaid.js:** Diyagram ve zihin haritaları çizimi.
*   **Socket.io Client:** Gerçek zamanlı iletişim.

### Backend (API)
*   **Node.js & Express:** Esnek ve ölçeklenebilir sunucu altyapısı.
*   **TypeScript:** Backend tarafında tip güvenliği.
*   **MongoDB & Mongoose:** Esnek veri modelleme ve veritabanı.
*   **Google Generative AI (Gemini):** Tüm yapay zeka işlemlerinin motoru.
*   **Socket.io:** WebSocket sunucusu.
*   **Multer:** Dosya yükleme işlemleri.

## 🚀 Kurulum ve Çalıştırma

Projeyi yerel ortamınızda çalıştırmak için aşağıdaki adımları izleyin:

### Gereksinimler
*   Node.js
*   MongoDB (Yerel veya Docker)
*   Google Gemini API Key

### Kurulum Adımları
1.  **Repoyu klonlayın:**
    ```bash
    git clone https://github.com/kullaniciadi/LearnCraft.git
    cd LearnCraft
    ```

2.  **Backend Kurulumu:**
    ```bash
    cd backend
    npm install
    # .env dosyasını oluşturun ve gerekli API anahtarlarını girin
    npm run dev
    ```

3.  **Frontend Kurulumu:**
    ```bash
    cd ../web
    npm install
    npm run dev
    ```

4.  **Veritabanı Başlatma:**
    Eğer Docker kullanıyorsanız:
    ```bash
    docker run -d --name mongo-learncraft -p 27017:27017 -v learncraft-data:/data/db mongo:7
    ```

## 🤝 Katkıda Bulunma
Pull requestler kabul edilir. Büyük değişiklikler için önce tartışma başlatmak üzere bir issue açınız.

## 📄 Lisans
[MIT](LICENSE)
