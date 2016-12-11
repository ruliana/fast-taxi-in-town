"use strict";

// Exclusive max
function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

Array.prototype.last = function () {
    return this[this.length - 1];
};

Array.prototype.first = function () {
    return this[0];
};

Array.prototype.randomIndex = function () {
    return randomInteger(0, this.length);
};

Array.prototype.randomCutPoint = function () {
    return new CutPoint(this);
};

Array.prototype.sample = function () {
    return this[this.randomIndex()];
};

Array.prototype.sampleGauss = function () {
    const a = this.length; // vertical
    const b = 0;  // middle
    const c = 0.25; // width
    const x = Math.random();

    let i = Math.floor(a * Math.exp(-(Math.pow(x - b, 2) / (2 * Math.pow(c, 2)))));
    return this[i];
};

class CutPoint {
    constructor(anArray, cutPoint = anArray.randomIndex()) {
        this.anArray = anArray;
        this.cutPoint = cutPoint;
    }

    slice() {
        let left = this.anArray.slice(0, this.cutPoint);
        let right = this.anArray.slice(this.cutPoint);
        return [left, right];
    }

    insert(value) {
        let [left, right] = this.slice();
        return left.concat([value]).concat(right);
    }

    remove() {
        let [left, right] = this.slice();
        return left.concat(right.slice(1));
    }

    replace(value) {
        let [left, right] = this.slice();
        return left.concat([value]).concat(right.slice(1));
    }
}

class TaskDoing {
    constructor() {
        this.startInMillis = Date.now();
        this.steps = [];
        this.moves = 0;
        this.misses = 0;
        this.actions = [];

        let action = game => {
            while (game.hero.children.length > 0) {
                game.hero.removeChildAt(game.hero.children.length - 1);
            }
        };
        this.actions.push(action);
    }

    lastStep() {
        return this.steps.last();
    }

    push(step) {
        this.steps.push(step);

        let action = game => {
            let y = -8 + (-6 * this.steps.length);
            let pancake = game.add.sprite(-16, y, 'pancakes');
            pancake.frame = step - 1;
            game.hero.addChild(pancake);
        };
        this.actions.push(action);
    }

    pop(step) {
        this.misses += 1;
        let rslt = this.steps.pop(step);

        let action = game => {
            game.hero.removeChildAt(game.hero.children.length - 1);
        };
        this.actions.push(action);

        return rslt;
    }

    matchesSteps(steps) {
        if (this.steps.length != steps.length) return false;
        for (let i = 0; i < steps.length; i++) {
            if (this.steps[i] !== steps[i]) return false;
        }
        return true;
    }

    movePlus(number) {
        this.moves += number;
    }

    moveCount() {
        return this.moves;
    }

    missesCount() {
        return this.misses;
    }

    toString() {
        return this.steps.join(", ");
    }

    update(game) {
        while (this.actions.length > 0) {
            let action = this.actions.shift();
            action(game);
        }
    }
}

class Task {
    constructor(time, steps) {
        this.time = time;
        this.steps = steps;
    }

    toString() {
        return this.steps.join(", ");
    }

    matches(doing) {
        return doing.matchesSteps(this.steps);
    }

    createSprite(game) {
        let rslt = game.add.sprite(0, 0, 'pancakes');
        rslt.frame = this.steps[0] - 1;
        for (let i = 1; i < this.steps.length; i++) {
            let child = game.add.sprite(0, -6 * i, 'pancakes');
            child.frame = this.steps[i] - 1;
            rslt.addChild(child);
        }
        return rslt;
    }

    breedWith(otherTask) {
        return otherTask.randomMix(this.steps);
    }

    randomMix(steps) {
        let cutPoint = Math.random();

        let cutPointThis = Math.floor(this.steps.length * cutPoint);
        let stepsThis = this.steps.slice(0, cutPointThis);

        let cutPointThat = Math.floor(steps.length * cutPoint);
        let stepsThat = steps.slice(cutPointThat);

        let rsltSteps = stepsThis.concat(stepsThat);
        return new Task(this.time, rsltSteps).repair();
    }

