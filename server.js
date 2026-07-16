const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Hayalet oyuncuları (disconnect gecikmelerini) önlemek için ping sürelerini agresifleştiriyoruz
const io = socketIo(server, {
  pingInterval: 2000,
  pingTimeout: 5000,
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const players = {};
// Platform sınırları (Genişletilmiş platform: 100x100 -> Sınırlar -49 ile 49 arası)
const MAP_LIMIT = 49; 

io.on('connection', (socket) => {
  console.log(`Yeni bağlantı sağlandı: ${socket.id}`);

  socket.on('joinGame', (username) => {
    // Boşlukları temizle ve sadece küçük harf filtresini sunucuda da doğrula
    const sanitizedName = username.trim().toLowerCase();
    const nameRegex = /^[a-zçğıöşuü]+$/;

    if (!nameRegex.test(sanitizedName)) {
      socket.emit('loginError', 'Kullanıcı adı sadece küçük harflerden oluşmalıdır!');
      return;
    }

    // Çakışan aktif kullanıcı kontrolü (Case-insensitive)
    const nameExists = Object.values(players).some(
      (p) => p.username.toLowerCase() === sanitizedName
    );

    if (nameExists) {
      socket.emit('loginError', 'Bu isim zaten kullanılıyor!');
      return;
    }

    // Oyuncuyu oluştur (Canı 100 olarak başlar)
    players[socket.id] = {
      id: socket.id,
      username: username, // Orijinal yazımı koru
      x: Math.random() * 20 - 10,
      y: 1, // Kapsülün y yüksekliği
      z: Math.random() * 20 - 10,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16),
      hp: 100,
      maxHp: 100
    };

    // Giriş başarılı
    socket.emit('loginSuccess', {
      myId: socket.id,
      players: players
    });

    // Diğer oyunculara haber ver
    socket.broadcast.emit('playerJoined', players[socket.id]);
    console.log(`${username} oyuna katıldı. Aktif oyuncu: ${Object.keys(players).length}`);
  });

  // Hareket verilerini güncelle ve sınırla
  socket.on('move', (data) => {
    const player = players[socket.id];
    if (player) {
      player.x = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, data.x));
      player.z = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, data.z));
      player.y = data.y;
      
      // Konumu tüm oyunculara yayınla
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        x: player.x,
        y: player.y,
        z: player.z
      });
    }
  });

  // PvP Vurma (Combat) Mekaniği
  socket.on('hitPlayer', (data) => {
    const attacker = players[socket.id];
    const victim = players[data.targetId];

    if (attacker && victim && victim.hp > 0) {
      // Saldırgan ve kurban arası mesafe kontrolü (Hile koruması için makul limit: 12 birim)
      const dx = victim.x - attacker.x;
      const dz = victim.z - attacker.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 12) {
        // Hasar ver
        victim.hp = Math.max(0, victim.hp - 15);

        // Geri Tepme (Knockback) Yön Hesaplaması
        let kx = 0;
        let kz = 0;
        const knockbackStrength = 3.5; // Geri fırlama gücü

        if (dist > 0) {
          kx = (dx / dist) * knockbackStrength;
          kz = (dz / dist) * knockbackStrength;
        } else {
          kx = (Math.random() - 0.5) * knockbackStrength;
          kz = (Math.random() - 0.5) * knockbackStrength;
        }

        // Yeni konumu güncelle ve platform dışına taşmasını engelle
        victim.x = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, victim.x + kx));
        victim.z = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, victim.z + kz));

        // Hasar bilgisini herkese gönder
        io.emit('playerHit', {
          targetId: victim.id,
          attackerId: attacker.id,
          hp: victim.hp,
          newPos: { x: victim.x, y: victim.y, z: victim.z }
        });

        // Eğer oyuncu öldüyse 1.5 saniye sonra canlandır (Respawn)
        if (victim.hp <= 0) {
          setTimeout(() => {
            if (players[victim.id]) {
              players[victim.id].hp = 100;
              players[victim.id].x = Math.random() * 20 - 10;
              players[victim.id].z = Math.random() * 20 - 10;
              
              io.emit('playerRespawned', {
                id: victim.id,
                hp: 100,
                pos: { x: players[victim.id].x, y: players[victim.id].y, z: players[victim.id].z }
              });
            }
          }, 1500);
        }
      }
    }
  });

  // Sohbet Mesajı
  socket.on('chatMessage', (msg) => {
    const player = players[socket.id];
    if (player) {
      io.emit('chatMessage', {
        username: player.username,
        text: msg
      });
    }
  });

  // Bağlantı Kesilmesi (Hayalet temizliği)
  socket.on('disconnect', () => {
    if (players[socket.id]) {
      const name = players[socket.id].username;
      delete players[socket.id];
      io.emit('playerDisconnected', socket.id);
      console.log(`${name} oyundan ayrıldı. Kalan oyuncu sayısı: ${Object.keys(players).length}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`GeoHub Server ${PORT} portunda başarıyla aktif edildi!`);
});
