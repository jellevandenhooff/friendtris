import { describe, it, expect } from "vitest";
import {
    getShape,
    tryRotate,
    TETROMINOS,
    RotationState,
} from "./tetrominos";

// Piece indices
const I = 0, O = 1, T = 2, S = 3, Z = 4, J = 5, L = 6;

// Parse an ASCII board that contains a piece
// '.' = empty, '#' = locked cell, 'X' = piece cell, '@' = piece center
function parseScene(ascii: string, pieceType: number): {
    board: number[][];
    piece: { type: number; x: number; y: number; rotation: RotationState };
} {
    const lines = ascii
        .trim()
        .split("\n")
        .map((line) => line.trim());

    // Find piece cells and rotation center
    const pieceCells: { row: number; col: number }[] = [];
    let centerPos: { row: number; col: number } | null = null;

    for (let row = 0; row < lines.length; row++) {
        for (let col = 0; col < lines[row].length; col++) {
            const char = lines[row][col];
            if (char === "@") {
                centerPos = { row, col };
                pieceCells.push({ row, col });
            } else if (char === "X") {
                pieceCells.push({ row, col });
            }
        }
    }

    // Build board without piece
    const board = lines.map((line) =>
        [...line].map((c) => {
            if (c === "#") return 8;
            return 0;
        })
    );

    if (!centerPos || pieceCells.length === 0) {
        throw new Error("Scene must have @ center marker and piece cells");
    }

    // Find which rotation state matches the piece cells AND center position
    for (let rot = 0; rot < 4; rot++) {
        const shapeAscii = TETROMINOS[pieceType].shapes[rot];
        const shape = getShape(pieceType, rot as RotationState);

        // Find center position in shape (marked with 'O')
        let shapeCenterRow = -1;
        let shapeCenterCol = -1;
        const shapeLines = shapeAscii.trim().split("\n").map((l) => l.trim());
        for (let r = 0; r < shapeLines.length; r++) {
            const idx = shapeLines[r].indexOf("O");
            if (idx !== -1) {
                shapeCenterRow = r;
                shapeCenterCol = idx;
                break;
            }
        }

        const px = centerPos.col - shapeCenterCol;
        const py = centerPos.row - shapeCenterRow;

        // Verify all cells match
        const shapeCells: { row: number; col: number }[] = [];
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    shapeCells.push({ row: py + r, col: px + c });
                }
            }
        }

        if (shapeCells.length === pieceCells.length) {
            const matches = shapeCells.every((sc) =>
                pieceCells.some((pc) => pc.row === sc.row && pc.col === sc.col)
            );
            if (matches) {
                return {
                    board,
                    piece: { type: pieceType, x: px, y: py, rotation: rot as RotationState },
                };
            }
        }
    }

    throw new Error(`Could not match piece to any rotation state`);
}

// Render a scene back to ASCII for comparison
function renderScene(
    board: number[][],
    piece: { type: number; x: number; y: number; rotation: RotationState }
): string {
    const result = board.map((row) =>
        row.map((cell) => (cell === 0 ? "." : "#"))
    );

    const shape = getShape(piece.type, piece.rotation);

    // Find center position in shape
    const shapeAscii = TETROMINOS[piece.type].shapes[piece.rotation];
    const shapeLines = shapeAscii.trim().split("\n").map((l) => l.trim());
    let centerR = -1, centerC = -1;
    for (let r = 0; r < shapeLines.length; r++) {
        const idx = shapeLines[r].indexOf("O");
        if (idx !== -1) {
            centerR = r;
            centerC = idx;
            break;
        }
    }

    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) {
                const y = piece.y + r;
                const x = piece.x + c;
                if (y >= 0 && y < result.length && x >= 0 && x < result[0].length) {
                    // Use @ for center, X for others
                    result[y][x] = (r === centerR && c === centerC) ? "@" : "X";
                }
            }
        }
    }

    return result.map((row) => row.join("")).join("\n");
}

// Main test helper: verify rotation from before -> after ASCII
function expectRotation(
    pieceType: number,
    before: string,
    after: string,
    direction: 1 | -1 = 1
): void {
    const { board, piece } = parseScene(before, pieceType);

    const result = tryRotate(board, piece, direction);
    const expected = parseScene(after, pieceType);

    expect(result).not.toBeNull();
    const actualScene = renderScene(board, result!);
    const expectedScene = renderScene(expected.board, expected.piece);
    expect(actualScene).toBe(expectedScene);
}

// ============================================================================
// Tests
// ============================================================================

describe("T piece rotation", () => {
    it("rotates clockwise in open space", () => {
        expectRotation(T,
            `
            .....
            .X...
            X@X..
            .....
            `,
            `
            .....
            .X...
            .@X..
            .X...
            `
        );
    });

    it("rotates counter-clockwise in open space", () => {
        expectRotation(T,
            `
            .....
            .X...
            X@X..
            .....
            `,
            `
            .....
            .X...
            X@...
            .X...
            `,
            -1
        );
    });

    it("wall kicks right when against left wall", () => {
        // T in L-state (state 3) at left edge, rotating CW to state 0
        // SRS kicks it right to fit
        expectRotation(T,
            `
            .....
            X....
            @X...
            X....
            `,
            `
            .....
            .....
            X@X..
            .X...
            `
        );
    });

    it("wall kicks left when against right wall", () => {
        // T in R-state (state 1) at right edge, rotating CCW to state 0
        expectRotation(T,
            `
            .....
            ...X.
            ...@X
            ...X.
            `,
            `
            .....
            ...X.
            ..X@X
            .....
            `,
            -1
        );
    });
});