    mutate() {
        if (Math.random() >= 0.1) return this; // Chance of mutation
        let add = steps => steps.randomCutPoint().insert([1, 2, 3].sample());
        let remove = steps => steps.randomCutPoint().remove();
        let replace = steps  => steps.randomCutPoint().replace([1, 2, 3].sample());
        let action = [add, remove, replace].sample();
        let rsltSteps = action(this.steps);
        return new Task(this.time, rsltSteps).repair();
    }

    repair() {
        if (this.steps.length <= 1) return this;

        let rslt = this.steps.slice();

        if (this.steps.length == 2) {
           rslt[1] = [1, 2, 3].filter(e => e !== this.steps.first()).sample();
        } else {
            for (let i = 1; i < this.steps.length - 1; i++) {
                let a = rslt[i - 1];
                let b = rslt[i];
                let c = rslt[i + 1];
                if (a === b || b === c) {
                    rslt[i] = [1, 2, 3].filter(e => e !== a && e !== c).sample();
                }
            }
        }

        return new Task(this.time, rslt);
    }
}

class TaskAnnotated {
    constructor(todo, done) {
        this.finishInMillis = Date.now();
        this.todo = todo;
        this.done = done;
    }

    get startInMillis() {
        return this.done.startInMillis;
    }

    correct() {
        return this.todo.matches(this.done);
    }

    incorrect() {
        return !this.correct();
    }

    difficulty() {
        return this.finishInMillis - this.startInMillis;
    }

    breedWith(other) {
        return this.todo.breedWith(other.todo);
    }
}

class TaskLibrary {
    constructor() {
        this.tasks = [];
    }

    push(taskAnnotated) {
        this.tasks.push(taskAnnotated);
        // Best fit
        this.tasks.sort((a, b) => {
            if (a.correct() && b.incorrect()) return -1;
            if (b.correct() && a.incorrect()) return 1;
            return a.difficulty() - b.difficulty();
        });
        this.tasks = this.tasks.slice(0, 10);
    }

    newTask() {
        if (this.tasks.length <= 2) return this.randomTask();
        let [a, b] = this.selectBest();
        return a.breedWith(b).mutate();
    }

    randomTask() {
        let size = game.rnd.between(1, 6);
        let rslt = [];
        for (let i = 1; i <= size; i++) {
            let e = game.rnd.between(1, 3);
            if (rslt.length == 0 || rslt.last() !== e)
                rslt.push(e);
        }
        return new Task(1, rslt);
    }

    correctCount() {
        return this.tasks.filter(e => e.correct()).length;
    }

    incorrectCount() {
        return this.tasks.length - this.correctCount();
    }

    selectBest() {
        return [this.tasks.sampleGauss(),
                this.tasks.sampleGauss()];
    }
}

class TaskBoard {
    constructor(tasks = []) {
        this.tasks= tasks;
        this.sprites = [];
        this.actions = [];
    }

    push(task) {
        this.tasks.push(task);

        let len = this.tasks.length;
        let action = game => {
            let sprite = task.createSprite(game);
            sprite.x = 32 * len;
            sprite.y = 80;
            this.sprites.push(sprite);
        };
        this.actions.push(action);
    }

    complete(task) {
        let first = this.tasks.shift();
        let rslt = new TaskAnnotated(first, task);

        let action = game => {
            let tweens = this.sprites
                .map(sp => game.add.tween(sp).to({x: sp.x - 32},
                                                 200,
                                                 Phaser.Easing.Circular.InOut,
                                                 true));
            let done = this.sprites.shift();
            tweens[0].onComplete.add(() => done.kill());
        };
        this.actions.push(action);

        return rslt;
    }

