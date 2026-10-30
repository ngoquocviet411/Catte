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
    players: [], // { id, name, hand: [] }
    isStarted: false,
    turnIndex: 0,
    tableCards: [] // Các lá bài đánh ra trong vòng hiện tại
};

io.on('connection', (socket) => {
    socket.on('joinRoom', (playerName) => {
        if (room.players.length >= 6) {
            socket.emit('errorMsg', 'Phòng đã đầy (Tối đa 6 người)!');
            return;
        }
        if (room.isStarted) {
            socket.emit('errorMsg', 'Trận đấu đang diễn ra!');
            return;
        }

        const player = { id: socket.id, name: playerName || `Người chơi ${room.players.length + 1}`, hand: [] };
        room.players.push(player);

        io.emit('updateRoom', room);
    });

    socket.on('startGame', () => {
        if (room.players.length < 2) {
            socket.emit('errorMsg', 'Cần ít nhất 2 người để bắt đầu!');
            return;
        }

        const deck = createDeck();
        room.isStarted = true;
        room.turnIndex = 0;
        room.tableCards = [];

        room.players.forEach(player => {
            player.hand = deck.splice(0, 6);
        });

        updateGameState();
    });

    socket.on('playCard', (cardIndex) => {
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        // Kiểm tra đúng lượt không
        if (room.players[room.turnIndex].id !== socket.id) {
            socket.emit('errorMsg', 'Chưa đến lượt của bạn!');
            return;
        }

        // Lấy lá bài người chơi đánh
        const playedCard = player.hand.splice(cardIndex, 1)[0];
        room.tableCards.push({ player: player.name, card: playedCard });

        // Chuyển lượt sang người tiếp theo
        room.turnIndex = (room.turnIndex + 1) % room.players.length;

        updateGameState();
    });

    socket.on('disconnect', () => {
        room.players = room.players.filter(p => p.id !== socket.id);
        if (room.players.length === 0) {
            room.isStarted = false;
            room.tableCards = [];
        }
        io.emit('updateRoom', room);
    });
});

function updateGameState() {
    io.emit('gameState', {
        players: room.players.map(p => ({ name: p.name, cardCount: p.hand.length, id: p.id })),
        isStarted: room.isStarted,
        turnIndex: room.turnIndex,
        tableCards: room.tableCards
    });

    room.players.forEach(player => {
        io.to(player.id).emit('myHand', player.hand);
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy trên port ${PORT}`);
});