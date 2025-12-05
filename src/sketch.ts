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
const ROWS = 20;
const COLS_SINGLE = 10;
const COLS_MULTI = 20;
const CELL_SIZE_SINGLE = 12;
const CELL_SIZE_MULTI = 10;
const BOARD_X = 20;
const BOARD_Y = 10;

const sketch = (p: p5) => {
    let board: number[][] = [];
    let currentPiece: Piece | null = null;
    let currentPiece2: Piece | null = null; // P2's piece
    let nextPiece: number = 0;
    let score = 0;
    let lines = 20; // Lines remaining until next level
    let level = 1;
    const LINES_PER_LEVEL = 20;
    let gameOver = false;
    let gameStarted = false;
    let isMultiplayer = false;

    // Dynamic board dimensions
    let cols = COLS_SINGLE;
    let cellSize = CELL_SIZE_SINGLE;

    // Timing for P1
    let lastFall = 0;
    let lastMove = 0;
    let lastRotate = 0;

    // Timing for P2
    let lastFall2 = 0;
    let lastMove2 = 0;
    let lastRotate2 = 0;

    const moveDelay = 100;
    const rotateDelay = 150;

    // Input state tracking for edge detection
    let prevUp = false;
    let prevA = false;
    let prevB = false;
    let prevP2Up = false;
    let prevP2A = false;
    let prevP2B = false;

    // Demo mode state (for attract screen)
    let demoBoard: number[][] = [];
    let demoPiece: Piece | null = null;
    let demoNextPiece = 0;
    let demoLastFall = 0;
    const DEMO_FALL_SPEED = 150;

    function getFallSpeed(): number {
        // Base speed divided by level (1x, 2x, 3x, ...)
        return Math.max(50, 800 / level);
    }

    function createBoard(numCols: number): number[][] {
        return Array.from({ length: ROWS }, () => Array(numCols).fill(0));
    }

    function getRandomPieceType(): number {
        return Math.floor(p.random(TETROMINOS.length));
    }

    function spawnPiece(spawnX: number): Piece {
        const type = nextPiece;
        nextPiece = getRandomPieceType();
        const shape = getShape(type, 0);
        return {
            type,
            rotation: 0,
            x: spawnX - Math.floor(shape[0].length / 2),
            y: 0,
        };
    }

    function spawnPieceP1(): Piece {
        // P1 spawns in left half (or center in single player)
        const spawnX = isMultiplayer ? Math.floor(cols / 4) : Math.floor(cols / 2);
        return spawnPiece(spawnX);
    }

    function spawnPieceP2(): Piece {
        // P2 spawns in right half
        const spawnX = Math.floor((cols * 3) / 4);
        return spawnPiece(spawnX);
    }

    function collides(piece: Piece, dx: number, dy: number): boolean {
        const shape = getShape(piece.type, piece.rotation);
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const newX = piece.x + col + dx;
                    const newY = piece.y + row + dy;
                    if (newX < 0 || newX >= cols || newY >= ROWS) {
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

    function lockPiece(piece: Piece, colorIndex?: number): void {
        const shape = getShape(piece.type, piece.rotation);
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardY = piece.y + row;
                    const boardX = piece.x + col;
                    if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < cols) {
                        board[boardY][boardX] = colorIndex ?? (piece.type + 1);
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
                board.unshift(Array(cols).fill(0));
                cleared++;
                row++;
            }
        }
        return cleared;
    }

    function updateScore(linesCleared: number): void {
        const points = [0, 100, 300, 500, 800];
        score += points[Math.min(linesCleared, 4)] * level;
        lines -= linesCleared;
        // Level up when lines reach 0
        while (lines <= 0) {
            level++;
            lines += LINES_PER_LEVEL;
        }
    }

    function drawCell(x: number, y: number, colorIndex: number, mode: "normal" | "active" | "ghost" = "normal"): void {
        const baseColor = COLORS[colorIndex];
        const px = BOARD_X + x * cellSize;
        const py = BOARD_Y + y * cellSize;

        if (mode === "ghost") {
            p.noFill();
            p.stroke(baseColor[0], baseColor[1], baseColor[2], 100);
            p.strokeWeight(1);
            p.rect(px + 1, py + 1, cellSize - 2, cellSize - 2);
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
            p.rect(px, py, cellSize - 1, cellSize - 1);
            // Highlight
            p.fill(255, 255, 255, mode === "active" ? 80 : 50);
            p.rect(px, py, cellSize - 1, 2);
            p.rect(px, py, 2, cellSize - 1);
        }
    }

    function drawBoard(): void {
        // Draw border
        p.stroke(80, 80, 120);
        p.strokeWeight(2);
        p.noFill();
        p.rect(BOARD_X - 2, BOARD_Y - 2, cols * cellSize + 3, ROWS * cellSize + 3);

        // Draw center line in multiplayer
        if (isMultiplayer) {
            p.stroke(60, 60, 90);
            p.strokeWeight(1);
            const centerX = BOARD_X + (cols / 2) * cellSize;
            p.line(centerX, BOARD_Y, centerX, BOARD_Y + ROWS * cellSize);
        }

        // Draw cells
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < cols; col++) {
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

    function drawNextPiece(): void {
        const previewX = BOARD_X + cols * cellSize + 15;
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
        const uiX = BOARD_X + cols * cellSize + 15;

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

    // Demo mode functions for attract screen
    function demoCollides(piece: Piece, dx: number, dy: number): boolean {
        const shape = getShape(piece.type, piece.rotation);
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const newX = piece.x + col + dx;
                    const newY = piece.y + row + dy;
                    if (newX < 0 || newX >= COLS_SINGLE || newY >= ROWS) {
                        return true;
                    }
                    if (newY >= 0 && demoBoard[newY][newX]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function demoLockPiece(piece: Piece): void {
        const shape = getShape(piece.type, piece.rotation);
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const boardY = piece.y + row;
                    const boardX = piece.x + col;
                    if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS_SINGLE) {
                        demoBoard[boardY][boardX] = piece.type + 1;
                    }
                }
            }
        }
    }

    function demoClearLines(): void {
        for (let row = ROWS - 1; row >= 0; row--) {
            if (demoBoard[row].every((cell) => cell !== 0)) {
                demoBoard.splice(row, 1);
                demoBoard.unshift(Array(COLS_SINGLE).fill(0));
                row++;
            }
        }
    }

    function demoSpawnPiece(): Piece {
        const type = demoNextPiece;
        demoNextPiece = Math.floor(p.random(TETROMINOS.length));
        const shape = getShape(type, 0);
        return {
            type,
            rotation: 0,
            x: Math.floor(COLS_SINGLE / 2) - Math.floor(shape[0].length / 2),
            y: 0,
        };
    }

    function resetDemo(): void {
        demoBoard = createBoard(COLS_SINGLE);
        demoNextPiece = Math.floor(p.random(TETROMINOS.length));
        demoPiece = demoSpawnPiece();
        demoLastFall = p.millis();
    }

    function updateDemo(): void {
        const now = p.millis();

        if (!demoPiece) {
            resetDemo();
            return;
        }

        if (now - demoLastFall > DEMO_FALL_SPEED) {
            if (!demoCollides(demoPiece, 0, 1)) {
                demoPiece.y++;
            } else {
                demoLockPiece(demoPiece);
                demoClearLines();
                demoPiece = demoSpawnPiece();
                if (demoCollides(demoPiece, 0, 0)) {
                    resetDemo();
                }
            }
            demoLastFall = now;
        }
    }

    function drawDemoBoard(): void {
        p.stroke(80, 80, 120);
        p.strokeWeight(2);
        p.noFill();
        p.rect(BOARD_X - 2, BOARD_Y - 2, COLS_SINGLE * CELL_SIZE_SINGLE + 3, ROWS * CELL_SIZE_SINGLE + 3);

        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS_SINGLE; col++) {
                const colorIndex = demoBoard[row][col];
                const baseColor = COLORS[colorIndex];
                const px = BOARD_X + col * CELL_SIZE_SINGLE;
                const py = BOARD_Y + row * CELL_SIZE_SINGLE;
                p.fill(baseColor[0] * 0.5, baseColor[1] * 0.5, baseColor[2] * 0.5);
                p.noStroke();
                p.rect(px, py, CELL_SIZE_SINGLE - 1, CELL_SIZE_SINGLE - 1);
            }
        }

        if (demoPiece) {
            const shape = getShape(demoPiece.type, demoPiece.rotation);
            const pieceColor = COLORS[demoPiece.type + 1];
            for (let row = 0; row < shape.length; row++) {
                for (let col = 0; col < shape[row].length; col++) {
                    if (shape[row][col]) {
                        const y = demoPiece.y + row;
                        if (y >= 0) {
                            const px = BOARD_X + (demoPiece.x + col) * CELL_SIZE_SINGLE;
                            const py = BOARD_Y + y * CELL_SIZE_SINGLE;
                            p.fill(pieceColor[0] * 0.6, pieceColor[1] * 0.6, pieceColor[2] * 0.6);
                            p.noStroke();
                            p.rect(px, py, CELL_SIZE_SINGLE - 1, CELL_SIZE_SINGLE - 1);
                        }
                    }
                }
            }
        }
    }

    function drawStartScreen(): void {
        updateDemo();
        drawDemoBoard();

        p.fill(26, 26, 46, 180);
        p.noStroke();
        p.rect(BOARD_X + COLS_SINGLE * CELL_SIZE_SINGLE + 10, 0, WIDTH - BOARD_X - COLS_SINGLE * CELL_SIZE_SINGLE - 10, HEIGHT);

        p.fill(255);
        p.textSize(24);
        p.textAlign(p.CENTER, p.CENTER);
        p.text("FRIENDTRIS", WIDTH / 2 + 60, 50);

        p.fill(255);
        p.textSize(10);
        const ctrlX = WIDTH / 2 + 60;
        const ctrlY = 100;
        p.textAlign(p.RIGHT, p.CENTER);
        p.text("MOVE", ctrlX - 10, ctrlY);
        p.text("SOFT DROP", ctrlX - 10, ctrlY + 18);
        p.text("HARD DROP", ctrlX - 10, ctrlY + 36);
        p.text("ROTATE", ctrlX - 10, ctrlY + 54);

        p.fill(150);
        p.textAlign(p.LEFT, p.CENTER);
        p.text("LEFT / RIGHT", ctrlX + 10, ctrlY);
        p.text("DOWN", ctrlX + 10, ctrlY + 18);
        p.text("UP", ctrlX + 10, ctrlY + 36);
        p.text("A / B", ctrlX + 10, ctrlY + 54);

        p.fill(255);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(12);
        p.text("P1 / P2 to start", ctrlX, 200);
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
        cols = isMultiplayer ? COLS_MULTI : COLS_SINGLE;
        cellSize = isMultiplayer ? CELL_SIZE_MULTI : CELL_SIZE_SINGLE;
        board = createBoard(cols);
        score = 0;
        lines = LINES_PER_LEVEL;
        level = 1;
        gameOver = false;
        nextPiece = getRandomPieceType();
        currentPiece = spawnPieceP1();
        currentPiece2 = isMultiplayer ? spawnPieceP2() : null;
        lastFall = p.millis();
        lastFall2 = p.millis();
    }

    p.setup = () => {
        p.createCanvas(WIDTH, HEIGHT);
        board = createBoard(COLS_SINGLE);
        nextPiece = getRandomPieceType();
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

        // ============ PLAYER 1 INPUT ============
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
                currentPiece = spawnPieceP1();
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
                    currentPiece = spawnPieceP1();
                    if (collides(currentPiece, 0, 0)) {
                        gameOver = true;
                    }
                }
                lastFall = now;
            }
        }

        // ============ PLAYER 2 INPUT (multiplayer only) ============
        if (isMultiplayer && currentPiece2) {
            // Horizontal movement (with repeat)
            if (PLAYER_2.DPAD.left && now - lastMove2 > moveDelay) {
                if (!collides(currentPiece2, -1, 0)) {
                    currentPiece2.x--;
                    lastMove2 = now;
                }
            }
            if (PLAYER_2.DPAD.right && now - lastMove2 > moveDelay) {
                if (!collides(currentPiece2, 1, 0)) {
                    currentPiece2.x++;
                    lastMove2 = now;
                }
            }

            // Soft drop (hold down)
            if (PLAYER_2.DPAD.down && now - lastFall2 > 50) {
                if (!collides(currentPiece2, 0, 1)) {
                    currentPiece2.y++;
                    lastFall2 = now;
                    score += 1;
                }
            }

            // Rotation with SRS wall kicks (A = CCW, B = CW)
            if (PLAYER_2.A && !prevP2A && now - lastRotate2 > rotateDelay) {
                const rotated = tryRotate(board, currentPiece2, -1);
                if (rotated) {
                    currentPiece2 = rotated;
                    lastRotate2 = now;
                }
            }
            if (PLAYER_2.B && !prevP2B && now - lastRotate2 > rotateDelay) {
                const rotated = tryRotate(board, currentPiece2, 1);
                if (rotated) {
                    currentPiece2 = rotated;
                    lastRotate2 = now;
                }
            }

            // Hard drop (UP - edge triggered)
            if (PLAYER_2.DPAD.up && !prevP2Up) {
                while (!collides(currentPiece2, 0, 1)) {
                    currentPiece2.y++;
                    score += 2;
                }
                lockPiece(currentPiece2);
                const cleared = clearLines();
                if (cleared > 0) {
                    updateScore(cleared);
                }
                currentPiece2 = spawnPieceP2();
                if (collides(currentPiece2, 0, 0)) {
                    gameOver = true;
                }
                lastFall2 = now;
            }

            // Natural falling
            if (now - lastFall2 > getFallSpeed()) {
                if (!collides(currentPiece2, 0, 1)) {
                    currentPiece2.y++;
                } else {
                    lockPiece(currentPiece2);
                    const cleared = clearLines();
                    if (cleared > 0) {
                        updateScore(cleared);
                    }
                    currentPiece2 = spawnPieceP2();
                    if (collides(currentPiece2, 0, 0)) {
                        gameOver = true;
                    }
                }
                lastFall2 = now;
            }
        }

        // Update previous input state
        prevUp = PLAYER_1.DPAD.up;
        prevA = PLAYER_1.A;
        prevB = PLAYER_1.B;
        prevP2Up = PLAYER_2.DPAD.up;
        prevP2A = PLAYER_2.A;
        prevP2B = PLAYER_2.B;

        // Draw everything
        drawBoard();
        if (currentPiece && !gameOver) {
            drawGhost(currentPiece);
            drawPiece(currentPiece);
        }
        if (isMultiplayer && currentPiece2 && !gameOver) {
            drawGhost(currentPiece2);
            drawPiece(currentPiece2);
        }
        drawNextPiece();
        drawUI();
    };
};

new p5(sketch, document.getElementById("sketch")!);
