import {Vector2} from "../vector.js";

const ControlKeys = {Left: 0b1, Up: 0b10, Right: 0b100, Down: 0b1000};

const DeadZone = 20;

export class MovementControl {
    player;
    node;

    controlKeys = 0;
    motionVector = new Vector2();

    /**
     * @param {IRenderObject} player
     * @param {HTMLElement} node
     */
    constructor(player, node) {
        this.player = player;
        this.player.impulse = new Vector2();
        this.node = node;
    }

    moveHandler(_, delta) {
        const motionScalar = this.motionVector.normalize().lengthSquared();
        if (motionScalar) {
            const motionImpulse = this.motionVector
                .scaled(motionScalar * 1000 * delta);

            this.player.impulse.add(motionImpulse);
        }

        this.player.impulse.scale(0.96);
        this.player.position.add(this.player.impulse.scaled(delta));
    }

    setup() {
        document.onkeydown = (e) => {
            if (e.target.nodeName.toLowerCase() === "input") return;

            switch (e.key) {
                case  "ArrowUp":
                case "w":
                    this.controlKeys |= ControlKeys.Up;
                    break;

                case  "ArrowDown":
                case "s":
                    this.controlKeys |= ControlKeys.Down;
                    break;

                case  "ArrowLeft":
                case "a":
                    this.controlKeys |= ControlKeys.Left;
                    break;

                case  "ArrowRight":
                case "d":
                    this.controlKeys |= ControlKeys.Right;
                    break;
            }

            this.#updateCameraMotionVector();
        }

        document.onkeyup = (e) => {
            if (e.target.nodeName.toLowerCase() === "input") return;

            switch (e.key) {
                case  "ArrowUp":
                case "w":
                    this.controlKeys &= ~ControlKeys.Up;
                    break;

                case  "ArrowDown":
                case "s":
                    this.controlKeys &= ~ControlKeys.Down;
                    break;

                case  "ArrowLeft":
                case "a":
                    this.controlKeys &= ~ControlKeys.Left;
                    break;

                case  "ArrowRight":
                case "d":
                    this.controlKeys &= ~ControlKeys.Right;
                    break;
            }

            this.#updateCameraMotionVector();
        }

        let initPos;
        this.node.ontouchstart = (e) => {
            e.preventDefault();

            initPos = {x: e.touches[0].clientX, y: e.touches[0].clientY};
        }
        this.node.ontouchend = (e) => {
            e.preventDefault();

            this.controlKeys = 0;
            this.#updateCameraMotionVector();
        }
        this.node.ontouchmove = (e) => {
            e.preventDefault();

            this.controlKeys = 0;

            const movementX = e.touches[0].clientX - initPos.x;
            if (Math.abs(movementX) > DeadZone) {
                this.controlKeys |= movementX < 0 ? ControlKeys.Left : ControlKeys.Right;
            }

            const movementY = e.touches[0].clientY - initPos.y;
            if (Math.abs(movementY) > DeadZone) {
                this.controlKeys |= movementY < 0 ? ControlKeys.Up : ControlKeys.Down;
            }

            this.#updateCameraMotionVector();
        }
    }

    #updateCameraMotionVector() {
        if (this.controlKeys & ControlKeys.Up) {
            this.motionVector.y = -1;
        } else if (this.controlKeys & ControlKeys.Down) {
            this.motionVector.y = 1;
        } else {
            this.motionVector.y = 0;
        }

        if (this.controlKeys & ControlKeys.Left) {
            this.motionVector.x = -1;
        } else if (this.controlKeys & ControlKeys.Right) {
            this.motionVector.x = 1;
        } else {
            this.motionVector.x = 0;
        }
    }
}