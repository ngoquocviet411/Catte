const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
    let deck = [];
    for (let s of SUITS) {
        for (let v of VALUES) {
            deck.push({ suit: s, value: v });
        }
    }
    return deck.sort(() => Math.random() - 0.5);
}

let room = {
    players: [], // { id, name, hand: [], winRounds: 0 }
    isStarted: false
};

io.on('connection', (socket) => {
    console.log('Người chơi kết nối:', socket.id);

    socket.on('joinRoom', (playerName) => {
        if (room.players.length >= 6) {
            socket.emit('errorMsg', 'Phòng đã đầy (Tối đa 6 người)!');
            return;
        }
        if (room.isStarted) {
            socket.emit('errorMsg', 'Trận đấu đang diễn ra!');
            return;
        }

        const player = { 
            id: socket.id, 
            name: playerName || `Người chơi ${room.players.length + 1}`, 
            hand: [],
            winRounds: 0 
        };
        room.players.push(player);

        io.emit('updateRoom', room.players.map(p => ({ id: p.id, name: p.name, cardCount: p.hand.length })));
    });

    socket.on('startGame', () => {
        if (room.players.length < 2) {
            socket.emit('errorMsg', 'Cần ít nhất 2 người để bắt đầu!');
            return;
        }

        const deck = createDeck();
        room.isStarted = true;

        // Chia mỗi người 6 lá & reset số vòng thắng
        room.players.forEach(player => {
            player.hand = deck.splice(0, 6);
            player.winRounds = 0;
            io.to(player.id).emit('dealCards', player.hand);
        });

        io.emit('gameStarted', 'Bài đã được chia! Mỗi người 6 lá.');
    });

    // Giả lập thắng vòng (Cập nhật luật: Thắng 3 vòng liên tiếp -> Thắng Tùng)
    socket.on('winRound', () => {
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.winRounds += 1;
            if (player.winRounds >= 3) {
                io.emit('gameOver', `🎉 ${player.name} đã THẮNG TÙNG (thắng 3 ván đầu)!`);
            } else {
                io.emit('roundWon', `${player.name} thắng vòng này! (Số vòng thắng: ${player.winRounds}/3)`);
            }
        }
    });

    socket.on('disconnect', () => {
        room.players = room.players.filter(p => p.id !== socket.id);
        if (room.players.length === 0) room.isStarted = false;
        io.emit('updateRoom', room.players.map(p => ({ id: p.id, name: p.name, cardCount: p.hand.length })));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Cát-tê Server đang chạy trên port ${PORT}`);
});