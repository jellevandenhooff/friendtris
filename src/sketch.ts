import p5 from "p5";
import { PLAYER_1, PLAYER_2, SYSTEM } from "@rcade/plugin-input-classic";
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

    // Player 2 sabotage controls
    // pieceMode: -1 = random, 0-6 = fixed piece type
    let pieceMode = -1;
    let prevP2Up = false;
    let prevP2Down = false;
    let prevP2Left = false;
    let prevP2Right = false;
    let prevP2A = false;
    let prevP2B = false;
    let isMultiplayer = false;

    // P2 mode: "pieces" = change next piece, "draw" = toggle cells
    let p2Mode: "pieces" | "draw" = "pieces";
    let p2CursorX = Math.floor(COLS / 2);
    let p2CursorY = Math.floor(ROWS / 2);

    function getFallSpeed(): number {
        return Math.max(100, 800 - (level - 1) * 70);
    }

    function createBoard(): number[][] {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    function getNextPieceType(): number {
        if (pieceMode === -1) {
            return Math.floor(p.random(TETROMINOS.length));
        }
        return pieceMode;
    }

    function spawnPiece(): Piece {
        const type = nextPiece;
        nextPiece = getNextPieceType();
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

    function drawCell(x: number, y: number, colorIndex: number, mode: "normal" | "active" | "ghost" = "normal"): void {
        const baseColor = COLORS[colorIndex];
        const px = BOARD_X + x * CELL_SIZE;
        const py = BOARD_Y + y * CELL_SIZE;

        if (mode === "ghost") {
            p.noFill();
            p.stroke(baseColor[0], baseColor[1], baseColor[2], 100);
            p.strokeWeight(1);
            p.rect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        } else {
            // Active pieces are brighter
            const brightness = mode === "active" ? 1.3 : 1.0;
            const color = [
                Math.min(255, baseColor[0] * brightness),
                Math.min(255, baseColor[1] * brightness),
                Math.min(255, baseColor[2] * brightness),
            ];
            p.fill(color[0], color[1], color[2]);
            p.noStroke();
            p.rect(px, py, CELL_SIZE - 1, CELL_SIZE - 1);
            // Highlight
            p.fill(255, 255, 255, mode === "active" ? 80 : 50);
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

    function drawPiece(piece: Piece, mode: "normal" | "active" | "ghost" = "active"): void {
        const shape = getShape(piece.type, piece.rotation);
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const y = piece.y + row;
                    if (y >= 0) {
                        drawCell(piece.x + col, y, piece.type + 1, mode);
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
            drawPiece({ ...piece, y: ghostY }, "ghost");
        }
    }

    function drawP2Cursor(): void {
        if (!isMultiplayer || p2Mode !== "draw") return;

        const px = BOARD_X + p2CursorX * CELL_SIZE;
        const py = BOARD_Y + p2CursorY * CELL_SIZE;

        // Blinking cursor
        const blink = Math.floor(p.millis() / 200) % 2 === 0;
        if (blink) {
            p.noFill();
            p.stroke(255, 100, 100);
            p.strokeWeight(2);
            p.rect(px - 1, py - 1, CELL_SIZE + 1, CELL_SIZE + 1);
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

        // Mode indicators on the right (multiplayer only)
        if (isMultiplayer) {
            p.textSize(10);
            p.textAlign(p.RIGHT, p.TOP);
            const rightX = WIDTH - 10;

            // P2 mode indicator
            if (p2Mode === "draw") {
                p.fill(255, 100, 100);
                p.text("DRAW", rightX, previewY - 15);
            } else {
                p.fill(100, 100, 100);
                p.text("PIECES", rightX, previewY - 15);
            }

            // Piece selection indicator
            if (pieceMode === -1) {
                p.fill(100, 255, 100);
                p.text("RANDOM", rightX, previewY);
            } else {
                p.fill(255, 200, 100);
                p.text("FIXED", rightX, previewY);
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
        p.text("FRIENDTRIS", WIDTH / 2, 50);

        // P1 Controls
        p.fill(255);
        p.textSize(10);
        const ctrlY = 100;
        p.textAlign(p.RIGHT, p.CENTER);
        p.text("MOVE", WIDTH / 2 - 10, ctrlY);
        p.text("SOFT DROP", WIDTH / 2 - 10, ctrlY + 18);
        p.text("HARD DROP", WIDTH / 2 - 10, ctrlY + 36);
        p.text("ROTATE", WIDTH / 2 - 10, ctrlY + 54);

        p.fill(150);
        p.textAlign(p.LEFT, p.CENTER);
        p.text("LEFT / RIGHT", WIDTH / 2 + 10, ctrlY);
        p.text("DOWN", WIDTH / 2 + 10, ctrlY + 18);
        p.text("UP", WIDTH / 2 + 10, ctrlY + 36);
        p.text("A / B", WIDTH / 2 + 10, ctrlY + 54);

        p.fill(255);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(12);
        p.text("P1 / P2 to start", WIDTH / 2, 200);
    }

    function drawGameOver(): void {
        p.fill(0, 0, 0, 200);
        p.noStroke();
        p.rect(0, 0, WIDTH, HEIGHT);

        p.fill(255);
        p.textSize(20);
        p.textAlign(p.CENTER, p.CENTER);
        p.text("GAME OVER", WIDTH / 2, 50);

        p.textSize(14);
        p.text("Score: " + score, WIDTH / 2, 90);
        p.fill(150);
        p.textSize(10);
        p.text("Lines: " + lines + "  Level: " + level, WIDTH / 2, 110);

        // P1 Controls (same as start screen)
        p.fill(255);
        p.textSize(10);
        const ctrlY = 150;
        p.textAlign(p.RIGHT, p.CENTER);
        p.text("MOVE", WIDTH / 2 - 10, ctrlY);
        p.text("SOFT DROP", WIDTH / 2 - 10, ctrlY + 18);
        p.text("HARD DROP", WIDTH / 2 - 10, ctrlY + 36);
        p.text("ROTATE", WIDTH / 2 - 10, ctrlY + 54);

        p.fill(150);
        p.textAlign(p.LEFT, p.CENTER);
        p.text("LEFT / RIGHT", WIDTH / 2 + 10, ctrlY);
        p.text("DOWN", WIDTH / 2 + 10, ctrlY + 18);
        p.text("UP", WIDTH / 2 + 10, ctrlY + 36);
        p.text("A / B", WIDTH / 2 + 10, ctrlY + 54);

        p.fill(255);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(12);
        p.text("P1 / P2 to start", WIDTH / 2, 235);
    }

    function resetGame(): void {
        board = createBoard();
        score = 0;
        lines = 0;
        level = 1;
        gameOver = false;
        pieceMode = -1;
        p2Mode = "pieces";
        p2CursorX = Math.floor(COLS / 2);
        p2CursorY = Math.floor(ROWS / 2);
        nextPiece = getNextPieceType();
        currentPiece = spawnPiece();
        lastFall = p.millis();
    }

    p.setup = () => {
        p.createCanvas(WIDTH, HEIGHT);
        board = createBoard();
        nextPiece = getNextPieceType();
    };

    p.draw = () => {
        p.background(26, 26, 46);
        const now = p.millis();

        // Start screen
        if (!gameStarted) {
            drawStartScreen();
            if (SYSTEM.ONE_PLAYER || SYSTEM.TWO_PLAYER) {
                gameStarted = true;
                isMultiplayer = SYSTEM.TWO_PLAYER;
                resetGame();
            }
            return;
        }

        // Game over screen
        if (gameOver) {
            drawBoard();
            drawNextPiece();
            drawUI();
            drawGameOver();
            if (SYSTEM.ONE_PLAYER || SYSTEM.TWO_PLAYER) {
                isMultiplayer = SYSTEM.TWO_PLAYER;
                resetGame();
            }
            return;
        }

        // Restart during gameplay
        if (SYSTEM.ONE_PLAYER || SYSTEM.TWO_PLAYER) {
            isMultiplayer = SYSTEM.TWO_PLAYER;
            resetGame();
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

        // Player 2 sabotage (multiplayer only)
        if (isMultiplayer) {
            // A button toggles P2 mode
            if (PLAYER_2.A && !prevP2A) {
                p2Mode = p2Mode === "pieces" ? "draw" : "pieces";
            }

            if (p2Mode === "pieces") {
                // Up/down to change piece type
                if (PLAYER_2.DPAD.up && !prevP2Up) {
                    pieceMode++;
                    if (pieceMode > 6) pieceMode = -1;
                    nextPiece = getNextPieceType();
                }
                if (PLAYER_2.DPAD.down && !prevP2Down) {
                    pieceMode--;
                    if (pieceMode < -1) pieceMode = 6;
                    nextPiece = getNextPieceType();
                }
            } else {
                // Draw mode: D-pad moves cursor, B toggles cell
                if (PLAYER_2.DPAD.up && !prevP2Up) {
                    p2CursorY = Math.max(0, p2CursorY - 1);
                }
                if (PLAYER_2.DPAD.down && !prevP2Down) {
                    p2CursorY = Math.min(ROWS - 1, p2CursorY + 1);
                }
                if (PLAYER_2.DPAD.left && !prevP2Left) {
                    p2CursorX = Math.max(0, p2CursorX - 1);
                }
                if (PLAYER_2.DPAD.right && !prevP2Right) {
                    p2CursorX = Math.min(COLS - 1, p2CursorX + 1);
                }
                if (PLAYER_2.B && !prevP2B) {
                    // Toggle cell (use color 8 for P2-placed blocks)
                    board[p2CursorY][p2CursorX] = board[p2CursorY][p2CursorX] ? 0 : 8;
                }
            }
        }

        // Update previous input state
        prevUp = PLAYER_1.DPAD.up;
        prevA = PLAYER_1.A;
        prevB = PLAYER_1.B;
        prevP2Up = PLAYER_2.DPAD.up;
        prevP2Down = PLAYER_2.DPAD.down;
        prevP2Left = PLAYER_2.DPAD.left;
        prevP2Right = PLAYER_2.DPAD.right;
        prevP2A = PLAYER_2.A;
        prevP2B = PLAYER_2.B;

        // Draw everything
        drawBoard();
        drawP2Cursor();
        if (currentPiece && !gameOver) {
            drawGhost(currentPiece);
            drawPiece(currentPiece);
        }
        drawNextPiece();
        drawUI();
    };
};

new p5(sketch, document.getElementById("sketch")!);
