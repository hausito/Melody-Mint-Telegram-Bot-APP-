document.addEventListener('DOMContentLoaded', async () => {
    const preloadImages = () => {
        const images = ['home.png', 'tasks.png', 'airdrop.png'];
        images.forEach((src) => {
            const img = new Image();
            img.src = src;
        });
    };
    preloadImages();

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

    // Initialize Telegram Web Apps API
    const tg = window.Telegram.WebApp;
    const user = tg.initDataUnsafe?.user;

    // Set username or fallback to "Username"
    if (user) {
        userInfo.textContent = user.username || `${user.first_name} ${user.last_name}`;
    } else {
        userInfo.textContent = 'Username';
    }

    let points = 0;
    let tickets = 0;

    // Fetch initial user data (points and tickets)
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

    playButton.addEventListener('click', async () => {
        if (tickets > 0) {
            tickets--;
            userTickets.textContent = tickets;

            // Update tickets on the server
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

        startScreen.style.display = 'none';
        footer.style.display = 'none';
        header.style.display = 'none'; 
        startMusic();
        initGame();
        lastTimestamp = performance.now();
        requestAnimationFrame(gameLoop);
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
    const BORDER_COLOR = '#FBEAEB';
    const SKY_BLUE = '#87CEEB';
    const SHADOW_COLOR = '#000080';

    const COLUMNS = 4;
    const SEPARATOR = 0; // No space between tiles
    const VERTICAL_GAP = 5;
    const TILE_WIDTH = (WIDTH - (COLUMNS - 1) * SEPARATOR) / COLUMNS;
    const TILE_HEIGHT = HEIGHT / 4 - VERTICAL_GAP;

    let TILE_SPEED;
    const SPEED_INCREMENT = 0.0018;

    let tiles = [];
    let score = 0;
    let gameRunning = true;

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
            const gradient = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
            gradient.addColorStop(0, '#2F3C7E');
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

    function startMusic() {
        backgroundMusic.play().catch(function(error) {
            console.error('Error playing audio:', error);
        });
    }

    function gameLoop(timestamp) {
        if (!gameRunning) return;

        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        tiles.forEach(tile => {
            tile.move(TILE_SPEED);
            tile.draw();
        });

        tiles = tiles.filter(tile => tile.y < HEIGHT);

        if (tiles.length < 4) {
            const x = Math.floor(Math.random() * COLUMNS) * (TILE_WIDTH + SEPARATOR);
            const y = -TILE_HEIGHT;
            tiles.push(new Tile(x, y));
        }

        tiles.forEach(tile => {
            if (tile.isOutOfBounds()) {
                gameRunning = false;
                alert('Game Over! Your score: ' + score);
                stopMusic();
                endGame();
            }
        });

        if (tiles.length > 0 && tiles[0].y > 0 && tiles.length < 4) {
            const x = Math.floor(Math.random() * COLUMNS) * (TILE_WIDTH + SEPARATOR);
            const y = -TILE_HEIGHT;
            tiles.push(new Tile(x, y));
        }

        tiles.forEach(tile => {
            tile.updateOpacity();
        });

        TILE_SPEED += SPEED_INCREMENT;

        requestAnimationFrame(gameLoop);
    }

    canvas.addEventListener('mousedown', (event) => {
        const mouseX = event.offsetX;
        const mouseY = event.offsetY;

        tiles.forEach(tile => {
            if (tile.isClicked(mouseX, mouseY) && !tile.clicked) {
                tile.startDisappearing();
                score++;
            }
        });
    });

    function endGame() {
        startScreen.style.display = 'flex';
        footer.style.display = 'flex';
        header.style.display = 'flex'; 

        // Update points on the server
        points += score;
        userPoints.textContent = points;
        try {
            const response = fetch('/updatePoints', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: userInfo.textContent, points }),
            });

            const result = response.json();
            if (!result.success) {
                console.error('Error updating points:', result.error);
            }
        } catch (error) {
            console.error('Error updating points:', error);
        }
    }

    function stopMusic() {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }

    window.showReferralLink = async () => {
        const username = userInfo.textContent;
        const response = await fetch(`/getReferralLink?username=${encodeURIComponent(username)}`);
        const data = await response.json();

        if (data.success) {
            const referralLink = data.referralLink;
            const modalContent = document.getElementById('modalContent');
            modalContent.textContent = referralLink;
            const modal = document.getElementById('myModal');
            modal.style.display = 'block';
        } else {
            console.error('Failed to get referral link:', data.error);
        }
    };

    window.copyToClipboard = () => {
        const referralLink = document.getElementById('modalContent').textContent;
        navigator.clipboard.writeText(referralLink).then(() => {
            alert('Referral link copied to clipboard!');
        }).catch(err => {
            console.error('Could not copy text: ', err);
        });
    };

    window.closeModal = () => {
        const modal = document.getElementById('myModal');
        modal.style.display = 'none';
    };

    const claimPopup = document.getElementById('claimPopup');
    claimPopup.style.display = 'block';

    window.closePopup = () => {
        claimPopup.style.display = 'none';
    };

    window.claimTickets = async () => {
        const username = userInfo.textContent;
        const response = await fetch(`/claimTickets?username=${encodeURIComponent(username)}`);
        const data = await response.json();

        if (data.success) {
            tickets = data.tickets;
            userTickets.textContent = tickets;
            closePopup();
        } else {
            console.error('Failed to claim tickets:', data.error);
        }
    };
});
