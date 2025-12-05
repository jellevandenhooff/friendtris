// Tetromino definitions with ASCII encoding and SRS rotation system
// Reference: https://tetris.wiki/Super_Rotation_System
//
// ASCII encoding:
//   # = filled cell
//   O = filled cell at rotation center (for documentation/tests only)
//   . = empty cell
//
// NOTE: The 'O' marker is purely for visual reference and test parsing.
// It does NOT affect game logic - SRS rotation is determined entirely by
// the wall kick offset tables, not by center position.

export type RotationState = 0 | 1 | 2 | 3; // 0=spawn, 1=R, 2=180, 3=L

export interface Tetromino {
    name: string;
    shapes: string[]; // 4 rotation states as ASCII art
    color: [number, number, number];
}

// Parse ASCII shape into 2D array
// Both '#' and 'O' are filled cells (1), '.' is empty (0)
export function parseShape(ascii: string): number[][] {
    return ascii
        .trim()
        .split("\n")
        .map((row) => [...row.trim()].map((c) => (c === "#" || c === "O" ? 1 : 0)));
}

// Find the rotation center position in a shape
export function findCenter(ascii: string): { row: number; col: number } | null {
    const lines = ascii.trim().split("\n");
    for (let row = 0; row < lines.length; row++) {
        const line = lines[row].trim();
        for (let col = 0; col < line.length; col++) {
            if (line[col] === "O") {
                return { row, col };
            }
        }
    }
    return null;
}

// All 7 tetrominoes with their 4 rotation states (0, R, 2, L)
// The 'O' marks the rotation center point
export const TETROMINOS: Tetromino[] = [
    {
        // I piece: rotates around a point between cells
        // The O marks the reference cell, rotation is offset-based
        name: "I",
        color: [0, 240, 240],
        shapes: [
            `....
             #O##
             ....
             ....`,

            `..#.
             ..O.
             ..#.
             ..#.`,

            `....
             ....
             ##O#
             ....`,

            `.#..
             .#..
             .O..
             .#..`,
        ],
    },
    {
        // O piece: doesn't visually rotate, center is between 4 cells
        name: "O",
        color: [240, 240, 0],
        shapes: [
            `.##.
             .O#.
             ....`,

            `.##.
             .O#.
             ....`,

            `.##.
             .O#.
             ....`,

            `.##.
             .O#.
             ....`,
        ],
    },
    {
        // T piece: rotates around center cell
        name: "T",
        color: [160, 0, 240],
        shapes: [
            `.#.
             #O#
             ...`,

            `.#.
             .O#
             .#.`,

            `...
             #O#
             .#.`,

            `.#.
             #O.
             .#.`,
        ],
    },
    {
        // S piece: rotates around center
        name: "S",
        color: [0, 240, 0],
        shapes: [
            `.##
             #O.
             ...`,

            `.#.
             .O#
             ..#`,

            `...
             .O#
             ##.`,

            `#..
             #O.
             .#.`,
        ],
    },
    {
        // Z piece: rotates around center
        name: "Z",
        color: [240, 0, 0],
        shapes: [
            `##.
             .O#
             ...`,

            `..#
             .O#
             .#.`,

            `...
             #O.
             .##`,

            `.#.
             #O.
             #..`,
        ],
    },
    {
        // J piece: rotates around center
        name: "J",
        color: [0, 0, 240],
        shapes: [
            `#..
             #O#
             ...`,

            `.##
             .O.
             .#.`,

            `...
             #O#
             ..#`,

            `.#.
             .O.
             ##.`,
        ],
    },
    {
        // L piece: rotates around center
        name: "L",
        color: [240, 160, 0],
        shapes: [
            `..#
             #O#
             ...`,

            `.#.
             .O.
             .##`,

            `...
             #O#
             #..`,

            `##.
             .O.
             .#.`,
        ],
    },
];

// SRS Wall Kick offset data
// These are the "offset" values per rotation state
// To get kick translations from state A to B: subtract B's offsets from A's
type Offset = [number, number]; // [x, y] where +y is DOWN (screen coords)
type StateOffsets = [Offset, Offset, Offset, Offset, Offset];

