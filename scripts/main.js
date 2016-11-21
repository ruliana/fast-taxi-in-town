"use strict";

const BOARD_WIDTH = 640;
const BOARD_HEIGHT = 480;

const game = new Phaser.Game(BOARD_WIDTH, BOARD_HEIGHT, Phaser.AUTO, 'game');

const PhaserGame = function (game) {
    this.map = null;
    this.layer = null;
    this.car = null;
    this.enemy = null;

    this.enemySpeed = 200;
    this.enemyTurnSpeed = 200;

    this.current = Phaser.DOWN;

    this.stopPoints = [];

    this.gridsize = 32;
};

PhaserGame.prototype = {
    init: function () {
        this.physics.startSystem(Phaser.Physics.ARCADE)
    },

    preload: function () {
        this.load.tilemap('map', 'assets/maze.json', null, Phaser.Tilemap.TILED_JSON);
        this.load.image('tiles', 'assets/tiles.png');
        this.load.image('enemy', 'assets/taxi.png');
        this.load.atlasJSONArray('car', 'assets/police.png', 'assets/police.json')
    },

    create: function () {
        this.map = this.add.tilemap('map');
        this.map.addTilesetImage('tiles', 'tiles');

        this.layer = this.map.createLayer('Tile Layer 2');

        this.car = this.add.sprite(48, 48, 'car');
        this.car.anchor.set(0.5);
        this.car.width = this.gridsize * 0.6;
        this.car.height = this.gridsize * 0.8;
        this.car.angle = 180;
        this.car.animations.add('siren', [0, 2], 5, true);
        this.car.animations.play('siren');
        this.car.ready = true;
        this.car.destination = null;

        this.physics.arcade.enable(this.car);

        this.enemy = this.add.sprite(
            this.gridsize * 10 + this.gridsize / 2,
            this.gridsize + this.gridsize / 2,
            'enemy');
        this.enemy.anchor.set(0.5);
        this.enemy.width = this.gridsize * 0.6;
        this.enemy.height = this.gridsize * 0.8;

        this.enemy.angle = 180;
        this.enemy.face = Phaser.DOWN;
        this.enemy.ready = true;
        this.enemy.destination = null;

        this.physics.arcade.enable(this.enemy);

        this.cursors = this.input.keyboard.createCursorKeys();

        // Helpers for easy redirection
        this.cursors.left.direction = Phaser.LEFT;
        this.cursors.right.direction = Phaser.RIGHT;
        this.cursors.up.direction = Phaser.UP;
        this.cursors.down.direction = Phaser.DOWN;
    },

    update: function () {
        this.physics.arcade.collide(this.car, this.layer);
        this.physics.arcade.collide(this.enemy, this.layer);
        this.physics.arcade.overlap(this.car, this.enemy, this.gotcha, null, this);

        this.stopPoints = this.findStopPoints(this.car);
        this.moveCar();
        this.moveEnemy();
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

    gotcha: function () {
        console.log("TODO: Explode");
        this.enemy.kill();
    },

    moveCar: function () {
        let car = this.car;
        if (!car.ready || this.currentTile(car).properties.turnPoint !== "true") return;

        let stopPoints = this.findStopPoints(car);
        let c = this.cursors;
        let keyPressed = [c.left, c.right, c.up, c.down].find(k => k.isDown);
        if (keyPressed == null) return;

        let direction = keyPressed.direction;
        let goTo = stopPoints[direction];

        if (goTo === null) return;

        this.moveObject(car, goTo);
    },

    moveEnemy: function (enemy = this.enemy) {
        if (!enemy.ready || this.currentTile(enemy).properties.turnPoint !== "true") return;

        let stopPoints = this.findStopPoints(enemy);
        let validDestinations = stopPoints.filter(e => e !== null);
        let goTo = validDestinations[this.game.rnd.integerInRange(0, validDestinations.length - 1)];

        this.moveObject(enemy, goTo);
    },

    moveObject: function (someObject, goTo) {
        someObject.ready = false;
        someObject.destination = goTo;

        let x = goTo.worldX + this.gridsize / 2;
        let y = goTo.worldY + this.gridsize / 2;

        let time = this.math.distance(someObject.x, someObject.y, x, y) / this.gridsize;
        let duration = time * this.enemySpeed;
        this.add.tween(someObject).to({x: x, y: y}, duration, Phaser.Easing.Linear.InOut, true)
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
        this.add.tween(someObject).to({rotation: toRotation}, this.enemyTurnSpeed, Phaser.Easing.Linear.InOut, true);
    },

    currentTile: function (someObject = this.car) {
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

