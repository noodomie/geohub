const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// NPM ile indirilen yerel Three.js kütüphanesini tarayıcıya gönderir
app.get('/three.min.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', 'three', 'build', 'three.min.js'));
});

app.use(express.static(path.join(__dirname, 'public')));

const players = {};

io.on('connection', (socket) => {
    console.log('Oyuncu bağlandı:', socket.id);

    socket.on('joinRequest', (data) => {
        let username = data.username.trim() || `Misafir_${socket.id.substring(0, 4)}`;
        
        const isTaken = Object.values(players).some(p => p.username.toLowerCase() === username.toLowerCase());
        if (isTaken) {
            username = `${username}_${Math.floor(Math.random() * 100)}`;
        }

        players[socket.id] = {
            id: socket.id,
            username: username,
            color: data.color || '#00a8ff',
            x: 0,
            y: 1,
            z: 0,
            ry: 0
        };

        socket.emit('joinResponse', {
            success: true,
            id: socket.id,
            color: players[socket.id].color,
            players: players
        });

        socket.broadcast.emit('playerJoined', players[socket.id]);
    });

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].ry = data.ry;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('chatMessage', (text) => {
        if (players[socket.id]) {
            io.emit('chatMessage', {
                username: players[socket.id].username,
                color: players[socket.id].color,
                text: text
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        if (players[socket.id]) {
            delete players[socket.id];
            io.emit('playerLeft', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde aktif.`);
});
