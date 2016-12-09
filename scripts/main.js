"use strict";
Array.prototype.last = function () {
    return this[this.length - 1];
};

class TaskDoing {
    constructor() {
        this.timeInMillis = Date.now();
        this.steps = [];
        this.moves = 0;
    }

    lastStep() {
        return this.steps.last();
    }

    push(step) {
        this.steps.push(step);
    }

    pop(step) {
        return this.steps.pop(step);
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

    toString() {
        return this.steps.join(", ");
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
}

class TaskAnnotated {
    constructor(todo, done) {
        this.finishInMillis = Date.now();
        this.todo = todo;
        this.done = done;
    }

    correct() {
        return this.todo.matches(this.done);
    }

    difficulty() {
        return 1.0;
    }
}

class TaskLibrary {
    constructor() {
        this.tasks = [];
    }

    push(taskAnnotated) {
        this.tasks.push(taskAnnotated);
    }

    newTask() {
        let size = game.rnd.between(1, 6);
        let rslt = [];
        for (let i = 1; i <= size; i++) {
            let e = game.rnd.between(1, 3);
            if (rslt.length == 1 || rslt.last() !== e)
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
}

class TaskBoard {
    constructor(tasks = []) {
        this.tasks= tasks;
    }

    push(task) {
        this.tasks.push(task);
    }

    complete(task) {
        let first = this.tasks.shift();
        return new TaskAnnotated(first, task);
    }

    toString() {
        return this.tasks.map(e => e.toString()).join('\n');
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
    this.taskBoard.push(new Task(1, [1, 2, 3]));
    this.taskBoard.push(new Task(1, [2, 3, 2]));

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
        this.load.image('potions', 'assets/potions.png');
        this.load.atlasJSONArray('hero', 'assets/police.png', 'assets/police.json')
    },

    create: function () {
        this.map = this.add.tilemap('map');
        this.map.addTilesetImage('castle', 'castle');
        this.map.addTilesetImage('potions', 'potions');

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
        this.hero.width = this.gridsize * 0.6;
        this.hero.height = this.gridsize * 0.8;
        this.hero.angle = 180;
        this.hero.animations.add('siren', [0, 2], 5, true);
        this.hero.animations.play('siren');
        this.hero.ready = true;
        this.hero.destination = null;
        this.hero.tween = Phaser.Easing.Circular.Out;
        this.hero.speedBy = time => 100;

        this.physics.arcade.enable(this.hero);

        this.map.createLayer('decoration');

        // Tasks
        let taskTexts = this.taskBoard.toString();
        this.taskText = this.add.text(16, 16, "Tasks:\n" + taskTexts, {fontSize: '24px', fill: '#FFF'});
        this.debugText = this.add.text(160, 335, "Debug:", {fontSize: '16px', fill: '#FFF'});

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();

        // Helpers for easy redirection
        this.cursors.left.direction = Phaser.LEFT;
        this.cursors.right.direction = Phaser.RIGHT;
        this.cursors.up.direction = Phaser.UP;
        this.cursors.down.direction = Phaser.DOWN;
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

        this.taskText.text = "Tasks:\n" + this.taskBoard.toString();
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
            + "C/I: " + this.taskLibrary.correctCount() + "/" + this.taskLibrary.incorrectCount() + "\n";
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
            .onComplete.add(() => someObject.ready = true);

        // Shortest rotation toward tile
        let toRotation = this.math.angleBetween(someObject.x, someObject.y, x, y) + Math.PI / 2;
        if (toRotation >= 3 * Math.PI / 2) {
            toRotation = -(Math.PI / 2);
        } else if (toRotation === Math.PI / 2 && someObject.rotation === -Math.PI) {
            toRotation = -(3 * Math.PI / 2);
        } else if (toRotation === Math.PI && someObject.rotation === -Math.PI) {
            toRotation = someObject.rotation;
        } else if (toRotation === Math.PI && someObject.rotation === -(Math.PI / 2)) {
            toRotation = -Math.PI;
        }
        this.add.tween(someObject).to({rotation: toRotation}, this.turnSpeed, Phaser.Easing.Linear.InOut, true);
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