// J, L, S, T, Z pieces share the same offset data
// Values from SRS wiki (where +y = UP)
const JLSTZ_OFFSETS: StateOffsets[] = [
    // State 0 (spawn)
    [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    // State R (1) - after CW from spawn
    [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    // State 2 - after CW from R
    [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    // State L (3) - after CW from 2
    [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
];

// I piece has unique offset data
const I_OFFSETS: StateOffsets[] = [
    // State 0 (spawn)
    [[0, 0], [-1, 0], [2, 0], [-1, 0], [2, 0]],
    // State R (1)
    [[-1, 0], [0, 0], [0, 0], [0, -1], [0, 2]],
    // State 2
    [[-1, -1], [1, -1], [-2, -1], [1, 0], [-2, 0]],
    // State L (3)
    [[0, -1], [0, -1], [0, -1], [0, 1], [0, -2]],
];

// O piece doesn't kick
const O_OFFSETS: StateOffsets[] = [
    [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
];

function getOffsets(tetrominoIndex: number): StateOffsets[] {
    const name = TETROMINOS[tetrominoIndex].name;
    if (name === "I") return I_OFFSETS;
    if (name === "O") return O_OFFSETS;
    return JLSTZ_OFFSETS;
}

// Calculate wall kick translations for a rotation
// Returns array of [dx, dy] offsets to try in order
// Note: In SRS, +y in offset data means UP, but we use screen coords where +y is DOWN
// So we negate the y values
export function getWallKicks(
    tetrominoIndex: number,
    fromState: RotationState,
    toState: RotationState
): Offset[] {
    const offsets = getOffsets(tetrominoIndex);
    const fromOffsets = offsets[fromState];
    const toOffsets = offsets[toState];

    // Kick translation = from_offset - to_offset
    // Y is negated because SRS uses +y=up but we use +y=down
    // Use (x || 0) to avoid -0
    return fromOffsets.map((from, i) => {
        const to = toOffsets[i];
        const dx = from[0] - to[0];
        const dy = -(from[1] - to[1]);
        return [(dx || 0), (dy || 0)] as Offset;
    });
}

// Get the next rotation state
export function rotateState(
    current: RotationState,
    direction: 1 | -1
): RotationState {
    return ((current + direction + 4) % 4) as RotationState;
}

// Get shape for a specific tetromino and rotation
export function getShape(
    tetrominoIndex: number,
    rotation: RotationState
): number[][] {
    return parseShape(TETROMINOS[tetrominoIndex].shapes[rotation]);
}

// Colors including empty cell (index 0)
export const COLORS: [number, number, number][] = [
    [40, 40, 60], // Empty/background
    ...TETROMINOS.map((t) => t.color),
];

// Piece state for rotation
export interface Piece {
    type: number;
    rotation: RotationState;
    x: number;
    y: number;
}

// Try to rotate a piece with SRS wall kicks
// Returns new piece state if successful, null if blocked
export function tryRotate(
    board: number[][],
    piece: Piece,
    direction: 1 | -1
): Piece | null {
    const newRotation = rotateState(piece.rotation, direction);
    const kicks = getWallKicks(piece.type, piece.rotation, newRotation);
    const newShape = getShape(piece.type, newRotation);
    const cols = board[0]?.length ?? 0;
    const rows = board.length;

    for (const [dx, dy] of kicks) {
        const newX = piece.x + dx;
        const newY = piece.y + dy;

        let valid = true;
        for (let r = 0; r < newShape.length && valid; r++) {
            for (let c = 0; c < newShape[r].length && valid; c++) {
                if (newShape[r][c]) {
                    const boardX = newX + c;
                    const boardY = newY + r;
                    if (boardX < 0 || boardX >= cols || boardY >= rows) {
                        valid = false;
                    } else if (boardY >= 0 && board[boardY][boardX]) {
                        valid = false;
                    }
                }
            }
        }

        if (valid) {
            return { ...piece, x: newX, y: newY, rotation: newRotation };
        }
    }

    return null;
}
