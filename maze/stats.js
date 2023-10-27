export class GameStats {
    #score = 0;
    #health = 0;
    #lights = 0;
    #count = 0;


    get score() {return this.#score;}
    set score(value) {
        this.#score = value;
        document.getElementById("score").textContent = value.toFixed(0);
    }
    get health() {return this.#health;}
    set health(value) {
        this.#health = value;
        document.getElementById("health").textContent = value.toFixed(0);
    }
    get lights() {return this.#lights;}
    set lights(value) {
        this.#lights = value;
        document.getElementById("lights").textContent = value.toString();
    }
    get count() {return this.#count;}
    set count(value) {
        this.#count = value;
        document.getElementById("count").textContent = value.toString();
    }
}