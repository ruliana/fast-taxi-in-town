var game = new Phaser.Game(640, 480, Phaser.AUTO, 'game');

var PhaserGame = function (game) {
    this.map = null;
    this.layer = null;
    this.car = null;

    this.current = Phaser.UP;
    this.turning = Phaser.NONE;

    this.turnPoint = new Phaser.Point();

    this.marker = new Phaser.Point();
    this.directions = [null, null, null, null, null];

    this.speed = 150;
    this.turnSpeed = 148;
    this.turnTolerance = 3;

    this.opposites = [Phaser.NONE, Phaser.RIGHT, Phaser.LEFT, Phaser.DOWN, Phaser.UP];

    this.gridsize = 32;

    this.wall = 20;
};

PhaserGame.prototype = {
    init: function () {
        this.physics.startSystem(Phaser.Physics.ARCADE)
    },

    preload: function () {
        this.load.tilemap('map', 'assets/maze.json', null, Phaser.Tilemap.TILED_JSON);
        this.load.image('tiles', 'assets/tiles.png');
        this.load.image('car', 'assets/car.png');
    },

    create: function () {
        this.map = this.add.tilemap('map');
        this.map.addTilesetImage('tiles', 'tiles');

        this.layer = this.map.createLayer('Tile Layer 1');

        this.map.setCollision(this.wall, true, this.layer);

        this.car = this.add.sprite(48, 48, 'car');
        this.car.anchor.set(0.5);

        this.physics.arcade.enable(this.car);

        this.cursors = this.input.keyboard.createCursorKeys();

        this.move(Phaser.DOWN);
    },

    update: function () {
        this.physics.arcade.collide(this.car, this.layer);

        this.marker.x = this.math.snapToFloor(Math.floor(this.car.x), this.gridsize) / this.gridsize;
        this.marker.y = this.math.snapToFloor(Math.floor(this.car.y), this.gridsize) / this.gridsize;

        var i = this.layer.index;
        var x = this.marker.x;
        var y = this.marker.y;

        this.directions[Phaser.LEFT] = this.map.getTileLeft(i, x, y);
        this.directions[Phaser.RIGHT] = this.map.getTileRight(i, x, y);
        this.directions[Phaser.UP] = this.map.getTileAbove(i, x, y);
        this.directions[Phaser.DOWN] = this.map.getTileBelow(i, x, y);

        this.checkKeys();

        if (this.turning !== Phaser.NONE) {
            this.turn();
        }
    },

    render: function () {
        for (var t = 1; t < 5; t++) {
            if (this.directions[t] === null) {
                continue;
            }

            var color = 'rgba(0,255,0,0.3)';

            if (this.directions[t].index === this.wall) {
                color = 'rgba(255,0,0,0.3)';
            }

            if (t === this.current) {
                color = 'rgba(255,255,255,0.3)';
            }

            this.game.debug.geom(new Phaser.Rectangle(this.directions[t].worldX, this.directions[t].worldY, 32, 32), color, true);
        }

        this.game.debug.geom(this.turnPoint, '#ffff00');
    },

    turn: function () {
        var cx = Math.floor(this.car.x);
        var cy = Math.floor(this.car.y);

        if (!this.math.fuzzyEqual(cx, this.turnPoint.x, this.turnTolerance) ||
            !this.math.fuzzyEqual(cy, this.turnPoint.y, this.turnTolerance)) {

            return false;
        }

        this.car.x = this.turnPoint.x;
        this.car.y = this.turnPoint.y;

        this.car.body.reset(this.turnPoint.x, this.turnPoint.y);

        this.move(this.turning);

        this.turning = Phaser.NONE;

        return true;
    },

    move: function (direction) {
        var speed = this.speed;

        if (direction === Phaser.LEFT || direction === Phaser.UP) {
            speed = -speed;
        }

        if (direction === Phaser.LEFT || direction === Phaser.RIGHT) {
            this.car.body.velocity.x = speed;
        } else {
            this.car.body.velocity.y = speed;
        }

        this.add.tween(this.car).to({angle: this.getAngle(direction)}, this.turnSpeed, 'Linear', true);
        this.current = direction;
    },

    getAngle: function (to) {
        if (to === Phaser.UP) return 0;
        if (this.current === Phaser.DOWN && to === Phaser.RIGHT) return -270;
        if (this.current === Phaser.LEFT && to === Phaser.DOWN) return -180;
        if (to === Phaser.LEFT) return -90;
        if (to === Phaser.RIGHT) return 90;

        return 180;
    },

    checkKeys: function () {
        if (this.cursors.left.isDown && this.current !== Phaser.LEFT) {
            this.checkDirection(Phaser.LEFT);
        } else if (this.cursors.right.isDown && this.current !== Phaser.RIGHT) {
            this.checkDirection(Phaser.RIGHT);
        } else if (this.cursors.up.isDown && this.current !== Phaser.UP) {
            this.checkDirection(Phaser.UP);
        } else if (this.cursors.down.isDown && this.current !== Phaser.DOWN) {
            this.checkDirection(Phaser.DOWN);
        }
    },

    checkDirection: function (turnTo) {
        if (this.turning === turnTo ||
            this.directions[turnTo] === null ||
            this.directions[turnTo].index === this.wall) {

            return;
        }

        if (this.current === this.opposites[turnTo]) {
            this.move(turnTo);
        } else {
            this.turning = turnTo;

            this.turnPoint.x = (this.marker.x * this.gridsize) + (this.gridsize / 2);
            this.turnPoint.y = (this.marker.y * this.gridsize) + (this.gridsize / 2);
        }
    }
};

game.state.add('Game', PhaserGame, true);