    toString() {
        return this.tasks.map(e => e.toString()).join('\n');
    }

    update(game) {
        while (this.actions.length > 0) {
            let action = this.actions.shift();
            action(game);
        }
    }
 }


const BOARD_WIDTH = 640;
const BOARD_HEIGHT = 480;

const game = new Phaser.Game(BOARD_WIDTH, BOARD_HEIGHT, Phaser.AUTO, 'game');

const PhaserGame = function (game) {
    this.map = null;
    this.layer = null;
    this.hero = null;

    this.turnSpeed = 200;

    this.gridsize = 32;

    this.taskBoard = new TaskBoard();
    this.taskDoing = new TaskDoing();
    this.taskLibrary = new TaskLibrary();
};

PhaserGame.prototype = {
    init: function () {
        this.physics.startSystem(Phaser.Physics.ARCADE)
    },

    preload: function () {
        this.load.tilemap('map', 'assets/forest.json', null, Phaser.Tilemap.TILED_JSON);
        this.load.image('castle', 'assets/castle-tiles.png');
        this.load.spritesheet('pancakes', 'assets/pancakes.png', 32, 32);
        this.load.image('hero', 'assets/ninja-idle.png');
    },

    create: function () {
        this.map = this.add.tilemap('map');
        this.map.addTilesetImage('castle');
        this.map.addTilesetImage('pancakes');

        this.stage.backgroundColor = "#4488AA";
        this.map.createLayer('bkg');
        this.map.createLayer('bkg-decoration');
        this.map.createLayer('floor');
        this.map.createLayer('floor-front');
        this.layer = this.map.createLayer('stop-points');
        this.layer.visible = false;

        this.hero = this.add.sprite(this.gridsize * 10 + this.gridsize / 2,
                                    this.gridsize * 4 + this.gridsize / 2,
                                    'hero');
        this.hero.anchor.set(0.5);
        this.hero.ready = true;
        this.hero.destination = null;
        this.hero.tween = Phaser.Easing.Circular.Out;
        this.hero.speedBy = time => 100;

        this.physics.arcade.enable(this.hero);

        this.map.createLayer('decoration');
        this.map.createLayer('pancakes');

        // Tasks
        this.taskText = this.add.text(24, 48, "Orders:", {fontSize: '24px', fill: '#FFF'});
        this.debugText = this.add.text(160, 335, "Debug:", {fontSize: '16px', fill: '#FFF'});

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();

        // Helpers for easy redirection
        this.cursors.left.direction = Phaser.LEFT;
        this.cursors.right.direction = Phaser.RIGHT;
        this.cursors.up.direction = Phaser.UP;
        this.cursors.down.direction = Phaser.DOWN;

        // Starting
        this.taskBoard.push(new Task(1, [1, 2, 3]));
        this.taskBoard.push(new Task(1, [2, 3, 2]));
        this.taskBoard.update(this);
    },

    update: function () {
        this.physics.arcade.collide(this.hero, this.layer);
        this.move();
    },

    render: function () {
        // let good = 'rgba(0,255,0,0.3)';
        // let bad = 'rgba(255,0,0,0.3)';
        // for (let tile of this.stopPoints.filter(t => t !== null)) {
        //     this.game.debug.geom(new Phaser.Rectangle(tile.worldX, tile.worldY, 32, 32), good, true);
        // }
        // if (this.enemy.destination !== null) {
        //     let tile = this.enemy.destination;
        //     this.game.debug.geom(new Phaser.Rectangle(tile.worldX, tile.worldY, 32, 32), bad, true);
        // }
    },

    findStopPoints: function (someObject) {
        let x = someObject.x;
        let y = someObject.y;
        let toLeft = new Phaser.Line(0, y, x - this.gridsize, y);
        let leftStopPoint = this.findStopPointReverse(toLeft);
        let toRight = new Phaser.Line(x + this.gridsize, y, BOARD_WIDTH, y);
        let rightStopPoint = this.findStopPoint(toRight);
        let toAbove = new Phaser.Line(x, 0, x, y - this.gridsize);
        let aboveStopPoint = this.findStopPointReverse(toAbove);
        let toBottom = new Phaser.Line(x, y + this.gridsize, x, BOARD_HEIGHT);
        let bottomStopPoint = this.findStopPoint(toBottom);

        return [null, leftStopPoint, rightStopPoint, aboveStopPoint, bottomStopPoint];
    },

    findStopPoint: function (line) {
        let tiles = this.layer.getRayCastTiles(line, 5);
        return this.detectStopPoint(tiles);
    },

    findStopPointReverse: function (line) {
        let tiles = this.layer.getRayCastTiles(line, 5);
        return this.detectStopPoint(tiles.reverse());
    },

    detectStopPoint: function (tiles) {
        for (let tile of tiles) {
            if (tile.properties.wall === "true") return null;
            if (tile.properties.turnPoint === "true") return tile;
        }
        return null; // Not found
    },

    pickup: function (tile) {
        if (tile == null) return;
        if (tile.properties.task == null) return;

        let taskMove = parseInt(tile.properties.task);
        let taskLastMove = this.taskDoing.lastStep();

        if (taskLastMove === taskMove) {
            this.taskDoing.pop();
        } else {
            this.taskDoing.push(taskMove);
        }
    },

    taskComplete: function () {
        let done = this.taskBoard.complete(this.taskDoing);

        this.taskLibrary.push(done);
        this.taskBoard.push(this.taskLibrary.newTask());
        this.taskDoing = new TaskDoing();
    },

    move: function () {
        let someObject = this.hero;
        if (!someObject.ready || !this.currentTile(someObject) ||
            this.currentTile(someObject).properties.turnPoint !== "true") return;

        let stopPoints = this.findStopPoints(someObject);
        let c = this.cursors;
        let keyPressed = [c.left, c.right, c.up, c.down].find(k => k.isDown);
        if (keyPressed == null) return;

        let direction = keyPressed.direction;
        let goTo = stopPoints[direction];

        if (goTo === null) return;

        this.moveObject(someObject, goTo);

        this.taskDoing.movePlus(1);
        if (goTo.properties.complete === "true") {
            this.taskComplete();
        } else {
            this.pickup(goTo);
        }
        this.debugText.text = "Debug:\n"
            + "Doing: " + this.taskDoing.toString() + "\n"
            + "Moves: " + this.taskDoing.moveCount() + "\n"
            + "Misses: " + this.taskDoing.missesCount() + "\n"
            + "Right/Wrong: " + this.taskLibrary.correctCount() + "/" + this.taskLibrary.incorrectCount() + "\n";
    },

    moveObject: function (someObject, goTo) {
        someObject.ready = false;
        someObject.destination = goTo;

        let x = goTo.worldX + this.gridsize / 2;
        let y = goTo.worldY + this.gridsize / 2;

        let time = this.math.distance(someObject.x, someObject.y, x, y) / this.gridsize;
        let duration = someObject.speedBy(time);
        let tween = someObject.tween;
        this.add.tween(someObject).to({x: x, y: y}, duration, tween, true)
            .onComplete.add(() => { someObject.ready = true;
                                    this.taskDoing.update(this);
                                    this.taskBoard.update(this); });
    },

    currentTile: function (someObject = this.hero) {
        let [x, y] = this.xyTileFor(someObject);
        let i = this.layer.index;
        return this.map.getTile(x, y, i);
    },

    xyTileFor: function (someObject) {
        let x = this.math.snapToFloor(Math.floor(someObject.x), this.gridsize) / this.gridsize;
        let y = this.math.snapToFloor(Math.floor(someObject.y), this.gridsize) / this.gridsize;
        return [x, y];
    },
};

game.state.add('Game', PhaserGame, true);

