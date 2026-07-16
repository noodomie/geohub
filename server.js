// ==========================================
// 1. KATILMA İSTEĞİ (Kullanıcı Adı Kontrolleri)
// ==========================================
socket.on('joinRequest', (data) => {
    const rawUsername = data.username ? data.username.trim() : "";
    const lowercaseUsername = rawUsername.toLowerCase();
    
    // a. Sunucu tarafında sadece küçük harf ve Türkçe karakter doğrulaması (Güvenlik için)
    const nameRegex = /^[a-zçğıöşü]+$/;
    if (!nameRegex.test(lowercaseUsername)) {
        return socket.emit('joinResponse', { 
            success: false, 
            error: "Kullanıcı adı sadece küçük harflerden oluşmalıdır (özel karakter, sayı, boşluk veya emoji içeremez)!" 
        });
    }

    // b. Aktif Oyuncu İsim Kontrolü (Aynı ismin oyunda olup olmadığını denetler - Büyük/Küçük duyarsız)
    const isNameTaken = Object.values(players).some(p => p.username.toLowerCase() === lowercaseUsername);
    if (isNameTaken) {
        return socket.emit('joinResponse', { 
            success: false, 
            error: `"${rawUsername}" ismiyle şu anda aktif bir oyuncu var. Lütfen başka bir isim seçin!` 
        });
    }

    // Oyuncuyu listeye ekle
    players[socket.id] = {
        id: socket.id,
        username: rawUsername,
        color: data.color,
        x: 0,
        y: 1,
        z: 0,
        ry: 0
    };
    
    // Başarılı yanıtı gönder
    socket.emit('joinResponse', {
        success: true,
        id: socket.id,
        color: data.color,
        players: players
    });
    
    // Diğerlerine haber ver
    socket.broadcast.emit('playerJoined', players[socket.id]);
});

// ==========================================
// 2. HAREKET (Diğer Oyunculara Seslerin Gitmesi İçin)
// ==========================================
socket.on('move', (data) => {
    if (players[socket.id]) {
        players[socket.id].x = data.x;
        players[socket.id].y = data.y;
        players[socket.id].z = data.z;
        players[socket.id].ry = data.ry;
        
        // walking ve jumping bilgilerini de diğer oyunculara dağıtıyoruz (SESLER İÇİN EN KRİTİK ADIM!)
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            x: data.x,
            y: data.y,
            z: data.z,
            ry: data.ry,
            walking: data.walking,  // <-- Sesler için sunucunun bunu göndermesi şarttır
            jumping: data.jumping   // <-- Sesler için sunucunun bunu göndermesi şarttır
        });
    }
});
