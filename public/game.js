document.addEventListener('DOMContentLoaded', async () => {
    const preloadImages = () => {
        const images = ['home.png', 'tasks.png', 'airdrop.png'];
        images.forEach((src) => {
            const img = new Image();
            img.src = src;
        });
    };
    preloadImages();

    let gameActive = false;
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const backgroundMusic = new Audio('background-music.mp3');
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.5;

    const startScreen = document.getElementById('startScreen');
    const playButton = document.getElementById('playButton');
    const tasksButton = document.getElementById('tasksButton');
    const upgradeButton = document.getElementById('upgradeButton');
    const userInfo = document.getElementById('userInfo');
    const footer = document.getElementById('footer');
    const userPoints = document.getElementById('points');
    const userTickets = document.getElementById('ticketsInfo');
    const header = document.getElementById('header');

    const tg = window.Telegram.WebApp;
    const user = tg.initDataUnsafe?.user;

    if (user) {
        userInfo.textContent = user.username || `${user.first_name} ${user.last_name}`;
    } else {
        userInfo.textContent = 'Username';
    }

    let points = 0;
    let tickets = 0;

    const fetchUserData = async () => {
        try {
            const response = await fetch(`/getUserData?username=${encodeURIComponent(userInfo.textContent)}`);
            const data = await response.json();
            if (data.success) {
                points = data.points;
                tickets = data.tickets;
                userPoints.textContent = points;
                userTickets.textContent = tickets;
            } else {
                console.error('Failed to fetch user data:', data.error);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    };

    fetchUserData();

    document.addEventListener('ticketsUpdated', (event) => {
        tickets = event.detail.tickets;
        userTickets.textContent = `Tickets: ${tickets}`;
    });

    playButton.addEventListener('click', async () => {
        if (tickets > 0) {
            tickets--;

            try {
                const response = await fetch('/updateTickets', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username: userInfo.textContent, tickets }),
                });

                const result = await response.json();
                if (!result.success) {
                    console.error('Error updating tickets:', result.error);
                }
            } catch (error) {
                console.error('Error updating tickets:', error);
            }
        } else {
            alert('No more tickets available!');
            return;
        }
        gameActive = true;
        startScreen.style.display = 'none';
        footer.style.display = 'none';
        header.style.display = 'none';
        startMusic();
        initGame();
        lastTimestamp = performance.now();
        requestAnimationFrame(gameLoop);
        userTickets.textContent = `${tickets}`;
    });

    tasksButton.addEventListener('click', () => {
        alert('Tasks: Coming Soon!');
    });

    upgradeButton.addEventListener('click', () => {
        alert('Upgrade: Coming Soon!');
    });

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const TILE_COLOR = '#2F3C7E';
    const TILE_BORDER_COLOR = '#00ffcc';
    const VERTICAL_LINE_COLOR = '#ff00ff';
    const BACKGROUND_COLOR = '#000';
    const SKY_BLUE = '#87CEEB';
    const SHADOW_COLOR = '#000080';

    const COLUMNS = 4;
    const SEPARATOR = 0;
    const VERTICAL_GAP = 5;
    const TILE_WIDTH = (WIDTH - (COLUMNS - 1) * SEPARATOR) / COLUMNS;
    const TILE_HEIGHT = HEIGHT / 4 - VERTICAL_GAP;

    let TILE_SPEED;
    const SPEED_INCREMENT = 0.0018;

    let tiles = [];
    let score = 0;
    let gameRunning = true;
    let lastDropTimestamp = 0;
    let dropEffectActive = false;

    class Tile {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.width = TILE_WIDTH;
            this.height = TILE_HEIGHT;
            this.clicked = false;
            this.opacity = 1;
        }

        move(speed) {
            this.y += speed;
        }

        draw() {
            ctx.save();
            ctx.shadowBlur = 20;
            ctx.shadowColor = TILE_BORDER_COLOR;
            ctx.strokeStyle = TILE_BORDER_COLOR;
            ctx.lineWidth = 4;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
            ctx.restore();

            const gradient = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
            gradient.addColorStop(0, TILE_COLOR);
            gradient.addColorStop(1, '#FF6F61');
            ctx.fillStyle = gradient;
            ctx.globalAlpha = this.opacity;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.globalAlpha = 1;
        }

        isClicked(mouseX, mouseY) {
            return this.x <= mouseX && this.x + this.width >= mouseX &&
                   this.y <= mouseY && this.y + this.height >= mouseY;
        }

        isOutOfBounds() {
            return this.y + this.height >= HEIGHT && !this.clicked;
        }

        startDisappearing() {
            this.clicked = true;
            this.opacity -= 0.05;
        }

        updateOpacity() {
            if (this.clicked && this.opacity > 0) {
                this.opacity -= 0.05;
            }
        }
    }

    function initGame() {
        tiles = [];
        for (let i = 0; i < 4; i++) {
            const x = Math.floor(Math.random() * COLUMNS) * (TILE_WIDTH + SEPARATOR);
            const y = -(i * (TILE_HEIGHT + VERTICAL_GAP)) - TILE_HEIGHT;
            tiles.push(new Tile(x, y));
        }
        score = 0;
        TILE_SPEED = 4;
        gameRunning = true;

        backgroundMusic.play().catch(function(error) {
            console.error('Error playing audio:', error);
        });
    }

    function isMobileDevice() {
        return /Mobi|Android/i.test(navigator.userAgent);
    }

    function addNewTile() {
        const attempts = 100;
        const lastColumn = tiles.length > 0 ? Math.floor(tiles[tiles.length - 1].x / (TILE_WIDTH + SEPARATOR)) : -1;

        for (let i = 0; i < attempts; i++) {
            let newColumn;
            do {
                newColumn = Math.floor(Math.random() * COLUMNS);
            } while (newColumn === lastColumn);

            const newTileX = newColumn * (TILE_WIDTH + SEPARATOR);
            const newTileY = Math.min(...tiles.map(tile => tile.y)) - TILE_HEIGHT - VERTICAL_GAP;

            if (!tiles.some(tile => {
                const rect = { x: newTileX, y: newTileY, width: TILE_WIDTH, height: TILE_HEIGHT };
                return tile.y < rect.y + rect.height && tile.y + tile.height > rect.y &&
                    tile.x < rect.x + rect.width && tile.x + rect.width > rect.x;
            })) {
                tiles.push(new Tile(newTileX, newTileY));
                break;
            }
        }
    }

    function handleClick(event) {
        if (!gameRunning) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;

        let clickedOnTile = false;
        tiles.forEach(tile => {
            if (tile.isClicked(mouseX, mouseY) && !tile.clicked) {
                tile.startDisappearing();
                clickedOnTile = true;
                score++;
                addNewTile();
            }
        });

        if (!clickedOnTile) {
            gameRunning = false;
            gameOver();
        }
    }

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', (event) => {
        event.preventDefault();
        const touch = event.touches[0];
        handleClick({
            clientX: touch.clientX,
            clientY: touch.clientY,
        });
    });

    let lastTimestamp = 0;

    function gameLoop(timestamp) {
        if (!gameRunning) return;

        const deltaTime = (timestamp - lastTimestamp) / 1000; 
        lastTimestamp = timestamp;

        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        let outOfBounds = false;
        tiles.forEach(tile => {
            tile.move(TILE_SPEED * deltaTime * 60);
            tile.updateOpacity();
            if (tile.isOutOfBounds()) {
                outOfBounds = true;
            }
            tile.draw();
        });

        if (outOfBounds) {
            gameRunning = false;
            gameOver();
        } else {
            TILE_SPEED += SPEED_INCREMENT;

            if (timestamp - lastDropTimestamp > 1000) {
                lastDropTimestamp = timestamp;
                dropEffectActive = true;
            }

            if (dropEffectActive) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = `rgba(255, 0, 0, ${Math.random() * 0.5})`;
                ctx.fillRect(0, 0, WIDTH, HEIGHT);
                ctx.restore();
                dropEffectActive = false;
            }

            drawGrid();
            requestAnimationFrame(gameLoop);
        }
    }

    function drawGrid() {
        ctx.strokeStyle = VERTICAL_LINE_COLOR;
        ctx.lineWidth = 2;
        for (let i = 1; i < COLUMNS; i++) {
            ctx.beginPath();
            ctx.moveTo(i * (TILE_WIDTH + SEPARATOR) - SEPARATOR / 2, 0);
            ctx.lineTo(i * (TILE_WIDTH + SEPARATOR) - SEPARATOR / 2, HEIGHT);
            ctx.stroke();
        }
    }

    function gameOver() {
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        backgroundMusic.pause();
        ctx.font = '48px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', WIDTH / 2, HEIGHT / 2);
        ctx.fillText(`Score: ${score}`, WIDTH / 2, HEIGHT / 2 + 60);
        setTimeout(() => {
            startScreen.style.display = 'flex';
            footer.style.display = 'block';
            header.style.display = 'block';
            gameActive = false;
        }, 2000);
    }

    function startMusic() {
        backgroundMusic.currentTime = 0;
        backgroundMusic.play().catch(function(error) {
            console.error('Error playing audio:', error);
        });
    }
});
