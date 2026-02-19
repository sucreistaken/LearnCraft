# LearnCraft AI - Çalışma Platformu Tasarım Spesifikasyonu

> 100 sorudan derlenen kapsamlı tasarım kararları

---

## 1. ONBOARDING & İLK DENEYİM

| Karar | Seçim |
|-------|-------|
| İlk açılış | Guided tour (adım adım tanıtım) |
| İlk ekran | Seçim sunulsun: "Oda Oluştur" veya "Odaya Katıl" |
| Oda oluşturma | Wizard (adım adım form) |
| Tek kişi kullanım | Desteklenmeli (solo çalışma) |
| Giriş sonrası varsayılan | Her zaman ana sayfa |
| Navigasyon | Sol sidebar ikonları yeterli |
| Dil | Sadece Türkçe |
| Materyal yükleme | Oda oluşturulurken zorunlu |
| Misafir erişimi | Herkese açık odaları görüntüleyebilsin |
| Ana sayfa içeriği | Sadece herkese açık odalar (keşfet) |

## 2. ODA YÖNETİMİ

| Karar | Seçim |
|-------|-------|
| Kanal/araç kategorileri | 2 sabit kategori: Araçlar ve Sohbet |
| Araç kanal yapısı | Tek araç, içinde sekmeler (örn: quiz aracı, içinde farklı quizler) |
| Araç ekleme yetkisi | Sadece oda sahibi |
| Oda konusu/dersi | Zorunlu alan |
| Oda sona erme | Süresiz (sona ermez) |
| Oda ayarları düzenleme | Tam düzenleme (oda sahibi) |
| Duyuru kanalı | Kaldırıldı (gereksiz) |
| Oda kapasitesi | Oda sahibi belirlesin |
| Özel vs herkese açık | İkon/badge farkı ile gösterim |
| Şablon kaydetme | Oda sahibi şablon kaydedebilsin |
| Çoklu oda üyelik | Sınırsız oda üyeliği |
| İnaktif odalar | 30+ gün inaktif → otomatik arşivle |
| Sahiplik devri | Oda sahibi ayrılırsa en eski üyeye otomatik devir |

## 3. ARAÇLAR - GENEL

| Karar | Seçim |
|-------|-------|
| Araçlar arası veri paylaşımı | Tek tıkla paylaşım |
| Materyal kapsamı | Oda seviyesinde tek materyal |
| Araç verisi sıfırlama | Sadece oda sahibi |
| Araç geçmişi/versiyon | Son 5 versiyon sakla |
| Activity log | Basit istatistik |
| Dışa aktarma | Tüm araçlar için (PDF, CSV, resim formatlarında) |
| AI içerik düzenleme | Sadece oda sahibi düzenleyebilir |
| Çakışma yönetimi | Real-time sync (Google Docs gibi) |
| Kilit modu | Evet, toggle ile (oda sahibi kilitler, üyeler izler) |
| Araç sıralama | Sadece oda sahibi sürükle-bırak |

## 4. QUIZ ARACI

| Karar | Seçim |
|-------|-------|
| Soru sayısı | Kullanıcı seçsin (5, 10, 15, 20) |
| Zorluk seviyesi | Otomatik artan (adaptif: doğru cevapladıkça zorlaşır) |
| Yanlış cevap sonrası | AI detaylı açıklama üretsin |
| Süre sınırı | Süresiz |
| Leaderboard | Sadece kişisel skor |
| Soru tipleri | Çoktan seçmeli + Doğru/Yanlış |

## 5. FLASHCARD ARACI

| Karar | Seçim |
|-------|-------|
| SM-2 algoritma | Oda geneli tek ilerleme |
| Görsel desteği | AI otomatik açıklayıcı görsel/diyagram üretsin |
| Çalışma modları | Klasik çevir (kart gör > düşün > çevir > bildim/bilmedim) |
| Deste/kategori | Tek deste yeterli |

## 6. DEEP DIVE ARACI (AI Sohbet)

| Karar | Seçim |
|-------|-------|
| Sohbet geçmişi | Konu başlıkları (thread gibi farklı konular) |
| AI yanıt görünürlük | Varsayılan kişisel + "odayla paylaş" butonu |
| Diğer araçlara dönüştürme | Sadece "not olarak kaydet" butonu |

## 7. MIND MAP ARACI

| Karar | Seçim |
|-------|-------|
| İnteraktiflik | Mermaid.js render yeterli (şu anki sistem) |
| Çoklu harita | AI materyal büyükse otomatik böl (bölüm başına) |

## 8. SPRINT ARACI (Pomodoro)

| Karar | Seçim |
|-------|-------|
| Çalışma modu | Senkron timer (oda sahibi başlatır, herkes aynı anda) |
| Süre seçenekleri | Hazır şablonlar (25/5, 50/10, 90/20) |

## 9. NOTES ARACI

| Karar | Seçim |
|-------|-------|
| Metin formatı | Düz metin (formatlama yok) |
| Organizasyon | Pin + notlar içinde arama |
| Yazma yetkisi | Herkes not ekleyebilsin |

## 10. SOHBET

