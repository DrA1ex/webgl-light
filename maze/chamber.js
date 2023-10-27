import {RectObject} from "../objects/rect.js";

const size = 340;
const width = 30;
const doorSize = 120;

export const MazeSide = {
    top: 0,
    bottom: 1,
    left: 2,
    right: 3,
}

export class MazeChamber {
    static size = size;

    /** @type {IRenderObject[][]} */
    walls;
    /** @type {IRenderObject[]} */
    doors;

    /**
     * @param {IRenderObject[]} objects
     * @param x
     * @param y
     */
    constructor(objects, x, y) {
        const blockSize1 = size / 2 - doorSize / 2 - width / 2;

        const top = [
            new RectObject(x - size / 2 + width / 2, y - size / 2, blockSize1, width),
            new RectObject(x + doorSize / 2, y - size / 2, blockSize1, width),
        ];
        const bottom = [
            new RectObject(x - size / 2 + width / 2, y + size / 2, blockSize1, width),
            new RectObject(x + doorSize / 2, y + size / 2, blockSize1, width),
        ];

        for (const body of [...top, ...bottom]) {
            body.position.x += blockSize1 / 2;
        }

        const blockSize2 = size / 2 - doorSize / 2 + width / 2;

        const left = [
            new RectObject(x - size / 2, y - size / 2 - width / 2, width, blockSize2),
            new RectObject(x - size / 2, y + doorSize / 2, width, blockSize2),
        ]

        const right = [
            new RectObject(x + size / 2, y - size / 2 - width / 2, width, blockSize2),
            new RectObject(x + size / 2, y + doorSize / 2, width, blockSize2),
        ]

        for (const body of [...left, ...right]) {
            body.position.y += blockSize2 / 2;
        }

        this.walls = [
            top,
            bottom,
            left,
            right
        ];

        this.doors = [
            new RectObject(x, y - size / 2, doorSize, width),
            new RectObject(x, y + size / 2, doorSize, width),
            new RectObject(x - size / 2, y, width, doorSize),
            new RectObject(x + size / 2, y, width, doorSize),
        ]

        for (const body of [...this.walls.flat(), ...this.doors]) {
            body.color = "#151515";
            objects.push(body);
        }
    }

    setDoor(side, enable) {
        this.#setEnabled(this.doors[side], enable);
    }

    setSide(side, enable) {
        for (const wall of this.walls[side]) {
            this.#setEnabled(wall, enable);
            this.setDoor(side, enable);
        }
    }

    #setEnabled(body, enable) {
        body.opacity = enable ? 1 : 0;
    }
}