describe("I piece rotation", () => {
    it("rotates horizontal to vertical", () => {
        expectRotation(I,
            `
            ......
            ......
            .X@XX.
            ......
            ......
            ......
            `,
            `
            ......
            ....X.
            ....@.
            ....X.
            ....X.
            ......
            `
        );
    });

    it("rotates vertical to horizontal", () => {
        // I in state 3 (left vertical), rotating CW to state 0
        expectRotation(I,
            `
            ......
            .X....
            .X....
            .@....
            .X....
            ......
            `,
            `
            ......
            ......
            ......
            X@XX..
            ......
            ......
            `
        );
    });
});

describe("S piece rotation", () => {
    it("rotates clockwise", () => {
        expectRotation(S,
            `
            .....
            .XX..
            X@...
            .....
            `,
            `
            .....
            .X...
            .@X..
            ..X..
            `
        );
    });

    it("rotates counter-clockwise", () => {
        expectRotation(S,
            `
            .....
            .XX..
            X@...
            .....
            `,
            `
            .....
            X....
            X@...
            .X...
            `,
            -1
        );
    });
});

describe("Z piece rotation", () => {
    it("rotates clockwise", () => {
        expectRotation(Z,
            `
            .....
            XX...
            .@X..
            .....
            `,
            `
            .....
            ..X..
            .@X..
            .X...
            `
        );
    });

    it("rotates counter-clockwise", () => {
        expectRotation(Z,
            `
            .....
            XX...
            .@X..
            .....
            `,
            `
            .....
            .X...
            X@...
            X....
            `,
            -1
        );
    });
});

describe("J piece rotation", () => {
    it("rotates clockwise", () => {
        expectRotation(J,
            `
            .....
            X....
            X@X..
            .....
            `,
            `
            .....
            .XX..
            .@...
            .X...
            `
        );
    });
});

describe("L piece rotation", () => {
    it("rotates clockwise", () => {
        expectRotation(L,
            `
            .....
            ..X..
            X@X..
            .....
            `,
            `
            .....
            .X...
            .@...
            .XX..
            `
        );
    });
});

describe("O piece rotation", () => {
    it("stays in place (O doesn't change shape)", () => {
        expectRotation(O,
            `
            .....
            .XX..
            .@X..
            .....
            `,
            `
            .....
            .XX..
            .@X..
            .....
            `
        );
    });
});

describe("blocked rotations", () => {
    it("fails when completely surrounded", () => {
        const { board, piece } = parseScene(`
            #####
            #X###
            X@X##
            #####
        `, T);
        const result = tryRotate(board, piece, 1);
        expect(result).toBeNull();
    });

    it("fails when all kick positions blocked", () => {
        const { board, piece } = parseScene(`
            .###.
            ##X##
            #X@X#
            #####
        `, T);
        const result = tryRotate(board, piece, 1);
        expect(result).toBeNull();
    });
});

describe("wall kick scenarios", () => {
    it("T kicks up off floor when needed", () => {
        // T in state 2, at floor, rotating CCW - needs floor kick
        expectRotation(T,
            `
            .....
            .....
            .X@X.
            ..X..
            `,
            `
            .....
            ..X..
            ..@X.
            ..X..
            `,
            -1
        );
    });

    it("T rotates into overhang", () => {
        // T in state 0 (spawn), rotates CCW into L-state
        expectRotation(T,
            `
            .....
            ##X..
            #X@X.
            #....
            `,
            `
            .....
            ##X..
            #X@..
            #.X..
            `,
            -1
        );
    });
});

describe("shape consistency", () => {
    it("all pieces have exactly 4 cells in each rotation", () => {
        for (let pieceIdx = 0; pieceIdx < 7; pieceIdx++) {
            for (let rot = 0; rot < 4; rot++) {
                const shape = getShape(pieceIdx, rot as RotationState);
                const cellCount = shape.flat().filter((c) => c === 1).length;
                expect(cellCount).toBe(4);
            }
        }
    });
});

describe("I piece wobble", () => {
    // The I piece "wobbles" - it shifts position during rotation due to
    // asymmetric SRS offset data. This test shows all 4 rotation steps.

    it("state 0 -> 1: shifts right", () => {
        expectRotation(I,
            `
            ......
            ......
            .X@XX.
            ......
            ......
            `,
            `
            ......
            ....X.
            ....@.
            ....X.
            ....X.
            `
        );
    });

    it("state 1 -> 2: shifts up", () => {
        // State 1 has center at row 1 of shape, state 2 has center at row 2
        expectRotation(I,
            `
            ......
            ....X.
            ....@.
            ....X.
            ....X.
            `,
            `
            ......
            ......
            ..XX@X
            ......
            ......
            `
        );
    });

    it("state 2 -> 3: shifts left", () => {
        // State 2 has center at col 2 of shape, state 3 has center at col 1
        expectRotation(I,
            `
            ......
            ......
            ..XX@X
            ......
            ......
            `,
            `
            ..X...
            ..X...
            ..@...
            ..X...
            ......
            `
        );
    });

    it("state 3 -> 0: shifts down (back to start)", () => {
        expectRotation(I,
            `
            ..X...
            ..X...
            ..@...
            ..X...
            ......
            `,
            `
            ......
            ......
            .X@XX.
            ......
            ......
            `
        );
    });
});

describe("O piece no wobble", () => {
    it("rotation does not change position", () => {
        expectRotation(O,
            `
            .....
            .XX..
            .@X..
            .....
            `,
            `
            .....
            .XX..
            .@X..
            .....
            `
        );
    });
});
