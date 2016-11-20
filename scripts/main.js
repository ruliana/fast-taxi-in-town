"use strict";

const BOARD_WIDTH = 640;
const BOARD_HEIGHT = 480;

var game = new Phaser.Game(BOARD_WIDTH, BOARD_HEIGHT, Phaser.AUTO, 'game');

var PhaserGame = function (game) {
    this.map = null;
    this.layer = null;
    this.car = null;
    this.police = null;

    this.enemySpeed = 200;
    this.enemyTurnSpeed = 200;

    this.current = Phaser.DOWN;

    this.turnPoint = new Phaser.Point();

    this.stopPoints = [];

    this.gridsize = 32;

    this.turnTile = 2;
    this.wallTile = 20;
    this.wall = 20;
};

PhaserGame.prototype = {
    init: function () {
        this.physics.startSystem(Phaser.Physics.ARCADE)
    },

    preload: function () {
        this.load.tilemap('map', 'assets/maze.json', null, Phaser.Tilemap.TILED_JSON);
        this.load.image('tiles', 'assets/tiles.png');
        this.load.image('car', 'assets/taxi.png');
        this.load.atlasJSONArray('police', 'assets/police.png', 'assets/police.json')
    },

    create: function () {
        this.map = this.add.tilemap('map');
        this.map.addTilesetImage('tiles', 'tiles');

        this.layer = this.map.createLayer('Tile Layer 1');

        this.map.setCollision(this.wall, true, this.layer);

        this.car = this.add.sprite(48, 48, 'car');
        this.car.anchor.set(0.5);
        this.car.width = this.gridsize * 0.6;
        this.car.height = this.gridsize * 0.8;
        this.car.angle = 180;

        this.physics.arcade.enable(this.car);

        this.police = this.add.sprite(
            this.gridsize * 10 + this.gridsize / 2,
            this.gridsize + this.gridsize / 2,
            'police');
        this.police.anchor.set(0.5);
        this.police.width = this.gridsize * 0.6;
        this.police.height = this.gridsize * 0.8;

        this.police.animations.add('siren', [0, 2], 5, true);
        this.police.animations.play('siren');
        this.police.angle = 180;
        this.police.face = Phaser.DOWN;
        this.police.ready = true;
        this.police.destination = null;

        this.physics.arcade.enable(this.police);

        this.cursors = this.input.keyboard.createCursorKeys();

        // Warp
        this.cursors.left.direction = Phaser.LEFT;
        this.cursors.left.angle = -90;
        this.cursors.left.onDown.add(this.warp, this);

        this.cursors.right.direction = Phaser.RIGHT;
        this.cursors.right.angle = 90;
        this.cursors.right.onDown.add(this.warp, this);

        this.cursors.up.direction = Phaser.UP;
        this.cursors.up.angle = 0;
        this.cursors.up.onDown.add(this.warp, this);

        this.cursors.down.direction = Phaser.DOWN;
        this.cursors.down.angle = 180;
        this.cursors.down.onDown.add(this.warp, this);
    },

    update: function () {
        this.physics.arcade.collide(this.car, this.layer);
        this.physics.arcade.collide(this.police, this.layer);
        this.physics.arcade.overlap(this.car, this.police, this.gotcha, null, this);

        this.stopPoints = this.findStopPoints(this.car);

        this.moveEnemy();
    },

    render: function () {
        let good = 'rgba(0,255,0,0.3)';
        let bad = 'rgba(255,0,0,0.3)';
        for (let tile of this.stopPoints.filter(t => t !== null)) {
            this.game.debug.geom(new Phaser.Rectangle(tile.worldX, tile.worldY, 32, 32), good, true);
        }
        if (this.police.destination !== null) {
            let tile = this.police.destination;
            this.game.debug.geom(new Phaser.Rectangle(tile.worldX, tile.worldY, 32, 32), bad, true);
        }
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
            if (tile.index === this.wallTile) return null;
            if (tile.index === this.turnTile) return tile;
        }
        return null; // Not found
    },

    gotcha: function () {
        console.log("TODO: Explode");
        this.car.kill();
    },

    moveEnemy: function (enemy = this.police) {
        if (!enemy.ready || this.currentTile(enemy).index !== this.turnTile) return;
        enemy.ready = false;

        let stopPoints = this.findStopPoints(enemy);
        let validDestinations = stopPoints.filter(e => e !== null);
        let goTo = validDestinations[this.game.rnd.integerInRange(0, validDestinations.length - 1)];

        enemy.destination = goTo;

        let x = goTo.worldX + this.gridsize / 2;
        let y = goTo.worldY + this.gridsize / 2;

        let time = this.math.distance(enemy.x, enemy.y, x, y) / this.gridsize;
        let duration = time * this.enemySpeed;
        this.add.tween(enemy).to({x: x, y: y}, duration, Phaser.Easing.Linear.InOut, true)
            .onComplete.add(() => enemy.ready = true);

        // Shortest rotation toward tile
        let toRotation = this.math.angleBetween(enemy.x, enemy.y, x, y) + Math.PI / 2;
        if (toRotation >= 3 * Math.PI / 2) {
            toRotation = -(Math.PI / 2);
        } else if (toRotation === Math.PI / 2 && enemy.rotation === -Math.PI) {
            toRotation = -(3 * Math.PI / 2);
        } else if (toRotation === Math.PI && enemy.rotation === -Math.PI) {
            toRotation = enemy.rotation;
        } else if (toRotation === Math.PI && enemy.rotation === -(Math.PI / 2)) {
            toRotation = -Math.PI;
        }
        this.add.tween(enemy).to({rotation: toRotation}, this.enemyTurnSpeed, Phaser.Easing.Linear.InOut, true);
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

    getAngle: function (to, someObject = this.current) {
        if (to === Phaser.UP) return 0;
        if (someObject === Phaser.DOWN && to === Phaser.RIGHT) return -270;
        if (someObject === Phaser.LEFT && to === Phaser.DOWN) return -180;
        if (to === Phaser.LEFT) return -90;
        if (to === Phaser.RIGHT) return 90;

        return 180;
    },

    warp: function (keyPressed) {
        if (this.currentTile().index !== this.turnTile) return;

        let direction = keyPressed.direction;
        if (this.stopPoints[direction] !== null) {
            let x = this.stopPoints[direction].worldX + this.gridsize / 2;
            let y = this.stopPoints[direction].worldY + this.gridsize / 2;

            this.add.tween(this.car).to({x: x, y: y}, 300, Phaser.Easing.Circular.InOut, true);
            if (direction !== this.current)
                this.add.tween(this.car).to({angle: this.getAngle(direction)}, 150, Phaser.Easing.Circular.InOut, true);

            this.current = direction;
        }
    },
};

game.state.add('Game', PhaserGame, true);