| Karar | Seçim |
|-------|-------|
| Kanal sayısı | Oda başına tek sohbet (genel) |
| Mesaj türleri | Metin + dosya (görsel/PDF paylaşımı) |
| Mesaj düzenleme/silme | Herkes kendini + oda sahibi herkesinkini silebilsin |
| Mention | @kullanıcı ile bildirimli bahsetme |
| Reaction | Yok (gereksiz) |
| Thread | Reply/alıntı (WhatsApp gibi, ayrı panel açılmasın) |
| AI bot (sohbette) | Yok (Deep Dive var) |
| Mesaj sayfalama | Tümü yüklensin (mini chat küçük) |

## 11. ÜYE YÖNETİMİ

| Karar | Seçim |
|-------|-------|
| Roller | Rollere gerek yok (sadece oda sahibi + üye) |
| Kick/Ban | İkisi de olsun |
| Üye profili | Avatar + isim + üniversite/bölüm bilgisi |
| Üye listesi sidebar | Toggle ile açılıp kapanabilsin (varsayılan kapalı) |
| Sahiplik devri | Oda sahibi ayrılırsa otomatik devir (en eski üyeye) |

## 12. ANA SAYFA & KEŞFET

| Karar | Seçim |
|-------|-------|
| Ana sayfa | Oda keşfet (herkese açık odalar listesi) |
| Filtreleme | Konu/ders bazlı filtre |
| Oda kart bilgileri | İsim + konu + üye sayısı |

## 13. BİLDİRİMLER

| Karar | Seçim |
|-------|-------|
| Bildirim sistemi | Uygulama içi + ses |
| Tetikleyici olaylar | Sadece @mention |
| Sessiz mod | Oda bazında aç/kapat |

## 14. MATERYAL YÖNETİMİ

| Karar | Seçim |
|-------|-------|
| Kabul edilen formatlar | PDF + ses (Whisper transkript) |
| AI otomatik işleme | Yok, kullanıcı hangi aracı isterse orada üret |
| Materyal görüntüleme | Oda içinde PDF viewer / transkript görüntüleyici |

## 15. UI/UX

| Karar | Seçim |
|-------|-------|
| Tema | Koyu + açık mod |
| Mobil uyumluluk | Sadece masaüstü |
| Animasyonlar | Orta seviye (sayfa geçişleri, modal açılış/kapanış, hover) |
| Loading durumları | Skeleton loader |
| Hata mesajları | Toast bildirim |
| Klavye kısayolları | Yok (gereksiz) |

## 16. KULLANICI KİMLİĞİ & PROFİL

| Karar | Seçim |
|-------|-------|
| Authentication | Tam auth (e-posta + şifre ile kayıt/giriş) |
| Profil sayfası | Basit profil (foto + isim + bölüm, düzenleme) |
| Avatar | Seçilebilir hazır avatar seti |
| Ayarlar sayfası | Profil + tema + bildirim + şifre değiştir + hesap sil |

## 17. GÜVENLİK

| Karar | Seçim |
|-------|-------|
| İçerik filtresi | Raporlama (üyeler mesaj raporlayabilsin) |
| Dosya güvenliği | Tip (PDF, resim) + boyut limiti |

## 18. SOSYAL ÖZELLİKLER

| Karar | Seçim |
|-------|-------|
| DM (özel mesaj) | Global DM (platform genelinde) |
| Arkadaşlık | Sadece DM için gerekli (arkadaş ekle → DM at) |

## 19. DAVET & PAYLAŞIM

| Karar | Seçim |
|-------|-------|
| Davet linki | Oda sahibi süre ve kullanım sayısını ayarlasın |
| Herkese açık odalar | Keşfetten direkt katıl (davet gerekmez) |
| Oda verisi dış paylaşım | Oda sahibi ayarlardan açıp kapatsın |

## 20. TEKNİK KARARLAR

| Karar | Seçim |
|-------|-------|
| Veritabanı | MongoDB'ye geçiş |
| Rate limiting | Şimdilik gereksiz |
| Disconnect yönetimi | Otomatik yeniden bağlan (sessizce) |
| AI model | Gemini (ileride alternatifler düşünülebilir) |
| Deployment | İleride karar verilir |
| Arama | Sadece oda arama (isme/konuya göre) |
| Gamification | Yok (gereksiz) |
| Sunum modu | Yok (gereksiz) |

## 21. ÖNCELİK SIRASI

**Önce AI çalışma araçları mükemmel olsun, sosyal özellikler sonra.**

### Önerilen Geliştirme Sırası:
1. **Faz 1**: Auth sistemi + MongoDB geçişi (altyapı)
2. **Faz 2**: Oda sistemi yeniden tasarım (wizard, keşfet, materyal)
3. **Faz 3**: AI araçları iyileştirme (quiz adaptif, flashcard görsel, deep-dive thread, mind-map bölümleme)
4. **Faz 4**: Sohbet iyileştirme (reply, mention, dosya paylaşım)
5. **Faz 5**: Bildirimler + dışa aktarma
6. **Faz 6**: DM + arkadaşlık sistemi
7. **Faz 7**: Tema (açık/koyu), ayarlar, profil
8. **Faz 8**: Real-time sync, kilit modu, arşivleme
