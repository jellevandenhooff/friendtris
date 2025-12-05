import p5 from "p5";
import { PLAYER_1, SYSTEM } from "@rcade/plugin-input-classic";
import {
    TETROMINOS,
    COLORS,
    getShape,
    tryRotate,
    Piece,
} from "./tetrominos";

// Rcade game dimensions
const WIDTH = 336;
const HEIGHT = 262;

// Board dimensions
const COLS = 10;
const ROWS = 20;
const CELL_SIZE = 12;
const BOARD_X = 20;
const BOARD_Y = 10;

const sketch = (p: p5) => {
    let board: number[][] = [];
    let currentPiece: Piece | null = null;
    let nextPiece: number = 0;
    let score = 0;
    let lines = 0;
    let level = 1;
    let gameOver = false;
    let gameStarted = false;

    // Timing
    let lastFall = 0;
    let lastMove = 0;
    let lastRotate = 0;
    const moveDelay = 100;
    const rotateDelay = 150;

    // Input state tracking for edge detection
    let prevUp = false;
    let prevA = false;
    let prevB = false;

    function getFallSpeed(): number {
        return Math.max(100, 800 - (level - 1) * 70);
    }

    function createBoard(): number[][] {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    function spawnPiece(): Piece {
        const type = nextPiece;
        nextPiece = Math.floor(p.random(TETROMINOS.length));
        const shape = getShape(type, 0);
        return {
            type,
            rotation: 0,
            x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
            y: 0,
        };
    }

    function collides(piece: Piece, dx: number, dy: number): boolean {
        const shape = getShape(piece.type, piece.rotation);
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const newX = piece.x + col + dx;
                    const newY = piece.y + row + dy;
                    if (newX < 0 || newX >= COLS || newY >= ROWS) {
                        return true;
                    }
                    if (newY >= 0 && board[newY][newX]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function lockPiece(piece: Piece): void {
        const shape = getShape(piece.type, piece.rotation);
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardY = piece.y + row;
                    const boardX = piece.x + col;
                    if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
                        board[boardY][boardX] = piece.type + 1;
                    }
                }
            }
        }
    }

    function clearLines(): number {
        let cleared = 0;
        for (let row = ROWS - 1; row >= 0; row--) {
            if (board[row].every((cell) => cell !== 0)) {
                board.splice(row, 1);
                board.unshift(Array(COLS).fill(0));
                cleared++;
                row++;
            }
        }
        return cleared;
    }

    function updateScore(linesCleared: number): void {
        const points = [0, 100, 300, 500, 800];
        score += points[linesCleared] * level;
        lines += linesCleared;
        level = Math.floor(lines / 10) + 1;
    }

    function drawCell(x: number, y: number, colorIndex: number, ghost: boolean = false): void {
        const color = COLORS[colorIndex];
        const px = BOARD_X + x * CELL_SIZE;
        const py = BOARD_Y + y * CELL_SIZE;

        if (ghost) {
            p.noFill();
            p.stroke(color[0], color[1], color[2], 100);
            p.strokeWeight(1);
            p.rect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        } else {
            p.fill(color[0], color[1], color[2]);
            p.noStroke();
            p.rect(px, py, CELL_SIZE - 1, CELL_SIZE - 1);
            // Highlight
            p.fill(255, 255, 255, 50);
            p.rect(px, py, CELL_SIZE - 1, 2);
            p.rect(px, py, 2, CELL_SIZE - 1);
        }
    }

    function drawBoard(): void {
        // Draw border
        p.stroke(80, 80, 120);
        p.strokeWeight(2);
        p.noFill();
        p.rect(BOARD_X - 2, BOARD_Y - 2, COLS * CELL_SIZE + 3, ROWS * CELL_SIZE + 3);

        // Draw cells
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                drawCell(col, row, board[row][col]);
            }
        }
    }

    function drawPiece(piece: Piece, ghost: boolean = false): void {
        const shape = getShape(piece.type, piece.rotation);
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const y = piece.y + row;
                    if (y >= 0) {
                        drawCell(piece.x + col, y, piece.type + 1, ghost);
                    }
                }
            }
        }
    }

    function drawGhost(piece: Piece): void {
        let ghostY = piece.y;
        while (!collides({ ...piece, y: ghostY + 1 }, 0, 0)) {
            ghostY++;
        }
        if (ghostY !== piece.y) {
            drawPiece({ ...piece, y: ghostY }, true);
        }
    }

    function drawNextPiece(): void {
        const previewX = BOARD_X + COLS * CELL_SIZE + 25;
        const previewY = 30;

        p.fill(255);
        p.noStroke();
        p.textSize(10);
        p.textAlign(p.LEFT, p.TOP);
        p.text("NEXT", previewX, previewY - 15);

        const shape = getShape(nextPiece, 0);
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const color = COLORS[nextPiece + 1];
                    p.fill(color[0], color[1], color[2]);
                    p.noStroke();
                    p.rect(previewX + col * 10, previewY + row * 10, 9, 9);
                }
            }
        }
    }

    function drawUI(): void {
        const uiX = BOARD_X + COLS * CELL_SIZE + 25;

        p.fill(255);
        p.noStroke();
        p.textSize(10);
        p.textAlign(p.LEFT, p.TOP);

        p.text("SCORE", uiX, 90);
        p.textSize(12);
        p.text(score.toString(), uiX, 102);

        p.textSize(10);
        p.text("LINES", uiX, 130);
        p.textSize(12);
        p.text(lines.toString(), uiX, 142);

        p.textSize(10);
        p.text("LEVEL", uiX, 170);
        p.textSize(12);
        p.text(level.toString(), uiX, 182);
    }

    function drawStartScreen(): void {
        p.fill(255);
        p.textSize(24);
        p.textAlign(p.CENTER, p.CENTER);
        p.text("FRIENDTRIS", WIDTH / 2, HEIGHT / 2 - 30);
        p.textSize(12);
        p.text("Press P1", WIDTH / 2, HEIGHT / 2 + 10);
        p.textSize(10);
        p.text("LEFT/RIGHT: Move  DOWN: Soft drop", WIDTH / 2, HEIGHT / 2 + 40);
        p.text("UP: Hard drop  A/B: Rotate", WIDTH / 2, HEIGHT / 2 + 55);
    }

    function drawGameOver(): void {
        p.fill(0, 0, 0, 180);
        p.noStroke();
        p.rect(0, 0, WIDTH, HEIGHT);

        p.fill(255);
        p.textSize(20);
        p.textAlign(p.CENTER, p.CENTER);
        p.text("GAME OVER", WIDTH / 2, HEIGHT / 2 - 20);
        p.textSize(14);
        p.text("Score: " + score, WIDTH / 2, HEIGHT / 2 + 10);
        p.textSize(10);
        p.text("Press P1 to retry", WIDTH / 2, HEIGHT / 2 + 40);
    }

    function resetGame(): void {
        board = createBoard();
        score = 0;
        lines = 0;
        level = 1;
        gameOver = false;
        nextPiece = Math.floor(p.random(TETROMINOS.length));
        currentPiece = spawnPiece();
        lastFall = p.millis();
    }

    p.setup = () => {
        p.createCanvas(WIDTH, HEIGHT);
        board = createBoard();
        nextPiece = Math.floor(p.random(TETROMINOS.length));
    };

    p.draw = () => {
        p.background(26, 26, 46);
        const now = p.millis();

        // Start screen
        if (!gameStarted) {
            drawStartScreen();
            if (SYSTEM.ONE_PLAYER) {
                gameStarted = true;
                resetGame();
            }
            return;
        }

        // Game over screen
        if (gameOver) {
            drawBoard();
            drawUI();
            drawNextPiece();
            drawGameOver();
            if (SYSTEM.ONE_PLAYER) {
                resetGame();
            }
            return;
        }

        // Handle input
        if (currentPiece) {
            // Horizontal movement (with repeat)
            if (PLAYER_1.DPAD.left && now - lastMove > moveDelay) {
                if (!collides(currentPiece, -1, 0)) {
                    currentPiece.x--;
                    lastMove = now;
                }
            }
            if (PLAYER_1.DPAD.right && now - lastMove > moveDelay) {
                if (!collides(currentPiece, 1, 0)) {
                    currentPiece.x++;
                    lastMove = now;
                }
            }

            // Soft drop (hold down)
            if (PLAYER_1.DPAD.down && now - lastFall > 50) {
                if (!collides(currentPiece, 0, 1)) {
                    currentPiece.y++;
                    lastFall = now;
                    score += 1;
                }
            }

            // Rotation with SRS wall kicks (A = CCW, B = CW)
            if (PLAYER_1.A && !prevA && now - lastRotate > rotateDelay) {
                const rotated = tryRotate(board, currentPiece, -1);
                if (rotated) {
                    currentPiece = rotated;
                    lastRotate = now;
                }
            }
            if (PLAYER_1.B && !prevB && now - lastRotate > rotateDelay) {
                const rotated = tryRotate(board, currentPiece, 1);
                if (rotated) {
                    currentPiece = rotated;
                    lastRotate = now;
                }
            }

            // Hard drop (UP - edge triggered)
            if (PLAYER_1.DPAD.up && !prevUp) {
                while (!collides(currentPiece, 0, 1)) {
                    currentPiece.y++;
                    score += 2;
                }
                lockPiece(currentPiece);
                const cleared = clearLines();
                if (cleared > 0) {
                    updateScore(cleared);
                }
                currentPiece = spawnPiece();
                if (collides(currentPiece, 0, 0)) {
                    gameOver = true;
                }
                lastFall = now;
            }

            // Natural falling
            if (now - lastFall > getFallSpeed()) {
                if (!collides(currentPiece, 0, 1)) {
                    currentPiece.y++;
                } else {
                    lockPiece(currentPiece);
                    const cleared = clearLines();
                    if (cleared > 0) {
                        updateScore(cleared);
                    }
                    currentPiece = spawnPiece();
                    if (collides(currentPiece, 0, 0)) {
                        gameOver = true;
                    }
                }
                lastFall = now;
            }
        }

        // Update previous input state
        prevUp = PLAYER_1.DPAD.up;
        prevA = PLAYER_1.A;
        prevB = PLAYER_1.B;

        // Draw everything
        drawBoard();
        if (currentPiece && !gameOver) {
            drawGhost(currentPiece);
            drawPiece(currentPiece);
        }
        drawNextPiece();
        drawUI();
    };
};

new p5(sketch, document.getElementById("sketch")!);
